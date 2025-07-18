/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { StreamQueryKql } from '@kbn/streams-schema';

export function getSigEventFlyoutTitle(query?: StreamQueryKql): string {
  if (!query) {
    return i18n.translate('xpack.streams.significantEventFlyout.addNewQueryFlyoutTitle', {
      defaultMessage: 'Add significant event',
    });
  }

  return i18n.translate('xpack.streams.significantEventFlyout.editQueryFlyoutTitle', {
    defaultMessage: 'Edit {title}',
    values: {
      title: query.title,
    },
  });
}

export function getSigEventSubmitTitle(query?: StreamQueryKql): string {
  if (!query) {
    return i18n.translate('xpack.streams.significantEventFlyout.addButtonLabel', {
      defaultMessage: 'Add',
    });
  }

  return i18n.translate('xpack.streams.significantEventFlyout.editButtonLabel', {
    defaultMessage: 'Save changes',
  });
}
