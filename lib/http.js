/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {asyncHandler} = require('bedrock-express');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {config, util: {BedrockError}} = bedrock;
const {Ed25519VerificationKey2020} = require(
  '@digitalbazaar/ed25519-verification-key-2020');
const {ensureAuthenticated} = brPassport;
const {httpClient} = require('@digitalbazaar/http-client');
const {httpsAgent} = require('bedrock-https-agent');
const {profiles, profileAgents} = require('bedrock-profile');
const {validate} = require('bedrock-validation');

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

      // create a new meter and keystore options
      const client = await _getMeterClient();
      const {meterCapability} = await _createMeter({
        // controller of meter is app that runs bedrock-profile-http
        controller: client.id,
        // mock ID for webkms service product
        productId: 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41'
      });
      const keystoreOptions = {
        meterCapability,
        meterCapabilityInvocationSigner: client.keyPair.signer()
      };

      const profile = await profiles.create({
        accountId: account,
        didMethod,
        keystoreOptions: {
          profileAgent: keystoreOptions,
          profile: keystoreOptions
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
      const client = await _getMeterClient();
      const {meterCapability} = await _createMeter({
        // controller of meter is app that runs bedrock-profile-http
        controller: client.id,
        // mock ID for webkms service product
        productId: 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41'
      });
      const keystoreOptions = {
        meterCapability,
        meterCapabilityInvocationSigner: client.keyPair.signer()
      };

      const options = {profileId: profile, keystoreOptions};
      if(account) {
        options.accountId = account;
      }
      if(token) {
        options.token = token;
      }

      const profileAgentRecord = await profileAgents.create(options);

      res.json(_sanitizeProfileAgentRecord(profileAgentRecord));
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
        const records = profileAgentRecords.filter(({profileAgent}) => {
          return profileAgent.profile === profile;
        });
        return res.json(records);
      }
      res.json(profileAgentRecords);
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
      res.json(profileAgentRecord);
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

  // delegates profile agent's zCaps to a specified "invoker"
  app.post(
    routes.profileAgentCapabilities,
    ensureAuthenticated,
    validate('bedrock-profile-http.delegateCapability'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {invoker, account} = req.body;
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const {profileAgent, secrets} = await profileAgents.get(
        {id: profileAgentId, includeSecrets: true});
      const now = Date.now();
      const ttl = config['profile-http'].zcap.ttl;
      const expires = new Date(now + ttl).toISOString();

      const zcap = await profileAgents.delegateCapabilityInvocationKey(
        {profileAgent, invoker, secrets, expires});

      const result = {
        id: profileAgentId,
        zcap
      };
      res.json(result);
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

async function _getMeterClient() {
  const {client} = config['profile-http'].meterService;
  const keyPair = await Ed25519VerificationKey2020.from(client.keyPair);
  return {id: client.id, keyPair};
}

async function _createMeter({controller, product}) {
  const {url} = config['profile-http'].meterService;

  // create a meter
  let meter = {controller, product};
  const response = await httpClient.post(url, {
    agent: httpsAgent, json: meter
  });
  ({data: {meter}} = response);

  // return usage capability
  const {usageCapability: meterCapability} = meter;
  return {meterCapability};
}
