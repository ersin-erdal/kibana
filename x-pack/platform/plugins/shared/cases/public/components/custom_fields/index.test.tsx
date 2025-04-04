/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { customFieldsConfigurationMock } from '../../containers/mock';
import { CustomFieldTypes } from '../../../common/types/domain';
import { MAX_CUSTOM_FIELDS_PER_CASE } from '../../../common/constants';
import { CustomFields } from '.';
import * as i18n from './translations';
import { renderWithTestingProviders } from '../../common/mock';

describe('CustomFields', () => {
  const props = {
    disabled: false,
    isLoading: false,
    handleAddCustomField: jest.fn(),
    handleDeleteCustomField: jest.fn(),
    handleEditCustomField: jest.fn(),
    customFields: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', async () => {
    renderWithTestingProviders(<CustomFields {...props} />);

    expect(await screen.findByTestId('custom-fields-form-group')).toBeInTheDocument();
    expect(await screen.findByTestId('add-custom-field')).toBeInTheDocument();
  });

  it('renders custom fields correctly', async () => {
    renderWithTestingProviders(
      <CustomFields {...{ ...props, customFields: customFieldsConfigurationMock }} />
    );

    expect(await screen.findByTestId('add-custom-field')).toBeInTheDocument();
    expect(await screen.findByTestId('custom-fields-list')).toBeInTheDocument();
  });

  it('renders loading state correctly', async () => {
    renderWithTestingProviders(<CustomFields {...{ ...props, isLoading: true }} />);

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('renders disabled state correctly', async () => {
    renderWithTestingProviders(<CustomFields {...{ ...props, disabled: true }} />);

    expect(await screen.findByTestId('add-custom-field')).toHaveAttribute('disabled');
  });

  it('calls onChange on add option click', async () => {
    renderWithTestingProviders(<CustomFields {...props} />);

    await userEvent.click(await screen.findByTestId('add-custom-field'));

    await waitFor(() => {
      expect(props.handleAddCustomField).toBeCalled();
    });
  });

  it('calls handleEditCustomField on edit option click', async () => {
    renderWithTestingProviders(
      <CustomFields {...{ ...props, customFields: customFieldsConfigurationMock }} />
    );

    await userEvent.click(
      await screen.findByTestId(`${customFieldsConfigurationMock[0].key}-custom-field-edit`)
    );

    await waitFor(() => {
      expect(props.handleEditCustomField).toBeCalledWith(customFieldsConfigurationMock[0].key);
    });
  });

  it('shows error when custom fields reaches the limit', async () => {
    const generatedMockCustomFields = [];

    for (let i = 0; i < 6; i++) {
      generatedMockCustomFields.push({
        key: `field_key_${i + 1}`,
        label: `My custom label ${i + 1}`,
        type: CustomFieldTypes.TEXT,
        required: false,
      });
    }

    const customFields = [...customFieldsConfigurationMock, ...generatedMockCustomFields];

    renderWithTestingProviders(<CustomFields {...{ ...props, customFields }} />);

    expect(await screen.findByText(i18n.MAX_CUSTOM_FIELD_LIMIT(MAX_CUSTOM_FIELDS_PER_CASE)));
    expect(screen.queryByTestId('add-custom-field')).not.toBeInTheDocument();
  });
});
