/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as brAccount from '@bedrock/account';
import * as database from '@bedrock/mongodb';
import {_deserializeUser, passport} from '@bedrock/passport';

import {mockData} from './mock.data.js';

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
