/*
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
// apisauce is a wrapper around axios that provides improved error handling
const {create} = require('apisauce');
const https = require('https');
const helpers = require('./helpers');
const mockData = require('./mock.data');

let accounts;
let zcaps;
let api;

const baseURL =
 `https://${config.server.host}`;

describe('bedrock-profile-http', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  before(async () => {
    await helpers.prepareDatabase(mockData);
    passportStub = await helpers.stubPassport();
    accounts = mockData.accounts;
    zcaps = mockData.zcaps;
    api = create({
      baseURL,
      headers: {Accept: 'application/ld+json, application/json'},
      httpsAgent: new https.Agent({rejectUnauthorized: false})
    });
  });
  after(async () => {
    passportStub.restore();
  });
  describe('POST /profiles (create a new profile)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully create a new profile', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let result;
      let error;
      try {
        result = await api.post('/profiles', {account});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.id.should.be.a('string');
    });
  }); // end create a new profile
  describe('GET /profile-agents (gets all profile agents associated with' +
  ' an account)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully get all profile agents', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let error;
      let result0;
      let result1;
      let result2;
      let results;
      try {
        [result0, result1, result2] = await _createNProfiles({
          n: 3,
          account,
          api
        });
        results = await api.get(`/profile-agents/?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result0);
      should.exist(result1);
      should.exist(result2);
      should.exist(results);
      results.status.should.equal(200);
      results.ok.should.equal(true);
      results.data.should.be.an('array');
      results.data.length.should.equal(3);
      const profiles = results.data.map(({profileAgent}) => {
        return profileAgent.profile;
      });
      profiles.should.include(result0.data.id);
      profiles.should.include(result1.data.id);
      profiles.should.include(result2.data.id);
    });
    it('successfully filters all profile agents for a ' +
      'specific profile', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let error;
      let result0;
      let result1;
      let result2;
      let results;
      try {
        [result0, result1, result2] = await _createNProfiles({
          n: 3,
          account,
          api
        });
        const {id: profile} = result2.data;
        results = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result0);
      should.exist(result1);
      should.exist(result2);
      should.exist(results);
      results.status.should.equal(200);
      results.ok.should.equal(true);
      results.data.should.be.an('array');
      results.data.length.should.equal(1);
      const profiles = results.data.map(({profileAgent}) => {
        return profileAgent.profile;
      });
      profiles.should.not.include(result0.data.id);
      profiles.should.not.include(result1.data.id);
      profiles.should.include(result2.data.id);
    });
  }); // end gets all profile agents associated with an account
  describe('GET /profile-agents/:profileAgentId (gets a profile agent' +
    ' associated with an account)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully get a profile agent by its id', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let result;
      let error;
      try {
        const {data: {id: profile}} = await api.post('/profiles', {account});
        const {data} = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
        const {id: profileAgentId} = data[0].profileAgent;
        result = await api.get(`/profile-agents/${profileAgentId}` +
          `?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.profileAgent.id.should.be.a('string');
      result.data.profileAgent.account.should.equal(account);
    });
  }); // end gets a profile agent associated with an account
  describe('GET /profile-agents/:profileAgentId/capabilities/delegate ' +
    '(delegates profile agent\'s zCaps to a specified "id")', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully delegate profile agent\'s zcaps to an id', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const did = 'did:example:123456789';
      let result;
      let error;
      try {
        const {data: {id: profile}} = await api.post('/profiles', {account});
        const {data} = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
        const {id: profileAgentId} = data[0].profileAgent;
        result = await api.get(`/profile-agents/${profileAgentId}` +
          `/capabilities/delegate?id=${did}&account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      should.exist(result.data.zcaps);
      result.data.zcaps.should.be.an('array');
      result.data.id.should.be.a('string');
      result.data.zcaps.forEach(zcap => {
        zcap.controller.should.equal(did);
      });
    });
  }); // end delegates profile agent\'s zCaps to a specified "id"
  describe('GET /profile-agents/:profileAgentId/capability-set ' +
    '(update profile agent\'s zcaps (get their capability set)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully get zcaps for a profile agent', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let result;
      let error;
      try {
        const {data: {id: profile}} = await api.post('/profiles', {account});
        const {data} = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
        const {id: profileAgentId} = data[0].profileAgent;
        result = await api.get(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.data.zcaps.should.be.an('array');
      result.data.zcaps.length.should.equal(1);
      result.ok.should.equal(true);
    });
  }); // end get profile agent's zcaps (gets their capability set)
  describe('POST /profile-agents/:profileAgentId/capability-set ' +
    '(update profile agent\'s zcaps (updates their capability set)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully update zcaps for a profile agent', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let result;
      let result0;
      let error;
      try {
        const {data: {id: profile}} = await api.post('/profiles', {account});
        const {data} = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
        const {id: profileAgentId} = data[0].profileAgent;
        result = await api.post(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`, {zcaps});
        result0 = await api.get(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(204);
      result.ok.should.equal(true);
      result0.data.zcaps.should.be.an('array');
      result0.data.zcaps.length.should.equal(zcaps.length);
    });
  }); // end update profile agent's zcaps (updates their capability set
  describe('DELETE /profile-agents/:profileAgentId/capability-set ' +
    '(delete profile agent\'s zcaps (deletes their capability set)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully delete zcaps for a profile agent', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      let result;
      let result0;
      let error;
      try {
        const {data: {id: profile}} = await api.post('/profiles', {account});
        const {data} = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
        const {id: profileAgentId} = data[0].profileAgent;
        result = await api.delete(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`);
        result0 = await api.get(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(204);
      result.ok.should.equal(true);
      result0.status.should.equal(404);
    });
  }); // end update profile agent's zcaps (updates their capability set
}); // end bedrock-profile-http

async function _createNProfiles({n, api, account}) {
  const promises = [];
  for(let i = 0; i < n; i++) {
    const promise = api.post('/profiles', {account});
    promises.push(promise);
  }
  return Promise.all(promises);
}
