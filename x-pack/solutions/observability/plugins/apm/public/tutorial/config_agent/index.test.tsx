/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { HttpStart } from '@kbn/core/public';
import React from 'react';
import { expectTextsInDocument, expectTextsNotInDocument } from '../../utils/test_helpers';
import { TutorialConfigAgent } from '.';

const policyElasticAgentOnCloudAgent = {
  id: 'policy-elastic-agent-on-cloud',
  name: 'Elastic Cloud agent policy',
  apmServerUrl: 'apm_cloud_url',
  secretToken: 'apm_cloud_token',
};

const fleetAgents = [
  {
    id: '1',
    name: 'agent foo',
    apmServerUrl: 'foo url',
    secretToken: 'foo token',
  },
  {
    id: '2',
    name: 'agent bar',
    apmServerUrl: 'bar url',
    secretToken: 'bar token',
  },
];

describe('TutorialConfigAgent', () => {
  beforeAll(() => {
    // Mocks console.error so it won't polute tests output when testing the api throwing error
    jest.spyOn(console, 'error').mockImplementation(() => null);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('when fleet plugin is enabled', () => {
    it('renders loading component while API is being called', () => {
      const component = render(
        <TutorialConfigAgent
          variantId="java"
          http={
            {
              get: jest.fn(),
            } as unknown as HttpStart
          }
          basePath="http://localhost:5601"
          isCloudEnabled
          kibanaVersion="8.0.0"
        />
      );
      expect(component.getByTestId('loading')).toBeInTheDocument();
    });
    it('updates commands when a different policy is selected', async () => {
      const component = render(
        <TutorialConfigAgent
          variantId="java"
          http={
            {
              get: jest.fn().mockReturnValue({
                cloudStandaloneSetup: undefined,
                fleetAgents,
                isFleetEnabled: true,
              }),
            } as unknown as HttpStart
          }
          basePath="http://localhost:5601"
          isCloudEnabled={false}
          kibanaVersion="8.0.0"
        />
      );

      const policySelectorWrapper = await screen.findByTestId('policySelector_onPrem');
      expect(policySelectorWrapper).toBeInTheDocument();

      const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
      expect(input).toHaveValue('Default Standalone configuration');

      let commands = component.getByTestId('commands').innerHTML;
      expect(commands).not.toEqual('');
      expect(commands).toMatchInlineSnapshot(`
        "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
        -Delastic.apm.service_name=my-service-name \\\\
        -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
        -Delastic.apm.server_url=http://localhost:8200 \\\\
        -Delastic.apm.environment=my-environment \\\\
        -Delastic.apm.application_packages=org.example \\\\
        -jar my-service-name.jar"
      `);

      fireEvent.click(component.getByTestId('comboBoxToggleListButton'));
      fireEvent.click(component.getByText('agent foo'));
      commands = component.getByTestId('commands').innerHTML;
      expect(commands).not.toEqual('');
      expect(commands).toMatchInlineSnapshot(`
        "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
        -Delastic.apm.service_name=my-service-name \\\\
        -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
        -Delastic.apm.server_url=foo url \\\\
        -Delastic.apm.environment=my-environment \\\\
        -Delastic.apm.application_packages=org.example \\\\
        -jar my-service-name.jar"
      `);
    });
    describe('running on prem', () => {
      it('selects defaul standalone by defauls', async () => {
        const component = render(
          <TutorialConfigAgent
            variantId="java"
            http={
              {
                get: jest.fn().mockReturnValue({
                  cloudStandaloneSetup: undefined,
                  fleetAgents,
                  isFleetEnabled: true,
                }),
              } as unknown as HttpStart
            }
            basePath="http://localhost:5601"
            isCloudEnabled={false}
            kibanaVersion="8.0.0"
          />
        );

        const policySelectorWrapper = await screen.findByTestId('policySelector_onPrem');
        expect(policySelectorWrapper).toBeInTheDocument();

        const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
        expect(input).toHaveValue('Default Standalone configuration');

        const commands = component.getByTestId('commands').innerHTML;
        expect(commands).not.toEqual('');
        expect(commands).toMatchInlineSnapshot(`
          "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
          -Delastic.apm.service_name=my-service-name \\\\
          -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
          -Delastic.apm.server_url=http://localhost:8200 \\\\
          -Delastic.apm.environment=my-environment \\\\
          -Delastic.apm.application_packages=org.example \\\\
          -jar my-service-name.jar"
        `);
      });
      it('shows get started with fleet link when there are no fleet agents', async () => {
        const component = render(
          <TutorialConfigAgent
            variantId="java"
            http={
              {
                get: jest.fn().mockReturnValue({
                  cloudStandaloneSetup: undefined,
                  fleetAgents: [],
                  isFleetEnabled: true,
                }),
              } as unknown as HttpStart
            }
            basePath="http://localhost:5601"
            isCloudEnabled
            kibanaVersion="8.0.0"
          />
        );

        const policySelectorWrapper = await screen.findByTestId('policySelector_onPrem');
        expect(policySelectorWrapper).toBeInTheDocument();

        const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
        expect(input).toHaveValue('Default Standalone configuration');

        const commands = component.getByTestId('commands').innerHTML;
        expect(commands).not.toEqual('');
        expect(commands).toMatchInlineSnapshot(`
          "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
          -Delastic.apm.service_name=my-service-name \\\\
          -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
          -Delastic.apm.server_url=http://localhost:8200 \\\\
          -Delastic.apm.environment=my-environment \\\\
          -Delastic.apm.application_packages=org.example \\\\
          -jar my-service-name.jar"
        `);
        expectTextsInDocument(component, ['Get started with fleet']);
      });
    });
    describe('running on cloud', () => {
      it('selects defaul standalone by defauls', async () => {
        const component = render(
          <TutorialConfigAgent
            variantId="java"
            http={
              {
                get: jest.fn().mockReturnValue({
                  cloudStandaloneSetup: {
                    apmServerUrl: 'cloud_url',
                    secretToken: 'cloud_token',
                  },
                  fleetAgents,
                  isFleetEnabled: true,
                }),
              } as unknown as HttpStart
            }
            basePath="http://localhost:5601"
            isCloudEnabled
            kibanaVersion="8.0.0"
          />
        );

        const policySelectorWrapper = await screen.findByTestId('policySelector_cloud');
        expect(policySelectorWrapper).toBeInTheDocument();

        const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
        expect(input).toHaveValue('Default Standalone configuration');

        const commands = component.getByTestId('commands').innerHTML;
        expect(commands).not.toEqual('');
        expect(commands).toMatchInlineSnapshot(`
          "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
          -Delastic.apm.service_name=my-service-name \\\\
          -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
          -Delastic.apm.server_url=cloud_url \\\\
          -Delastic.apm.environment=my-environment \\\\
          -Delastic.apm.application_packages=org.example \\\\
          -jar my-service-name.jar"
        `);
      });
      it('selects policy elastic agent on cloud when available by default', async () => {
        const component = render(
          <TutorialConfigAgent
            variantId="java"
            http={
              {
                get: jest.fn().mockReturnValue({
                  cloudStandaloneSetup: {
                    apmServerUrl: 'cloud_url',
                    secretToken: 'cloud_token',
                  },
                  fleetAgents: [...fleetAgents, policyElasticAgentOnCloudAgent],
                  isFleetEnabled: true,
                }),
              } as unknown as HttpStart
            }
            basePath="http://localhost:5601"
            isCloudEnabled
            kibanaVersion="8.0.0"
          />
        );

        const policySelectorWrapper = await screen.findByTestId(
          'policySelector_policy-elastic-agent-on-cloud'
        );
        expect(policySelectorWrapper).toBeInTheDocument();

        const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
        expect(input).toHaveValue('Elastic Cloud agent policy');

        const commands = component.getByTestId('commands').innerHTML;
        expect(commands).not.toEqual('');
        expect(commands).toMatchInlineSnapshot(`
          "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
          -Delastic.apm.service_name=my-service-name \\\\
          -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
          -Delastic.apm.server_url=apm_cloud_url \\\\
          -Delastic.apm.environment=my-environment \\\\
          -Delastic.apm.application_packages=org.example \\\\
          -jar my-service-name.jar"
        `);
      });

      it('shows default standalone option when api throws an error', async () => {
        const component = render(
          <TutorialConfigAgent
            variantId="java"
            http={
              {
                get: () => {
                  throw new Error('Boom');
                },
              } as unknown as HttpStart
            }
            basePath="http://localhost:5601"
            isCloudEnabled
            kibanaVersion="8.0.0"
          />
        );

        const policySelectorWrapper = await screen.findByTestId('policySelector_onPrem');
        expect(policySelectorWrapper).toBeInTheDocument();

        const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
        expect(input).toHaveValue('Default Standalone configuration');

        const commands = component.getByTestId('commands').innerHTML;
        expect(commands).not.toEqual('');
        expect(commands).toMatchInlineSnapshot(`
          "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
          -Delastic.apm.service_name=my-service-name \\\\
          -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
          -Delastic.apm.server_url=http://localhost:8200 \\\\
          -Delastic.apm.environment=my-environment \\\\
          -Delastic.apm.application_packages=org.example \\\\
          -jar my-service-name.jar"
        `);
      });
    });
  });
  describe('when fleet plugin is disabled', () => {
    it('hides fleet links', async () => {
      const component = render(
        <TutorialConfigAgent
          variantId="java"
          http={
            {
              get: jest.fn().mockReturnValue({
                cloudStandaloneSetup: undefined,
                fleetAgents: [],
                isFleetEnabled: false,
              }),
            } as unknown as HttpStart
          }
          basePath="http://localhost:5601"
          isCloudEnabled
          kibanaVersion="8.0.0"
        />
      );

      expectTextsNotInDocument(component, ['Get started with fleet', 'Manage fleet policies']);
    });
    it('shows default standalone on prem', async () => {
      const component = render(
        <TutorialConfigAgent
          variantId="java"
          http={
            {
              get: jest.fn().mockReturnValue({
                cloudStandaloneSetup: undefined,
                fleetAgents: [],
                isFleetEnabled: false,
              }),
            } as unknown as HttpStart
          }
          basePath="http://localhost:5601"
          isCloudEnabled
          kibanaVersion="8.0.0"
        />
      );

      const policySelectorWrapper = await screen.findByTestId('policySelector_onPrem');
      expect(policySelectorWrapper).toBeInTheDocument();

      const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
      expect(input).toHaveValue('Default Standalone configuration');

      const commands = component.getByTestId('commands').innerHTML;
      expect(commands).not.toEqual('');
      expect(commands).toMatchInlineSnapshot(`
        "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
        -Delastic.apm.service_name=my-service-name \\\\
        -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
        -Delastic.apm.server_url=http://localhost:8200 \\\\
        -Delastic.apm.environment=my-environment \\\\
        -Delastic.apm.application_packages=org.example \\\\
        -jar my-service-name.jar"
      `);
    });
    it('shows default standalone on cloud', async () => {
      const component = render(
        <TutorialConfigAgent
          variantId="java"
          http={
            {
              get: jest.fn().mockReturnValue({
                cloudStandaloneSetup: {
                  apmServerUrl: 'cloud_url',
                  secretToken: 'cloud_token',
                },
                fleetAgents: [],
                isFleetEnabled: false,
              }),
            } as unknown as HttpStart
          }
          basePath="http://localhost:5601"
          isCloudEnabled
          kibanaVersion="8.0.0"
        />
      );
      const policySelectorWrapper = await screen.findByTestId('policySelector_cloud');
      expect(policySelectorWrapper).toBeInTheDocument();

      const input = within(policySelectorWrapper).getByTestId('comboBoxSearchInput');
      expect(input).toHaveValue('Default Standalone configuration');

      const commands = component.getByTestId('commands').innerHTML;
      expect(commands).not.toEqual('');
      expect(commands).toMatchInlineSnapshot(`
        "java -javaagent:/path/to/elastic-apm-agent-&lt;version&gt;.jar \\\\
        -Delastic.apm.service_name=my-service-name \\\\
        -Delastic.apm.secret_token=&lt;SECRET_TOKEN&gt; \\\\
        -Delastic.apm.server_url=cloud_url \\\\
        -Delastic.apm.environment=my-environment \\\\
        -Delastic.apm.application_packages=org.example \\\\
        -jar my-service-name.jar"
      `);
    });
  });
});
