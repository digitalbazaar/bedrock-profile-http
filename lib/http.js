/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {asyncHandler} = require('bedrock-express');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {capabilitySets, profiles, profileAgents} = require('bedrock-profile');
const {
  ensureAuthenticated
} = brPassport;

const {config, util: {BedrockError}} = bedrock;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const {basePath} = config['profile-http'].routes;
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
    // validate('profile.createProfile'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.body;
      if(!account) {
        throw new BedrockError(
          'The "account" property in the body must be specified.',
          'DataError',
          {account, httpStatusCode: 400, public: true});
      }
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const profile = await profiles.create({accountId: account});
      res.json(profile);
    }));

  // creates a profile agent, optionally w/ account set
  app.post(
    routes.profileAgents,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account, profile} = req.body;
      let profileAgentRecord;
      if(!account) {
        profileAgentRecord = await profileAgents.create({profileId: profile});
      } else {
        // TODO: Add permissions to allow access for admin
        if(account !== accountId) {
          throw new BedrockError(
            'The "account" is not authorized.',
            'NotAllowedError',
            {httpStatusCode: 403, public: true});
        }
        profileAgentRecord = await profileAgents.create({
          accountId: account,
          profileId: profile
        });
      }
      res.json(profileAgentRecord);
    }));

  // gets all profile agents associated with an account
  app.get(
    routes.profileAgents,
    ensureAuthenticated,
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

  // delegates profile agent's zCaps to a specified "id"
  app.get(
    routes.profileAgentCapabilities,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {id, account} = req.query;
      if(!account) {
        throw new BedrockError(
          'The "account" query parameter must be specified.',
          'DataError',
          {account, httpStatusCode: 400, public: true});
      }
      if(!id) {
        throw new BedrockError(
          'The "id" query parameter must be specified.',
          'DataError',
          {id, httpStatusCode: 400, public: true});
      }
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const {profileAgent} = await profileAgents.get({id: profileAgentId});

      // all capabilities in the `zcaps` map will be delegated
      const capabilities = Object.values(profileAgent.zcaps);

      const zcaps = await profileAgents.delegateCapabilities({
        profileAgent,
        capabilities,
        controller: id
      });
      const result = {
        id: profileAgentId,
        zcaps
      };
      res.json(result);
    }));

  // get profile agent's zcaps (gets their capability set)
  app.get(
    routes.profileAgentCapabilitySet,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.query;
      if(!account) {
        throw new BedrockError(
          'The "account" query parameter must be specified.',
          'DataError',
          {account, httpStatusCode: 400, public: true});
      }
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const {capabilitySet} = await capabilitySets.get({profileAgentId});
      res.json(capabilitySet);
    }));

  // update profile agent's zcaps (updates their capability set)
  app.post(
    routes.profileAgentCapabilitySet,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.query;
      const {zcaps} = req.body;
      if(!account) {
        throw new BedrockError(
          'The "account" query parameter must be specified.',
          'DataError',
          {account, httpStatusCode: 400, public: true});
      }
      if(!Array.isArray(zcaps)) {
        throw new BedrockError(
          'The "zcaps" property must be an array in the body.',
          'DataError',
          {account, httpStatusCode: 400, public: true});
      }
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      const {capabilitySet} = await capabilitySets.get({profileAgentId});
      await capabilitySets.update({
        capabilitySet: {
          ...capabilitySet,
          sequence: ++capabilitySet.sequence,
          zcaps
        }
      });
      res.status(204).end();
    }));

  // delete a user's capability set (revoke their zcaps)
  app.delete(
    routes.profileAgentCapabilitySet,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = (req.user || {});
      const {account} = req.query;
      if(!account) {
        throw new BedrockError(
          'The "account" query parameter must be specified.',
          'DataError',
          {account, httpStatusCode: 400, public: true});
      }
      // TODO: Add permissions to allow access for admin
      if(account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }
      const {profileAgentId} = req.params;
      await capabilitySets.remove({profileAgentId});
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
