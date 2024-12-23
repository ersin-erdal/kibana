/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiDescriptionList } from '@elastic/eui';
import * as ruleDetailsI18n from '../../../../translations';
import type { RuleTagArray } from '../../../../../../../../../common/api/detection_engine';
import { Tags } from '../../../../rule_about_section';

interface TagsReadOnlyProps {
  tags: RuleTagArray;
}

export function TagsReadOnly({ tags }: TagsReadOnlyProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <EuiDescriptionList
      listItems={[
        {
          title: ruleDetailsI18n.TAGS_FIELD_LABEL,
          description: <Tags tags={tags} />,
        },
      ]}
    />
  );
}
