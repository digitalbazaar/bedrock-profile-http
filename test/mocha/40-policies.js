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
import https from 'node:https';
import {httpsAgent} from '@bedrock/https-agent';
import {mockData} from './mock.data.js';
import {ZcapClient} from '@digitalbazaar/ezcap';

let accounts;
let api;

describe('policies', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  let capabilityAgent;
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
      httpsAgent: new https.Agent({rejectUnauthorized: false})
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

    // setup policy urls
    const profilePath = `${baseURL}/profiles/${encodeURIComponent(profileId)}`;
    const zcapsPath = `${profilePath}/zcaps`;
    urls.policies = `${zcapsPath}/policies`;
    urls.refresh = `${zcapsPath}/refresh`;

    ({id: rootZcap} = createRootCapability({
      invocationTarget: profilePath
    }));
  });
  after(async () => {
    passportStub.restore();
  });

  it('fails to create a new policy with bad post data', async () => {
    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
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

  it('fails to create a new policy with bad controller', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: 'did:example:1234',
            delegate: delegate.id,
            refresh: false
          }
        }
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(403);
    err.data.name.should.equal('NotAllowedError');
  });

  it('creates a new "refresh=false" policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: profileId,
            delegate: delegate.id,
            refresh: false
          }
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(201);
    const expectedLocation =
      `${urls.policies}/${encodeURIComponent(delegate.id)}`;
    result.headers.get('location').should.equal(expectedLocation);
    result.data.should.deep.equal({
      policy: {
        sequence: 0,
        controller: profileId,
        delegate: delegate.id,
        refresh: false
      }
    });
  });

  it('creates a new policy with no constraints', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: profileId,
            delegate: delegate.id,
            refresh: {}
          }
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(201);
    const expectedLocation =
      `${urls.policies}/${encodeURIComponent(delegate.id)}`;
    result.headers.get('location').should.equal(expectedLocation);
    result.data.should.deep.equal({
      policy: {
        sequence: 0,
        controller: profileId,
        delegate: delegate.id,
        refresh: {}
      }
    });
  });

  it('creates a new policy with empty constraints', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: profileId,
            delegate: delegate.id,
            refresh: {
              constraints: {}
            }
          }
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(201);
    const expectedLocation =
      `${urls.policies}/${encodeURIComponent(delegate.id)}`;
    result.headers.get('location').should.equal(expectedLocation);
    result.data.should.deep.equal({
      policy: {
        sequence: 0,
        controller: profileId,
        delegate: delegate.id,
        refresh: {
          constraints: {}
        }
      }
    });
  });

  it('creates a new policy with constraints', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: urls.policies,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: profileId,
            delegate: delegate.id,
            refresh: {
              constraints: {
                // must be 30 days from expiry or less
                maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
              }
            }
          }
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(201);
    const expectedLocation =
      `${urls.policies}/${encodeURIComponent(delegate.id)}`;
    result.headers.get('location').should.equal(expectedLocation);
    result.data.should.deep.equal({
      policy: {
        sequence: 0,
        controller: profileId,
        delegate: delegate.id,
        refresh: {
          constraints: {
            // must be 30 days from expiry or less
            maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
          }
        }
      }
    });
  });

  it('fails to update an existing policy w/ wrong sequence', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add initial policy w/o refresh support
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: false
        }
      }
    });

    // fail to update existing policy to enable refresh w/constraints
    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 0,
            controller: profileId,
            delegate: delegate.id,
            refresh: {
              constraints: {
                // must be 30 days from expiry or less
                maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
              }
            }
          }
        }
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(409);
    err.data.name.should.equal('InvalidStateError');
  });

  it('updates an existing "refresh=false" policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add initial policy w/o refresh support
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: false
        }
      }
    });

    // update existing policy to enable refresh w/constraints
    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 1,
            controller: profileId,
            delegate: delegate.id,
            refresh: {
              constraints: {
                // must be 30 days from expiry or less
                maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
              }
            }
          }
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.should.deep.equal({
      policy: {
        sequence: 1,
        controller: profileId,
        delegate: delegate.id,
        refresh: {
          constraints: {
            // must be 30 days from expiry or less
            maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
          }
        }
      }
    });
  });

  it('updates an existing policy w/constraints', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add initial policy w/o refresh support
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: {
            constraints: {
              // must be 30 days from expiry or less
              maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
            }
          }
        }
      }
    });

    // update existing policy to enable refresh w/constraints
    let err;
    let result;
    try {
      result = await zcapClient.write({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap,
        json: {
          policy: {
            sequence: 1,
            controller: profileId,
            delegate: delegate.id,
            refresh: false
          }
        }
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.should.deep.equal({
      policy: {
        sequence: 1,
        controller: profileId,
        delegate: delegate.id,
        refresh: false
      }
    });
  });

  it('deletes nothing for a non-existent policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // delete existing policy
    let err;
    let result;
    try {
      result = await zcapClient.request({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap,
        method: 'delete',
        action: 'write'
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.deleted.should.equal(false);
  });

  it('deletes an existing policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add policy to delete
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: false
        }
      }
    });

    // delete existing policy
    let err;
    let result;
    try {
      result = await zcapClient.request({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap,
        method: 'delete',
        action: 'write'
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.deleted.should.equal(true);
  });

  it('get existing policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: {
            constraints: {
              // must be 30 days from expiry or less
              maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
            }
          }
        }
      }
    });

    // get policy
    let err;
    let result;
    try {
      result = await zcapClient.read({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.should.deep.equal({
      policy: {
        sequence: 0,
        controller: profileId,
        delegate: delegate.id,
        refresh: {
          constraints: {
            // must be 30 days from expiry or less
            maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
          }
        }
      }
    });
  });

  it('fails to get non-existent policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // fail to get policy
    let err;
    let result;
    try {
      result = await zcapClient.read({
        url: `${urls.policies}/${encodeURIComponent(delegate.id)}`,
        capability: rootZcap
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(404);
    err.data.name.should.equal('NotFoundError');
  });

  it('gets multiple policies', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: {
            constraints: {
              // must be 30 days from expiry or less
              maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
            }
          }
        }
      }
    });

    // get policies
    let err;
    let result;
    try {
      result = await zcapClient.read({
        url: urls.policies,
        capability: rootZcap
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.results.should.be.an('array');
    result.data.results.length.should.be.gte(1);
  });

  it('gets a delegate-viewable policy', async () => {
    const secret = crypto.randomUUID();
    const handle = 'test';
    const delegate = await CapabilityAgent.fromSecret({secret, handle});

    // add policy
    await zcapClient.write({
      url: urls.policies,
      capability: rootZcap,
      json: {
        policy: {
          sequence: 0,
          controller: profileId,
          delegate: delegate.id,
          refresh: {
            constraints: {
              // must be 30 days from expiry or less
              maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
            }
          }
        }
      }
    });

    let err;
    let result;
    try {
      result = await zcapClient.read({
        url:
          `${urls.policies}/${encodeURIComponent(delegate.id)}/refresh/policy`,
        capability: rootZcap
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.status.should.equal(200);
    result.data.should.deep.equal({
      policy: {
        refresh: {
          constraints: {
            // must be 30 days from expiry or less
            maxTtlBeforeRefresh: 1000 * 60 * 60 * 24 * 30
          }
        }
      }
    });
  });
});
