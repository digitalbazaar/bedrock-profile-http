/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {constants: {ZCAP_CONTEXT_URL}} = require('@digitalbazaar/zcap');

const {util: {uuid}} = bedrock;

export const mockData = {};

// mock product IDs and reverse lookup for webkms/edv/etc service products
mockData.productIdMap = new Map([
  // webkms service
  ['webkms', 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41'],
  ['urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a41', 'webkms'],
  // edv service
  ['edv', 'urn:uuid:dbd15f08-ff67-11eb-893b-10bf48838a41'],
  ['urn:uuid:dbd15f08-ff67-11eb-893b-10bf48838a41', 'edv']
]);

const zcaps = mockData.zcaps = {};
const accounts = mockData.accounts = {};

const email = 'alpha@example.com';
accounts[email] = {};
accounts[email].account = createAccount(email);
accounts[email].meta = {};

function createAccount(email) {
  const newAccount = {
    id: 'urn:uuid:' + uuid(),
    email
  };
  return newAccount;
}

const zcap0 = {
  '@context': ZCAP_CONTEXT_URL,
  id: 'urn:zcap:z19vWhR8EsNbWqvazp5bg6BTu',
  controller: 'did:key:z6Mkkt1BWYLPAAXwYBwyVHAZkL94tgT8QbQv2SUxeW1U3DaG',
  allowedAction: 'sign',
  invocationTarget: {
    // eslint-disable-next-line max-len
    id: 'https://bedrock.localhost:18443/kms/keystores/z1AAWWM7Zd4YyyV3NfaCqFuzQ/keys/z19wxodgv1UhrToQMvSxGhQG6',
    type: 'Ed25519VerificationKey2020',
    // eslint-disable-next-line max-len
    publicAlias: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg'
  },
  // eslint-disable-next-line max-len
  parentCapability: 'https://bedrock.localhost:18443/kms/keystores/z1AAWWM7Zd4YyyV3NfaCqFuzQ/keys/z19wxodgv1UhrToQMvSxGhQG6',
  proof: {
    type: 'Ed25519Signature2020',
    created: '2020-02-27T21:22:48Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg',
    proofPurpose: 'capabilityDelegation',
    capabilityChain: [
      // eslint-disable-next-line max-len
      'https://bedrock.localhost:18443/kms/keystores/z1AAWWM7Zd4YyyV3NfaCqFuzQ/keys/z19wxodgv1UhrToQMvSxGhQG6'
    ],
    // a valid signature is not required for the test
    proofValue: 'zMOCK_PROOF'
  },
  expires: '2020-09-10T15:56:22.911Z'
};

const zcap1 = {
  '@context': ZCAP_CONTEXT_URL,
  id: 'urn:zcap:z1ACgNxti98PXBjtw7ogfsN45',
  controller: 'did:key:z6Mkkt1BWYLPAAXwYBwyVHAZkL94tgT8QbQv2SUxeW1U3DaG',
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
    type: 'Ed25519Signature2020',
    created: '2020-02-27T21:22:48Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg',
    proofPurpose: 'capabilityDelegation',
    capabilityChain: [
      // eslint-disable-next-line max-len
      'https://bedrock.localhost:18443/edvs/z1A9uTYSmCU3DYQr7jhruhCuK/zcaps/documents'
    ],
    // a valid signature is not required for the test
    proofValue: 'zMOCK_PROOF'
  },
  expires: '2050-09-10T15:56:22.911Z'
};

const zcap2 = {
  '@context': ZCAP_CONTEXT_URL,
  id: 'urn:zcap:z19u4rwByrmyKFr1XC9AYNYcs',
  controller: 'did:key:z6Mkkt1BWYLPAAXwYBwyVHAZkL94tgT8QbQv2SUxeW1U3DaG',
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
    type: 'Ed25519Signature2020',
    created: '2020-02-27T21:22:48Z',
    // eslint-disable-next-line max-len
    verificationMethod: 'did:key:z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg#z6MkkrtV7wnBpXKBtiZjxaSghCo8ttb5kZUJTk8bEwTTTYvg',
    proofPurpose: 'capabilityDelegation',
    capabilityChain: [
      // eslint-disable-next-line max-len
      'https://bedrock.localhost:18443/edvs/z19jTB2drTyi4JHrARunxze8E/zcaps/documents'
    ],
    // a valid signature is not required for the test
    proofValue: 'zMOCK_PROOF'
  },
  expires: '2050-09-10T15:56:22.911Z'
};

zcaps.zero = zcap0;
zcaps.one = zcap1;
zcaps.two = zcap2;
