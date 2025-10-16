/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as brZcapStorage from '@bedrock/zcap-storage';
import canonicalize from 'canonicalize';
import {createHash} from 'node:crypto';
import {LruCache} from '@digitalbazaar/lru-memoize';
import {profileAgents} from '@bedrock/profile';

const {util: {BedrockError}} = bedrock;

let REFRESHED_ZCAP_CACHE;

bedrock.events.on('bedrock.init', async () => {
  const cfg = bedrock.config['profile-http'];
  REFRESHED_ZCAP_CACHE = new LruCache(cfg.caches.refreshedZcap);
});

export async function getRefreshedZcap({profileId, capability}) {
  const key = _createCacheKey({profileId, capability});
  const fn = () => _getUncached({profileId, capability});
  return REFRESHED_ZCAP_CACHE.memoize({key, fn});
}

export async function getRefreshZcapPolicy({profileId, delegateId}) {
  try {
    return brZcapStorage.policies.get({
      controller: profileId, delegate: delegateId
    });
  } catch(e) {
    // no matching policy, so refresh is denied
    if(e.name === 'NotFoundError') {
      throw new BedrockError(
        `No refresh policy specified for profile "${profileId}" and ` +
        `delegate "${delegateId}".`, {
          name: 'NotAllowedError',
          details: {httpStatusCode: 403, public: true}
        });
    }
    throw e;
  }
}

function _createCacheKey({profileId, capability}) {
  const json = {profileId, canonicalZcap: canonicalize(capability)};
  const hash = createHash('sha256').update(json, 'utf8').digest('base64url');
  return hash;
}

async function _getUncached({profileId, capability}) {
  // get the policy for the profile + controller (delegate)
  const {controller: delegateId} = capability;
  const policy = await getRefreshZcapPolicy({profileId, delegateId});

  // get the profile signer associated with the policy
  // FIXME: perhaps allow "any root profile agent" to be used, requiring
  // new methods from `@bedrock/profile` to expose this feature
  const {refresh: {profileAgentId}} = policy;
  const profileAgentRecord = await profileAgents.get({id: profileAgentId});
  const profileSigner = await profileAgents.getProfileSigner({
    profileAgentRecord
  });

  // FIXME: compute new expires from policy
  const now = Date.now();
  const expires = now + 1000;

  return profileAgents.refreshCapability({
    capability, profileSigner, now, expires
  });
}
