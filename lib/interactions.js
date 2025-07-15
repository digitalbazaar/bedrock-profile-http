/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {poll, pollers, push} from '@bedrock/notify';
import {agent} from '@bedrock/https-agent';
import {asyncHandler} from '@bedrock/express';
import {ensureAuthenticated} from '@bedrock/passport';
import {httpClient} from '@digitalbazaar/http-client';
import {createValidateMiddleware as validate} from '@bedrock/validation';
import {ZCAP_CLIENT as zcapClient} from './zcapClient.js';

const {config, util: {BedrockError}} = bedrock;

let DEFINITIONS_BY_TYPE_MAP;
let DEFINITIONS_BY_ID_MAP;

// use a TTL of 1 second to account for the case where a push notification
// isn't received by the same instance that the client hits, but prevent
// requests from triggering a hit to the workflow service backend more
// frequently than 1 second
const POLL_TTL = 1000;

bedrock.events.on('bedrock.init', () => {
  const cfg = config['profile-http'];

  // interactions feature is optional, return early if not enabled
  if(!cfg.interactions?.enabled) {
    return;
  }

  // parse interaction types when enabled
  const {types = {}} = cfg.interactions;
  DEFINITIONS_BY_TYPE_MAP = new Map();
  DEFINITIONS_BY_ID_MAP = new Map();
  for(const typeName in types) {
    const {localInteractionId, zcaps} = types[typeName];
    if(!localInteractionId) {
      throw new TypeError(
        '"bedrock.config.profile-http.interaction.types" must each ' +
        'have "localInteractionId".');
    }
    const definition = {
      name: typeName,
      localInteractionId,
      zcaps: new Map()
    };
    for(const zcapName in zcaps) {
      const zcap = zcaps[zcapName];
      definition.zcaps.set(zcapName, JSON.parse(zcap));
    }
    if(!definition.zcaps.has('readWriteExchanges')) {
      throw new TypeError(
        '"bedrock.config.profile-http.interaction.types" must each ' +
        'have "zcaps.readWriteExchanges".');
    }
    DEFINITIONS_BY_TYPE_MAP.set(typeName, definition);
    DEFINITIONS_BY_ID_MAP.set(localInteractionId, definition);
  }
});

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = config['profile-http'];

  // interaction feature is optional, return early if not enabled
  if(!cfg.interactions?.enabled) {
    return;
  }

  const interactionsPath = '/interactions';
  const routes = {
    interactions: interactionsPath,
    interaction: `${interactionsPath}/:localInteractionId/:localExchangeId`,
    callback: `${interactionsPath}/:localInteractionId/callbacks/:pushToken`
  };

  // base URL for server
  const {baseUri} = bedrock.config.server;

  // create an interaction to exchange VCs
  app.post(
    routes.interactions,
    ensureAuthenticated,
    validate({bodySchema: schemas.createInteraction}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {type, exchange: {variables}} = req.body;

      const definition = DEFINITIONS_BY_TYPE_MAP.get(type);
      if(!definition) {
        throw new BedrockError(`Interaction type "${type}" not found.`, {
          name: 'NotFoundError',
          details: {
            httpStatusCode: 404,
            public: true
          }
        });
      }

      // create a push token
      const {token} = await push.createPushToken({event: 'exchangeUpdated'});

      // compute callback URL
      const {localInteractionId} = definition;
      const callbackUrl =
        `${baseUri}${interactionsPath}/${localInteractionId}` +
        `/callbacks/${token}`;

      // create exchange with given variables
      const exchange = {
        // FIXME: use `expires` instead of now-deprecated `ttl`
        // 15 minute expiry in seconds
        ttl: 60 * 15,
        // template variables
        variables: {
          ...variables,
          callback: {
            url: callbackUrl
          },
          accountId
        }
      };
      const capability = definition.zcaps.get('readWriteExchanges');
      const response = await zcapClient.write({json: exchange, capability});
      const exchangeId = response.headers.get('location');
      // reuse `localExchangeId` in path
      const localExchangeId = exchangeId.slice(exchangeId.lastIndexOf('/'));
      const id = `${config.server.baseUri}/${routes.interactions}/` +
        `${localInteractionId}/${localExchangeId}`;
      res.json({interactionId: id, exchangeId});
    }));

  // gets an interaction
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

      // get interaction definition
      const definition = _getInteractionDefinition({localInteractionId});

      // determine full exchange ID based on related capability
      const capability = definition.zcaps.get('readWriteExchanges');
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
        poller: _createExchangePoller({accountId, capability}),
        ttl: POLL_TTL
      });

      res.json(result);
    }));

  // push event handler
  app.post(
    routes.callback,
    push.createVerifyPushTokenMiddleware({event: 'exchangeUpdated'}),
    asyncHandler(async (req, res) => {
      const {event: {data: {exchangeId: id}}} = req.body;
      const {localInteractionId} = req.params;

      // get interaction definition
      const definition = _getInteractionDefinition({localInteractionId});

      // get capability for fetching exchange and verify its invocation target
      // matches the exchange ID passed
      const capability = definition.zcaps.get('readWriteExchanges');
      if(!id.startsWith(capability.invocationTarget)) {
        throw new BedrockError('Not authorized.', {
          name: 'NotAllowedError',
          details: {httpStatusCode: 403, public: true}
        });
      }

      // poll (and clear cache)
      await poll({
        id,
        poller: _createExchangePoller({capability}),
        ttl: POLL_TTL,
        useCache: false
      });
      res.sendStatus(204);
    }));
});

function _createExchangePoller({accountId, capability}) {
  return pollers.createExchangePoller({
    zcapClient,
    capability,
    filterExchange({exchange/*, previousPollResult*/}) {
      // if `accountId` given, ensure it matches exchange variables
      if(accountId && exchange?.variables.accountId !== accountId) {
        throw new BedrockError('Not authorized.', {
          name: 'NotAllowedError',
          details: {httpStatusCode: 403, public: true}
        });
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
  });
}

function _getInteractionDefinition({localInteractionId}) {
  const definition = DEFINITIONS_BY_ID_MAP.get(localInteractionId);
  if(!definition) {
    throw new BedrockError(
      `Interaction type for "${localInteractionId}" not found.`, {
        name: 'NotFoundError',
        details: {httpStatusCode: 404, public: true}
      });
  }
  return definition;
}
