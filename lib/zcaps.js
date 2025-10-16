/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as middleware from './middleware.js';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {getRefreshedZcap, getRefreshZcapPolicy} from './refreshedZcapCache.js';
import {asyncHandler} from '@bedrock/express';
import cors from 'cors';
import {createValidateMiddleware as validate} from '@bedrock/validation';

// FIXME: use below
//const {util: {BedrockError}} = bedrock;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = bedrock.config['profile-http'];
  const {basePath} = cfg.routes;
  const zcapsPath = `${basePath}/:profileId/zcaps`;
  const routes = {
    policies: `${zcapsPath}/policies`,
    refresh: `${zcapsPath}/refresh`
  };
  // full zcap policy for a particular delegate
  routes.policy = `${routes.policies}/:delegateId`;
  // viewable zcap policy of a delegate when they invoke a refresh zcap
  routes.viewablePolicy = `${routes.refresh}/policy`;

  // base URL for server
  //const {baseUri} = bedrock.config.server;

  /* Note: CORS is used on all endpoints. This is safe because authorization
  uses HTTP signatures + capabilities, not cookies; CSRF is not possible. */

  // create a new zcap policy
  app.options(routes.policies, cors());
  app.post(
    routes.policies,
    cors(),
    // FIXME: make wider than "zcap policy" as "authorization policy"?
    validate({bodySchema: schemas.createZcapPolicyBody}),
    validate({bodySchema: schemas.createZcapPolicy}),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: create zcap/authz policy
      throw new Error('Not implemented');
      // FIXME: consider meter usage for storing policies or some other limit
      /*
      const {body: {meterId}, meterCheck: {hasAvailable}} = req;
      if(!hasAvailable) {
        // insufficient remaining storage
        throw new BedrockError('Permission denied.', 'NotAllowedError', {
          httpStatusCode: 403,
          public: true,
        });
      }
      */
    }));

  // get zcap policies by query
  app.get(
    routes.policies,
    cors(),
    validate({querySchema: schemas.getZcapPoliciesQuery}),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: implement
      throw new Error('Not implemented');
      /*
      const {profileId} = req.query;
      const results = await policyStorage.find({
        profileId, req, options: {projection: {_id: 0, policy: 1}}
      });
      res.json({
        // return as `results` to enable adding `hasMore` / `cursor`
        // information in the future
        results: results.map(r => r.policy)
      });
      */
    }));

  // update a zcap policy
  app.options(routes.policy, cors());
  app.post(
    routes.policy,
    cors(),
    validate({bodySchema: schemas.updateZcapPolicyBody}),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: implement
      throw new Error('Not implemented');
      /*
      await policyStorage.update({policy});
      res.json(policy);

      // FIXME: use meters?
      // meter operation usage
      reportOperationUsage({req});
      */
    }));

  // get a zcap policy
  app.get(
    routes.policy,
    cors(),
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: implement
      throw new Error('Not implemented');
    }));

  // deletes a zcap policy
  app.delete(
    routes.policy,
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: implement
      throw new Error('Not implemented');
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
      res.json({zcap});
    }));

  // get only the details of the refresh policy that a delegate can see
  app.options(routes.viewablePolicy, cors());
  app.post(
    routes.viewablePolicy,
    middleware.authorizeProfileZcapRequest(),
    asyncHandler(async (req, res) => {
      // use `controller` of invoked zcap to determine `delegateId` to look up
      // policy details
      const {profileId} = req.params;
      const {controller: delegateId} = req.zcap;
      const policy = await getRefreshZcapPolicy({profileId, delegateId});
      // return only `refresh.constraints` to client
      const viewablePolicy = {
        refresh: {
          constraints: policy.refresh.constraints
        }
      };
      res.json({policy: viewablePolicy});
    }));
});
