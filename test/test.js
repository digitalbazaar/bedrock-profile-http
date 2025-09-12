/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {CapabilityAgent} from '@digitalbazaar/webkms-client';
import {handlers} from '@bedrock/meter-http';
import {meters as meterReporting} from '@bedrock/meter-usage-reporter';
import {meters} from '@bedrock/meter';
import {workflowService} from '@bedrock/vc-delivery';
import '@bedrock/ssm-mongodb';
import '@bedrock/kms';
import '@bedrock/edv-storage';
import '@bedrock/account';
import '@bedrock/profile';
import '@bedrock/app-identity';
import '@bedrock/https-agent';
import '@bedrock/jsonld-document-loader';
import '@bedrock/notify';
import '@bedrock/passport';
import '@bedrock/server';
import '@bedrock/kms-http';
import '@bedrock/profile-http';

// for generating workflow for interactions...
import {IdEncoder, IdGenerator} from 'bnid';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {
  processInteractionConfig
} from '@bedrock/profile-http/lib/interactions.js';
import {ZCAP_CLIENT} from '@bedrock/profile-http/lib/zcapClient.js';
import {ZcapClient} from '@digitalbazaar/ezcap';
// 128 bit random id generator
const idGenerator = new IdGenerator({bitLength: 128});
// base58-multibase-multihash encoder
const idEncoder = new IdEncoder({
  encoding: 'base58',
  multibase: true,
  multihash: true
});

import {mockData} from './mocha/mock.data.js';

bedrock.events.on('bedrock.init', async () => {
  /* Handlers need to be added before `bedrock.start` is called. These are
  no-op handlers to enable meter usage without restriction */
  handlers.setCreateHandler({
    handler({meter} = {}) {
      // use configured meter usage reporter as service ID for tests
      const serviceType = mockData.productIdMap.get(meter.product.id);
      meter.serviceId = bedrock.config['app-identity'].seeds
        .services[serviceType].id;
      return {meter};
    }
  });
  handlers.setUpdateHandler({handler: ({meter} = {}) => ({meter})});
  handlers.setRemoveHandler({handler: ({meter} = {}) => ({meter})});
  handlers.setUseHandler({handler: ({meter} = {}) => ({meter})});
});

bedrock.events.on('bedrock.ready', async () => {
  // programmatically create workflow for interactions
  {
    // create some controller for the workflow
    const secret = '53ad64ce-8e1d-11ec-bb12-10bf48838a41';
    const handle = 'test';
    const capabilityAgent = await CapabilityAgent.fromSecret({secret, handle});
    const {baseUri} = bedrock.config.server;

    const meter = {
      id: idEncoder.encode(await idGenerator.generate()),
      controller: capabilityAgent.id,
      product: {
        id: mockData.productIdMap.get('vc-workflow')
      },
      serviceId: bedrock.config['app-identity'].seeds.services['vc-workflow'].id
    };
    await meters.insert({meter});
    const meterId = `${baseUri}/meters/${meter.id}`;
    await meterReporting.upsert({id: meterId, serviceType: 'vc-workflow'});

    const localWorkflowId = idEncoder.encode(await idGenerator.generate());
    const config = {
      id: `${baseUri}/workflows/${localWorkflowId}`,
      sequence: 0,
      controller: capabilityAgent.id,
      meterId,
      steps: {
        myStep: {
          stepTemplate: {
            type: 'jsonata',
            template: `
            {
              "inviteRequest": inviteRequest
            }`
          }
        }
      },
      initialStep: 'myStep'
    };
    await workflowService.configStorage.insert({config});

    // delegate ability to read/write exchanges for workflow to app identity
    const signer = capabilityAgent.getSigner();
    const zcapClient = new ZcapClient({
      invocationSigner: signer,
      delegationSigner: signer,
      SuiteClass: Ed25519Signature2020
    });
    const readWriteExchanges = await zcapClient.delegate({
      capability: `urn:zcap:root:${encodeURIComponent(config.id)}`,
      invocationTarget: `${config.id}/exchanges`,
      controller: ZCAP_CLIENT.invocationSigner.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
      allowedActions: ['read', 'write']
    });
    // update interactions config
    const interactionsConfig = bedrock.config['profile-http'].interactions;
    interactionsConfig.enabled = true;
    interactionsConfig.types.test.zcaps
      .readWriteExchanges = JSON.stringify(readWriteExchanges);
    // re-process interactions config
    processInteractionConfig();
  }
});

import '@bedrock/test';
bedrock.start();
