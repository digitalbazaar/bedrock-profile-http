/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const cc = bedrock.util.config.main.computer();
const path = require('path');

const {config} = bedrock;

const namespace = 'profile-http';
const cfg = config[namespace] = {};

const basePath = '/profiles';
cfg.routes = {
  basePath
};

cfg.zcap = {
  // default: 24 hour expiration
  ttl: 24 * 60 * 60 * 1000
};
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
