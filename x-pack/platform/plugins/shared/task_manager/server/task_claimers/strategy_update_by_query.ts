/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * This module contains helpers for managing the task manager storage layer.
 */
import apm from 'elastic-apm-node';
import type { Subject } from 'rxjs';
import { groupBy, pick } from 'lodash';

import { asOk } from '../lib/result_type';
import type { TaskTypeDictionary } from '../task_type_dictionary';
import type { TaskClaimerOpts, ClaimOwnershipResult } from '.';
import { getEmptyClaimOwnershipResult, isTaskTypeExcluded } from '.';
import type { ConcreteTaskInstance } from '../task';
import { TASK_MANAGER_TRANSACTION_TYPE } from '../task_running';
import { isLimited, TASK_MANAGER_MARK_AS_CLAIMED } from '../queries/task_claiming';
import type { TaskClaim } from '../task_events';
import { asTaskClaimEvent, startTaskTimer } from '../task_events';
import { shouldBeOneOf, mustBeAllOf, filterDownBy, matchesClauses } from '../queries/query_clauses';

import {
  updateFieldsAndMarkAsFailed,
  IdleTaskWithExpiredRunAt,
  InactiveTasks,
  RunningOrClaimingTaskWithExpiredRetryAt,
  getClaimSort,
  tasksClaimedByOwner,
  tasksOfType,
  EnabledTask,
} from '../queries/mark_available_tasks_as_claimed';

import type { TaskStore, UpdateByQueryResult, SearchOpts } from '../task_store';
import { correctVersionConflictsForContinuation } from '../task_store';

interface OwnershipClaimingOpts {
  claimOwnershipUntil: Date;
  size: number;
  taskTypes: Set<string>;
  taskStore: TaskStore;
  events$: Subject<TaskClaim>;
  definitions: TaskTypeDictionary;
  excludedTaskTypes: string[];
  taskMaxAttempts: Record<string, number>;
}

export async function claimAvailableTasksUpdateByQuery(
  opts: TaskClaimerOpts
): Promise<ClaimOwnershipResult> {
  const { getCapacity, claimOwnershipUntil, batches, events$, taskStore } = opts;
  const { definitions, excludedTaskTypes, taskMaxAttempts } = opts;
  const initialCapacity = getCapacity();

  let accumulatedResult = getEmptyClaimOwnershipResult();
  const stopTaskTimer = startTaskTimer();
  for (const batch of batches) {
    const capacity = Math.min(
      initialCapacity - accumulatedResult.stats.tasksClaimed,
      isLimited(batch) ? getCapacity(batch.tasksTypes) : getCapacity()
    );

    // if we have no more capacity, short circuit here
    if (capacity <= 0) {
      return accumulatedResult;
    }

    const result = await executeClaimAvailableTasks({
      claimOwnershipUntil,
      size: capacity,
      events$,
      taskTypes: isLimited(batch) ? new Set([batch.tasksTypes]) : batch.tasksTypes,
      taskStore,
      definitions,
      excludedTaskTypes,
      taskMaxAttempts,
    });

    accumulatedResult = accumulateClaimOwnershipResults(accumulatedResult, result);
    accumulatedResult.stats.tasksConflicted = correctVersionConflictsForContinuation(
      accumulatedResult.stats.tasksClaimed,
      accumulatedResult.stats.tasksConflicted,
      initialCapacity
    );
  }

  return { ...accumulatedResult, timing: stopTaskTimer() };
}

async function executeClaimAvailableTasks(
  opts: OwnershipClaimingOpts
): Promise<ClaimOwnershipResult> {
  const { taskStore, size, taskTypes, events$, definitions } = opts;
  const { updated: tasksUpdated, version_conflicts: tasksConflicted } =
    await markAvailableTasksAsClaimed(opts);

  const docs =
    tasksUpdated > 0 ? await sweepForClaimedTasks(taskStore, taskTypes, size, definitions) : [];

  emitEvents(
    events$,
    docs.map((doc) => asTaskClaimEvent(doc.id, asOk(doc)))
  );

  const stats = {
    tasksUpdated,
    tasksConflicted,
    tasksClaimed: docs.length,
  };

  return {
    stats,
    docs,
  };
}

function emitEvents(events$: Subject<TaskClaim>, events: TaskClaim[]) {
  events.forEach((event) => events$.next(event));
}

async function markAvailableTasksAsClaimed({
  definitions,
  excludedTaskTypes,
  taskStore,
  claimOwnershipUntil,
  size,
  taskTypes,
  taskMaxAttempts,
}: OwnershipClaimingOpts): Promise<UpdateByQueryResult> {
  const { taskTypesToSkip = [], taskTypesToClaim = [] } = groupBy(
    definitions.getAllTypes(),
    (type) =>
      taskTypes.has(type) && !isTaskTypeExcluded(excludedTaskTypes, type)
        ? 'taskTypesToClaim'
        : 'taskTypesToSkip'
  );
  const queryForScheduledTasks = mustBeAllOf(
    // Task must be enabled
    EnabledTask,
    // Either a task with idle status and runAt <= now or
    // status running or claiming with a retryAt <= now.
    shouldBeOneOf(IdleTaskWithExpiredRunAt, RunningOrClaimingTaskWithExpiredRetryAt)
  );

  const sort: NonNullable<SearchOpts['sort']> = getClaimSort(definitions);
  const query = matchesClauses(queryForScheduledTasks, filterDownBy(InactiveTasks));
  const script = updateFieldsAndMarkAsFailed({
    fieldUpdates: {
      ownerId: taskStore.taskManagerId,
      retryAt: claimOwnershipUntil,
    },
    claimableTaskTypes: taskTypesToClaim,
    skippedTaskTypes: taskTypesToSkip,
    taskMaxAttempts: pick(taskMaxAttempts, taskTypesToClaim),
  });

  const apmTrans = apm.startTransaction(
    TASK_MANAGER_MARK_AS_CLAIMED,
    TASK_MANAGER_TRANSACTION_TYPE
  );

  try {
    const result = await taskStore.updateByQuery(
      {
        query,
        script,
        sort,
      },
      {
        max_docs: size,
      }
    );
    apmTrans.end('success');
    return result;
  } catch (err) {
    apmTrans.end('failure');
    throw err;
  }
}

async function sweepForClaimedTasks(
  taskStore: TaskStore,
  taskTypes: Set<string>,
  size: number,
  definitions: TaskTypeDictionary
): Promise<ConcreteTaskInstance[]> {
  const claimedTasksQuery = tasksClaimedByOwner(
    taskStore.taskManagerId,
    tasksOfType([...taskTypes])
  );
  const { docs } = await taskStore.fetch({
    query: claimedTasksQuery,
    size,
    sort: getClaimSort(definitions),
    seq_no_primary_term: true,
  });

  return docs;
}

function accumulateClaimOwnershipResults(
  prev: ClaimOwnershipResult = getEmptyClaimOwnershipResult(),
  next?: ClaimOwnershipResult
) {
  if (next) {
    const { stats, docs, timing } = next;
    const res = {
      stats: {
        tasksUpdated: stats.tasksUpdated + prev.stats.tasksUpdated,
        tasksConflicted: stats.tasksConflicted + prev.stats.tasksConflicted,
        tasksClaimed: stats.tasksClaimed + prev.stats.tasksClaimed,
      },
      docs: [...prev.docs, ...docs],
      timing,
    };
    return res;
  }
  return prev;
}
