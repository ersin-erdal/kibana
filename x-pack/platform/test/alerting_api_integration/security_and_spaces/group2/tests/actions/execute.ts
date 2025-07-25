/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import type { IValidatedEvent } from '@kbn/event-log-plugin/server';
import { nanosToMillis } from '@kbn/event-log-plugin/server';
import { ESTestIndexTool, ES_TEST_INDEX_NAME } from '@kbn/alerting-api-integration-helpers';
import { ActionExecutionSourceType } from '@kbn/actions-plugin/server/lib/action_execution_source';
import { systemActionScenario, UserAtSpaceScenarios } from '../../../scenarios';
import { getUrlPrefix, ObjectRemover, getEventLog } from '../../../../common/lib';
import type { FtrProviderContext } from '../../../../common/ftr_provider_context';

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const es = getService('es');
  const retry = getService('retry');
  const esTestIndexTool = new ESTestIndexTool(es, retry);

  const authorizationIndex = '.kibana-test-authorization';

  describe('execute', () => {
    const objectRemover = new ObjectRemover(supertest);

    before(async () => {
      await esTestIndexTool.destroy();
      await esTestIndexTool.setup();
      await es.indices.create({ index: authorizationIndex });
    });
    after(async () => {
      await esTestIndexTool.destroy();
      await es.indices.delete({ index: authorizationIndex });
      await objectRemover.removeAll();
    });

    for (const scenario of [...UserAtSpaceScenarios, systemActionScenario]) {
      const { user, space } = scenario;
      describe(scenario.id, () => {
        it('should handle execute request appropriately', async () => {
          const connectorTypeId = 'test.index-record';
          const { body: createdConnector } = await supertest
            .post(`${getUrlPrefix(space.id)}/api/actions/connector`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'My Connector',
              connector_type_id: connectorTypeId,
              config: {
                unencrypted: `This value shouldn't get encrypted`,
              },
              secrets: {
                encrypted: 'This value should be encrypted',
              },
            })
            .expect(200);
          objectRemover.add(space.id, createdConnector.id, 'connector', 'actions');

          const reference = `actions-execute-1:${user.username}`;
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: {
                reference,
                index: ES_TEST_INDEX_NAME,
                message: 'Testing 123',
              },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
              expect(response.statusCode).to.eql(403);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: `Unauthorized to execute a "${connectorTypeId}" action`,
              });
              break;
            case 'global_read at space1':
            case 'superuser at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(200);
              expect(response.body).to.be.an('object');
              const searchResult = await esTestIndexTool.search(
                'action:test.index-record',
                reference
              );
              // @ts-expect-error doesnt handle total: number
              expect(searchResult.body.hits.total.value).to.eql(1);
              const indexedRecord = searchResult.body.hits.hits[0];
              expect(indexedRecord._source).to.eql({
                params: {
                  reference,
                  index: ES_TEST_INDEX_NAME,
                  message: 'Testing 123',
                },
                config: {
                  unencrypted: `This value shouldn't get encrypted`,
                },
                secrets: {
                  encrypted: 'This value should be encrypted',
                },
                reference,
                source: 'action:test.index-record',
              });

              await validateEventLog({
                spaceId: space.id,
                connectorId: createdConnector.id,
                outcome: 'success',
                actionTypeId: 'test.index-record',
                message: `action executed: test.index-record:${createdConnector.id}: My Connector`,
                source: ActionExecutionSourceType.HTTP_REQUEST,
              });
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it(`shouldn't execute an connector from another space`, async () => {
          const { body: createdConnector } = await supertest
            .post(`${getUrlPrefix(space.id)}/api/actions/connector`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'My Connector',
              connector_type_id: 'test.index-record',
              config: {
                unencrypted: `This value shouldn't get encrypted`,
              },
              secrets: {
                encrypted: 'This value should be encrypted',
              },
            })
            .expect(200);
          objectRemover.add(space.id, createdConnector.id, 'connector', 'actions');

          const reference = `actions-execute-4:${user.username}`;
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix('other')}/api/actions/connector/${createdConnector.id}/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: {
                reference,
                index: ES_TEST_INDEX_NAME,
                message: 'Testing 123',
              },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
              expect(response.statusCode).to.eql(403, response.text);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Unauthorized to execute actions',
              });
              break;
            case 'global_read at space1':
            case 'superuser at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(404);
              expect(response.body).to.eql({
                statusCode: 404,
                error: 'Not Found',
                message: `Saved object [action/${createdConnector.id}] not found`,
              });
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it('should handle execute request appropriately after connector is updated', async () => {
          const connectorTypeId = 'test.index-record';
          const { body: createdConnector } = await supertest
            .post(`${getUrlPrefix(space.id)}/api/actions/connector`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'My Connector',
              connector_type_id: connectorTypeId,
              config: {
                unencrypted: `This value shouldn't get encrypted`,
              },
              secrets: {
                encrypted: 'This value should be encrypted',
              },
            })
            .expect(200);
          objectRemover.add(space.id, createdConnector.id, 'connector', 'actions');

          await supertest
            .put(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'My Connector updated',
              config: {
                unencrypted: `This value shouldn't get encrypted`,
              },
              secrets: {
                encrypted: 'This value should be encrypted',
              },
            })
            .expect(200);

          const reference = `actions-execute-2:${user.username}`;
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: {
                reference,
                index: ES_TEST_INDEX_NAME,
                message: 'Testing 123',
              },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
              expect(response.statusCode).to.eql(403);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: `Unauthorized to execute a "${connectorTypeId}" action`,
              });
              break;
            case 'global_read at space1':
            case 'superuser at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(200);
              expect(response.body).to.be.an('object');
              const searchResult = await esTestIndexTool.search(
                'action:test.index-record',
                reference
              );
              // @ts-expect-error doesnt handle total: number
              expect(searchResult.body.hits.total.value).to.eql(1);
              const indexedRecord = searchResult.body.hits.hits[0];
              expect(indexedRecord._source).to.eql({
                params: {
                  reference,
                  index: ES_TEST_INDEX_NAME,
                  message: 'Testing 123',
                },
                config: {
                  unencrypted: `This value shouldn't get encrypted`,
                },
                secrets: {
                  encrypted: 'This value should be encrypted',
                },
                reference,
                source: 'action:test.index-record',
              });
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it(`should handle execute request appropriately when connector doesn't exist`, async () => {
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/1/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: { foo: true },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
              expect(response.statusCode).to.eql(403, response.text);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Unauthorized to execute actions',
              });
              break;
            case 'global_read at space1':
            case 'superuser at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(404);
              expect(response.body).to.eql({
                statusCode: 404,
                error: 'Not Found',
                message: 'Saved object [action/1] not found',
              });
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it('should handle execute request appropriately when payload is empty and invalid', async () => {
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/1/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({});

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
            case 'global_read at space1':
            case 'superuser at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(400);
              expect(response.body).to.eql({
                statusCode: 400,
                error: 'Bad Request',
                message:
                  '[request body.params]: expected value of type [object] but got [undefined]',
              });
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it('should handle execute request appropriately after changing config properties', async () => {
          const connectorTypeId = '.email';
          const { body: createdConnector } = await supertest
            .post(`${getUrlPrefix(space.id)}/api/actions/connector`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'test email connector',
              connector_type_id: connectorTypeId,
              config: {
                from: 'email-from-1@example.com',
                // this host is specifically added to allowedHosts in:
                //    x-pack/platform/test/alerting_api_integration/common/config.ts
                host: 'some.non.existent.com',
                port: 666,
              },
              secrets: {
                user: 'email-user',
                password: 'email-password',
              },
            })
            .expect(200);
          objectRemover.add(space.id, createdConnector.id, 'connector', 'actions');

          await supertest
            .put(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'a test email connector 2',
              config: {
                from: 'email-from-2@example.com',
                service: '__json',
              },
              secrets: {
                user: 'email-user',
                password: 'email-password',
              },
            })
            .expect(200);

          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: {
                to: ['X'],
                subject: 'email-subject',
                message: 'email-message',
              },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
              expect(response.statusCode).to.eql(403);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: `Unauthorized to execute a "${connectorTypeId}" action`,
              });
              break;
            case 'global_read at space1':
            case 'superuser at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(200);
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it('should handle execute request appropriately and have proper callCluster and savedObjectsClient authorization', async () => {
          let indexedRecord: any;
          let searchResult: any;
          const reference = `actions-execute-3:${user.username}`;
          const connectorTypeId = 'test.authorization';
          const { body: createdConnector } = await supertest
            .post(`${getUrlPrefix(space.id)}/api/actions/connector`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'My Connector',
              connector_type_id: connectorTypeId,
            })
            .expect(200);
          objectRemover.add(space.id, createdConnector.id, 'connector', 'actions');

          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}/_execute`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: {
                callClusterAuthorizationIndex: authorizationIndex,
                savedObjectsClientType: 'dashboard',
                savedObjectsClientId: '1',
                index: ES_TEST_INDEX_NAME,
                reference,
              },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
              expect(response.statusCode).to.eql(403);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: `Unauthorized to execute a "${connectorTypeId}" action`,
              });
              break;
            case 'global_read at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(200);
              searchResult = await esTestIndexTool.search('action:test.authorization', reference);
              expect(searchResult.body.hits.total.value).to.eql(1);
              indexedRecord = searchResult.body.hits.hits[0];
              expect(indexedRecord._source.state).to.eql({
                callClusterSuccess: false,
                callScopedClusterSuccess: false,
                savedObjectsClientSuccess: false,
                callClusterError: {
                  ...indexedRecord._source.state.callClusterError,
                },
                callScopedClusterError: {
                  ...indexedRecord._source.state.callScopedClusterError,
                },
                savedObjectsClientError: {
                  ...indexedRecord._source.state.savedObjectsClientError,
                  output: {
                    ...indexedRecord._source.state.savedObjectsClientError.output,
                    statusCode: 403,
                  },
                },
              });
              break;
            case 'superuser at space1':
              expect(response.statusCode).to.eql(200);
              searchResult = await esTestIndexTool.search('action:test.authorization', reference);
              expect(searchResult.body.hits.total.value).to.eql(1);
              indexedRecord = searchResult.body.hits.hits[0];
              expect(indexedRecord._source.state).to.eql({
                callClusterSuccess: true,
                callScopedClusterSuccess: true,
                savedObjectsClientSuccess: false,
                savedObjectsClientError: {
                  ...indexedRecord._source.state.savedObjectsClientError,
                  output: {
                    ...indexedRecord._source.state.savedObjectsClientError.output,
                    statusCode: 404,
                  },
                },
              });
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it('should authorize system actions correctly', async () => {
          const startDate = new Date().toISOString();
          const connectorId = 'system-connector-test.system-action-kibana-privileges';
          const name = 'Test system action with kibana privileges';
          const reference = `actions-enqueue-${scenario.id}:${space.id}:${connectorId}`;

          /**
           * The test are using a test endpoint that calls the actions client.
           * The route is defined here x-pack/platform/test/alerting_api_integration/common/plugins/alerts/server/routes.ts.
           * The public execute API does not allows the execution of system actions. We use the
           * test route to test the execution of system actions
           */
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/alerts_fixture/${connectorId}/_execute_connector`)
            .auth(user.username, user.password)
            .set('kbn-xsrf', 'foo')
            .send({
              params: { index: ES_TEST_INDEX_NAME, reference },
            });

          switch (scenario.id) {
            /**
             * The users in these scenarios may have access
             * to connectors but do not have access to
             * the system action. They should not be able to
             * to execute even if they have access to connectors.
             */
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
            case 'global_read at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
              expect(response.statusCode).to.eql(403, response.text);
              expect(response.body).to.eql({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Unauthorized to execute a "test.system-action-kibana-privileges" action',
              });
              break;
            /**
             * The users in these scenarios have access
             * to connectors and to the system action. They should be able to
             * execute.
             */
            case 'superuser at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(200, response.text);

              await validateSystemEventLog({
                spaceId: space.id,
                connectorId,
                startDate,
                outcome: 'success',
                message: `action executed: test.system-action-kibana-privileges:${connectorId}: ${name}`,
                source: ActionExecutionSourceType.HTTP_REQUEST,
              });

              await esTestIndexTool.waitForDocs(
                'action:test.system-action-kibana-privileges',
                reference,
                1
              );
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });

        it('should log api key information from execute request', async () => {
          const { body: createdApiKey } = await supertest
            .post(`/internal/security/api_key`)
            .set('kbn-xsrf', 'foo')
            .send({ name: 'test user managed key' })
            .expect(200);
          const apiKey = createdApiKey.encoded;

          const connectorTypeId = 'test.index-record';
          const { body: createdConnector } = await supertest
            .post(`${getUrlPrefix(space.id)}/api/actions/connector`)
            .set('kbn-xsrf', 'foo')
            .send({
              name: 'My Connector',
              connector_type_id: connectorTypeId,
              config: {
                unencrypted: `This value shouldn't get encrypted`,
              },
              secrets: {
                encrypted: 'This value should be encrypted',
              },
            })
            .expect(200);
          objectRemover.add(space.id, createdConnector.id, 'connector', 'actions');

          const reference = `actions-execute-1:${user.username}`;
          const response = await supertestWithoutAuth
            .post(`${getUrlPrefix(space.id)}/api/actions/connector/${createdConnector.id}/_execute`)
            .set('kbn-xsrf', 'foo')
            .set('Authorization', `ApiKey ${apiKey}`)
            .send({
              params: {
                reference,
                index: ES_TEST_INDEX_NAME,
                message: 'Testing 123',
              },
            });

          switch (scenario.id) {
            case 'no_kibana_privileges at space1':
            case 'space_1_all_alerts_none_actions at space1':
            case 'space_1_all at space2':
            case 'global_read at space1':
            case 'superuser at space1':
            case 'space_1_all at space1':
            case 'space_1_all_with_restricted_fixture at space1':
            case 'system_actions at space1':
              expect(response.statusCode).to.eql(200);
              expect(response.body).to.be.an('object');
              const searchResult = await esTestIndexTool.search(
                'action:test.index-record',
                reference
              );
              // @ts-expect-error doesnt handle total: number
              expect(searchResult.body.hits.total.value > 0).to.be(true);

              const events: IValidatedEvent[] = await retry.try(async () => {
                return await getEventLog({
                  getService,
                  spaceId: space.id,
                  type: 'action',
                  id: createdConnector.id,
                  provider: 'actions',
                  actions: new Map([
                    ['execute-start', { equal: 1 }],
                    ['execute', { equal: 1 }],
                  ]),
                });
              });
              const executeEvent = events[1];
              expect(executeEvent?.kibana?.user_api_key?.id).to.eql(createdApiKey.id);
              expect(executeEvent?.kibana?.user_api_key?.name).to.eql(createdApiKey.name);
              break;
            default:
              throw new Error(`Scenario untested: ${JSON.stringify(scenario)}`);
          }
        });
      });
    }
  });

  interface ValidateEventLogParams {
    spaceId: string;
    connectorId: string;
    actionTypeId: string;
    outcome: string;
    message: string;
    errorMessage?: string;
    source?: string;
    spaceAgnostic?: boolean;
  }

  async function validateEventLog(params: ValidateEventLogParams): Promise<void> {
    const {
      spaceId,
      connectorId,
      actionTypeId,
      outcome,
      message,
      errorMessage,
      source,
      spaceAgnostic,
    } = params;

    const events: IValidatedEvent[] = await retry.try(async () => {
      return await getEventLog({
        getService,
        spaceId,
        type: 'action',
        id: connectorId,
        provider: 'actions',
        actions: new Map([
          ['execute-start', { equal: 1 }],
          ['execute', { equal: 1 }],
        ]),
      });
    });

    const startExecuteEvent = events[0];
    const executeEvent = events[1];

    const duration = executeEvent?.event?.duration;
    const executeEventStart = Date.parse(executeEvent?.event?.start || 'undefined');
    const startExecuteEventStart = Date.parse(startExecuteEvent?.event?.start || 'undefined');
    const executeEventEnd = Date.parse(executeEvent?.event?.end || 'undefined');
    const dateNow = Date.now();

    expect(typeof duration).to.be('string');
    expect(executeEventStart).to.be.ok();
    expect(startExecuteEventStart).to.equal(executeEventStart);
    expect(executeEventEnd).to.be.ok();

    const durationDiff = Math.abs(nanosToMillis(duration!) - (executeEventEnd - executeEventStart));

    // account for rounding errors
    expect(durationDiff < 1).to.equal(true);
    expect(executeEventStart <= executeEventEnd).to.equal(true);
    expect(executeEventEnd <= dateNow).to.equal(true);

    expect(executeEvent?.event?.outcome).to.equal(outcome);

    expect(executeEvent?.kibana?.saved_objects).to.eql([
      {
        rel: 'primary',
        type: 'action',
        id: connectorId,
        namespace: 'space1',
        type_id: actionTypeId,
        ...(spaceAgnostic ? { space_agnostic: true } : {}),
      },
    ]);
    expect(startExecuteEvent?.kibana?.saved_objects).to.eql(executeEvent?.kibana?.saved_objects);

    expect(executeEvent?.message).to.eql(message);
    expect(startExecuteEvent?.message).to.eql(message.replace('executed', 'started'));

    expect(executeEvent?.kibana?.action?.execution?.usage?.request_body_bytes).to.eql(0);

    if (source) {
      expect(executeEvent?.kibana?.action?.execution?.source).to.eql(source.toLowerCase());
    }

    if (errorMessage) {
      expect(executeEvent?.error?.message).to.eql(errorMessage);
    }
  }

  const validateSystemEventLog = async (
    params: Omit<ValidateEventLogParams, 'actionTypeId' | 'spaceAgnostic'> & { startDate: string }
  ): Promise<void> => {
    const { spaceId, connectorId, outcome, message, startDate, errorMessage, source } = params;

    const events: IValidatedEvent[] = await retry.try(async () => {
      const events_ = await getEventLog({
        getService,
        spaceId,
        type: 'action',
        id: connectorId,
        provider: 'actions',
        actions: new Map([['execute', { gte: 1 }]]),
      });

      const filteredEvents = events_.filter((event) => event!['@timestamp']! >= startDate);
      if (filteredEvents.length < 1) throw new Error('no recent events found yet');

      return filteredEvents;
    });

    expect(events.length).to.be(1);

    const event = events[0];

    expect(event?.message).to.eql(message);
    expect(event?.event?.outcome).to.eql(outcome);

    if (errorMessage) {
      expect(event?.error?.message).to.eql(errorMessage);
    }

    if (source) {
      expect(event?.kibana?.action?.execution?.source).to.eql(source.toLowerCase());
    }
  };
}
