/*!
 * Copyright (c) 2020-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const path = require('path');
const cc = bedrock.util.config.main.computer();

const {config} = bedrock;

const namespace = 'profile-http';
const cfg = config[namespace] = {};

const basePath = '/profiles';
cfg.routes = {
  basePath
};

cfg.zcap = {
  // default: 24 hour expiration
  ttl: 24 * 60 * 60 * 1000
};

cfg.meterService = {
  // `client` values are for dev use only, must be overwritten in deployments
  client: {
    id: 'did:key:z6MkhekGqrajY4xMd7VVgd2qKkrb1rycWWT7mGWJC8sStzgG',
    keyPair: {
      id: 'did:key:z6MkhekGqrajY4xMd7VVgd2qKkrb1rycWWT7mGWJC8sStzgG#' +
        'z6MkhekGqrajY4xMd7VVgd2qKkrb1rycWWT7mGWJC8sStzgG',
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase: 'z6MkhekGqrajY4xMd7VVgd2qKkrb1rycWWT7mGWJC8sStzgG',
      privateKeyMultibase: 'zrv3mSGr9R9xSudb117yEBDUrFKcKyzqBGhTo42KHUN95nF' +
        'DBvdyUyPmH214SbbiSx6UErDUaVRnTVH4qV2Eev5GC9W'
    }
  }
};
const meterServiceName = `${namespace}.meterService`;
cc(`${meterServiceName}.url`, () => `${bedrock.config.server.baseUri}/meters`);

// ensure meter service config is overridden in deployments
config.ensureConfigOverride.fields.push(meterServiceName);

config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
