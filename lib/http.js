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
  const routes = {
    profiles: basePath,
    profile: `${basePath}/:profileId`,
    zcaps: `${basePath}/agents/zcaps`
  };

  // create a new profile
  app.post(
    routes.profiles,
    ensureAuthenticated,
    // validate('profile.createProfile'),
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = req.user;
      const {name, color} = req.body;
      const settings = {name, color};
      const profile = await profiles.create({accountId, settings});
      res.json(profile);
    }));

  // gets all profiles associated with an account
  app.get(
    routes.profiles,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = req.user;
      const profileRecords = await profiles.getAll({accountId});
      res.json(profileRecords);
    }));

  // gets a profile associated with an account
  app.get(
    routes.profile,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = req.user;
      const {profileId} = req.params;
      const profile = await profiles.get({accountId, profileId});
      res.json(profile);
    }));

  // delegates zCaps from all ProfileAgent's associated with an account to a DID
  app.get(
    routes.zcaps,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {account: {id: accountId}} = req.user;
      const {id} = req.query;
      if(!id) {
        throw new BedrockError(
          'The "id" query parameter must be specified.',
          'DataError',
          {id, httpStatusCode: 400, public: true});
      }
      const profileAgentRecords = await profileAgents.getAll({accountId});
      const zCapMap = await _generateZcaps({
        profileAgentRecords,
        id
      });
      res.json(zCapMap);
    }));
});

async function _generateZcaps({profileAgentRecords, id}) {
  // get all zcaps for all profile agents and then delegate to the
  // "id" (recepient/controller of zCap)
  const promises = profileAgentRecords.map(async ({profileAgent}) => {
    const {id: profileAgentId} = profileAgent;
    const {capabilitySet} = await capabilitySets.get({profileAgentId});
    const {zcaps: capabilities} = capabilitySet;
    const zcaps = await profileAgents.delegateCapabilities({
      profileAgent,
      capabilities,
      controller: id
    });
    return {
      profileId: profileAgent.profile,
      zcaps
    };
  });
  // TODO: Find proper promise-fun library for concurrency
  const zCaps = await Promise.all(promises);
  // turn zCaps into a Map<ProfileDID, zCaps>
  const zCapMap = zCaps.reduce((acc, curr) => {
    return {
      ...acc,
      [curr.profileId]: curr.zcaps
    };
  }, {});
  return zCapMap;
}
