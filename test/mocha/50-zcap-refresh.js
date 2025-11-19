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
import {createRootCapability} from '@digitalbazaar/zcap';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {httpClient} from '@digitalbazaar/http-client';
import {httpsAgent} from '@bedrock/https-agent';
import {mockData} from './mock.data.js';
import {refreshZcaps} from '@bedrock/service-agent';
import {ZcapClient} from '@digitalbazaar/ezcap';

let accounts;
let api;

describe('zcap refresh', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  let capabilityAgent;
  let serviceAgent;
  let profileId;
  let rootZcap;
  let zcapClient;
  const urls = {};
  before(async () => {
    await helpers.prepareDatabase(mockData);
    passportStub = helpers.stubPassport();
    accounts = mockData.accounts;
    const baseURL = `https://${config.server.host}`;
    api = create({
      baseURL,
      headers: {Accept: 'application/ld+json, application/json'},
      httpsAgent
    });

    // create local ephemeral capability agent
    const secret = crypto.randomUUID();
    const handle = 'test';
    capabilityAgent = await CapabilityAgent.fromSecret({secret, handle});

    // delegate profile root zcap to capability agent
    const {account: {id: account}} = accounts['alpha@example.com'];
    ({
      data: {id: profileId}
    } = await api.post('/profiles', {account, didMethod: 'key'}));
    const {data} = await api.get(
      `/profile-agents/?account=${account}&profile=${profileId}`);
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

    // get service agent of interest
    const {baseUrl} = mockData;
    const serviceAgentUrl = `${baseUrl}/service-agents/refreshing`;
    ({data: serviceAgent} = await httpClient.get(serviceAgentUrl, {
      agent: httpsAgent
    }));

    // setup policy urls
    const profilePath = `${baseURL}/profiles/${encodeURIComponent(profileId)}`;
    const zcapsPath = `${profilePath}/zcaps`;
    urls.policies = `${zcapsPath}/policies`;
    urls.policy = `${urls.policies}/${encodeURIComponent(serviceAgent.id)}`;

    ({id: rootZcap} = createRootCapability({
      invocationTarget: profilePath
    }));
  });
  after(async () => {
    passportStub.restore();
  });

  it('should handle 404 for refresh policy', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // function to be called when refreshing the created config
    let expectedAfter;
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(false);
          result.error.name.should.equal('NotFoundError');
          should.not.exist(result.config);

          expectedAfter = result.refresh.after;

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...record.config, sequence: record.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      const zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent
      });
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(false);
    record.meta.refresh.after.should.equal(expectedAfter);
  });
  it('should handle 403 for refresh policy', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // create policy and refrehs zcap for another delegate
    // (to erroneously reference to trigger `NotAllowedError`)
    let wrongRefreshZcap;
    {
      const secret = crypto.randomUUID();
      const handle = 'test';
      const otherDelegate = await CapabilityAgent.fromSecret({secret, handle});
      await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: profileId,
            delegate: otherDelegate.id,
            refresh: {}
          }
        }
      });
      const {baseUrl} = mockData;
      const profilePath =
        `${baseUrl}/profiles/${encodeURIComponent(profileId)}`;
      const refreshUrl =
        `${profilePath}/zcaps` +
        `/policies/${encodeURIComponent(serviceAgent.id)}/refresh`;
      wrongRefreshZcap = await helpers.delegate({
        controller: otherDelegate.id,
        capability: `urn:zcap:root:${encodeURIComponent(profilePath)}`,
        invocationTarget: refreshUrl,
        zcapClient
      });
    }

    // function to be called when refreshing the created config
    let expectedAfter;
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(false);
          result.error.name.should.equal('NotAllowedError');
          should.not.exist(result.config);

          expectedAfter = result.refresh.after;

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...record.config, sequence: record.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      const zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent
      });
      // use wrong refresh zcap to trigger 403
      zcaps.refresh = wrongRefreshZcap;
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(false);
    record.meta.refresh.after.should.equal(expectedAfter);
  });
  it('should not refresh zcaps with "refresh=false" policy', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // add "refresh=false" policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: serviceAgent.id,
          refresh: false
        }
      }
    });

    // function to be called when refreshing the created config
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(false);
          result.refresh.after.should.equal(0);
          should.not.exist(result.config);

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...record.config, sequence: record.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      const zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent
      });
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(false);
    record.meta.refresh.after.should.equal(0);
  });
  it('should not refresh zcaps with too large TTL', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // add constrained policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: serviceAgent.id,
          refresh: {
            constraints: {
              // require fully expired zcaps
              maxTtlBeforeRefresh: 0
            }
          }
        }
      }
    });

    // function to be called when refreshing the created config
    let expectedAfter;
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const now = Date.now();
          const later = now + 1000 * 60 * 5;
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(true);
          should.exist(result.config);
          result.refresh.after.should.be.gte(later);
          should.exist(result.results);
          result.results.length.should.equal(4);
          result.results[3].refreshed.should.equal(false);
          result.results[3].refreshed.should.equal(false);
          result.results[3].refreshed.should.equal(false);
          result.results[3].refreshed.should.equal(false);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);

          expectedAfter = result.refresh.after;

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...result.config, sequence: result.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    let zcaps;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent
      });
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(true);
    record.meta.refresh.after.should.equal(expectedAfter);

    // ensure zcaps did not change
    for(const [key, value] of Object.entries(zcaps)) {
      record.config.zcaps[key].should.deep.equal(value);
    }
  });
  it('should refresh zcaps in a config', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // add unconstrained policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: serviceAgent.id,
          refresh: {
            // no constraints
            constraints: {}
          }
        }
      }
    });

    // function to be called when refreshing the created config
    let expectedAfter;
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const now = Date.now();
          const later = now + 1000 * 60 * 5;
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(true);
          should.exist(result.config);
          result.refresh.after.should.be.gte(later);
          should.exist(result.results);
          result.results.length.should.equal(4);
          result.results[0].refreshed.should.equal(true);
          result.results[1].refreshed.should.equal(true);
          result.results[2].refreshed.should.equal(true);
          result.results[3].refreshed.should.equal(true);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);

          // refresh zcap expiry should be more than 360 days from now
          const days360 = Date.now() + 1000 * 60 * 60 * 24 * 360;
          result.results.forEach(r => {
            const expires = (new Date(r.capability.expires)).getTime();
            expires.should.be.gte(days360);
          });

          // set expected after
          expectedAfter = result.refresh.after;

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...result.config, sequence: result.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    let zcaps;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent
      });
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(true);
    record.meta.refresh.after.should.equal(expectedAfter);

    // ensure zcaps changed
    for(const [key, value] of Object.entries(zcaps)) {
      record.config.zcaps[key].should.not.deep.equal(value);
    }
  });
  it('should refresh zcaps w/1 day max delegation TTL', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // add constrained policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: serviceAgent.id,
          refresh: {
            constraints: {
              maxDelegationTtl: 1000 * 60 * 60 * 24
            }
          }
        }
      }
    });

    // function to be called when refreshing the created config
    let expectedAfter;
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const now = Date.now();
          const later = now + 1000 * 60 * 5;
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(true);
          should.exist(result.config);
          result.refresh.after.should.be.gte(later);
          should.exist(result.results);
          result.results.length.should.equal(4);
          result.results[0].refreshed.should.equal(true);
          result.results[1].refreshed.should.equal(true);
          result.results[2].refreshed.should.equal(true);
          result.results[3].refreshed.should.equal(true);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);

          // refresh zcap expiry should be less than 2 days from now
          const twoDaysFromNow = Date.now() + 1000 * 60 * 60 * 24 * 2;
          result.results.forEach(r => {
            const expires = (new Date(r.capability.expires)).getTime();
            expires.should.be.lte(twoDaysFromNow);
          });

          // set expected after
          expectedAfter = result.refresh.after;

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...result.config, sequence: result.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    let zcaps;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent
      });
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(true);
    record.meta.refresh.after.should.equal(expectedAfter);

    // ensure zcaps changed
    for(const [key, value] of Object.entries(zcaps)) {
      record.config.zcaps[key].should.not.deep.equal(value);
    }
  });
  it('should refresh already-expired zcaps in a config', async () => {
    // remove any existing policy
    await zcapClient.request({
      url: urls.policy,
      capability: rootZcap,
      method: 'delete',
      action: 'write'
    });

    // add unconstrained policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: serviceAgent.id,
          refresh: {
            // no constraints
            constraints: {}
          }
        }
      }
    });

    // function to be called when refreshing the created config
    let expectedAfter;
    const configId = `${mockData.baseUrl}/refreshables/${crypto.randomUUID()}`;
    const configRefreshPromise = new Promise((resolve, reject) =>
      mockData.refreshHandlerListeners.set(configId, async ({
        record, signal
      }) => {
        try {
          const now = Date.now();
          const later = now + 1000 * 60 * 5;
          const result = await refreshZcaps({
            serviceType: 'refreshing', config: record.config, signal
          });
          result.refresh.enabled.should.equal(true);
          should.exist(result.config);
          result.refresh.after.should.be.gte(later);
          should.exist(result.results);
          result.results.length.should.equal(4);
          result.results[0].refreshed.should.equal(true);
          result.results[1].refreshed.should.equal(true);
          result.results[2].refreshed.should.equal(true);
          result.results[3].refreshed.should.equal(true);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);
          should.not.exist(result.results[0].error);

          // set expected after
          expectedAfter = result.refresh.after;

          // update record
          await mockData.refreshingService.configStorage.update({
            config: {...result.config, sequence: result.config.sequence + 1},
            refresh: {
              enabled: result.refresh.enabled,
              after: result.refresh.after
            }
          });
          resolve(mockData.refreshingService.configStorage.get({id: configId}));
        } catch(e) {
          reject(e);
        }
      }));

    let err;
    let result;
    let zcaps;
    try {
      const {id: meterId} = await helpers.createMeter({
        controller: profileId, serviceType: 'refreshing'
      });
      zcaps = await _createZcaps({
        profileId, zcapClient, serviceAgent, alreadyExpired: true
      });
      result = await helpers.createConfig({
        profileId, zcapClient, meterId, servicePath: '/refreshables',
        options: {
          id: configId,
          zcaps
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.should.have.keys([
      'controller', 'id', 'sequence', 'meterId', 'zcaps'
    ]);
    result.sequence.should.equal(0);
    result.controller.should.equal(profileId);

    // wait for refresh promise to resolve
    const record = await configRefreshPromise;
    record.config.id.should.equal(configId);
    record.config.sequence.should.equal(1);
    record.meta.refresh.enabled.should.equal(true);
    record.meta.refresh.after.should.equal(expectedAfter);

    // ensure zcaps changed
    for(const [key, value] of Object.entries(zcaps)) {
      record.config.zcaps[key].should.not.deep.equal(value);
    }
  });
});

