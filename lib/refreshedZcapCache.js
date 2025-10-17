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

  // check policy constraints
  const {authorizeZcapInvocationOptions} = bedrock.config['profile-http'];
  if(typeof policy.refresh?.constraints?.maxTtlBeforeRefresh === 'number') {
    // get max clock skew in milliseconds
    const maxClockSkew = authorizeZcapInvocationOptions.maxClockSkew * 1000;

    // compute earliest refresh time
    const now = Date.now();
    const {maxTtlBeforeRefresh} = policy.refresh.constraints;
    const expiryTime = Date.parse(capability.expires).getTime();
    const refreshTime = expiryTime - maxClockSkew - maxTtlBeforeRefresh;

    // apply refresh time constraint
    if(now < refreshTime) {
      throw new BedrockError(
        'Refresh policy constraint violation; too early to refresh.', {
          name: 'ConstraintError',
          details: {
            refreshTime,
            public: true,
            httpStatusCode: 400
          }
        });
    }
  }

  // get profile signer associated with the policy; use any root profile agent
  const profileAgentRecord = await profileAgents.getRootAgents({
    profileId, options: {limit: 1}, includeSecrets: true
  });
  const profileSigner = await profileAgents.getProfileSigner({
    profileAgentRecord
  });

  // compute new `expires` from policy, defaulting to max delegation TTL
  const now = Date.now();
  const expires = new Date(now + policy.refresh?.maxDelegationTtl ??
    authorizeZcapInvocationOptions.maxDelegationTtl);

  return profileAgents.refreshCapability({
    capability, profileSigner, now, expires
  });
}
