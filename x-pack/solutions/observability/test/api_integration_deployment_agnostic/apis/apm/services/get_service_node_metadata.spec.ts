/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { apm, timerange } from '@kbn/apm-synthtrace-client';
import { ApmDocumentType } from '@kbn/apm-plugin/common/document_type';
import { RollupInterval } from '@kbn/apm-plugin/common/rollup';
import type { ApmSynthtraceEsClient } from '@kbn/apm-synthtrace';
import type { DeploymentAgnosticFtrProviderContext } from '../../../ftr_provider_context';

export default function ApiTest({ getService }: DeploymentAgnosticFtrProviderContext) {
  const apmApiClient = getService('apmApi');
  const synthtrace = getService('synthtrace');

  const start = new Date('2021-01-01T00:00:00.000Z').getTime();
  const end = new Date('2021-01-01T00:15:00.000Z').getTime() - 1;
  const serviceName = 'synth-go';
  const instanceName = 'instance-a';

  async function callApi() {
    return await apmApiClient.readUser({
      endpoint: 'GET /internal/apm/services/{serviceName}/node/{serviceNodeName}/metadata',
      params: {
        path: { serviceName, serviceNodeName: instanceName },
        query: {
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          kuery: '',
          environment: 'production',
          documentType: ApmDocumentType.TransactionMetric,
          rollupInterval: RollupInterval.OneMinute,
        },
      },
    });
  }

  describe('Service node metadata', () => {
    describe('when data is not loaded', () => {
      it('handles the empty state', async () => {
        const response = await callApi();

        expect(response.status).to.be(200);

        expectSnapshot(response.body).toMatchInline(`
          Object {
            "containerId": "N/A",
            "host": "N/A",
          }
        `);
      });
    });

    describe('when data is loaded', () => {
      let apmSynthtraceEsClient: ApmSynthtraceEsClient;

      before(async () => {
        apmSynthtraceEsClient = await synthtrace.createApmSynthtraceEsClient();
        const instance = apm
          .service({ name: serviceName, environment: 'production', agentName: 'go' })
          .instance(instanceName);
        await apmSynthtraceEsClient.index(
          timerange(start, end)
            .interval('1m')
            .rate(1)
            .generator((timestamp) =>
              instance
                .containerId(instanceName)
                .transaction({ transactionName: 'GET /api/product/list' })
                .timestamp(timestamp)
                .duration(1000)
                .success()
            )
        );
      });
      after(() => apmSynthtraceEsClient.clean());

      it('returns service node metadata', async () => {
        const response = await callApi();

        expect(response.status).to.be(200);

        expectSnapshot(response.body).toMatchInline(`
          Object {
            "containerId": "instance-a",
            "host": "instance-a",
          }
        `);
      });
    });
  });
}
