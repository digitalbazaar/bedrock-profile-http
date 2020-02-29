/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */

'use strict';

const {util: {uuid}} = require('bedrock');

const data = {};
module.exports = data;

const accounts = data.accounts = {};

// regular permissions
const email = 'alpha@example.com';
accounts[email] = {};
accounts[email].account = createAccount(email);
accounts[email].meta = {};
accounts[email].meta.sysResourceRole = [{
  sysRole: 'bedrock-test.regular',
  // FIXME: had to enable admin rights to create keyStore
  // generateResource: 'id'
}];

function createAccount(email) {
  const newAccount = {
    id: 'urn:uuid:' + uuid(),
    email
  };
  return newAccount;
}
