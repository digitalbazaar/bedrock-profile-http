/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as brZcapStorage from '@bedrock/zcap-storage';
import * as middleware from './middleware.js';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {asyncHandler} from '@bedrock/express';
import cors from 'cors';
import {getRefreshedZcap} from './refreshedZcapCache.js';
import {createValidateMiddleware as validate} from '@bedrock/validation';

const {util: {BedrockError}} = bedrock;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = bedrock.config['profile-http'];
  const {basePath} = cfg.routes;
  const zcapsPath = `${basePath}/:profileId/zcaps`;
  const routes = {
    policies: `${zcapsPath}/policies`
  };
  // full zcap policy for a particular delegate
  routes.policy = `${routes.policies}/:delegateId`;
  // refresh for a particular delegate
  routes.refresh = `${routes.policy}/refresh`;
  // delegate view of a zcap refresh policy
  routes.viewableRefreshPolicy = `${routes.refresh}/policy`;

  /* Note: CORS is used on all endpoints. This is safe because authorization
  uses HTTP signatures + capabilities, not cookies; CSRF is not possible. */

  // create a new zcap policy
  app.options(routes.policies, cors());
  app.post(
    routes.policies,
    cors(),
    validate({bodySchema: schemas.createZcapPolicyBody}),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      const {profileId} = req.params;
      const {policy} = req.body;
      if(policy.controller !== profileId) {
        throw new BedrockError(
          'Permission denied; policy controller does not match HTTP route.', {
            name: 'NotAllowedError',
            details: {
              httpStatusCode: 403,
              public: true
            }
          });
      }

      // apply any limits checks
      if(cfg.limits?.zcapPolicies !== -1) {
        const {count} = await brZcapStorage.policies.count({
          controller: profileId
        });
        if(count >= cfg.limits?.zcapPolicies) {
          throw new BedrockError(
            'Permission denied; Maximum policies per profile ' +
            `"${cfg.limits.zcapPolicies}" already reached.`, {
              name: 'NotAllowedError',
              details: {
                httpStatusCode: 403,
                public: true
              }
            });
        }
      }

      const record = await brZcapStorage.policies.insert({policy});
      const location = `https://${req.get('host')}${req.originalUrl}/` +
        encodeURIComponent(policy.delegate);
      res.status(201).location(location).json({policy: record.policy});
    }));

  // get zcap policies by query
  app.get(
    routes.policies,
    cors(),
    validate({querySchema: schemas.getZcapPoliciesQuery}),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      const {profileId} = req.query;
      const results = await brZcapStorage.policies.find({
        profileId, req, options: {projection: {_id: 0, policy: 1}, limit: 100}
      });
      res.json({
        // return as `results` to enable adding `hasMore` / `cursor`
        // information in the future
        results: results.map(r => ({policy: r.policy}))
      });
    }));

  // update a zcap policy
  app.options(routes.policy, cors());
  app.post(
    routes.policy,
    cors(),
    validate({bodySchema: schemas.updateZcapPolicyBody}),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      const {profileId, delegateId} = req.params;
      const {policy} = req.body;
      if(policy.controller !== profileId || policy.delegate !== delegateId) {
        throw new BedrockError(
          'Permission denied; policy controller or delegate do not match ' +
          'HTTP route.', {
            name: 'NotAllowedError',
            details: {
              httpStatusCode: 403,
              public: true
            }
          });
      }
      const record = await brZcapStorage.policies.update({policy});
      res.json({policy: record.policy});
    }));

  // get a zcap policy
  app.get(
    routes.policy,
    cors(),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      const {profileId, delegateId} = req.params;
      const {policy} = await brZcapStorage.policies.get({
        controller: profileId, delegate: delegateId
      });
      res.json({policy});
    }));

  // deletes a zcap policy
  app.delete(
    routes.policy,
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      const {profileId, delegateId} = req.params;
      const deleted = await brZcapStorage.policies.remove({
        controller: profileId, delegate: delegateId
      });
      res.json({deleted});
    }));

  // refresh a zcap
  app.options(routes.refresh, cors());
  app.post(
    routes.refresh,
    validate({bodySchema: schemas.refreshableZcap}),
    middleware.authorizeProfileZcapRequest(),
    middleware.verifyRefreshableZcapDelegation(),
    asyncHandler(async (req, res) => {
      const {profileId} = req.params;
      const {body: capability} = req;
      const zcap = await getRefreshedZcap({profileId, capability});
      res.json(zcap);
    }));

  // get only the details of the refresh policy that a delegate can see
  app.options(routes.viewableRefreshPolicy, cors());
  app.get(
    routes.viewableRefreshPolicy,
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      const {profileId, delegateId} = req.params;
      const {policy} = await brZcapStorage.policies.get({
        controller: profileId, delegate: delegateId
      });
      // return only `refresh=false` or `refresh.constraints` to client
      const viewablePolicy = {};
      const {refresh} = policy;
      if(!refresh) {
        viewablePolicy.refresh = false;
      } else {
        viewablePolicy.refresh = {};
        const {constraints} = refresh;
        if(constraints) {
          viewablePolicy.refresh.constraints = constraints;
        }
      }
      res.json({policy: viewablePolicy});
    }));
});