async function _createZcaps({
  profileId, zcapClient, serviceAgent, alreadyExpired = false
}) {
  const zcaps = {};
  const {baseUrl} = mockData;

  let expires;
  let now;
  if(alreadyExpired) {
    // set now in the past, expires an hour later
    now = Date.now() - 1000 * 60 * 60 * 24 * 365;
    expires = new Date(now + 1000 * 60 * 60);
  }

  // delegate *mock* edv, hmac, and key agreement key zcaps to service agent
  zcaps.edv = await helpers.delegate({
    controller: serviceAgent.id,
    invocationTarget: `${baseUrl}/edv`,
    expires,
    zcapClient,
    now
  });
  zcaps.hmac = await helpers.delegate({
    controller: serviceAgent.id,
    invocationTarget: `${baseUrl}/hmac`,
    expires,
    zcapClient,
    now
  });
  zcaps.keyAgreementKey = await helpers.delegate({
    controller: serviceAgent.id,
    invocationTarget: `${baseUrl}/keyAgreementKey`,
    expires,
    zcapClient,
    now
  });

  // delegate refresh zcap to service agent; this zcap must not be expired
  const profilePath =
    `${baseUrl}/profiles/${encodeURIComponent(profileId)}`;
  const refreshUrl =
    `${profilePath}/zcaps` +
    `/policies/${encodeURIComponent(serviceAgent.id)}/refresh`;
  zcaps.refresh = await helpers.delegate({
    controller: serviceAgent.id,
    capability: `urn:zcap:root:${encodeURIComponent(profilePath)}`,
    invocationTarget: refreshUrl,
    zcapClient
  });

  return zcaps;
}
