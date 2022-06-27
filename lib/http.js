/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {profileAgents, profileMeters, profiles} from '@bedrock/profile';
import {asyncHandler} from '@bedrock/express';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {ensureAuthenticated} from '@bedrock/passport';
import {getAppIdentity} from '@bedrock/app-identity';
import {httpsAgent} from '@bedrock/https-agent';
import {createValidateMiddleware as validate} from '@bedrock/validation';
import {ZcapClient} from '@digitalbazaar/ezcap';

const {config, util: {BedrockError}} = bedrock;

let APP_ID;
let EDV_METER_CREATION_ZCAP;
let WEBKMS_METER_CREATION_ZCAP;
let ZCAP_CLIENT;

bedrock.events.on('bedrock.init', () => {
  // create signer using the application's capability invocation key
  const {id, keys: {capabilityInvocationKey}} = getAppIdentity();
  APP_ID = id;

  ZCAP_CLIENT = new ZcapClient({
    agent: httpsAgent,
    invocationSigner: capabilityInvocationKey.signer(),
    SuiteClass: Ed25519Signature2020
  });

  const cfg = bedrock.config['profile-http'];
  const {edvMeterCreationZcap, webKmsMeterCreationZcap} = cfg;
  if(edvMeterCreationZcap) {
    EDV_METER_CREATION_ZCAP = JSON.parse(edvMeterCreationZcap);
  }
  if(webKmsMeterCreationZcap) {
    WEBKMS_METER_CREATION_ZCAP = JSON.parse(webKmsMeterCreationZcap);
  }
});

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = config['profile-http'];
  const {defaultProducts} = cfg;
  const {basePath} = cfg.routes;
  const profileAgentsPath = '/profile-agents';
  const profileAgentPath = `${profileAgentsPath}/:profileAgentId`;
  const routes = {
    profiles: basePath,
    profileAgents: `${profileAgentsPath}`,
    profileAgent: `${profileAgentPath}`,
    profileAgentClaim: `${profileAgentPath}/claim`,
    profileAgentCapabilities: `${profileAgentPath}/capabilities/delegate`,
    profileAgentCapabilitySet: `${profileAgentPath}/capability-set`
  };

  // create a new profile
  app.post(
    routes.profiles,
    ensureAuthenticated,
    validate({bodySchema: schemas.accountQuery}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account, didMethod, didOptions} = req.body;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      // create a new meter, edv options, and keystore options
      const [{id: edvMeterId}, {id: kmsMeterId}] = await Promise.all([
        _createMeter({
          // controller of meter is the app that runs bedrock-profile-http
          controller: APP_ID,
          // use default EDV product; specifying in request not supported
          productId: defaultProducts.edv,
          // use zcap for edv meter creation; when undefined invoke root zcap
          capability: EDV_METER_CREATION_ZCAP,
        }),
        _createMeter({
          // controller of meter is the app that runs bedrock-profile-http
          controller: APP_ID,
          // use default webkms product; specifying in request not supported
          productId: defaultProducts.webkms,
          // use zcap for webkms meter creation; when undefined invoke root zcap
          capability: WEBKMS_METER_CREATION_ZCAP,
        })
      ]);
      const edvOptions = {
        baseUrl: cfg.edvBaseUrl,
        meterId: edvMeterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };
      // add any additionally configured EDVs
      if(cfg.additionalEdvs) {
        edvOptions.additionalEdvs = Object.values(cfg.additionalEdvs);
      }
      const keystoreOptions = {
        meterId: kmsMeterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };

      const profile = await profiles.create({
        accountId: account,
        didMethod,
        keystoreOptions: {
          profileAgent: keystoreOptions,
          profile: keystoreOptions
        },
        edvOptions: {
          profile: edvOptions
        },
        didOptions
      });

      res.json(profile);
    }));

  // creates a profile agent, optionally w/ account set
  app.post(
    routes.profileAgents,
    ensureAuthenticated,
    validate({bodySchema: schemas.profileAgent}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account, profile, token} = req.body;

      if(!accountId || (account && account !== accountId)) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      // create a new meter and keystore options
      const {id: meterId} = await _createMeter({
        // controller of meter is app that runs bedrock-profile-http
        controller: APP_ID,
        // use default webkms product; specifying in request not supported
        productId: defaultProducts.webkms,
        // use zcap for webkms meter creation; when undefined invoke root zcap
        capability: WEBKMS_METER_CREATION_ZCAP,
      });
      const keystoreOptions = {
        meterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };

      const options = {
        profileId: profile,
        keystoreOptions,
        store: true
      };
      if(account) {
        options.accountId = account;
      }
      if(token) {
        options.token = token;
      }

      const profileAgentRecord = await profileAgents.create(options);
      const {meters} = await profileMeters.findByProfile({
        profileId: profile
      });

      res.json({
        ..._sanitizeProfileAgentRecord(profileAgentRecord),
        profileMeters: meters
      });
    }));

  // gets all profile agents associated with an account
  app.get(
    routes.profileAgents,
    ensureAuthenticated,
    validate({querySchema: schemas.profileAgents}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account, profile} = req.query;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const profileAgentRecords = await profileAgents.getAll({
        accountId: account
      });
      if(profile) {
        const {meters} = await profileMeters.findByProfile({
          profileId: profile
        });
        // Note: In the next major release, this API should not repeat the same
        //       set of meters for each profile.
        const records = profileAgentRecords.filter(({profileAgent}) => {
          return profileAgent.profile === profile;
        }).map(r => ({...r, profileMeters: meters}));
        return res.json(records);
      }

      const profileMetersMap = new Map();
      const promises = profileAgentRecords.map(async record => {
        const {profile} = record.profileAgent;
        let promise = profileMetersMap.get(profile);
        if(!promise) {
          promise = profileMeters.findByProfile({profileId: profile});
          profileMetersMap.set(profile, promise);
        }

        const {meters} = await promise;
        return {
          ...record,
          profileMeters: meters
        };
      });

      // No concurrency protection due to the assumption that for a given
      // aaccount there will be <= 10 profiles
      const records = await Promise.all(promises);
      res.json(records);
    }));

  // gets a profile agent by its "id"
  app.get(
    routes.profileAgent,
    ensureAuthenticated,
    validate({querySchema: schemas.accountQuery}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account} = req.query;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const profileAgentRecord = await profileAgents.get({id: profileAgentId});

      // if profile agent is claimed (has an `account`), ensure profile agent
      // `account` matches session account
      const {profileAgent} = profileAgentRecord;
      if(profileAgent.account && profileAgent.account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      const {profile} = profileAgent;
      const {meters} = await profileMeters.findByProfile({profileId: profile});

      res.json({...profileAgentRecord, profileMeters: meters});
    }));

  // deletes a profile agent by its "id"
  app.delete(
    routes.profileAgent,
    ensureAuthenticated,
    validate({querySchema: schemas.accountQuery}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account} = req.query;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      // require `account` to also match the profile agent
      await profileAgents.remove({id: profileAgentId, account});
      res.status(204).end();
    }));

  // claims a profile agent using an account
  app.post(
    routes.profileAgentClaim,
    ensureAuthenticated,
    validate({bodySchema: schemas.accountQuery}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account} = req.body;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The account must match the authenticated user.', 'NotAllowedError', {
            httpStatusCode: 400,
            public: true,
          });
      }
      const {profileAgentId} = req.params;
      const profileAgentRecord = await profileAgents.get(
        {id: profileAgentId, includeSecrets: true});

      const {profileAgent} = profileAgentRecord;
      if(profileAgent.account === account) {
        // account already set properly, send affirmative response
        return res.status(204).end();
      }

      // cannot claim a profile agent that has a different account or has
      // a token
      if(profileAgent.account || profileAgentRecord.secrets.token) {
        throw new BedrockError(
          'Profile agent cannot be claimed.', 'NotAllowedError', {
            httpStatusCode: 400,
            public: true,
          });
      }

      await profileAgents.update({
        profileAgent: {
          ...profileAgent,
          sequence: ++profileAgent.sequence,
          account
        }
      });
      res.status(204).end();
    }));

  // delegates profile agent's zCaps to a specified "controller"
  app.post(
    routes.profileAgentCapabilities,
    ensureAuthenticated,
    validate({bodySchema: schemas.delegateCapability}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account, controller, zcap} = req.body;

      // ensure requested account matches session account
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      const {profileAgentId} = req.params;
      const {profileAgent, secrets} = await profileAgents.get(
        {id: profileAgentId, includeSecrets: true});

      // ensure profile agent `account` matches session account
      if(profileAgent.account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      // determine `expires` for delegated zcap
      const now = Date.now();
      const ttl = config['profile-http'].zcap.ttl;
      const preferredExpires = new Date(now + ttl);
      let expires;
      if(!zcap.expires) {
        expires = preferredExpires.toISOString();
      } else {
        const maxExpires = new Date(zcap.expires);
        expires = maxExpires < preferredExpires ?
          maxExpires.toISOString() : preferredExpires.toISOString();
      }

      const [delegated] = await profileAgents.delegateCapabilities(
        {profileAgent, capabilities: [zcap], controller, secrets, expires});
      res.json({zcap: delegated});
    }));

  // update profile agent's zcaps (updates their capability set)
  app.post(
    routes.profileAgentCapabilitySet,
    ensureAuthenticated,
    validate({bodySchema: schemas.zcaps, querySchema: schemas.accountQuery}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account} = req.query;
      const {zcaps} = req.body;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const {profileAgent} = await profileAgents.get({id: profileAgentId});

      // ensure profile agent `account` matches session account
      if(profileAgent.account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      profileAgent.sequence++;
      // replace existing zcaps
      profileAgent.zcaps = zcaps;

      await profileAgents.update({profileAgent});

      res.status(204).end();
    }));
});

// return select properties in the profileAgent record which does NOT include
// record.secrets
function _sanitizeProfileAgentRecord(record) {
  const {meta, profileAgent} = record;
  const sanitizedRecord = {
    meta,
    profileAgent,
  };
  return sanitizedRecord;
}

async function _createMeter({controller, productId, capability} = {}) {
  let url;
  if(capability) {
    url = capability.invocationTarget;
  } else {
    // only use `url` from config if `capability` is not provided
    ({url} = config['profile-http'].meterService);
  }

  // create a meter
  let meter = {controller, product: {id: productId}};
  ({data: {meter}} = await ZCAP_CLIENT.write({url, json: meter, capability}));

  // return fully qualified meter ID
  const {id} = meter;
  // ensure `URL` terminates at `/meters` -- in case zcap invocation target
  // was attenuated
  url = url.slice(0, url.indexOf('/meters') + '/meters'.length);
  return {id: `${url}/${id}`};
}
