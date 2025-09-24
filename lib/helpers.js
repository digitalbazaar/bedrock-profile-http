/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {ZCAP_CLIENT} from './zcapClient.js';

export async function createMeter({controller, productId, capability} = {}) {
  let url;
  if(capability) {
    url = capability.invocationTarget;
  } else {
    // only use `url` from config if `capability` is not provided
    ({url} = bedrock.config['profile-http'].meterService);
  }

  // create a meter
  let meter = {controller, product: {id: productId}};
  ({data: {meter}} = await ZCAP_CLIENT.write({url, json: meter, capability}));

  // return fully qualified meter ID
  const {id} = meter;
  // ensure `URL` terminates at `/meters` -- in case zcap invocation target
  // was attenuated
  url = url.slice(0, url.indexOf('/meters') + '/meters'.length);
  return {id: `${url}/${id}`};
}
