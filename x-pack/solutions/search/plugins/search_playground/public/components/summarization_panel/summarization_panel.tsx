/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { EuiPanel } from '@elastic/eui';
import { useLLMsModels } from '../../hooks/use_llms_models';
import { IncludeCitationsField } from './include_citations_field';
import { InstructionsField } from './instructions_field';
import { PlaygroundForm, PlaygroundFormFields } from '../../types';
import { SummarizationModel } from './summarization_model';

export const SummarizationPanel: React.FC = () => {
  const { control } = useFormContext<PlaygroundForm>();
  const models = useLLMsModels();

  return (
    <EuiPanel data-test-subj="summarizationPanel">
      <Controller
        name={PlaygroundFormFields.summarizationModel}
        control={control}
        render={({ field }) => (
          <SummarizationModel
            selectedModel={field.value}
            onSelect={(model) => field.onChange(model)}
            models={models}
          />
        )}
      />

      <Controller
        name={PlaygroundFormFields.prompt}
        control={control}
        defaultValue="You are an assistant for question-answering tasks."
        render={({ field }) => <InstructionsField value={field.value} onChange={field.onChange} />}
      />

      <Controller
        name={PlaygroundFormFields.citations}
        control={control}
        defaultValue={true}
        render={({ field }) => (
          <IncludeCitationsField checked={field.value} onChange={field.onChange} />
        )}
      />
    </EuiPanel>
  );
};
