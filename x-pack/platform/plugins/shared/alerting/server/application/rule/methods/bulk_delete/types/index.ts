/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { TypeOf } from '@kbn/config-schema';
import type { bulkDeleteRulesRequestBodySchema } from '../schemas';
import type { SanitizedRule } from '../../../../../types';
import type { RuleParams } from '../../../types';

export interface BulkOperationError {
  message: string;
  status?: number;
  rule: {
    id: string;
    name: string;
  };
}

export type BulkDeleteRulesRequestBody = TypeOf<typeof bulkDeleteRulesRequestBodySchema>;

export interface BulkDeleteRulesResult<Params extends RuleParams> {
  rules: Array<SanitizedRule<Params>>;
  errors: BulkOperationError[];
  total: number;
  taskIdsFailedToBeDeleted: string[];
}
