/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const account = {
  title: 'Account',
  type: 'string'
};

const profile = {
  title: 'Profile',
  type: 'string'
};

// this should match query objects with an account in them
const accountQuery = {
  title: 'Accout Query',
  type: 'object',
  required: ['account'],
  // FIXME set this to false once we have
  // decided on all the properties.
  additionalProperties: true,
  properties: {account}
};

const profileAgent = {
  title: 'Profile Agent',
  type: 'object',
  required: ['profile'],
  // FIXME set this to false once we have
  // decided on all the properties.
  additionalProperties: true,
  properties: {
    account,
    profile,
    token: {
      title: 'Token',
      type: 'string'
    }
  }
};

const profileAgents = {
  title: 'Profile Agents',
  type: 'object',
  // FIXME set this to false once we have
  // decided on all the properties.
  additionalProperties: true,
  properties: {
    account,
    profile
  }
};

const delegateCapability = {
  title: 'Delegate Capability',
  type: 'object',
  required: ['invoker', 'account'],
  // FIXME set this to false if we
  // have decided on all the properties
  additionalProperties: true,
  properties: {
    account,
    invoker: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: [{type: 'string'}]
      }]
    }
  }
};

const zcap = {
  title: 'zcap',
  type: 'object',
  // FIXME set this to false once we have
  // decided on all the properties.
  additionalProperties: true,
  properties: {
    id: {
      title: 'id',
      type: 'string'
    },
    controller: {
      title: 'controller',
      type: 'string'
    },
    allowedAction: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: [{type: 'string'}]
      }]
    },
    invoker: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: [{type: 'string'}]
      }]
    },
    invocationTarget: {
      title: 'Invocation Target',
      anyOf: [{
        type: 'string'
      }, {
        type: 'object',
        properties: {
          id: {
            title: 'Invocation Target Id',
            type: 'string'
          },
          type: {
            title: 'Invocation Target Type',
            type: 'string'
          }
        }
      }]
    }
  }
};

const zcaps = {
  title: 'zcaps',
  type: 'object',
  properties: {
    zcaps: {
      title: 'zcaps',
      type: 'object',
      // each property must be a zcap
      additionalProperties: zcap
    }
  }
};

module.exports.profileAgent = () => profileAgent;
module.exports.profileAgents = () => profileAgents;
module.exports.account = () => accountQuery;
module.exports.delegateCapability = () => delegateCapability;
module.exports.zcaps = () => zcaps;
