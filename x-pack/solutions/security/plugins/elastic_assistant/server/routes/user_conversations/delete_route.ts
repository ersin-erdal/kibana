/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { transformError } from '@kbn/securitysolution-es-utils';
import {
  ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID,
  DeleteConversationRequestParams,
  API_VERSIONS,
} from '@kbn/elastic-assistant-common';
import { buildRouteValidationWithZod } from '@kbn/elastic-assistant-common/impl/schemas/common';
import { ElasticAssistantPluginRouter } from '../../types';
import { buildResponse } from '../utils';
import { performChecks } from '../helpers';

export const deleteConversationRoute = (router: ElasticAssistantPluginRouter) => {
  router.versioned
    .delete({
      access: 'public',
      path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID,
      security: {
        authz: {
          requiredPrivileges: ['elasticAssistant'],
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.public.v1,
        validate: {
          request: {
            params: buildRouteValidationWithZod(DeleteConversationRequestParams),
          },
        },
      },
      async (context, request, response) => {
        const assistantResponse = buildResponse(response);
        try {
          const { id } = request.params;

          const ctx = await context.resolve(['core', 'elasticAssistant', 'licensing']);
          const checkResponse = await performChecks({
            context: ctx,
            request,
            response,
          });
          if (!checkResponse.isSuccess) {
            return checkResponse.response;
          }
          const dataClient = await ctx.elasticAssistant.getAIAssistantConversationsDataClient();

          const authenticatedUser = checkResponse.currentUser;

          const existingConversation = await dataClient?.getConversation({ id, authenticatedUser });
          if (existingConversation == null) {
            return assistantResponse.error({
              body: `conversation id: "${id}" not found`,
              statusCode: 404,
            });
          }
          await dataClient?.deleteConversation(id);

          return response.ok({ body: {} });
        } catch (err) {
          const error = transformError(err);
          return assistantResponse.error({
            body: error.message,
            statusCode: error.statusCode,
          });
        }
      }
    );
};
