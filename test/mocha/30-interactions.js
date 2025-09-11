/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as helpers from './helpers.js';
import {config} from '@bedrock/core';
// apisauce is a wrapper around axios that provides improved error handling
import {create} from 'apisauce';
import https from 'node:https';
import {mockData} from './mock.data.js';

let api;

const baseURL = `https://${config.server.host}`;

describe.skip('interactions', () => {
  // mock session authentication for delegations endpoint
  let passportStub;
  before(async () => {
    await helpers.prepareDatabase(mockData);
    passportStub = helpers.stubPassport();
    api = create({
      baseURL,
      headers: {Accept: 'application/ld+json, application/json'},
      httpsAgent: new https.Agent({rejectUnauthorized: false})
    });
  });
  after(async () => {
    passportStub.restore();
  });

  // FIXME: create associated workflow instance w/`inviteRequest` feature
  // before()
  it('fails to create a new interaction with bad post data', async () => {
    let result;
    let error;
    try {
      result = await api.post('/interactions', {});
    } catch(e) {
      error = e;
    }
    assertNoError(error);
    should.exist(result);
    result.status.should.equal(400);
    result.ok.should.equal(false);
    result.data.message.should.equal(
      `A validation error occurred in the 'Create Interaction' validator.`);
  });
  it('fails to create a new interaction with unknown type', async () => {
    let result;
    let error;
    try {
      result = await api.post('/interactions', {
        type: 'does-not-exist',
        exchange: {
          variables: {}
        }
      });
    } catch(e) {
      error = e;
    }
    assertNoError(error);
    should.exist(result);
    result.status.should.equal(404);
    result.ok.should.equal(false);
    result.data.name.should.equal('NotFoundError');
    result.data.message.should.equal(
      'Interaction type "does-not-exist" not found.');
  });
  it.skip('creates a new interaction', async () => {
    let interactionId;
    {
      let result;
      let error;
      try {
        result = await api.post('/interactions', {
          type: 'test',
          exchange: {
            variables: {}
          }
        });
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      should.exist(result.data.interactionId);
      should.exist(result.data.exchangeId);
      interactionId = result.data.interactionId;
    }

    // get status of interaction
    {
      let result;
      let error;
      try {
        result = await api.get(interactionId);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      console.log('result.data', result.data);
      // FIXME: assert on result.data
    }
  });
});
