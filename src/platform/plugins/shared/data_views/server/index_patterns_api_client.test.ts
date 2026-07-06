/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
import { IndexPatternsApiServer } from './index_patterns_api_client';
import { IndexPatternsFetcher } from './fetcher';
import { coreMock } from '@kbn/core/server/mocks';

jest.mock('./fetcher');

describe('IndexPatternsApiServer', () => {
  const coreRequestHandler = coreMock.createRequestHandlerContext();
  let getFieldsForWildcard: jest.Mock;
  let indexPatternsApiServer: IndexPatternsApiServer;

  beforeEach(() => {
    jest.clearAllMocks();
    getFieldsForWildcard = jest.fn().mockResolvedValue({
      fields: [{ name: 'field1', type: 'string' }],
      indices: ['index1'],
    });

    (IndexPatternsFetcher as jest.Mock).mockImplementation(() => ({
      getFieldsForWildcard,
    }));

    indexPatternsApiServer = new IndexPatternsApiServer(
      coreRequestHandler.elasticsearch.client.asInternalUser,
      coreRequestHandler.savedObjects.client,
      coreRequestHandler.uiSettings.client,
      false
    );
  });

  it('uses the allowHidden parameter in indexPatternsApiServer.getFieldsForWildcard', async () => {
    const options = {
      allowHidden: true,
      allowNoIndex: true,
      pattern: '*',
    };

    await indexPatternsApiServer.getFieldsForWildcard(options);

    expect(getFieldsForWildcard).toHaveBeenCalledWith(
      expect.objectContaining({
        allowHidden: true,
      })
    );
  });

  describe('projectRouting', () => {
    const createServer = (defaultProjectRouting?: string) =>
      new IndexPatternsApiServer(
        coreRequestHandler.elasticsearch.client.asInternalUser,
        coreRequestHandler.savedObjects.client,
        coreRequestHandler.uiSettings.client,
        false,
        defaultProjectRouting
      );

    it('passes the constructor default projectRouting when no explicit value is provided', async () => {
      const server = createServer('@kibana_space_default_default');

      await server.getFieldsForWildcard({ pattern: '*' });

      expect(getFieldsForWildcard).toHaveBeenCalledWith(
        expect.objectContaining({ projectRouting: '@kibana_space_default_default' })
      );
    });

    it('lets an explicit projectRouting option override the constructor default', async () => {
      const server = createServer('@kibana_space_default_default');

      await server.getFieldsForWildcard({ pattern: '*', projectRouting: 'explicit-routing' });

      expect(getFieldsForWildcard).toHaveBeenCalledWith(
        expect.objectContaining({ projectRouting: 'explicit-routing' })
      );
    });

    it('passes undefined projectRouting when neither a default nor an explicit value is set', async () => {
      const server = createServer();

      await server.getFieldsForWildcard({ pattern: '*' });

      expect(getFieldsForWildcard).toHaveBeenCalledWith(
        expect.objectContaining({ projectRouting: undefined })
      );
    });
  });
});
