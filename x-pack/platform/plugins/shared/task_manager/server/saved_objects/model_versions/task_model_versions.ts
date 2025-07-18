/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsModelVersionMap } from '@kbn/core-saved-objects-server';
import {
  taskSchemaV1,
  taskSchemaV2,
  taskSchemaV3,
  taskSchemaV4,
  taskSchemaV5,
  taskSchemaV6,
} from '../schemas/task';

// IMPORTANT!!!
// When adding new model versions, make sure to manually test
// downgrading to the previous version. This is a gap in our
// automated test coverage so manual testing is needed.
export const taskModelVersions: SavedObjectsModelVersionMap = {
  '1': {
    changes: [
      {
        type: 'mappings_deprecation',
        deprecatedMappings: ['numSkippedRuns', 'interval'],
      },
    ],
    schemas: {
      forwardCompatibility: taskSchemaV1.extends({}, { unknowns: 'ignore' }),
      create: taskSchemaV1,
    },
  },
  '2': {
    changes: [
      {
        type: 'mappings_addition',
        addedMappings: {
          partition: { type: 'integer' },
        },
      },
    ],
    schemas: {
      forwardCompatibility: taskSchemaV2.extends({}, { unknowns: 'ignore' }),
      create: taskSchemaV2,
    },
  },
  '3': {
    changes: [
      {
        type: 'mappings_addition',
        addedMappings: {
          priority: { type: 'integer' },
        },
      },
    ],
    schemas: {
      forwardCompatibility: taskSchemaV3.extends({}, { unknowns: 'ignore' }),
      create: taskSchemaV3,
    },
  },
  '4': {
    changes: [
      {
        type: 'mappings_addition',
        addedMappings: {
          userScope: {
            properties: {
              apiKeyId: { type: 'keyword' },
            },
          },
        },
      },
    ],
    schemas: {
      forwardCompatibility: taskSchemaV4.extends({}, { unknowns: 'ignore' }),
      create: taskSchemaV4,
    },
  },
  '5': {
    changes: [],
    schemas: {
      forwardCompatibility: taskSchemaV5.extends({}, { unknowns: 'ignore' }),
      create: taskSchemaV5,
    },
  },
  '6': {
    changes: [],
    schemas: {
      forwardCompatibility: taskSchemaV6.extends({}, { unknowns: 'ignore' }),
      create: taskSchemaV6,
    },
  },
};
