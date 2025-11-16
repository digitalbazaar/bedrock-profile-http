/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as helpers from './helpers.js';
import {
  AsymmetricKey,
  CapabilityAgent,
  KmsClient
} from '@digitalbazaar/webkms-client';
import {config} from '@bedrock/core';
// apisauce is a wrapper around axios that provides improved error handling
import {create} from 'apisauce';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import https from 'node:https';
import {httpsAgent} from '@bedrock/https-agent';
import {mockData} from './mock.data.js';
import {ZcapClient} from '@digitalbazaar/ezcap';

let accounts;
let api;

const baseURL = `https://${config.server.host}`;

describe('policies', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  let capabilityAgent;
  let zcapClient;
  const urls = {};
  before(async () => {
    await helpers.prepareDatabase(mockData);
    passportStub = helpers.stubPassport();
    accounts = mockData.accounts;
    api = create({
      baseURL,
      headers: {Accept: 'application/ld+json, application/json'},
      httpsAgent: new https.Agent({rejectUnauthorized: false})
    });

    // create local ephemeral capability agent
    const secret = crypto.randomUUID();
    const handle = 'test';
    capabilityAgent = await CapabilityAgent.fromSecret({secret, handle});

    // delegate profile root zcap to capability agent
    const {account: {id: account}} = accounts['alpha@example.com'];
    const {data: {id: profileId}} = await api.post('/profiles',
      {account, didMethod: 'key'});
    const {data} = await api.get(`/profile-agents/?account=${account}` +
      `&profile=${profileId}`);
    const [{profileAgent}] = data;
    const {id: profileAgentId} = profileAgent;
    const zcap = profileAgent.zcaps.profileCapabilityInvocationKey;
    const result = await api.post(
      `/profile-agents/${profileAgentId}/capabilities/delegate`, {
        controller: capabilityAgent.id, account, zcap
      });

    // create `invocationSigner` interface for acting as profile
    const profileSigner = await AsymmetricKey.fromCapability({
      capability: result.data.zcap,
      invocationSigner: capabilityAgent.getSigner(),
      kmsClient: new KmsClient({httpsAgent})
    });
    zcapClient = new ZcapClient({
      agent: httpsAgent,
      invocationSigner: profileSigner,
      delegationSigner: profileSigner,
      SuiteClass: Ed25519Signature2020
    });

    // create test "delegates" for whom the policies will be about
    const delegates = [];
    for(let i = 0; i < 2; ++i) {
      const secret = crypto.randomUUID();
      const handle = 'test';
      const delegate = await CapabilityAgent.fromSecret({secret, handle});
      delegates.push(delegate);
    }

    // setup policy urls
    const profilePath = `${baseURL}/profiles/${encodeURIComponent(profileId)}`;
    const zcapsPath = `${profilePath}/zcaps`;
    urls.policies = `${zcapsPath}/policies`;
    urls.refresh = `${zcapsPath}/refresh`;
    urls.viewablePolicy = `${urls.refresh}/policy`;
  });
  after(async () => {
    passportStub.restore();
  });

  it('fails to create a new policy with bad post data', async () => {
    should.exist(zcapClient);

    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        json: {foo: {}, policy: {}}
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(400);
    err.data.details.errors.should.have.length(1);
    const [error] = err.data.details.errors;
    error.name.should.equal('ValidationError');
    error.message.should.contain('should NOT have additional properties');
  });
});
