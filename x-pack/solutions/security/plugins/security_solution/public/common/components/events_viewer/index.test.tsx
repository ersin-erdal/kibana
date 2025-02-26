/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import useResizeObserver from 'use-resize-observer/polyfilled';

import { render } from '@testing-library/react';
import { TestProviders } from '../../mock';

import { mockEventViewerResponse } from './mock';
import { type EventsViewerProps, StatefulEventsViewer } from '.';
import { eventsDefaultModel } from './default_model';
import { EntityType } from '@kbn/timelines-plugin/common';
import { SourcererScopeName } from '../../../sourcerer/store/model';
import { DefaultCellRenderer } from '../../../timelines/components/timeline/cell_rendering/default_cell_renderer';
import { useTimelineEvents } from './use_timelines_events';
import { getDefaultControlColumn } from '../../../timelines/components/timeline/body/control_columns';
import { defaultRowRenderers } from '../../../timelines/components/timeline/body/renderers';
import type { UseFieldBrowserOptionsProps } from '../../../timelines/components/fields_browser';
import { TableId } from '@kbn/securitysolution-data-table';
import { mount } from 'enzyme';

jest.mock('../../lib/kibana');

const mockDispatch = jest.fn();
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');

  return {
    ...original,
    useDispatch: () => mockDispatch,
  };
});

jest.mock('./use_timelines_events');

jest.mock('../../utils/normalize_time_range');

const mockUseFieldBrowserOptions = jest.fn();
jest.mock('../../../timelines/components/fields_browser', () => ({
  useFieldBrowserOptions: (props: UseFieldBrowserOptionsProps) => mockUseFieldBrowserOptions(props),
}));

const mockUseResizeObserver: jest.Mock = useResizeObserver as jest.Mock;
jest.mock('use-resize-observer/polyfilled');
mockUseResizeObserver.mockImplementation(() => ({}));

const from = '2019-08-27T22:10:56.794Z';
const to = '2019-08-26T22:10:56.791Z';
const ACTION_BUTTON_COUNT = 4;

const testProps: EventsViewerProps = {
  bulkActions: false,
  defaultModel: eventsDefaultModel,
  end: to,
  entityType: EntityType.EVENTS,
  indexNames: [],
  leadingControlColumns: getDefaultControlColumn(ACTION_BUTTON_COUNT),
  renderCellValue: DefaultCellRenderer,
  rowRenderers: defaultRowRenderers,
  sourcererScope: SourcererScopeName.default,
  start: from,
  tableId: TableId.test,
};
describe('StatefulEventsViewer', () => {
  beforeAll(() => {
    (useTimelineEvents as jest.Mock).mockReturnValue([false, mockEventViewerResponse]);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('it renders the events viewer', () => {
    const wrapper = mount(
      <TestProviders>
        <StatefulEventsViewer {...testProps} />
      </TestProviders>
    );

    expect(wrapper.find(`[data-test-subj="events-viewer-panel"]`).exists()).toBeTruthy();
  });

  // InspectButtonContainer controls displaying InspectButton components
  test('it renders InspectButtonContainer', () => {
    const wrapper = mount(
      <TestProviders>
        <StatefulEventsViewer {...testProps} />
      </TestProviders>
    );

    expect(wrapper.find(`[data-test-subj="inspect-icon-button"]`).exists()).toBeTruthy();
  });

  test('it closes field editor when unmounted', () => {
    const mockCloseEditor = jest.fn();
    mockUseFieldBrowserOptions.mockImplementation(({ editorActionsRef }) => {
      editorActionsRef.current = { closeEditor: mockCloseEditor };
      return {};
    });

    const { unmount } = render(
      <TestProviders>
        <StatefulEventsViewer {...testProps} />
      </TestProviders>
    );
    expect(mockCloseEditor).not.toHaveBeenCalled();

    unmount();
    expect(mockCloseEditor).toHaveBeenCalled();
  });

  test('renders the RightTopMenu additional menu options when given additionalRightMenuOptions props', () => {
    const { getByTestId } = render(
      <TestProviders>
        <StatefulEventsViewer
          {...testProps}
          topRightMenuOptions={[<p data-test-subj="right-option" />]}
        />
      </TestProviders>
    );
    expect(getByTestId('right-option')).toBeInTheDocument();
  });

  test('does not render the RightTopMenu additional menu options when additionalRightMenuOptions props are not given', () => {
    const { queryByTestId } = render(
      <TestProviders>
        <StatefulEventsViewer {...testProps} />
      </TestProviders>
    );
    expect(queryByTestId('right-option')).not.toBeInTheDocument();
  });
});
