/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brAccount = require('bedrock-account');
const brPassport = require('bedrock-passport');
const database = require('bedrock-mongodb');
const sinon = require('sinon');
const mockData = require('./mock.data');

exports.stubPassport = async ({email = 'alpha@example.com'} = {}) => {
  const passportStub = sinon.stub(brPassport, 'optionallyAuthenticated');
  passportStub.callsFake((req, res, next) => {
    req.user = {
      account: mockData.accounts[email].account
    };
    next();
  });
  return passportStub;
};

exports.prepareDatabase = async mockData => {
  await exports.removeCollections();
  await insertTestData(mockData);
};

exports.removeCollections = async (
  collectionNames = [
    'account',
    'edvConfig',
    'edvDoc',
    'edvDocChunk',
    'profile-profileAgent',
    'profile-profileAgentCapabilitySet'
  ]) => {
  await database.openCollections(collectionNames);
  for(const collectionName of collectionNames) {
    await database.collections[collectionName].deleteMany({});
  }
};

exports.removeCollection =
  async collectionName => exports.removeCollections([collectionName]);

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
