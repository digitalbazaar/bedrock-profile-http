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

let api;

const baseURL =
 `https://${config.server.host}${config['profile-http'].routes.basePath}`;

describe('bedrock-profile-http', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  before(async () => {
    await helpers.prepareDatabase(mockData);
    passportStub = await helpers.stubPassport();
    api = create({
      baseURL,
      httpsAgent: new https.Agent({rejectUnauthorized: false})
    });
  });
  after(async () => {
    passportStub.restore();
  });
  describe('POST / (create a new profile)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully create a new profile', async () => {
      const settings = {name: 'Example Profile', color: '#ff0000'};
      let result;
      let error;
      try {
        result = await api.post('/', settings);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.name.should.equal(settings.name);
      result.data.color.should.equal(settings.color);
      result.data.type.should.equal('Profile');
      result.data.id.should.be.a('string');
    });
  }); // end create a new profile
  describe('GET / (gets all profiles associated with an account)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully get all profiles', async () => {
      const settings = {name: 'Example Profile', color: '#ff0000'};
      let error;
      let result0;
      let result1;
      let result2;
      let results;
      try {
        [result0, result1, result2] = await _createNProfiles({
          n: 3,
          settings,
          api
        });
        results = await api.get('/');
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

      results.data = results.data.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if(nameA < nameB) {
          return -1;
        }
        if(nameA > nameB) {
          return 1;
        }
        return 0;
      });
      results.data[0].type.should.equal('Profile');
      results.data[0].name.should.equal(settings.name + '0');
      results.data[0].color.should.equal(settings.color);
      results.data[1].type.should.equal('Profile');
      results.data[1].name.should.equal(settings.name + '1');
      results.data[1].color.should.equal(settings.color);
      results.data[2].type.should.equal('Profile');
      results.data[2].name.should.equal(settings.name + '2');
      results.data[2].color.should.equal(settings.color);
    });
  }); // end gets all profiles associated with an account
  describe('GET /:profileId (gets a profile associated with an' +
    ' account)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully get a profile', async () => {
      const settings = {name: 'Example Profile', color: '#ff0000'};
      let result;
      let error;
      try {
        const {data} = await api.post('/', settings);
        const {id: profileId} = data;
        result = await api.get(`/${profileId}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      result.data.name.should.equal(settings.name);
      result.data.color.should.equal(settings.color);
      result.data.type.should.equal('Profile');
      result.data.id.should.be.a('string');
    });
  }); // end gets a profile associated with an account
  describe('GET /agents/zcaps (delegates zCaps from all ProfileAgent\'s' +
    ' associated with an account to a DID)', () => {
    afterEach(async () => {
      await helpers.removeCollections();
    });
    it('successfully get zcaps associated with one profile', async () => {
      const settings = {name: 'Example Profile', color: '#ff0000'};
      const did = 'did:example:123456789';
      let profile;
      let result;
      let error;
      try {
        ({data: profile} = await api.post('/', settings));
        result = await api.get(`/agents/zcaps?id=${did}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      Object.keys(result.data).length.should.equal(1);
      result.data[profile.id].should.be.an('array');
      result.data[profile.id].forEach(zcap => {
        zcap.controller.should.equal(did);
      });
    });
    it('successfully get zcaps associated with 3 profiles', async () => {
      const settings = {name: 'Example Profile', color: '#ff0000'};
      const did = 'did:example:123456789';
      let profile0;
      let profile1;
      let profile2;
      let result;
      let error;
      try {
        [profile0, profile1, profile2] = await _createNProfiles({
          n: 3,
          settings,
          api
        });
        result = await api.get(`/agents/zcaps?id=${did}`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      Object.keys(result.data).length.should.equal(3);
      result.data[profile0.data.id].should.be.an('array');
      result.data[profile0.data.id].forEach(zcap => {
        zcap.controller.should.equal(did);
      });
      result.data[profile1.data.id].should.be.an('array');
      result.data[profile1.data.id].forEach(zcap => {
        zcap.controller.should.equal(did);
      });
      result.data[profile2.data.id].should.be.an('array');
      result.data[profile2.data.id].forEach(zcap => {
        zcap.controller.should.equal(did);
      });
    });
  }); // end delegates zCaps from all ProfileAgent's associated with an account
}); // end bedrock-profile-http

async function _createNProfiles({n, api, settings}) {
  const promises = [];
  for(let i = 0; i < n; i++) {
    const promise = api.post('/', {
      ...settings,
      name: settings.name + i
    });
    promises.push(promise);
  }
  return Promise.all(promises);
}
