/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
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

const baseURL = `https://${config.server.host}`;

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
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully create a new profile', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'v1';
      let result;
      let error;
      try {
        result = await api.post('/profiles', {account, didMethod});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.id.should.be.a('string');
      result.data.id.startsWith('did:v1').should.equal(true);

      const {meters, id: profileId} = result.data;
      _shouldHaveMeters({meters, profileId});
    });
    it('create a new profile with didMethod and didOptions', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'v1';
      const didOptions = {mode: 'test'};
      let result;
      let error;
      try {
        result = await api.post('/profiles', {account, didMethod, didOptions});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.id.should.be.a('string');
      result.data.id.startsWith('did:v1').should.equal(true);

      const {meters, id: profileId} = result.data;
      _shouldHaveMeters({meters, profileId});
    });
    it('create a new profile with didMethods "v1" and "key"', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethods = ['v1', 'key'];
      const didOptions = {mode: 'test'};

      for(const didMethod of didMethods) {
        let result;
        let error;
        try {
          result = await api.post('/profiles',
            {account, didMethod, didOptions});
        } catch(e) {
          error = e;
        }
        assertNoError(error);
        should.exist(result);
        result.status.should.equal(200);
        result.ok.should.equal(true);
        result.data.id.should.be.a('string');

        const {meters, id: profileId} = result.data;
        _shouldHaveMeters({meters, profileId});
      }
    });
    it('throws error when didMethod is not "v1" or "key"', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'not-v1-or-key';
      const didOptions = {mode: 'test'};

      const result = await api.post('/profiles',
        {account, didMethod, didOptions});

      should.exist(result);
      result.status.should.equal(500);
    });
    it('throws error when there is no account', async () => {
      let account;
      let result;
      let error;
      try {
        result = await api.post('/profiles', {account});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'Account Query\' validator.');
    });
    it('throws error when account is not authorized', async () => {
      let result;
      let error;
      try {
        result = await api.post('/profiles', {account: '123'});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end create a new profile

  describe('POST /profile-agents (create a new profile agent)', () => {
    afterEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully create a new profile agent', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const profile = 'did:example:1234';
      let result;
      let error;
      try {
        result = await api.post('/profile-agents', {account, profile});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.profileAgent.id.should.be.a('string');
      result.data.profileAgent.sequence.should.equal(0);
      result.data.profileAgent.profile.should.equal(profile);
      result.data.profileAgent.account.should.equal(account);
      _shouldHaveNoMeters({meters: result.data.profileMeters});
    });
    it('throws error when there is no account', async () => {
      let account;
      let result;
      let error;
      try {
        result = await api.post('/profile-agents', {account});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'Profile Agent\' validator.');
    });
    it('throws error when account is not authorized', async () => {
      const profile = 'did:example:1234';
      let result;
      let error;
      try {
        result = await api.post('/profile-agents', {account: '123', profile});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end create a new profile agent

  describe('GET /profile-agents (gets all profile agents associated with' +
    ' an account)', () => {
    afterEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully get all profile agents', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      let error;
      let result0;
      let result1;
      let result2;
      let results;
      try {
        [result0, result1, result2] = await _createNProfiles({
          n: 3,
          account,
          didMethod,
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
      const profileIds = results.data.map(({profileAgent}) => {
        return profileAgent.profile;
      });
      profileIds.should.include(result0.data.id);
      profileIds.should.include(result1.data.id);
      profileIds.should.include(result2.data.id);
      _shouldHaveMeters({
        meters: results.data[0].profileMeters,
        profileId: profileIds[0]
      });
      _shouldHaveMeters({
        meters: results.data[1].profileMeters,
        profileId: profileIds[1]
      });
      _shouldHaveMeters({
        meters: results.data[2].profileMeters,
        profileId: profileIds[2]
      });
    });
    it('successfully filters all profile agents for a ' +
      'specific profile', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      let error;
      let result0;
      let result1;
      let result2;
      let results;
      try {
        [result0, result1, result2] = await _createNProfiles({
          n: 3,
          account,
          didMethod,
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
      const profileIds = results.data.map(({profileAgent}) => {
        return profileAgent.profile;
      });
      profileIds.should.not.include(result0.data.id);
      profileIds.should.not.include(result1.data.id);
      profileIds.should.include(result2.data.id);

      _shouldHaveMeters({
        meters: results.data[0].profileMeters,
        profileId: profileIds[0]
      });
    });
    it('throws error when account is not authorized', async () => {
      const account = '123';
      let error;
      let result;
      try {
        result = await api.get(`/profile-agents/?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end gets all profile agents associated with an account

  describe('GET /profile-agents/:profileAgentId (gets a profile agent' +
    ' associated with an account)', () => {
    afterEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully get a profile agent by its id', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
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
      _shouldHaveMeters({
        meters: result.data.profileMeters,
        profileId: profile
      });
    });
    it('throws error when there is no account', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
        result = await api.get(`/profile-agents/${profileAgentId}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'Account Query\' validator.');
    });
    it('throws error when account is not authorized', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      const wrongAccount = '123';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
        result = await api.get(`/profile-agents/${profileAgentId}` +
          `?account=${wrongAccount}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end gets a profile agent associated with an account

  describe('DELETE /profile-agents/:profileAgentId (gets a profile agent' +
    ' associated with an account)', () => {
    afterEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully deletes a profile agent by its id', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let result0;
      let error;
      try {
        result = await api.delete(`/profile-agents/${profileAgentId}` +
          `?account=${account}`);
      } catch(e) {
        error = e;
      }
      try {
        result0 = await api.get(`/profile-agents/${profileAgentId}` +
        `?account=${account}`);
      } catch(e) {
        should.exist(e);
      }
      assertNoError(error);
      should.exist(result);
      should.exist(result0);
      result.status.should.equal(204);
      result.ok.should.equal(true);
      result0.status.should.equal(404);
      result0.ok.should.equal(false);
    });
    it('throws error when there is no account', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
        result = await api.delete(`/profile-agents/${profileAgentId}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'Account Query\' validator.');
    });
    it('throws error when account is not authorized', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const wrongAccount = '123';
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
        result = await api.delete(`/profile-agents/${profileAgentId}` +
          `?account=${wrongAccount}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end gets a profile agent associated with an account

  describe('POST /profile-agents/:profileAgentId/capabilities/delegate ' +
    '(delegates profile agent\'s zCaps to a specified "controller")', () => {
    afterEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully delegate profile agent\'s zcaps', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const did = 'did:example:123456789';
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const [{profileAgent}] = data;
      const {id: profileAgentId} = profileAgent;
      const zcap = profileAgent.zcaps.profileCapabilityInvocationKey;
      let result;
      let error;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/capabilities/delegate`,
          {controller: did, account, zcap});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      should.exist(result.data.zcap);
      result.data.zcap.should.be.an('object');
      result.data.zcap.id.should.be.a('string');
      result.data.zcap.controller.should.equal(did);
      should.exist(result.data.zcap.expires);
      result.data.zcap.expires.should.be.a('string');
    });
    it('throws error when there is no account', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const did = 'did:example:123456789';
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const [{profileAgent}] = data;
      const {id: profileAgentId} = profileAgent;
      const zcap = profileAgent.zcaps.profileCapabilityInvocationKey;
      let result;
      let error;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/capabilities/delegate`,
          {controller: did, zcap});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'Delegate Capability\' validator.');
    });
    it('throws error when there is no controller', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'key';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const [{profileAgent}] = data;
      const {id: profileAgentId} = profileAgent;
      const zcap = profileAgent.zcaps.profileCapabilityInvocationKey;
      let result;
      let error;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/capabilities/delegate`,
          {account, zcap});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'Delegate Capability\' validator.');
    });
    it('throws error when account is not authorized', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const did = 'did:example:123456789';
      const wrongAccount = '123';
      const didMethod = 'v1';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const [{profileAgent}] = data;
      const {id: profileAgentId} = profileAgent;
      const zcap = profileAgent.zcaps.profileCapabilityInvocationKey;
      let result;
      let error;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/capabilities/delegate`,
          {controller: did, account: wrongAccount, zcap});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end delegates profile agent\'s zCaps to a specified "id"

  describe('POST /profile-agents/:profileAgentId/capability-set ' +
    '(update profile agent\'s zcaps (updates their capability set)', () => {
    afterEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('successfully update zcaps for a profile agent', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'v1';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let result0;
      let error;
      try {
        result = await api.post(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`, {zcaps});
        result0 = await api.get(`/profile-agents/${profileAgentId}` +
          `?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(204);
      result.ok.should.equal(true);
      result0.data.profileAgent.zcaps.should.eql(zcaps);
    });
    it('should not throw error if zcap `expires` pattern does not ' +
      'include millisecond', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const didMethod = 'v1';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const zcapsCopy = {...zcaps};
      for(const prop in zcapsCopy) {
        // change expires to not have millisecond
        zcapsCopy[prop].expires = '2050-09-10T15:56:22';
      }
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let result0;
      let error;
      try {
        result = await api.post(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`, {zcaps: zcapsCopy});
        result0 = await api.get(`/profile-agents/${profileAgentId}` +
          `?account=${account}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(204);
      result.ok.should.equal(true);
      should.exist(result0.data.profileAgent.zcaps);
    });
    it('should not throw error if zcaps do not have expires field',
      async () => {
        const {account: {id: account}} = accounts['alpha@example.com'];
        const didMethod = 'v1';
        const {data: {id: profile}} = await api.post('/profiles',
          {account, didMethod});
        const {data} = await api.get(`/profile-agents/?account=${account}` +
          `&profile=${profile}`);
        const {id: profileAgentId} = data[0].profileAgent;
        let result;
        let result0;
        let error;
        const zcapWithoutExpires = {zero: {...zcaps.zero}};
        delete zcapWithoutExpires.zero.expires;
        try {
          result = await api.post(`/profile-agents/${profileAgentId}` +
            `/capability-set?account=${account}`, {zcaps: zcapWithoutExpires});
          result0 = await api.get(`/profile-agents/${profileAgentId}` +
            `?account=${account}`);
        } catch(e) {
          error = e;
        }
        assertNoError(error);
        should.exist(result);
        result.status.should.equal(204);
        result.ok.should.equal(true);
        should.not.exist(result0.data.profileAgent.zcaps.zero.expires);
      });
    it('throws error when there is no zcaps', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const noZcaps = '';
      const didMethod = 'v1';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
        result = await api.post(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${account}`, {zcaps: noZcaps});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(400);
      result.ok.should.equal(false);
      result.data.message.should.equal(
        'A validation error occured in the \'zcaps\' validator.');
    });
    it('throws error when account is not authorized', async () => {
      const {account: {id: account}} = accounts['alpha@example.com'];
      const wrongAccount = '123';
      const didMethod = 'v1';
      const {data: {id: profile}} = await api.post('/profiles',
        {account, didMethod});
      const {data} = await api.get(`/profile-agents/?account=${account}` +
        `&profile=${profile}`);
      const {id: profileAgentId} = data[0].profileAgent;
      let result;
      let error;
      try {
        result = await api.post(`/profile-agents/${profileAgentId}` +
          `/capability-set?account=${wrongAccount}`, {zcaps});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(403);
      result.ok.should.equal(false);
      result.data.message.should.equal('The "account" is not authorized.');
    });
  }); // end update profile agent's zcaps (updates their capability set

  describe('account claims a profile agent', () => {
    beforeEach(async () => {
      await helpers.removeCollections(['profile-profileAgent']);
    });
    it('should succeed', async () => {
      const {account: {id: alphaAccountId}} = accounts['alpha@example.com'];
      const profile = 'did:example:2f09296d-611e-4a37-924b-656c41d6ef83';
      let result;
      let error;
      try {
        result = await api.post('/profile-agents', {profile});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      // result.data.id.should.equal(profile);
      const {profileAgent: {id: profileAgentId}} = result.data;
      should.exist(profileAgentId);
      profileAgentId.startsWith('did:key:').should.be.true;
      result = null;
      error = null;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/claim`, {account: alphaAccountId});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      result.status.should.equal(204);

      error = null;
      result = null;
      try {
        result = await api.get(`/profile-agents/${profileAgentId}`, {
          account: alphaAccountId,
        });
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result.data);
      should.exist(result.data.profileAgent);
      result.data.profileAgent.account.should.equal(alphaAccountId);
    });
    it('claiming a profileAgent twice does not produce an error', async () => {
      const {account: {id: alphaAccountId}} = accounts['alpha@example.com'];
      const profile = 'did:example:2f09296d-611e-4a37-924b-656c41d6ef83';
      let result;
      let error;
      try {
        result = await api.post('/profile-agents', {profile});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      // result.data.id.should.equal(profile);
      const {profileAgent: {id: profileAgentId}} = result.data;
      should.exist(profileAgentId);
      profileAgentId.startsWith('did:key:').should.be.true;
      result = null;
      error = null;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/claim`, {account: alphaAccountId});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      result.status.should.equal(204);

      result = null;
      error = null;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/claim`, {account: alphaAccountId});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      result.status.should.equal(204);
    });
    it('NotAllowedError on account and session mismatch', async () => {
      const profile = 'did:example:939f6e82-9db8-4cbc-8b8c-a0b1673c2e32';
      let result;
      let error;
      try {
        result = await api.post('/profile-agents', {profile});
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      const {profileAgent: {id: profileAgentId}} = result.data;
      should.exist(profileAgentId);
      profileAgentId.startsWith('did:key:').should.be.true;
      result = null;
      error = null;
      try {
        result = await api.post(
          `/profile-agents/${profileAgentId}/claim`,
          // does not match the authenticated alpha account
          {account: 'urn:uuid:3f5a526c-aa48-4a7e-9075-b3507456f324'});
      } catch(e) {
        error = e;
      }
      should.not.exist(error);
      should.exist(result.problem);
      result.problem.should.equal('CLIENT_ERROR');
      should.exist(result.data);
      result.data.type.should.equal('NotAllowedError');
    });
  });
}); // end bedrock-profile-http

async function _createNProfiles({n, api, account, didMethod}) {
  const promises = [];
  for(let i = 0; i < n; i++) {
    const promise = api.post('/profiles', {account, didMethod});
    promises.push(promise);
  }
  return Promise.all(promises);
}

function _shouldHaveMeters({meters, profileId}) {
  meters.should.be.an('array');
  meters.should.have.length(2);
  const {meter: edvMeter} = meters.find(
    m => m.meter.serviceType === 'edv');
  edvMeter.id.should.be.a('string');
  edvMeter.profile.should.equal(profileId);
  edvMeter.serviceType.should.equal('edv');
  edvMeter.referenceId.should.equal('profile:core:edv');
  const {meter: kmsMeter} = meters.find(
    m => m.meter.serviceType === 'webkms');
  kmsMeter.id.should.be.a('string');
  kmsMeter.profile.should.equal(profileId);
  kmsMeter.serviceType.should.equal('webkms');
  kmsMeter.referenceId.should.equal('profile:core:webkms');
}

function _shouldHaveNoMeters({meters}) {
  should.exist(meters);
  meters.should.have.length(0);
}
