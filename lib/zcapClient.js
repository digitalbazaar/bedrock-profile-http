/*!
 * Copyright (c) 2020-2024 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {getAppIdentity} from '@bedrock/app-identity';
import {httpsAgent} from '@bedrock/https-agent';
import {ZcapClient} from '@digitalbazaar/ezcap';

export let ZCAP_CLIENT;

bedrock.events.on('bedrock.init', () => {
  // create signer using the application's capability invocation key
  const {keys: {capabilityInvocationKey}} = getAppIdentity();

  ZCAP_CLIENT = new ZcapClient({
    agent: httpsAgent,
    invocationSigner: capabilityInvocationKey.signer(),
    SuiteClass: Ed25519Signature2020
  });
});
