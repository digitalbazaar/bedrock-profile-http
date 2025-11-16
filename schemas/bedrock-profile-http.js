/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
const account = {
  title: 'Account',
  type: 'string'
};

const profile = {
  title: 'Profile',
  type: 'string'
};

const controller = {
  title: 'controller',
  type: 'string',
  maxLength: 4096
};

const id = {
  title: 'id',
  type: 'string',
  maxLength: 4096
};

const sequence = {
  title: 'sequence',
  type: 'integer',
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER - 1
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
    id,
    allowedAction: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    },
    controller,
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

const delegatedZcap = {
  title: 'Delegated ZCAP',
  type: 'object',
  additionalProperties: false,
  required: [
    '@context', 'controller', 'expires', 'id', 'invocationTarget',
    'parentCapability', 'proof'
  ],
  properties: {
    controller,
    id,
    allowedAction: {
      anyOf: [{
        type: 'string'
      }, {
        type: 'array',
        minItems: 1,
        items: {type: 'string'}
      }]
    },
    expires: {
      title: 'W3C Date/Time',
      description: 'A W3C-formatted date and time combination.',
      type: 'string',
      pattern: '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])' +
        'T([0-1][0-9]|2[0-3]):([0-5][0-9]):(([0-5][0-9])|60)(\\.[0-9]+)?' +
        '(Z|((\\+|-)([0-1][0-9]|2[0-3]):([0-5][0-9])))?$'
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
    invocationTarget: {
      title: 'Invocation Target',
      type: 'string'
    },
    parentCapability: {
      title: 'Parent Capability',
      type: 'string'
    },
    proof: {
      title: 'Proof',
      type: 'object',
      additionalProperties: false,
      required: [
        'verificationMethod', 'type', 'created', 'proofPurpose',
        'capabilityChain', 'proofValue'
      ],
      properties: {
        verificationMethod: {
          title: 'verificationMethod',
          type: 'string'
        },
        type: {
          title: 'type',
          type: 'string'
        },
        created: {
          title: 'created',
          type: 'string'
        },
        proofPurpose: {
          title: 'proofPurpose',
          type: 'string'
        },
        capabilityChain: {
          title: 'capabilityChain',
          type: 'array',
          minItems: 1,
          items: {
            type: ['string', 'object']
          }
        },
        proofValue: {
          title: 'proofValue',
          type: 'string'
        },
      }
    }
  }
};

// refreshable zcaps have a capability chain length of 1
const refreshableZcap = structuredClone(delegatedZcap);
refreshableZcap.properties.proof.properties.capabilityChain.maxItems = 1;

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

const createInteraction = {
  title: 'Create Interaction',
  type: 'object',
  required: ['type', 'exchange'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string'
    },
    exchange: {
      type: 'object',
      required: ['variables'],
      additionalProperties: false,
      properties: {
        variables: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }
};

const getInteractionQuery = {
  title: 'Interaction Query',
  type: 'object',
  additionalProperties: false,
  properties: {
    iuv: {
      title: 'Interaction URL version',
      const: '1'
    }
  }
};

const zcapPolicy = {
  title: 'Zcap Policy',
  type: 'object',
  required: ['sequence', 'refresh'],
  additionalProperties: false,
  properties: {
    sequence,
    controller,
    delegate: controller,
    refresh: {
      anyOf: [{
        const: false
      }, {
        type: 'object',
        additionalProperties: false,
        properties: {
          constraints: {
            type: 'object',
            additionalProperties: false,
            properties: {
              maxTtlBeforeRefresh: {
                type: 'number'
              }
            }
          }
        }
      }]
    }
  }
};

const createZcapPolicyBody = {
  title: 'Create Zcap Policy',
  type: 'object',
  required: ['policy'],
  additionalProperties: false,
  properties: {
    policy: zcapPolicy
  }
};
const getZcapPoliciesQuery = {
  title: 'Zcap Policy Query',
  type: 'object',
  additionalProperties: false,
  properties: {}
};
const updateZcapPolicyBody = createZcapPolicyBody;

export {
  profileAgent,
  profileAgents,
  accountQuery,
  delegateCapability,
  createInteraction,
  getInteractionQuery,
  createZcapPolicyBody,
  getZcapPoliciesQuery,
  updateZcapPolicyBody,
  zcaps,
  refreshableZcap
};
