/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as brAccount from '@bedrock/account';
import * as database from '@bedrock/mongodb';
import {_deserializeUser, passport} from '@bedrock/passport';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {getAppIdentity} from '@bedrock/app-identity';
import {httpsAgent} from '@bedrock/https-agent';
import {ZcapClient} from '@digitalbazaar/ezcap';

import {mockData} from './mock.data.js';

export async function createMeter({controller, serviceType} = {}) {
  // create signer using the application's capability invocation key
  const {keys: {capabilityInvocationKey}} = getAppIdentity();

  const zcapClient = new ZcapClient({
    agent: httpsAgent,
    invocationSigner: capabilityInvocationKey.signer(),
    SuiteClass: Ed25519Signature2020
  });

  // create a meter
  const meterService = `${bedrock.config.server.baseUri}/meters`;
  let meter = {
    controller,
    product: {
      // mock ID for service type
      id: mockData.productIdMap.get(serviceType)
    }
  };
  ({data: {meter}} = await zcapClient.write({url: meterService, json: meter}));

  // return full meter ID
  const {id} = meter;
  return {id: `${meterService}/${id}`};
}

export async function createConfig({
  profileId, zcapClient, ipAllowList, meterId, zcaps, options = {},
  servicePath = '/refreshing'
} = {}) {
  if(!meterId) {
    // create a meter for the keystore
    ({id: meterId} = await createMeter({
      profileId, zcapClient, serviceType: 'refreshing'
    }));
  }

  // create service object
  const config = {
    sequence: 0,
    controller: profileId,
    meterId,
    ...options
  };
  if(ipAllowList) {
    config.ipAllowList = ipAllowList;
  }
  if(zcaps) {
    config.zcaps = zcaps;
  }

  const url = `${mockData.baseUrl}${servicePath}`;
  const response = await zcapClient.write({url, json: config});
  return response.data;
}

export async function delegate({
  capability, controller, invocationTarget, expires, allowedActions,
  zcapClient, now
}) {
  expires = expires || (capability && capability.expires) ||
    new Date(Date.now() + 5000).toISOString().slice(0, -5) + 'Z';
  return zcapClient.delegate({
    capability, controller, expires, invocationTarget, allowedActions, now
  });
}

export function stubPassport({email = 'alpha@example.com'} = {}) {
  const original = passport.authenticate;
  passport._original = original;

  passport.authenticate = (strategyName, options, callback) => {
    // if no email given, call original `passport.authenticate`
    if(!email) {
      return passport._original.call(
        passport, strategyName, options, callback);
    }

    // eslint-disable-next-line no-unused-vars
    return async function(req, res, next) {
      req._sessionManager = passport._sm;
      req.isAuthenticated = req.isAuthenticated || (() => !!req.user);
      req.login = (user, callback) => {
        req._sessionManager.logIn(req, user, function(err) {
          if(err) {
            req.user = null;
            return callback(err);
          }
          callback();
        });
      };
      let user = false;
      try {
        const {accounts} = mockData;
        const {account} = accounts[email] || {account: {id: 'does-not-exist'}};
        user = await _deserializeUser({
          accountId: account.id
        });
      } catch(e) {
        return callback(e);
      }
      callback(null, user);
    };
  };

  return {
    restore() {
      passport.authenticate = passport._original;
    }
  };
}

export async function prepareDatabase(mockData) {
  await removeCollections();
  await insertTestData(mockData);
}

export async function removeCollections(
  collectionNames = [
    'account',
    'account-email',
    'profile-profileAgent'
  ]) {
  await database.openCollections(collectionNames);
  for(const collectionName of collectionNames) {
    await database.collections[collectionName].deleteMany({});
  }
}

export async function removeCollection(collectionName) {
  return removeCollections([collectionName]);
}

async function insertTestData(mockData) {
  const records = Object.values(mockData.accounts);
  for(const record of records) {
    try {
      await brAccount.insert(
        {account: record.account, meta: record.meta || {}});
    } catch(e) {
      if(e.name === 'DuplicateError') {
        // duplicate error means test data is already loaded
        continue;
      }
      throw e;
    }
  }
}
