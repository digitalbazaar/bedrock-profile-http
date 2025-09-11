/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as helpers from './helpers.js';
import {config} from '@bedrock/core';
// apisauce is a wrapper around axios that provides improved error handling
import {create} from 'apisauce';
import https from 'node:https';
import {mockData} from './mock.data.js';

let accounts;
let api;

const baseURL = `https://${config.server.host}`;

describe('profiles', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  before(async () => {
    await helpers.prepareDatabase(mockData);
    passportStub = helpers.stubPassport();
    accounts = mockData.accounts;
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
        'A validation error occurred in the \'Account Query\' validator.');
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
});

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
