/*
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
require('bedrock-https-agent');
require('bedrock-kms-http');
require('bedrock-security-context');
require('bedrock-profile-http');

// this is responsible for providing the `ssm-v1` key store
require('bedrock-ssm-mongodb');

require('bedrock-test');
bedrock.start();
