/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { act, waitFor, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';

import { useSourcererDataView } from '.';
import { getScopeFromPath } from './sourcerer_paths';
import { mockPatterns } from './mocks';
import type { RouteSpyState } from '../../common/utils/route/types';
import {
  DEFAULT_DATA_VIEW_ID,
  DEFAULT_INDEX_PATTERN,
  SECURITY_FEATURE_ID,
  SecurityPageName,
} from '../../../common/constants';
import { useUserInfo, initialState as userInfoState } from '../../detections/components/user_info';
import {
  mockGlobalState,
  mockSourcererState,
  TestProviders,
  createMockStore,
} from '../../common/mock';
import type { SelectedDataView } from '../store/model';
import { SourcererScopeName } from '../store/model';
import * as source from '../../common/containers/source/use_data_view';
import { sourcererActions } from '../store';
import { useInitializeUrlParam, useUpdateUrlParam } from '../../common/utils/global_query_string';
import { createSourcererDataView } from './create_sourcerer_data_view';
import { useInitSourcerer } from './use_init_sourcerer';

const mockRouteSpy: RouteSpyState = {
  pageName: SecurityPageName.overview,
  detailName: undefined,
  tabName: undefined,
  search: '',
  pathName: '/',
};
const mockDispatch = jest.fn();
const mockUseUserInfo = useUserInfo as jest.Mock;
jest.mock('../../common/lib/apm/use_track_http_request');
jest.mock('../../detections/components/user_info');
jest.mock('./create_sourcerer_data_view');
jest.mock('../../common/utils/global_query_string');
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');

  return {
    ...original,
    useDispatch: () => mockDispatch,
  };
});
jest.mock('../../common/utils/route/use_route_spy', () => ({
  useRouteSpy: () => [mockRouteSpy],
}));

(useInitializeUrlParam as jest.Mock).mockImplementation((_, onInitialize) => onInitialize({}));

const mockSearch = jest.fn();

const mockAddWarning = jest.fn();
const mockAddError = jest.fn();
const mockCreateSourcererDataView = jest.fn(() => {
  const errToReturn = new Error('fake error');
  errToReturn.name = 'AbortError';
  throw errToReturn;
});
const mockUseKibana = () => ({
  services: {
    application: {
      capabilities: {
        [SECURITY_FEATURE_ID]: {
          crud: true,
        },
      },
    },
    data: {
      dataViews: {
        get: mockSearch.mockImplementation(
          async (dataViewId: string, displayErrors?: boolean, refreshFields = false) =>
            Promise.resolve({
              id: dataViewId,
              matchedIndices: refreshFields ? ['hello', 'world', 'refreshed'] : ['hello', 'world'],
              fields: [
                {
                  name: 'bytes',
                  type: 'number',
                  esTypes: ['long'],
                  aggregatable: true,
                  searchable: true,
                  count: 10,
                  readFromDocValues: true,
                  scripted: false,
                  isMapped: true,
                },
                {
                  name: 'ssl',
                  type: 'boolean',
                  esTypes: ['boolean'],
                  aggregatable: true,
                  searchable: true,
                  count: 20,
                  readFromDocValues: true,
                  scripted: false,
                  isMapped: true,
                },
                {
                  name: '@timestamp',
                  type: 'date',
                  esTypes: ['date'],
                  aggregatable: true,
                  searchable: true,
                  count: 30,
                  readFromDocValues: true,
                  scripted: false,
                  isMapped: true,
                },
              ],
              getIndexPattern: () => 'hello*,world*,refreshed*',
              getRuntimeMappings: () => ({
                myfield: {
                  type: 'keyword',
                },
              }),
              toSpec: () => ({
                id: dataViewId,
              }),
            })
        ),
        getExistingIndices: jest.fn(() => [] as string[]),
      },
      indexPatterns: {
        getTitles: jest.fn().mockImplementation(() => Promise.resolve(mockPatterns)),
      },
    },
    notifications: {},
  },
});

jest.mock('../../common/lib/kibana', () => ({
  useToasts: () => ({
    addError: mockAddError,
    addSuccess: jest.fn(),
    addWarning: mockAddWarning,
    addInfo: jest.fn(),
    remove: jest.fn(),
  }),
  useKibana: () => mockUseKibana(),
  useUiSetting$: jest.fn().mockImplementation(() => [mockPatterns]),
}));

