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

const delegateCapability = {
  title: 'Delegate Capability',
  type: 'object',
  required: ['invoker', 'account'],
  additionalProperties: false,
  properties: {
    account,
    invoker: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    }
  }
};

const zcap = {
  title: 'zcap',
  type: 'object',
  additionalProperties: false,
  properties: {
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
    caveat: {
      title: 'Caveat',
      type: 'object'
    },
    '@context': {
      title: '@context',
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
    delegator: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    },
    invoker: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
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
    },
    parentCapability: {
      title: 'Parent Capability',
      type: 'string'
    },
    proof: {
      title: 'Proof',
      type: 'object'
    },
    referenceId: {
      title: 'Reference Id',
      type: 'string'
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
