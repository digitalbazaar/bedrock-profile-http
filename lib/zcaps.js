/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as middleware from './middleware.js';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {asyncHandler} from '@bedrock/express';
import cors from 'cors';
import {createValidateMiddleware as validate} from '@bedrock/validation';

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = bedrock.config['profile-http'];
  const {basePath} = cfg.routes;
  const zcapsPath = `${basePath}/:profileId/zcaps`;
  const routes = {
    policies: `${zcapsPath}/policies`,
    refresh: `${zcapsPath}/refresh`
  };
  routes.policy = `${routes.policies}/:policyId`;

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
    middleware.authorizeZcapPolicyRequest({root: true}),
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
    middleware.authorizeZcapPolicyRequest(),
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
    middleware.authorizeZcapPolicyRequest(),
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
    middleware.authorizeZcapPolicyRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: implement
      throw new Error('Not implemented');
    }));

  // deletes a zcap policy
  app.delete(
    routes.policy,
    middleware.authorizeZcapPolicyRequest(),
    asyncHandler(async (/*req, res*/) => {
      // FIXME: implement
      throw new Error('Not implemented');
    }));

  // refresh a zcap
  app.options(routes.refresh, cors());
  app.post(
    routes.refresh,
    validate({bodySchema: schemas.refreshZcap}),
    middleware.authorizeZcapInvocation({
      async getExpectedValues({req}) {
        const {profileId} = req.params;
        const {baseUri} = bedrock.config.server;
        const profilePath = `${baseUri}/${basePath}`;
        return {
          host: bedrock.config.server.host,
          rootInvocationTarget:
            `${profilePath}/${encodeURIComponent(profileId)}/zcaps/refresh`
        };
      },
      async getRootController({req}) {
        return req.param.profileId;
      }
    }),
    asyncHandler(async (/*req, res*/) => {
      // FIXME:
      throw new Error('Not implemented');
    }));
});
