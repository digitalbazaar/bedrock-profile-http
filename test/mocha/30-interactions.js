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

describe('interactions', () => {
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

  it('creates a new interaction', async () => {
    let interactionId;
    let exchangeId;
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
      exchangeId = result.data.exchangeId;
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
      should.exist(result.data.exchange);
      result.data.exchange.should.include.keys(['state']);
      result.data.exchange.state.should.equal('pending');
    }

    // get protocols for interaction
    {
      let result;
      let error;
      try {
        result = await api.get(`${interactionId}?iuv=1`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      should.exist(result);
      result.status.should.equal(200);
      result.ok.should.equal(true);
      should.exist(result.data.protocols);
      result.data.protocols.should.include.keys(['inviteRequest']);
      result.data.protocols.inviteRequest.should.equal(
        `${exchangeId}/invite-request/response`);
    }
  });

  it('completes an interaction', async () => {
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
      interactionId = result.data.interactionId;
    }

    // get protocols for interaction
    let inviteRequestUrl;
    {
      let result;
      let error;
      try {
        result = await api.get(`${interactionId}?iuv=1`);
      } catch(e) {
        error = e;
      }
      assertNoError(error);
      inviteRequestUrl = result.data.protocols.inviteRequest;
    }

    // create invite response for exchange
    const referenceId = crypto.randomUUID();
    const inviteResponse = {
      url: 'https://retailer.example/checkout/baskets/1',
      purpose: 'checkout',
      referenceId
    };

    // complete interaction by posting invite response to exchange
    {
      const response = await api.post(inviteRequestUrl, inviteResponse);
      should.exist(response?.data?.referenceId);
      // ensure `referenceId` matches
      response.data.referenceId.should.equal(referenceId);
    }

    // get status of interaction (exchange should have a `complete` state
    // and result)
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
      should.exist(result.data.exchange);
      result.data.exchange.should.include.keys(['state', 'result']);
      result.data.exchange.state.should.equal('complete');
      should.exist(result.data.exchange.result.inviteRequest?.inviteResponse);
      result.data.exchange.result.inviteRequest.inviteResponse
        .should.deep.equal(inviteResponse);
    }
  });
});
