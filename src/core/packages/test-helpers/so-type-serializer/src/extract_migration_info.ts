/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { compare as semverCompare } from 'semver';
import { getFlattenedObject } from '@kbn/std';
import type { SavedObjectsNamespaceType } from '@kbn/core-saved-objects-common';
import type { SavedObjectsType } from '@kbn/core-saved-objects-server';
import { aggregateMappingAdditions } from '@kbn/core-saved-objects-base-server-internal';
import { SavedObjectsModelChange } from '@kbn/core-saved-objects-server';

export interface SavedObjectTypeMigrationInfo {
  name: string;
  namespaceType: SavedObjectsNamespaceType;
  convertToAliasScript?: string;
  convertToMultiNamespaceTypeVersion?: string;
  migrationVersions: string[];
  schemaVersions: string[];
  mappings: Record<string, unknown>;
  hasExcludeOnUpgrade: boolean;
  modelVersions: ModelVersionSummary[];
  switchToModelVersionAt?: string;
}

export interface ModelVersionSummary {
  version: string;
  changeTypes: string[];
  hasTransformation: boolean;
  newMappings: string[];
  schemas: {
    forwardCompatibility: boolean;
  };
}

/**
 * Extract all migration-relevant informations bound to given type in a serializable format.
 *
 * @param soType
 */
export const extractMigrationInfo = (soType: SavedObjectsType): SavedObjectTypeMigrationInfo => {
  const migrationMap =
    typeof soType.migrations === 'function' ? soType.migrations() : soType.migrations;
  const migrationVersions = Object.keys(migrationMap ?? {});
  migrationVersions.sort(semverCompare);

  const schemaMap = typeof soType.schemas === 'function' ? soType.schemas() : soType.schemas;
  const schemaVersions = Object.keys(schemaMap ?? {});
  schemaVersions.sort(semverCompare);

  const modelVersionMap =
    typeof soType.modelVersions === 'function'
      ? soType.modelVersions()
      : soType.modelVersions ?? {};

  const modelVersions: ModelVersionSummary[] = Object.entries(modelVersionMap).map(
    ([version, modelVersion]) => {
      const { changes, schemas } = modelVersion ?? { changes: [] };
      return {
        version,
        changeTypes: [...new Set(changes.map((change) => change.type))].sort(),
        hasTransformation: hasTransformation(changes),
        newMappings: Object.keys(getFlattenedObject(aggregateMappingAdditions(changes))),
        schemas: {
          forwardCompatibility: !!schemas?.forwardCompatibility,
        },
      };
    }
  );

  return {
    name: soType.name,
    namespaceType: soType.namespaceType,
    convertToAliasScript: soType.convertToAliasScript,
    convertToMultiNamespaceTypeVersion: soType.convertToMultiNamespaceTypeVersion,
    migrationVersions,
    schemaVersions,
    mappings: getFlattenedObject(soType.mappings ?? {}),
    hasExcludeOnUpgrade: !!soType.excludeOnUpgrade,
    modelVersions,
  };
};

const changesWithTransform = ['data_backfill', 'data_removal', 'unsafe_transform'];
const hasTransformation = (changes: SavedObjectsModelChange[]): boolean => {
  return changes.some((change) => changesWithTransform.includes(change.type));
};