describe('Sourcerer Hooks', () => {
  let store = createMockStore();

  const StoreProvider: React.FC<React.PropsWithChildren> = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <TestProviders>{children}</TestProviders>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    store = createMockStore();
    mockUseUserInfo.mockImplementation(() => userInfoState);
  });
  it('initializes loading default and timeline index patterns', async () => {
    const { rerender } = renderHook(() => useInitSourcerer(), {
      wrapper: StoreProvider,
    });
    await waitFor(() => new Promise((resolve) => resolve(null)));
    rerender();
    expect(mockDispatch.mock.calls[0][0]).toEqual({
      type: 'x-pack/security_solution/local/sourcerer/SET_DATA_VIEW_LOADING',
      payload: { id: 'security-solution', loading: true },
    });
    expect(mockDispatch.mock.calls[1][0]).toEqual({
      type: 'x-pack/security_solution/local/sourcerer/SET_SELECTED_DATA_VIEW',
      payload: {
        id: 'timeline',
        selectedDataViewId: 'security-solution',
        selectedPatterns: ['.siem-signals-spacename', ...DEFAULT_INDEX_PATTERN],
      },
    });
  });
  it('sets signal index name', async () => {
    const mockNewDataViews = {
      defaultDataView: mockSourcererState.defaultDataView,
      kibanaDataViews: [mockSourcererState.defaultDataView],
    };
    (createSourcererDataView as jest.Mock).mockResolvedValue(mockNewDataViews);

    store = createMockStore({
      ...mockGlobalState,
      sourcerer: {
        ...mockGlobalState.sourcerer,
        signalIndexName: null,
        defaultDataView: {
          ...mockGlobalState.sourcerer.defaultDataView,
          title: DEFAULT_INDEX_PATTERN.join(','),
          patternList: DEFAULT_INDEX_PATTERN,
        },
      },
    });
    mockUseUserInfo.mockImplementation(() => ({
      ...userInfoState,
      loading: false,
      signalIndexName: mockSourcererState.signalIndexName,
    }));
    const { rerender } = renderHook(useInitSourcerer, {
      wrapper: StoreProvider,
    });
    await waitFor(() => new Promise((resolve) => resolve(null)));
    rerender();
    await waitFor(() => {
      expect(mockDispatch.mock.calls[3][0]).toEqual({
        type: 'x-pack/security_solution/local/sourcerer/SET_SOURCERER_SCOPE_LOADING',
        payload: { loading: true },
      });
      expect(mockDispatch.mock.calls[4][0]).toEqual({
        type: 'x-pack/security_solution/local/sourcerer/SET_SIGNAL_INDEX_NAME',
        payload: { signalIndexName: mockSourcererState.signalIndexName },
      });
      expect(mockDispatch.mock.calls[5][0]).toEqual({
        type: 'x-pack/security_solution/local/sourcerer/SET_DATA_VIEW_LOADING',
        payload: {
          id: mockSourcererState.defaultDataView.id,
          loading: true,
        },
      });
      expect(mockDispatch.mock.calls[6][0]).toEqual({
        type: 'x-pack/security_solution/local/sourcerer/SET_SOURCERER_DATA_VIEWS',
        payload: mockNewDataViews,
      });
      expect(mockDispatch.mock.calls[7][0]).toEqual({
        type: 'x-pack/security_solution/local/sourcerer/SET_SOURCERER_SCOPE_LOADING',
        payload: { loading: false },
      });

      expect(mockSearch).toHaveBeenCalledTimes(2);
    });
  });

  it('initializes dataview with data from query string', async () => {
    const selectedPatterns = ['testPattern-*'];
    const selectedDataViewId = 'security-solution-default';
    (useInitializeUrlParam as jest.Mock).mockImplementation((_, onInitialize) =>
      onInitialize({
        [SourcererScopeName.default]: {
          id: selectedDataViewId,
          selectedPatterns,
        },
      })
    );

    renderHook(() => useInitSourcerer(), {
      wrapper: Wrapper,
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      sourcererActions.setSelectedDataView({
        id: SourcererScopeName.default,
        selectedDataViewId,
        selectedPatterns,
      })
    );
  });

  it('sets default selected patterns to the URL when there is no sorcerer URL param in the query string', async () => {
    const updateUrlParam = jest.fn();
    (useUpdateUrlParam as jest.Mock).mockReturnValue(updateUrlParam);
    (useInitializeUrlParam as jest.Mock).mockImplementation((_, onInitialize) =>
      onInitialize(null)
    );

    renderHook(() => useInitSourcerer(), {
      wrapper: Wrapper,
    });

    expect(updateUrlParam).toHaveBeenCalledWith({
      [SourcererScopeName.default]: {
        id: DEFAULT_DATA_VIEW_ID,
        selectedPatterns: DEFAULT_INDEX_PATTERN,
      },
    });
  });

  it('calls addWarning if defaultDataView has an error', async () => {
    store = createMockStore({
      ...mockGlobalState,
      sourcerer: {
        ...mockGlobalState.sourcerer,
        signalIndexName: null,
        defaultDataView: {
          ...mockGlobalState.sourcerer.defaultDataView,
          error: true,
        },
      },
    });
    renderHook(() => useInitSourcerer(), {
      wrapper: StoreProvider,
    });

    await waitFor(() => {
      expect(mockAddWarning).toHaveBeenNthCalledWith(1, {
        text: 'Users with write permission need to access the Elastic Security app to initialize the app source data.',
        title: 'Write role required to generate data',
      });
    });
  });

  it('does not call addError if updateSourcererDataView receives an AbortError', async () => {
    // createSourcererDataView throws an 'AbortError' which
    // puts us in the catch block, but the addError toast is not called
    (createSourcererDataView as jest.Mock).mockImplementation(mockCreateSourcererDataView);

    store = createMockStore({
      ...mockGlobalState,
      sourcerer: {
        ...mockGlobalState.sourcerer,
        signalIndexName: null,
        defaultDataView: {
          ...mockGlobalState.sourcerer.defaultDataView,
          title: DEFAULT_INDEX_PATTERN.join(','),
          patternList: DEFAULT_INDEX_PATTERN,
        },
      },
    });

    mockUseUserInfo.mockImplementation(() => ({
      ...userInfoState,
      loading: false,
      signalIndexName: mockSourcererState.signalIndexName,
    }));

    const { rerender } = renderHook(() => useInitSourcerer(), {
      wrapper: StoreProvider,
    });

    await waitFor(() => new Promise((resolve) => resolve(null)));

    rerender();

    await waitFor(() => new Promise((resolve) => resolve(null)));

    expect(mockCreateSourcererDataView).toHaveBeenCalled();
    expect(mockAddError).not.toHaveBeenCalled();
  });

  it('does call addError if updateSourcererDataView receives a non-abort error', async () => {
    // createSourcererDataView throws an 'AbortError' which
    // puts us in the catch block, but the addError toast is not called
    (createSourcererDataView as jest.Mock).mockImplementation(() => {
      throw Error('fake error');
    });

    store = createMockStore({
      ...mockGlobalState,
      sourcerer: {
        ...mockGlobalState.sourcerer,
        signalIndexName: null,
        defaultDataView: {
          ...mockGlobalState.sourcerer.defaultDataView,
          title: DEFAULT_INDEX_PATTERN.join(','),
          patternList: DEFAULT_INDEX_PATTERN,
        },
      },
    });
    mockUseUserInfo.mockImplementation(() => ({
      ...userInfoState,
      loading: false,
      signalIndexName: mockSourcererState.signalIndexName,
    }));
    const { rerender } = renderHook(() => useInitSourcerer(), {
      wrapper: StoreProvider,
    });

    await waitFor(() => new Promise((resolve) => resolve(null)));
    rerender();

    await waitFor(() => {
      expect(mockAddError).toHaveBeenCalled();
    });
  });

  it('handles detections page', async () => {
    mockUseUserInfo.mockImplementation(() => ({
      ...userInfoState,
      signalIndexName: mockSourcererState.signalIndexName,
      isSignalIndexExists: true,
    }));
    const { rerender } = renderHook(() => useInitSourcerer(SourcererScopeName.detections), {
      wrapper: StoreProvider,
    });
    await waitFor(() => new Promise((resolve) => resolve(null)));
    rerender();
    expect(mockDispatch.mock.calls[3][0]).toEqual({
      type: 'x-pack/security_solution/local/sourcerer/SET_SELECTED_DATA_VIEW',
      payload: {
        id: 'detections',
        selectedDataViewId: mockSourcererState.defaultDataView.id,
        selectedPatterns: [mockSourcererState.signalIndexName],
      },
    });
  });
  it('index field search is not repeated when default and timeline have same dataViewId', async () => {
    const { rerender } = renderHook(() => useInitSourcerer(), {
      wrapper: StoreProvider,
    });
    await waitFor(() => new Promise((resolve) => resolve(null)));
    rerender();
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1);
    });
  });
  it('index field search called twice when default and timeline have different dataViewId', async () => {
    store = createMockStore({
      ...mockGlobalState,
      sourcerer: {
        ...mockGlobalState.sourcerer,
        sourcererScopes: {
          ...mockGlobalState.sourcerer.sourcererScopes,
          [SourcererScopeName.timeline]: {
            ...mockGlobalState.sourcerer.sourcererScopes[SourcererScopeName.timeline],
            selectedDataViewId: 'different-id',
          },
        },
      },
    });
    const { rerender } = renderHook(() => useInitSourcerer(), {
      wrapper: StoreProvider,
    });
    await waitFor(() => new Promise((resolve) => resolve(null)));
    rerender();
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(2);
    });
  });
  describe('initialization settings', () => {
    const mockIndexFieldsSearch = jest.fn();
    beforeAll(() => {
      // 👇️ not using dot-notation + the ignore clears up a ts error
      // @ts-ignore
      // eslint-disable-next-line dot-notation
      source['useDataView'] = jest.fn(() => ({
        indexFieldsSearch: mockIndexFieldsSearch,
      }));
    });
    it('does not needToBeInit if scope is default and selectedPatterns/missingPatterns have values', async () => {
      const { rerender } = renderHook(() => useInitSourcerer(), {
        wrapper: StoreProvider,
      });
      await waitFor(() => new Promise((resolve) => resolve(null)));
      rerender();
      await waitFor(() => {
        expect(mockIndexFieldsSearch).toHaveBeenCalledWith({
          dataViewId: mockSourcererState.defaultDataView.id,
          needToBeInit: false,
          scopeId: SourcererScopeName.default,
        });
      });
    });

    it('does needToBeInit if scope is default and selectedPatterns/missingPatterns are empty', async () => {
      store = createMockStore({
        ...mockGlobalState,
        sourcerer: {
          ...mockGlobalState.sourcerer,
          sourcererScopes: {
            ...mockGlobalState.sourcerer.sourcererScopes,
            [SourcererScopeName.default]: {
              ...mockGlobalState.sourcerer.sourcererScopes[SourcererScopeName.default],
              selectedPatterns: [],
              missingPatterns: [],
            },
          },
        },
      });
      const { rerender } = renderHook(() => useInitSourcerer(), {
        wrapper: StoreProvider,
      });
      await waitFor(() => new Promise((resolve) => resolve(null)));
      rerender();
      await waitFor(() => {
        expect(mockIndexFieldsSearch).toHaveBeenCalledWith({
          dataViewId: mockSourcererState.defaultDataView.id,
          needToBeInit: true,
          scopeId: SourcererScopeName.default,
        });
      });
    });

    it('does needToBeInit and skipScopeUpdate=false if scope is timeline and selectedPatterns/missingPatterns are empty', async () => {
      store = createMockStore({
        ...mockGlobalState,
        sourcerer: {
          ...mockGlobalState.sourcerer,
          kibanaDataViews: [
            ...mockGlobalState.sourcerer.kibanaDataViews,
            { ...mockSourcererState.defaultDataView, id: 'something-weird', patternList: [] },
          ],
          sourcererScopes: {
            ...mockGlobalState.sourcerer.sourcererScopes,
            [SourcererScopeName.timeline]: {
              ...mockGlobalState.sourcerer.sourcererScopes[SourcererScopeName.timeline],
              selectedDataViewId: 'something-weird',
              selectedPatterns: [],
              missingPatterns: [],
            },
          },
        },
      });
      const { rerender } = renderHook(() => useInitSourcerer(), {
        wrapper: StoreProvider,
      });
      await waitFor(() => new Promise((resolve) => resolve(null)));
      rerender();
      await waitFor(() => {
        expect(mockIndexFieldsSearch).toHaveBeenNthCalledWith(2, {
          dataViewId: 'something-weird',
          needToBeInit: true,
          scopeId: SourcererScopeName.timeline,
          skipScopeUpdate: false,
        });
      });
    });

    it('does needToBeInit and skipScopeUpdate=true if scope is timeline and selectedPatterns have value', async () => {
      store = createMockStore({
        ...mockGlobalState,
        sourcerer: {
          ...mockGlobalState.sourcerer,
          kibanaDataViews: [
            ...mockGlobalState.sourcerer.kibanaDataViews,
            { ...mockSourcererState.defaultDataView, id: 'something-weird', patternList: [] },
          ],
          sourcererScopes: {
            ...mockGlobalState.sourcerer.sourcererScopes,
            [SourcererScopeName.timeline]: {
              ...mockGlobalState.sourcerer.sourcererScopes[SourcererScopeName.timeline],
              selectedDataViewId: 'something-weird',
              selectedPatterns: ['ohboy'],
              missingPatterns: [],
            },
          },
        },
      });
      const { rerender } = renderHook(() => useInitSourcerer(), {
        wrapper: StoreProvider,
      });
      await waitFor(() => new Promise((resolve) => resolve(null)));
      rerender();
      await waitFor(() => {
        expect(mockIndexFieldsSearch).toHaveBeenNthCalledWith(2, {
          dataViewId: 'something-weird',
          needToBeInit: true,
          scopeId: SourcererScopeName.timeline,
          skipScopeUpdate: true,
        });
      });
    });

    it('does not needToBeInit if scope is timeline and data view has patternList', async () => {
      store = createMockStore({
        ...mockGlobalState,
        sourcerer: {
          ...mockGlobalState.sourcerer,
          kibanaDataViews: [
            ...mockGlobalState.sourcerer.kibanaDataViews,
            {
              ...mockSourcererState.defaultDataView,
              id: 'something-weird',
              patternList: ['ohboy'],
            },
          ],
          sourcererScopes: {
            ...mockGlobalState.sourcerer.sourcererScopes,
            [SourcererScopeName.timeline]: {
              ...mockGlobalState.sourcerer.sourcererScopes[SourcererScopeName.timeline],
              selectedDataViewId: 'something-weird',
              selectedPatterns: [],
              missingPatterns: [],
            },
          },
        },
      });
      const { rerender } = renderHook(() => useInitSourcerer(), {
        wrapper: StoreProvider,
      });
      await waitFor(() => new Promise((resolve) => resolve(null)));
      rerender();
      await waitFor(() => {
        expect(mockIndexFieldsSearch).toHaveBeenNthCalledWith(2, {
          dataViewId: 'something-weird',
          needToBeInit: false,
          scopeId: SourcererScopeName.timeline,
        });
      });
    });
  });

  describe('useSourcererDataView', () => {
    it('Should put any excludes in the index pattern at the end of the pattern list, and sort both the includes and excludes', async () => {
      store = createMockStore({
        ...mockGlobalState,
        sourcerer: {
          ...mockGlobalState.sourcerer,
          sourcererScopes: {
            ...mockGlobalState.sourcerer.sourcererScopes,
            [SourcererScopeName.default]: {
              ...mockGlobalState.sourcerer.sourcererScopes[SourcererScopeName.default],
              selectedPatterns: [
                '-packetbeat-*',
                'endgame-*',
                'auditbeat-*',
                'filebeat-*',
                'winlogbeat-*',
                '-filebeat-*',
                'packetbeat-*',
                'traces-apm*',
                'apm-*-transaction*',
              ],
            },
          },
        },
      });

      const { result, rerender } = renderHook<SelectedDataView, SourcererScopeName>(
        useSourcererDataView,
        {
          wrapper: StoreProvider,
        }
      );
      await waitFor(() => new Promise((resolve) => resolve(null)));
      rerender();
      await waitFor(() =>
        expect(result.current.selectedPatterns).toEqual([
          'apm-*-transaction*',
          'auditbeat-*',
          'endgame-*',
          'filebeat-*',
          'packetbeat-*',
          'traces-apm*',
          'winlogbeat-*',
          '-filebeat-*',
          '-packetbeat-*',
        ])
      );
    });

    it('should update the title and name of the data view according to the selected patterns', async () => {
      const { result, rerender } = renderHook(() => useSourcererDataView(), {
        wrapper: StoreProvider,
      });

      expect(result.current.sourcererDataView.title).toBe(
        'apm-*-transaction*,auditbeat-*,endgame-*,filebeat-*,logs-*,packetbeat-*,traces-apm*,winlogbeat-*,-*elastic-cloud-logs-*'
      );

      const testPatterns = ['anotherTestPattern', 'justATestPattern'];
      await act(async () => {
        store.dispatch(
          sourcererActions.setSelectedDataView({
            id: SourcererScopeName.default,
            selectedDataViewId: 'security-solution-default',
            selectedPatterns: testPatterns,
          })
        );
      });

      rerender();

      expect(result.current.sourcererDataView.title).toBe(testPatterns.join(','));
      expect(result.current.sourcererDataView.name).toBe(testPatterns.join(','));
    });
  });
});

describe('getScopeFromPath', () => {
  it('should return default scope', async () => {
    expect(getScopeFromPath('/')).toBe(SourcererScopeName.default);
    expect(getScopeFromPath('/exceptions')).toBe(SourcererScopeName.default);
    expect(getScopeFromPath('/rules')).toBe(SourcererScopeName.default);
    expect(getScopeFromPath('/rules/create')).toBe(SourcererScopeName.default);
  });

  it('should return detections scope', async () => {
    expect(getScopeFromPath('/alerts')).toBe(SourcererScopeName.detections);
    expect(getScopeFromPath('/rules/id/foo')).toBe(SourcererScopeName.detections);
    expect(getScopeFromPath('/rules/id/foo/edit')).toBe(SourcererScopeName.detections);
  });
});
