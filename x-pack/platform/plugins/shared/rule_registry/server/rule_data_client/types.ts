/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransportResult } from '@elastic/elasticsearch';
import type { BulkRequest, BulkResponse } from '@elastic/elasticsearch/lib/api/types';

import type { ESSearchRequest, ESSearchResponse } from '@kbn/es-types';
import type { FieldDescriptor } from '@kbn/data-plugin/server';
import type { ParsedExperimentalFields } from '../../common/parse_experimental_fields';
import type { ParsedTechnicalFields } from '../../common/parse_technical_fields';

export interface IRuleDataClient {
  indexName: string;
  indexNameWithNamespace(namespace: string): string;
  kibanaVersion: string;
  isWriteEnabled(): boolean;
  isUsingDataStreams(): boolean;
  getReader(options?: { namespace?: string }): IRuleDataReader;
  getWriter(options?: { namespace?: string }): Promise<IRuleDataWriter>;
}

export interface IRuleDataReader {
  search<
    TSearchRequest extends ESSearchRequest,
    TAlertDoc = Partial<ParsedTechnicalFields & ParsedExperimentalFields>
  >(
    request: TSearchRequest
  ): Promise<ESSearchResponse<TAlertDoc, TSearchRequest>>;

  getDynamicIndexPattern(target?: string): Promise<{
    title: string;
    timeFieldName: string;
    fields: FieldDescriptor[];
  }>;
}

export interface IRuleDataWriter {
  bulk(request: BulkRequest): Promise<TransportResult<BulkResponse, unknown> | undefined>;
}
