/*!
 * Copyright (c) 2018-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as brZCapStorage from '@bedrock/zcap-storage';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import {
  CapabilityDelegation,
  createRootCapability,
  constants as zcapConstants
} from '@digitalbazaar/zcap';
import {
  authorizeZcapInvocation as _authorizeZcapInvocation
} from '@digitalbazaar/ezcap-express';
import {asyncHandler} from '@bedrock/express';
import {documentLoader} from './documentLoader.js';
import {
  Ed25519Signature2020
} from '@digitalbazaar/ed25519-signature-2020';
import jsigs from 'jsonld-signatures';

const {util: {BedrockError}} = bedrock;
const {helpers: {inspectCapabilityChain}} = brZCapStorage;
const {ZCAP_ROOT_PREFIX} = zcapConstants;

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

// creates a middleware to verify a refreshable zcap's delegation chain
export function verifyRefreshableZcapDelegation() {
  return asyncHandler(async function verifyRefreshZcap(req, res, next) {
    const {body: capability} = req;

    // confirm the invoked zcap controller matches the controller of the zcap
    // that is to be refreshed
    if(capability.controller !== req.zcap.controller) {
      throw new BedrockError(
        `The controller "${capability.controller}" of the capability to be ` +
        `refreshed must equal the invoked capability's controller ` +
        `${req.zcap.controller}.`, {
          name: 'NotAllowedError',
          details: {httpStatusCode: 403, public: true}
        });
    }

    // `profileId` param always present where this middleware is used
    const {profileId} = req.params;

    // verify CapabilityDelegation
    let delegator;
    const capture = {};
    const chainControllers = [];
    try {
      const results = await _verifyDelegation({
        req,
        capability,
        documentLoader: _createRootCapabilityLoader({
          documentLoader,
          getRootController() {
            return profileId;
          },
          req
        }),
        inspectCapabilityChain: _captureChainControllers({
          inspectCapabilityChain,
          chainControllers,
          capture
        }),
        suiteFactory
      });
      ({delegator} = results[0].purposeResult);
      delegator = delegator.id || delegator;
    } catch(e) {
      const error = new Error('The provided capability delegation is invalid.');
      error.name = 'DataError';
      error.cause = e;
      error.httpStatusCode = 400;
      return _handleError({res, error, onError});
    }

    // confirm the zcap was delegated by the profile
    if(delegator !== profileId) {
      throw new BedrockError(
        `The given capability was not delegated by "${profileId}".`, {
          name: 'NotAllowedError',
          details: {httpStatusCode: 403, public: true}
        });
    }

    const {capabilityChain} = capture;

    // expose middleware results for reuse
    req.verifyRefreshableZcapDelegation = {
      delegator, capabilityChain, chainControllers, capability
    };

    // proceed to next middleware on next tick to prevent subsequent
    // middleware from potentially throwing here
    process.nextTick(next);
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

function _captureChainControllers({
  inspectCapabilityChain, chainControllers, capture
}) {
  return async function _inspectCapabilityChain(chainDetails) {
    // collect every controller in the chain
    const {capabilityChain} = chainDetails;
    capture.capabilityChain = capabilityChain;
    for(const capability of capabilityChain.values()) {
      chainControllers.push(..._getCapabilityControllers({capability}));
    }
    return inspectCapabilityChain(chainDetails);
  };
}

function _createRootCapabilityLoader({
  documentLoader, getRootController, req
}) {
  return async function rootCapabilityLoader(...args) {
    const [url] = args;
    if(url.startsWith(ZCAP_ROOT_PREFIX)) {
      const document = await _getRootCapability({
        getRootController, req, rootCapabilityId: url
      });
      return {
        contextUrl: null,
        documentUrl: url,
        document
      };
    }
    return documentLoader(...args);
  };
}

function _getCapabilityControllers({capability}) {
  const {controller} = capability;
  return Array.isArray(controller) ? controller : [controller];
}

async function _getRootCapability({
  getRootController, req, rootCapabilityId
}) {
  const rootInvocationTarget = decodeURIComponent(
    rootCapabilityId.slice(ZCAP_ROOT_PREFIX.length));
  const controller = await getRootController({
    req, rootCapabilityId, rootInvocationTarget
  });
  return createRootCapability({
    controller, invocationTarget: rootInvocationTarget
  });
}

function _handleError({res, error, onError, throwError = true}) {
  if(error.httpStatusCode) {
    res.status(error.httpStatusCode);
  } else if(res.status < 400) {
    res.status(500);
  }
  if(onError) {
    return onError({error});
  }
  if(throwError) {
    throw error;
  }
}

async function _verifyDelegation({
  req, capability, documentLoader, inspectCapabilityChain, suiteFactory
}) {
  // the expected root capability must be the parent capability for a
  // refreshable zcap; if this is somehow an attacker provided value,
  // then the capability delegation proof will either not verify or the
  // newly refreshed zcap will fail when invoked at its target if the root
  // capability controller is invalid
  const expectedRootCapability = capability.parentCapability;
  // FIXME: compute `date` as before expiration in zcap and pass it
  // const date = new Date((new Date(capability.expires)).getTime() - 1);
  const {verified, error, results} = await jsigs.verify(capability, {
    documentLoader,
    purpose: new CapabilityDelegation({
      /* Note: Path-based target attenuation must always be true to support the
      convention described above. This is not a security problem even if the
      to-be-refreshed zcap cannot be invoked (because the invocation endpoint
      doesn't allow such attenuation). It just means zcaps that can be
      delegated with attenuation rules that aren't supported by the invocation
      endpoint can still be refreshed. */
      allowTargetAttenuation: true,
      // FIXME: pass `date` as well
      // date,
      expectedRootCapability,
      inspectCapabilityChain,
      suite: await suiteFactory({req})
    }),
    suite: await suiteFactory({req})
  });
  if(!verified) {
    throw error;
  }
  return results;
}
