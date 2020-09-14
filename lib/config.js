/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const path = require('path');

const {config} = bedrock;

const namespace = 'profile-http';
const cfg = config[namespace] = {};

const basePath = '/profiles';
cfg.routes = {
  basePath
};

config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
