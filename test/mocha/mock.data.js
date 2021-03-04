/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */

'use strict';

const {util: {uuid}} = require('bedrock');

const data = {};
module.exports = data;

const zcaps = data.zcaps = {};
const accounts = data.accounts = {};
const emails = data.emails = {};

// regular permissions
emails.alpha = 'alpha@example.com';
accounts[emails.alpha] = {};
accounts[emails.alpha].account = createAccount(emails.alpha);
accounts[emails.alpha].meta = {};
accounts[emails.alpha].meta.sysResourceRole = [{
  sysRole: 'bedrock-test.regular',
  generateResource: 'id'
}];

emails.failMail = 'auth-test@example.com';
accounts[emails.failMail] = {};
accounts[emails.failMail].account = createAccount(emails.failMail);
accounts[emails.failMail].meta = {};
accounts[emails.failMail].meta.sysResourceRole = [{
  sysRole: 'bedrock-test.regular',
  generateResource: 'id'
}];

function createAccount(email) {
  const newAccount = {
    id: 'urn:uuid:' + uuid(),
    email
  };
  return newAccount;
}

const zcap0 = {
  '@context': 'https://w3id.org/security/v2',
  id: 'urn:zcap:z19vWhR8EsNbWqvazp5bg6BTu',
  controller: 'did:key:z6Mkkt1BWYLPAAXwYBwyVHAZkL94tgT8QbQv2SUxeW1U3DaG',
  // eslint-disable-next-line max-len
  referenceId: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg-key-capabilityInvocation',
  allowedAction: 'sign',
  invocationTarget: {
    // eslint-disable-next-line max-len
    id: 'https://bedrock.localhost:18443/kms/keystores/z1AAWWM7Zd4YyyV3NfaCqFuzQ/keys/z19wxodgv1UhrToQMvSxGhQG6',
    type: 'Ed25519VerificationKey2018',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg'
  },
  // eslint-disable-next-line max-len
  parentCapability: 'https://bedrock.localhost:18443/kms/keystores/z1AAWWM7Zd4YyyV3NfaCqFuzQ/keys/z19wxodgv1UhrToQMvSxGhQG6',
  proof: {
    type: 'Ed25519Signature2018',
    created: '2020-02-27T21:22:48Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg',
    proofPurpose: 'capabilityDelegation',
    capabilityChain: [
      // eslint-disable-next-line max-len
      'https://bedrock.localhost:18443/kms/keystores/z1AAWWM7Zd4YyyV3NfaCqFuzQ/keys/z19wxodgv1UhrToQMvSxGhQG6'
    ],
    // eslint-disable-next-line max-len
    jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..bWt6_Q65omg8rE44a_1dzWFGcFQbUrVqZ_hnAqIKlWSQ1HpTSV6OyhAQfBlVhPCsrVplqC8oVEJmp4UWqy6gCw'
  },
  expires: '2020-09-10T15:56:22.911Z'
};

const zcap1 = {
  '@context': 'https://w3id.org/security/v2',
  id: 'urn:zcap:z1ACgNxti98PXBjtw7ogfsN45',
  controller: 'did:key:z6Mkkt1BWYLPAAXwYBwyVHAZkL94tgT8QbQv2SUxeW1U3DaG',
  referenceId: 'bedrock.localhost:users',
  allowedAction: [
    'read',
    'write'
  ],
  invocationTarget: {
    id: 'https://bedrock.localhost:18443/edvs/z1A9uTYSmCU3DYQr7jhruhCuK',
    type: 'urn:edv:documents'
  },
  // eslint-disable-next-line max-len
  parentCapability: 'https://bedrock.localhost:18443/edvs/z1A9uTYSmCU3DYQr7jhruhCuK/zcaps/documents',
  proof: {
    type: 'Ed25519Signature2018',
    created: '2020-02-27T21:22:48Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg',
    proofPurpose: 'capabilityDelegation',
    capabilityChain: [
      // eslint-disable-next-line max-len
      'https://bedrock.localhost:18443/edvs/z1A9uTYSmCU3DYQr7jhruhCuK/zcaps/documents'
    ],
    // eslint-disable-next-line max-len
    jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..jXUHaPhgTLFafpi5d7ya-vAnYfgZQrRYYNxCtkH5PRTIb31EWYt9oFKEbxo2Fxn8lB0HTPC67phQUkd-J0DhDA'
  },
  expires: '2050-09-10T15:56:22.911Z'
};

const zcap2 = {
  '@context': 'https://w3id.org/security/v2',
  id: 'urn:zcap:z19u4rwByrmyKFr1XC9AYNYcs',
  controller: 'did:key:z6Mkkt1BWYLPAAXwYBwyVHAZkL94tgT8QbQv2SUxeW1U3DaG',
  referenceId: 'bedrock.localhost:settings',
  allowedAction: [
    'read',
    'write'
  ],
  invocationTarget: {
    id: 'https://bedrock.localhost:18443/edvs/z19jTB2drTyi4JHrARunxze8E',
    type: 'urn:edv:documents'
  },
  // eslint-disable-next-line max-len
  parentCapability: 'https://bedrock.localhost:18443/edvs/z19jTB2drTyi4JHrARunxze8E/zcaps/documents',
  proof: {
    type: 'Ed25519Signature2018',
    created: '2020-02-27T21:22:48Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg',
    proofPurpose: 'capabilityDelegation',
    capabilityChain: [
      // eslint-disable-next-line max-len
      'https://bedrock.localhost:18443/edvs/z19jTB2drTyi4JHrARunxze8E/zcaps/documents'
    ],
    // eslint-disable-next-line max-len
    jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..4wl0uIr1meF5c_gXlQysfK6xhAlB5mQ7ZclxxursKTwEYiWDUTXbk0H9lElPJDpbN5vC64yh_pR5zeycm8-4Bw'
  },
  expires: '2050-09-10T15:56:22.911Z'
};

zcaps.zero = zcap0;
zcaps.one = zcap1;
zcaps.two = zcap2;
