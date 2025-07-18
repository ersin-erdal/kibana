/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { UsageCollectionSetup } from '@kbn/usage-collection-plugin/server';
import type { CoreSetup } from '@kbn/core/server';

import type { FleetConfigType } from '..';

import { appContextService } from '../services';

import { getIsAgentsEnabled } from './config_collectors';
import { getAgentUsage, getAgentData } from './agent_collectors';
import type { AgentUsage, AgentData } from './agent_collectors';
import { getInternalClients } from './helpers';
import { getPackageUsage } from './package_collectors';
import type { PackageUsage } from './package_collectors';
import { getFleetServerUsage, getFleetServerConfig } from './fleet_server_collector';
import type { FleetServerUsage } from './fleet_server_collector';
import { getAgentPoliciesUsage } from './agent_policies';
import type { AgentPanicLogsData } from './agent_logs_panics';
import { getPanicLogsLastHour } from './agent_logs_panics';
import { getAgentLogsTopErrors } from './agent_logs_top_errors';
import type { AgentsPerOutputType } from './agents_per_output';
import { getAgentsPerOutput } from './agents_per_output';
import type { IntegrationsDetails } from './integrations_collector';
import { getIntegrationsDetails } from './integrations_collector';

export interface Usage {
  agents_enabled: boolean;
  agents: AgentUsage;
  packages: PackageUsage[];
  fleet_server: FleetServerUsage;
  agentless_agents: AgentUsage;
}

export interface FleetUsage extends Usage, AgentData {
  fleet_server_config: { policies: Array<{ input_config: any }> };
  agent_policies: {
    count: number;
    output_types: string[];
    count_with_global_data_tags: number;
    count_with_non_default_space: number;
  };
  agent_logs_panics_last_hour: AgentPanicLogsData['agent_logs_panics_last_hour'];
  agent_logs_top_errors?: string[];
  fleet_server_logs_top_errors?: string[];
  agents_per_output_type: AgentsPerOutputType[];
  integrations_details: IntegrationsDetails[];
}

export const fetchFleetUsage = async (
  core: CoreSetup,
  config: FleetConfigType,
  abortController: AbortController
): Promise<FleetUsage | undefined> => {
  const [soClient, esClient] = await getInternalClients(core);
  if (!soClient || !esClient) {
    return;
  }

  const usage = {
    agents_enabled: getIsAgentsEnabled(config),
    agents: await getAgentUsage(soClient, esClient),
    fleet_server: await getFleetServerUsage(soClient, esClient),
    packages: await getPackageUsage(soClient),
    ...(await getAgentData(esClient, soClient, abortController)),
    fleet_server_config: await getFleetServerConfig(soClient),
    agent_policies: await getAgentPoliciesUsage(soClient),
    ...(await getPanicLogsLastHour(esClient)),
    ...(await getAgentLogsTopErrors(esClient)),
    agents_per_output_type: await getAgentsPerOutput(soClient, esClient),
    license_issued_to: (await esClient.license.get()).license.issued_to,
    deployment_id: appContextService.getCloud()?.deploymentId,
    integrations_details: await getIntegrationsDetails(soClient),
    agentless_agents: await getAgentUsage(soClient, esClient, true),
  };
  return usage;
};

// used by kibana daily collector
const fetchUsage = async (core: CoreSetup, config: FleetConfigType): Promise<Usage> => {
  const [soClient, esClient] = await getInternalClients(core);
  const usage = {
    agents_enabled: getIsAgentsEnabled(config),
    agents: await getAgentUsage(soClient, esClient),
    fleet_server: await getFleetServerUsage(soClient, esClient),
    packages: await getPackageUsage(soClient),
    agentless_agents: await getAgentUsage(soClient, esClient, true),
  };
  return usage;
};

export const fetchAgentsUsage = async (core: CoreSetup, config: FleetConfigType) => {
  const [soClient, esClient] = await getInternalClients(core);
  const usage = {
    agents_enabled: getIsAgentsEnabled(config),
    agents: await getAgentUsage(soClient, esClient),
    fleet_server: await getFleetServerUsage(soClient, esClient),
    license_issued_to: (await esClient.license.get()).license.issued_to,
    deployment_id: appContextService.getCloud()?.deploymentId,
  };
  return usage;
};

export function registerFleetUsageCollector(
  core: CoreSetup,
  config: FleetConfigType,
  usageCollection: UsageCollectionSetup | undefined
): void {
  // usageCollection is an optional dependency, so make sure to return if it is not registered.
  // if for any reason the saved objects client is not available, also return
  if (!usageCollection) {
    return;
  }

  // create usage collector
  const fleetCollector = usageCollection.makeUsageCollector<Usage>({
    type: 'fleet',
    isReady: () => true,
    fetch: async () => fetchUsage(core, config),
    schema: {
      agents_enabled: { type: 'boolean' },
      agents: {
        total_enrolled: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents, in any state',
          },
        },
        healthy: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents in a healthy state',
          },
        },
        unhealthy: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents in an unhealthy state',
          },
        },
        updating: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents in an updating state',
          },
        },
        offline: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents currently offline',
          },
        },
        inactive: {
          type: 'long',
          _meta: {
            description: 'The total number of of enrolled agents currently inactive',
          },
        },
        unenrolled: {
          type: 'long',
          _meta: {
            description: 'The total number of agents currently unenrolled',
          },
        },
        total_all_statuses: {
          type: 'long',
          _meta: {
            description: 'The total number of agents in any state, both enrolled and inactive',
          },
        },
      },
      fleet_server: {
        total_enrolled: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled Fleet Server agents, in any state',
          },
        },
        total_all_statuses: {
          type: 'long',
          _meta: {
            description:
              'The total number of Fleet Server agents in any state, both enrolled and inactive.',
          },
        },
        healthy: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled Fleet Server agents in a healthy state.',
          },
        },
        unhealthy: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled Fleet Server agents in an unhealthy state',
          },
        },
        updating: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled Fleet Server agents in an updating state',
          },
        },
        offline: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled Fleet Server agents currently offline',
          },
        },
        inactive: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled Fleet Server agents currently inactive',
          },
        },
        unenrolled: {
          type: 'long',
          _meta: {
            description: 'The total number of unenrolled Fleet Server agents',
          },
        },
        num_host_urls: {
          type: 'long',
          _meta: {
            description: 'The number of Fleet Server hosts configured in Fleet settings.',
          },
        },
      },
      packages: {
        type: 'array',
        items: {
          name: { type: 'keyword' },
          version: { type: 'keyword' },
          enabled: { type: 'boolean' },
          agent_based: { type: 'boolean' },
        },
      },
      agentless_agents: {
        total_enrolled: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents, in any state',
          },
        },
        healthy: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents in a healthy state',
          },
        },
        unhealthy: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents in an unhealthy state',
          },
        },
        updating: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents in an updating state',
          },
        },
        offline: {
          type: 'long',
          _meta: {
            description: 'The total number of enrolled agents currently offline',
          },
        },
        inactive: {
          type: 'long',
          _meta: {
            description: 'The total number of of enrolled agents currently inactive',
          },
        },
        unenrolled: {
          type: 'long',
          _meta: {
            description: 'The total number of agents currently unenrolled',
          },
        },
        total_all_statuses: {
          type: 'long',
          _meta: {
            description: 'The total number of agents in any state, both enrolled and inactive',
          },
        },
      },
    },
  });

  // register usage collector
  usageCollection.registerCollector(fleetCollector);
}
