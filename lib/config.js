/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from 'bedrock';

const {config} = bedrock;
const cc = bedrock.util.config.main.computer();

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

// default products (if none specified in request)
cfg.defaultProducts = {
  // mock ID for default edv service product
  edv: 'urn:uuid:dbd15f08-ff67-11eb-893b-10bf48838a41',
  // mock ID for default webkms service product
  webkms: 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41'
};

// meter creation zcaps
cfg.edvMeterCreationZcap = '';
cfg.webKmsMeterCreationZcap = '';

cfg.meterService = {};
const meterServiceName = `${namespace}.meterService`;
cc(`${meterServiceName}.url`, () => `${bedrock.config.server.baseUri}/meters`);

// ensure meter service config is overridden in deployments
config.ensureConfigOverride.fields.push(meterServiceName);
