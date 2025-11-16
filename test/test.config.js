/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '@bedrock/did-io';
import '@bedrock/express';
import '@bedrock/https-agent';
import '@bedrock/mongodb';
import '@bedrock/profile';
import '@bedrock/service-core';
import '@bedrock/service-agent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// Express
config.express.useSession = true;

// MongoDB
config.mongodb.name = 'bedrock_profile_http_test';
config.mongodb.dropCollections = {};
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

// allow self-signed certs in test framework
config['https-agent'].rejectUnauthorized = false;

// Profile
config.profile.kms.baseUrl = `${config.server.baseUri}/kms`;
config.profile.kms.ipAllowList = ['127.0.0.1/32', '::1/128'];

config['did-io'].methodOverrides.v1.disableFetch = true;

// example additional EDV
config['profile-http'].additionalEdvs = {
  credentials: {referenceId: 'credentials'},
};

// `interactions` to be programmatically enabled in `test.js`
config['profile-http'].interactions.enabled = false;
config['profile-http'].interactions.types.test = {
  localInteractionId: '1d35d09b-94c8-44d5-9d10-8dd3460a5fc4',
  zcaps: {
    // to be populated by `test.js`
    readWriteExchanges: '{}'
  }
};
// test hmac key for push token feature; required for `interactions`
config.notify.push.hmacKey = {
  id: 'urn:test:hmacKey',
  secretKeyMultibase: 'uogHy02QDNPX4GID7dGUSGuYQ_Gv0WOIcpmTuKgt1ZNz7_4'
};

// create application identity for service with refresh
config['app-identity'].seeds.services.refreshing = {
  id: 'did:key:z6MkqhgbwggDuoHeru2GSDmZN6V2oPs1vHZoXhEVJnKpDzEz',
  seedMultibase: 'z1AnLvp9wWsUe9YkGoQpvLikA1GjtuduvQGwgptu5va2mKS',
  serviceType: 'refreshing'
};

// set config storage refresh interval short for testing purposes
config['service-core'].configStorage.refresh.interval = 100;

// service agent
config['service-agent'].kms.baseUrl = `${config.server.baseUri}/kms`;
