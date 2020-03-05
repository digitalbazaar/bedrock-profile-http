/*
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
require('bedrock-account');
require('bedrock-express');
require('bedrock-edv-storage');
require('bedrock-https-agent');
require('bedrock-jsonld-document-loader');
require('bedrock-kms');
require('bedrock-kms-http');
require('bedrock-passport');
require('bedrock-permission');
require('bedrock-profile');
require('bedrock-profile-http');
require('bedrock-server');
require('bedrock-ssm-mongodb');
require('bedrock-test');
bedrock.start();
