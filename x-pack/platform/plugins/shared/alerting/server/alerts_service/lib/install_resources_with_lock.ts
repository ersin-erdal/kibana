/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/core/server';
import { isLockAcquisitionError } from '@kbn/lock-manager';

/**
 * Minimal contract needed from `@kbn/lock-manager`'s `LockManagerService`, kept
 * local so the alerts service (and its tests) don't depend on the concrete class.
 */
export interface ResourceInstallLockManager {
  withLock(
    lockId: string,
    callback: () => Promise<void>,
    options?: { metadata?: Record<string, unknown> }
  ): Promise<void>;
}

export interface InstallResourcesWithLockOpts {
  /** When omitted, the install runs directly without any coordination. */
  lockManager?: ResourceInstallLockManager;
  lockId: string;
  logger: Logger;
  installFn: () => Promise<void>;
  /** Number of lock acquisition attempts before falling back to installing without the lock. */
  maxAttempts?: number;
  /** Delay between acquisition attempts, in milliseconds. */
  retryDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_RETRY_DELAY_MS = 5000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs alerts-as-data resource installation under a cluster-wide lock so that,
 * across multiple Kibana nodes, only one node installs a given resource set at a
 * time — reducing the burst of concurrent requests to Elasticsearch on startup.
 *
 * A node that loses the race retries acquiring the lock; because the install work
 * is idempotent, whichever node holds the lock installs while the others wait,
 * then acquire in turn and run the (now largely no-op) install. The lock is a
 * best-effort optimization, never a correctness mechanism: if no lock manager is
 * provided, or the lock cannot be acquired within `maxAttempts`, the install runs
 * directly so resource installation is never blocked by lock contention or a lock
 * failure.
 */
export const installResourcesWithLock = async ({
  lockManager,
  lockId,
  logger,
  installFn,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}: InstallResourcesWithLockOpts): Promise<void> => {
  if (!lockManager) {
    await installFn();
    return;
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await lockManager.withLock(lockId, installFn);
      return;
    } catch (err) {
      // A non-acquisition error means the install itself failed (or the lock
      // manager errored); surface it to the caller's existing error handling.
      if (!isLockAcquisitionError(err)) {
        throw err;
      }

      if (attempt >= maxAttempts) {
        logger.warn(
          `Could not acquire install lock "${lockId}" after ${attempt} attempts; installing without the lock`
        );
        await installFn();
        return;
      }

      logger.debug(
        `Install lock "${lockId}" is held by another node; retrying (attempt ${attempt} of ${maxAttempts})`
      );
      await delay(retryDelayMs);
    }
  }
};
