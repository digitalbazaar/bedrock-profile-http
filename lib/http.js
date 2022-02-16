/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {asyncHandler} = require('bedrock-express');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {config, util: {BedrockError}} = bedrock;
const {Ed25519Signature2020} = require('@digitalbazaar/ed25519-signature-2020');
const {ensureAuthenticated} = brPassport;
const {getAppIdentity} = require('bedrock-app-identity');
const {httpsAgent} = require('bedrock-https-agent');
const {profiles, profileAgents, profileMeters} = require('bedrock-profile');
const {validate} = require('bedrock-validation');
const {ZcapClient} = require('@digitalbazaar/ezcap');

let ZCAP_CLIENT;
let APP_ID;

bedrock.events.on('bedrock.init', () => {
  // create signer using the application's capability invocation key
  const {id, keys: {capabilityInvocationKey}} = getAppIdentity();
  APP_ID = id;

  ZCAP_CLIENT = new ZcapClient({
    agent: httpsAgent,
    invocationSigner: capabilityInvocationKey.signer(),
    SuiteClass: Ed25519Signature2020
  });
});

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = config['profile-http'];
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
    validate('bedrock-profile-http.account'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account, didMethod, didOptions} = req.body;
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      // FIXME: add overriddable hook function (or similar functionality) to
      // allow customization of the creation of the meter to be used with
      // the profile's keystore; similar measures may be required in the future
      // for the meter to be used with any EDVs associated with the profile too
      // https://github.com/digitalbazaar/bedrock-profile-http/issues/36

      // create a new meter, edv options, and keystore options
      const [{id: edvMeterId}, {id: kmsMeterId}] = await Promise.all([
        _createMeter({
          // controller of meter is the app that runs bedrock-profile-http
          controller: APP_ID,
          // mock ID for edv service product
          productId: 'urn:uuid:dbd15f08-ff67-11eb-893b-10bf48838a41'
        }),
        _createMeter({
          // controller of meter is the app that runs bedrock-profile-http
          controller: APP_ID,
          // mock ID for webkms service product
          productId: 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41'
        })
      ]);
      const edvOptions = {
        meterId: edvMeterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };
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
    validate('bedrock-profile-http.profileAgent'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account, profile, token} = req.body;

      // TODO: Add permissions to allow access for admin
      if(account && account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      // FIXME: add overriddable hook function (or similar functionality) to
      // allow customization of the creation of the meter to be used with
      // the profile agent's keystore
      // https://github.com/digitalbazaar/bedrock-profile-http/issues/36

      // create a new meter and keystore options
      const {id: meterId} = await _createMeter({
        // controller of meter is app that runs bedrock-profile-http
        controller: APP_ID,
        // mock ID for webkms service product
        productId: 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41'
      });
      const keystoreOptions = {
        meterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };

      const options = {profileId: profile, keystoreOptions};
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
    validate({query: 'bedrock-profile-http.profileAgents'}),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account, profile} = req.query;
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
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
    validate({query: 'bedrock-profile-http.account'}),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.query;
      // FIXME: Use http-sigs and zcaps for
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const profileAgentRecord = await profileAgents.get({id: profileAgentId});
      const {profile} = profileAgentRecord.profileAgent;
      const {meters} = await profileMeters.findByProfile({profileId: profile});

      res.json({...profileAgentRecord, profileMeters: meters});
    }));

  // deletes a profile agent by its "id"
  app.delete(
    routes.profileAgent,
    ensureAuthenticated,
    validate({query: 'bedrock-profile-http.account'}),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.query;
      // FIXME: Use http-sigs and zcaps for
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      await profileAgents.remove({id: profileAgentId});
      res.status(204).end();
    }));
  // claims a profile agent using an account
  app.post(
    routes.profileAgentClaim,
    ensureAuthenticated,
    validate('bedrock-profile-http.account'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.body;
      if(account !== accountId) {
        throw new BedrockError(
          'The account must match the authenticated user.', 'NotAllowedError', {
            httpStatusCode: 400,
            public: true,
          });
      }
      const {profileAgentId} = req.params;
      const {profileAgent} = await profileAgents.get({id: profileAgentId});

      if(profileAgent.account === account) {
        // account already set properly, send affirmative response
        return res.status(204).end();
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
    validate('bedrock-profile-http.delegateCapability'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account, controller, zcap} = req.body;

      // ensure requested account matches session account
      if(account !== accountId) {
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
    validate({
      query: 'bedrock-profile-http.account',
      body: 'bedrock-profile-http.zcaps'
    }),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.query;
      const {zcaps} = req.body;
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const {profileAgent} = await profileAgents.get({id: profileAgentId});

      profileAgent.sequence++;
      // replace existing zcaps
      profileAgent.zcaps = zcaps;

      await profileAgents.update({profileAgent});

      res.status(204).end();
    }));

  // TODO: Implement claim profile agent
  // // claim a profile agent
  // app.post(
  //   routes.claimProfileAgent,
  //   ensureAuthenticated,
  //   asyncHandler(async (req, res) => {
  //     const {account: {id: accountId}} = (req.user || {});
  //     const {account, token} = req.body;
  //     if(!account) {
  //       throw new BedrockError(
  //         'The "account" property in the body must be specified.',
  //         'DataError',
  //         {account, httpStatusCode: 400, public: true});
  //     }
  //     // TODO: Add permissions to allow access for admin
  //     if(account !== accountId) {
  //       throw new BedrockError(
  //         'The "account" is not authorized.',
  //        'NotAllowedError',
  //        {httpStatusCode: 403, public: true});
  //     }
  //     const {profileAgentId} = req.params;
  //     await profileAgents.claim({profileAgentId, accountId, token});
  //     res.status(204).end();
  //   }));
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

async function _createMeter({controller, productId}) {
  const {url} = config['profile-http'].meterService;

  // create a meter
  let meter = {controller, product: {id: productId}};
  ({data: {meter}} = await ZCAP_CLIENT.write({url, json: meter}));

  // return fully qualified meter ID
  const {id} = meter;
  return {id: `${url}/${id}`};
}
