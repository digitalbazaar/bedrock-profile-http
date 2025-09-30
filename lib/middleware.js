/*!
 * Copyright (c) 2018-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as brZCapStorage from '@bedrock/zcap-storage';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import {
  authorizeZcapInvocation as _authorizeZcapInvocation,
  authorizeZcapRevocation as _authorizeZcapRevocation
} from '@digitalbazaar/ezcap-express';
import {documentLoader} from '../documentLoader.js';
import {
  Ed25519Signature2020
} from '@digitalbazaar/ed25519-signature-2020';

const {util: {BedrockError}} = bedrock;
const {helpers: {inspectCapabilityChain}} = brZCapStorage;

// creates middleware for authorizing a profile zcap request
export function authorizeProfileZcapRequest({expectedAction} = {}) {
  const cfg = bedrock.config['profile-http'];
  const {basePath} = cfg.routes;
  const {baseUri} = bedrock.config.server;
  const profilesPath = `${baseUri}/${basePath}`;

  return authorizeZcapInvocation({
    async getExpectedValues({req}) {
      const {profileId} = req.params;
      return {
        // allow expected action override
        action: expectedAction,
        host: bedrock.config.server.host,
        rootInvocationTarget:
          `${profilesPath}/${encodeURIComponent(profileId)}`
      };
    },
    async getRootController({req}) {
      // this will always be present based on where this middleware is used
      return req.param.profileId;
    }
  });
}

// calls ezcap-express's authorizeZcapInvocation w/constant params, exposing
// only those params that change in this module
export function authorizeZcapInvocation({
  getExpectedValues, getRootController
} = {}) {
  const {authorizeZcapInvocationOptions} = bedrock.config['profile-http'];
  return _authorizeZcapInvocation({
    documentLoader, getExpectedValues, getRootController,
    getVerifier,
    inspectCapabilityChain,
    onError,
    suiteFactory,
    ...authorizeZcapInvocationOptions
  });
}

// FIXME: remove if not used
// creates middleware for revocation of zcaps for service objects
export function authorizeZcapRevocation() {
  return _authorizeZcapRevocation({
    documentLoader,
    expectedHost: bedrock.config.server.host,
    async getRootController({req}) {
      // this will always be present based on where this middleware is used
      return req.serviceObject.config.controller;
    },
    getVerifier,
    inspectCapabilityChain,
    onError,
    suiteFactory
  });
}

// hook used to verify zcap invocation HTTP signatures
async function getVerifier({keyId, documentLoader}) {
  const {document} = await documentLoader(keyId);
  const key = await Ed25519Multikey.from(document);
  const verificationMethod = await key.export(
    {publicKey: true, includeContext: true});
  const verifier = key.verifier();
  return {verifier, verificationMethod};
}

function onError({error}) {
  if(!(error instanceof BedrockError)) {
    // always expose cause message and name; expose cause details as
    // BedrockError if error is marked public
    let details = {};
    if(error.details && error.details.public) {
      details = error.details;
    }
    error = new BedrockError(
      error.message,
      error.name || 'NotAllowedError', {
        ...details,
        public: true,
      }, error);
  }
  throw new BedrockError(
    'Authorization error.', 'NotAllowedError', {
      httpStatusCode: 403,
      public: true,
    }, error);
}

// hook used to create suites for verifying zcap delegation chains
async function suiteFactory() {
  return new Ed25519Signature2020();
}
