/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');

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
config.profile.kms.ipAllowList = ['127.0.0.1/32'];
