/*!
 * Copyright (c) 2020-2024 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '@bedrock/did-io';
import '@bedrock/express';
import '@bedrock/https-agent';
import '@bedrock/mongodb';
import '@bedrock/profile';

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

// enable optional `interactions`
config['profile-http'].interactions.enabled = true;
config['profile-http'].interactions.workflows.test = {
  localInteractionId: '1d35d09b-94c8-44d5-9d10-8dd3460a5fc4',
  zcaps: {
    // FIXME:
    readWriteExchanges: '{}'
  }
};
