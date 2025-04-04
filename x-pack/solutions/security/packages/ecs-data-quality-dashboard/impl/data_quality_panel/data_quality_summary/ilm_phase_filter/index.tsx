/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiComboBox,
  EuiComboBoxOptionOption,
  EuiFormControlLayout,
  EuiFormLabel,
  EuiToolTip,
  useGeneratedHtmlId,
} from '@elastic/eui';
import React, { useCallback, useMemo } from 'react';

import { ilmPhaseOptionsStatic } from '../../constants';
import { getIlmPhaseDescription } from '../../utils/get_ilm_phase_description';
import {
  ILM_PHASE,
  INDEX_LIFECYCLE_MANAGEMENT_PHASES,
  SELECT_ONE_OR_MORE_ILM_PHASES,
} from '../../translations';
import { useDataQualityContext } from '../../data_quality_context';
import { formControlLayoutCss, optionCss, optionLabelCss } from './styles';

const renderOption = (
  option: EuiComboBoxOptionOption<string | number | string[] | undefined>
): React.ReactNode => (
  <EuiToolTip content={`${option.label}: ${getIlmPhaseDescription(option.label)}`}>
    <div css={optionCss}>
      <span css={optionLabelCss}>{`${option.label}`}</span>
      {': '}
      <span>{getIlmPhaseDescription(option.label)}</span>
    </div>
  </EuiToolTip>
);

const IlmPhaseFilterComponent: React.FC = () => {
  const { selectedIlmPhaseOptions, setSelectedIlmPhaseOptions } = useDataQualityContext();
  const labelInputId = useGeneratedHtmlId({ prefix: 'labelInput' });
  const ilmFormLabel = useMemo(
    () => <EuiFormLabel htmlFor={labelInputId}>{ILM_PHASE}</EuiFormLabel>,
    [labelInputId]
  );

  const handleSetSelectedOptions = useCallback(
    (selectedOptions: EuiComboBoxOptionOption[]) => {
      setSelectedIlmPhaseOptions(selectedOptions);
    },
    [setSelectedIlmPhaseOptions]
  );

  return (
    <EuiToolTip display="block" content={INDEX_LIFECYCLE_MANAGEMENT_PHASES}>
      <EuiFormControlLayout css={formControlLayoutCss} fullWidth={true} prepend={ilmFormLabel}>
        <EuiComboBox
          id={labelInputId}
          data-test-subj="selectIlmPhases"
          fullWidth={true}
          placeholder={SELECT_ONE_OR_MORE_ILM_PHASES}
          renderOption={renderOption}
          selectedOptions={selectedIlmPhaseOptions}
          options={ilmPhaseOptionsStatic}
          onChange={handleSetSelectedOptions}
        />
      </EuiFormControlLayout>
    </EuiToolTip>
  );
};

IlmPhaseFilterComponent.displayName = 'IlmPhaseFilterComponent';

export const IlmPhaseFilter = React.memo(IlmPhaseFilterComponent);
