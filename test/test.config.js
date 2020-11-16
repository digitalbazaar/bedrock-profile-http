/*
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');

config.mocha.tests.push(path.join(__dirname, 'mocha'));
const {permissions, roles} = config.permission;

// MongoDB
config.mongodb.name = 'bedrock_profile_http_test';
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

// do not require an authentication session for tests
config['kms-http'].requireAuthentication = false;

config.kms.allowedHost = config.server.host;

// allow self-signed certs in test framework
config['https-agent'].rejectUnauthorized = false;

// Account
roles['bedrock-test.regular'] = {
  id: 'bedrock-test.regular',
  label: 'Account Test Role',
  comment: 'Role for Test User',
  sysPermission: [
    permissions.ACCOUNT_ACCESS.id,
    permissions.ACCOUNT_UPDATE.id,
    permissions.ACCOUNT_INSERT.id,
    permissions.EDV_CONFIG_ACCESS.id,
    permissions.EDV_CONFIG_UPDATE.id,
    permissions.EDV_CONFIG_REMOVE.id
  ]
};
