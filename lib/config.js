/*!
 * Copyright (c) 2020-2024 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';

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

// base URL to EDV service: `cfg.edvBaseUrl`
const edvBaseUrlName = `${namespace}.edvBaseUrl`;
cc(edvBaseUrlName, () => `${bedrock.config.server.baseUri}`);
// ensure EDV base URL is overridden in deployments
config.ensureConfigOverride.fields.push(edvBaseUrlName);

// additional EDVs to create for profiles at provisioning time
cfg.additionalEdvs = {
  //example: {referenceId: 'example'},
};

// meter creation zcaps
cfg.edvMeterCreationZcap = '';
cfg.webKmsMeterCreationZcap = '';

cfg.meterService = {};
const meterServiceName = `${namespace}.meterService`;
cc(`${meterServiceName}.url`, () => `${bedrock.config.server.baseUri}/meters`);
// ensure meter service config is overridden in deployments
config.ensureConfigOverride.fields.push(meterServiceName);

// optional interaction config
cfg.interactions = {
  enabled: false,
  caches: {
    // FIXME: remove; replace with bedrock-notify
    exchangePolling: {
      // each cache value is only a boolean (the key is ~64 bytes); one entry
      // per exchange being actively polled, 1M = ~60 MiB
      max: 1000000,
      // polling allowed no more than once per second by default
      ttl: 1000
    }
  },
  // named workflows for interactions
  /* Spec:
  {
    <workflow name>: {
      ...,
      // a unique local interaction ID for use in interaction URLs
      localInteractionId,
      zcaps: {
        readWriteExchanges: <zcap for reading/writing exchanges>
      }
    }
  }
  */
  workflows: {}
};
