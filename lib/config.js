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
  // `client` values are for dev use only, must be overwritten in deployments;
  // this client is used to *create* meters and the keystores that use them
  client: {
    id: 'did:key:z6Mknr4fxqK3j2QiMH8w3aZ5bcQ5naRv9pmY5uMJD9CxZWF4',
    keyPair: {
      id: 'did:key:z6Mknr4fxqK3j2QiMH8w3aZ5bcQ5naRv9pmY5uMJD9CxZWF4#' +
        'z6Mknr4fxqK3j2QiMH8w3aZ5bcQ5naRv9pmY5uMJD9CxZWF4',
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase: 'z6Mknr4fxqK3j2QiMH8w3aZ5bcQ5naRv9pmY5uMJD9CxZWF4',
      privateKeyMultibase: 'zrv57BX4bacLkxX1r82JJt9WCXhgKiDPoSSS8GVkh9xj5ZR' +
        'rqSrCj5BkaF9de7wMMtoVvRShH5rxDxhwH1zsVShKWoc'
    }
  }
};
const meterServiceName = `${namespace}.meterService`;
cc(`${meterServiceName}.url`, () => `${bedrock.config.server.baseUri}/meters`);

// ensure meter service config is overridden in deployments
config.ensureConfigOverride.fields.push(meterServiceName);

config.validation.schema.paths.push(path.join(__dirname, '..', 'schemas'));
