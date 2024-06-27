/*!
 * Copyright (c) 2020-2024 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {asyncHandler} from '@bedrock/express';
import {ensureAuthenticated} from '@bedrock/passport';
import {createValidateMiddleware as validate} from '@bedrock/validation';
import {ZCAP_CLIENT} from './zcapClient.js';

const {config, util: {BedrockError}} = bedrock;

let WORKFLOWS_BY_NAME_MAP;
let WORKFLOWS_BY_ID_MAP;

bedrock.events.on('bedrock.init', () => {
  const cfg = bedrock.config['profile-http'];

  // parse workflow configs when interactions are enabled
  const {interactions} = cfg;
  if(interactions?.enabled) {
    const {workflows = {}} = interactions;
    WORKFLOWS_BY_NAME_MAP = new Map();
    WORKFLOWS_BY_ID_MAP = new Map();
    for(const workflowName in workflows) {
      const {localInteractionId, zcaps} = workflows[workflowName];
      if(!localInteractionId) {
        throw new TypeError(
          '"bedrock.config.profile-http.interactions.workflows" must each ' +
          'have "localInteractionId".');
      }
      const workflow = {
        localInteractionId,
        name: workflowName,
        zcaps: new Map()
      };
      for(const zcapName in zcaps) {
        const zcap = zcaps[zcapName];
        workflow.zcaps.set(zcapName, JSON.parse(zcap));
      }
      if(!workflow.zcaps.has('readWriteExchanges')) {
        throw new TypeError(
          '"bedrock.config.profile-http.interactions.workflows" must each ' +
          'have "zcaps.readWriteExchanges".');
      }
      WORKFLOWS_BY_NAME_MAP.set(workflowName, workflow);
      WORKFLOWS_BY_ID_MAP.set(localInteractionId, workflow);
    }
  }
});

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = config['profile-http'];

  // interactions feature is optional, return early if not enabled
  const {interactions} = cfg;
  if(!interactions?.enabled) {
    return;
  }

  const interactionsPath = '/interactions';
  const routes = {
    interactions: interactionsPath,
    interaction: `${interactionsPath}/:localInteractionId/:localExchangeId`
  };

  // create an interaction to exchange VCs
  app.post(
    routes.interactions,
    ensureAuthenticated,
    validate({bodySchema: schemas.createInteraction}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {workflowName, exchange: {variables}} = req.body;

      const workflow = WORKFLOWS_BY_NAME_MAP.get(workflowName);
      if(!workflow) {
        throw new BedrockError(`Workflow "${workflowName}" not found.`, {
          name: 'NotFoundError',
          details: {
            httpStatusCode: 404,
            public: true
          }
        });
      }

      // create exchange with given variables
      const exchange = {
        // 15 minute expiry in seconds
        ttl: 60 * 15,
        // template variables
        variables: {
          ...variables,
          accountId
        }
      };
      const capability = workflow.zcaps.get('readWriteExchanges');
      const response = await ZCAP_CLIENT.write({json: exchange, capability});
      const exchangeId = response.headers.get('location');
      const {localInteractionId} = workflow;
      // reuse `localExchangeId` in path
      const localExchangeId = exchangeId.slice(exchangeId.lastIndexOf('/'));
      const id = `${config.server.baseUri}/${routes.interactions}/` +
        `${localInteractionId}/${localExchangeId}`;
      res.json({id, exchangeId});
    }));

  // gets an interaction by its "id"
  app.get(
    routes.interactionPath,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {localInteractionId, localExchangeId} = req.params;

      const workflow = WORKFLOWS_BY_ID_MAP.get(localInteractionId);
      if(!workflow) {
        throw new BedrockError(
          `Workflow "${localInteractionId}" not found.`, {
            name: 'NotFoundError',
            details: {
              httpStatusCode: 404,
              public: true
            }
          });
      }

      // FIXME: use in-memory cache to return exchange state if it was
      // polled recently

      // fetch exchange
      const capability = workflow.zcaps.get('readWriteExchanges');
      const response = await ZCAP_CLIENT.read({
        url: `${capability.invocationTarget}/${localExchangeId}`,
        capability
      });

      // ensure `accountId` matches exchange variables
      const {exchange: {state, variables}} = response;
      if(variables.accountId !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      res.json({exchange: {state, variables}});
    }));
});
