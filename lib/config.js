/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
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

cfg.caches = {
  // refreshed zcap cache
  refreshedZcap: {
    // zcaps are not typically large objects (hundreds of bytes); but this
    // cache isn't expected to be used frequently either, just for zcap refresh
    // retries or misbehaving zcap refresh clients
    max: 100,
    ttl: 5 * 60 * 1000
  }
};

// profile agent zcap config
cfg.zcap = {
  // default: 24 hour TTL for delegated zcaps (when a profile agent's zcaps
  // are delegated)
  ttl: 24 * 60 * 60 * 1000
};

// for middleware that uses zcap-authz
cfg.authorizeZcapInvocationOptions = {
  maxChainLength: 10,
  // 300 second clock skew permitted by default
  maxClockSkew: 300,
  // 1 year max TTL by default
  maxDelegationTtl: 1 * 60 * 60 * 24 * 365 * 1000
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

// optional interactions config
cfg.interactions = {
  // FIXME: add qr-code route fallback for non-accept-json "protocols" requests
  enabled: false,
  // types of interactions, type name => definition
  /* Spec:
  {
    <interaction type name>: {
      ...,
      // a unique local interaction ID for use in interaction URLs
      localInteractionId,
      zcaps: {
        readWriteExchanges: <zcap for reading/writing exchanges>
      }
    }
  }
  */
  types: {}
};

// optional default limits on number of profile agents, zcap policies etc.
cfg.limits = {
  // limit per account; -1 is unlimited; default to -1 for backwards compat;
  // future version may set another default limit, e.g., 1000
  profileAgents: -1,
  // limit per profile; -1 is unlimited; default to 1000
  zcapPolicies: 1000
};
