/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
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
  title: 'Account Query',
  type: 'object',
  required: ['account'],
  additionalProperties: false,
  properties: {
    account,
    didMethod: {
      title: 'didMethod',
      type: 'string'
    },
    didOptions: {
      title: 'didOptions',
      type: 'object'
    }
  }
};

const profileAgent = {
  title: 'Profile Agent',
  type: 'object',
  required: ['profile'],
  additionalProperties: false,
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
  additionalProperties: false,
  properties: {
    account,
    profile
  }
};

const zcap = {
  title: 'zcap',
  type: 'object',
  required: ['@context', 'id', 'controller', 'invocationTarget'],
  additionalProperties: false,
  properties: {
    '@context': {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    },
    id: {
      title: 'id',
      type: 'string'
    },
    allowedAction: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    },
    controller: {
      title: 'controller',
      type: 'string'
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
    },
    parentCapability: {
      title: 'Parent Capability',
      type: 'string'
    },
    proof: {
      title: 'Proof',
      type: 'object'
    },
    expires: {
      title: 'W3C Date/Time',
      description: 'A W3C-formatted date and time combination.',
      type: 'string',
      pattern: '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])' +
        'T([0-1][0-9]|2[0-3]):([0-5][0-9]):(([0-5][0-9])|60)(\\.[0-9]+)?' +
        '(Z|((\\+|-)([0-1][0-9]|2[0-3]):([0-5][0-9])))?$',
      errors: {
        invalid: 'The date/time must be of the W3C date/time format ' +
          '"YYYY-MM-DD( |T)HH:MM:SS.s(Z|(+|-)TZOFFSET)".',
        missing: 'Please enter a date/time.'
      }
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

const delegateCapability = {
  title: 'Delegate Capability',
  type: 'object',
  required: ['controller', 'account', 'zcap'],
  additionalProperties: false,
  properties: {
    account,
    controller: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    },
    zcap
  }
};

module.exports.profileAgent = () => profileAgent;
module.exports.profileAgents = () => profileAgents;
module.exports.account = () => accountQuery;
module.exports.delegateCapability = () => delegateCapability;
module.exports.zcaps = () => zcaps;
