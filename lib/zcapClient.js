/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {getAppIdentity} from '@bedrock/app-identity';
import {httpsAgent} from '@bedrock/https-agent';
import {ZcapClient} from '@digitalbazaar/ezcap';

export let APP_ID;
export let ZCAP_CLIENT;
export let EDV_METER_CREATION_ZCAP;
export let WEBKMS_METER_CREATION_ZCAP;

bedrock.events.on('bedrock.init', () => {
  // create signer using the application's capability invocation key
  const {id, keys: {capabilityInvocationKey}} = getAppIdentity();
  APP_ID = id;

  ZCAP_CLIENT = new ZcapClient({
    agent: httpsAgent,
    invocationSigner: capabilityInvocationKey.signer(),
    SuiteClass: Ed25519Signature2020
  });

  // load zcaps delegated to the application
  const cfg = bedrock.config['profile-http'];
  const {edvMeterCreationZcap, webKmsMeterCreationZcap} = cfg;
  if(edvMeterCreationZcap) {
    EDV_METER_CREATION_ZCAP = JSON.parse(edvMeterCreationZcap);
  }
  if(webKmsMeterCreationZcap) {
    WEBKMS_METER_CREATION_ZCAP = JSON.parse(webKmsMeterCreationZcap);
  }
});
