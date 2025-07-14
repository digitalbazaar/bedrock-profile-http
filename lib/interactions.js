/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {poll, pollers} from '@bedrock/notify';
import {agent} from '@bedrock/https-agent';
import {asyncHandler} from '@bedrock/express';
import {ensureAuthenticated} from '@bedrock/passport';
import {httpClient} from '@digitalbazaar/http-client';
import {createValidateMiddleware as validate} from '@bedrock/validation';
import {ZCAP_CLIENT as zcapClient} from './zcapClient.js';

const {config, util: {BedrockError}} = bedrock;

let WORKFLOWS_BY_NAME_MAP;
let WORKFLOWS_BY_ID_MAP;

bedrock.events.on('bedrock.init', () => {
  const cfg = config['profile-http'];

  // interactions feature is optional, return early if not enabled
  const {interactions} = cfg;
  if(!interactions?.enabled) {
    return;
  }

  // parse workflow configs when interactions are enabled
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
        // FIXME: use `expires` instead of now-deprecated `ttl`
        // 15 minute expiry in seconds
        ttl: 60 * 15,
        // template variables
        variables: {
          ...variables,
          accountId
        }
      };
      const capability = workflow.zcaps.get('readWriteExchanges');
      const response = await zcapClient.write({json: exchange, capability});
      const exchangeId = response.headers.get('location');
      const {localInteractionId} = workflow;
      // reuse `localExchangeId` in path
      const localExchangeId = exchangeId.slice(exchangeId.lastIndexOf('/'));
      const id = `${config.server.baseUri}/${routes.interactions}/` +
        `${localInteractionId}/${localExchangeId}`;
      res.json({interactionId: id, exchangeId});
    }));

  // gets an interaction by its "id"
  app.get(
    routes.interaction,
    ensureAuthenticated,
    // FIXME: add URL query validator that requires no query or `iuv=1` only
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {
        params: {localInteractionId, localExchangeId},
        query: {iuv}
      } = req;

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

      // determine full exchange ID based on related capability
      const capability = workflow.zcaps.get('readWriteExchanges');
      const exchangeId = `${capability.invocationTarget}/${localExchangeId}`;

      // if an "Interaction URL Version" is present send "protocols"
      // (note: validation requires it to be `1`, so no need to check its value)
      if(iuv) {
        // FIXME: send to a QR-code page if supported
        // FIXME: check config for supported QR code route and use it
        // instead of hard-coded value
        if(req.accepts('html') || !req.accepts('json')) {
          return res.redirect(`${req.originalUrl}/qr-code`);
        }
        try {
          const url = `${exchangeId}/protocols`;
          const {data: protocols} = await httpClient.get(url, {agent});
          res.json(protocols);
        } catch(cause) {
          throw new BedrockError(
            'Unable to serve protocols object: ' + cause.message, {
              name: 'OperationError',
              details: {httpStatusCode: 500, public: true},
              cause
            });
        }
      }

      // poll the exchange...
      const result = await poll({
        id: exchangeId,
        poller: pollers.createExchangePoller({
          zcapClient,
          capability,
          filterExchange({exchange/*, previousPollResult*/}) {
            // ensure `accountId` matches exchange variables
            if(exchange?.variables.accountId !== accountId) {
              throw new BedrockError(
                'Not authorized.',
                'NotAllowedError',
                {httpStatusCode: 403, public: true});
            }
            // return only information that should be accessible to client
            return {
              exchange
              // FIXME: filter info once final step name and info is determined
              /*
              exchange: {
                state: exchange.state,
                result: exchange.variables.results?.finish
              }*/
            };
          }
        }),
        // set a TTL of 1 seconds to account for the case where a push
        // notification isn't received by the same instance that the client
        // hits, but prevent requests from triggering a hit to the backend more
        // frequently than 1 second
        ttl: 1000
      });

      res.json(result);
    }));
});
