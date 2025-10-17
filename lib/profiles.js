/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as schemas from '../schemas/bedrock-profile-http.js';
import {
  APP_ID,
  EDV_METER_CREATION_ZCAP,
  WEBKMS_METER_CREATION_ZCAP,
  ZCAP_CLIENT
} from './zcapClient.js';
import {profileAgents, profiles} from '@bedrock/profile';
import {asyncHandler} from '@bedrock/express';
import {createMeter} from './helpers.js';
import {ensureAuthenticated} from '@bedrock/passport';
import {createValidateMiddleware as validate} from '@bedrock/validation';

const {util: {BedrockError}} = bedrock;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = bedrock.config['profile-http'];
  const {defaultProducts} = cfg;
  const {basePath} = cfg.routes;
  const profileAgentsPath = '/profile-agents';
  const profileAgentPath = `${profileAgentsPath}/:profileAgentId`;
  const routes = {
    profiles: basePath,
    profileAgents: profileAgentsPath,
    profileAgent: profileAgentPath,
    profileAgentClaim: `${profileAgentPath}/claim`,
    profileAgentCapabilities: `${profileAgentPath}/capabilities/delegate`,
    profileAgentCapabilitySet: `${profileAgentPath}/capability-set`
  };

  // create a new profile
  app.post(
    routes.profiles,
    ensureAuthenticated,
    validate({bodySchema: schemas.accountQuery}),
    asyncHandler(async (req, res) => {
      const {id: accountId} = req.user.account || {};
      const {account, didMethod, didOptions} = req.body;
      if(!accountId || account !== accountId) {
        throw new BedrockError(
          'The "account" is not authorized.',
          'NotAllowedError',
          {httpStatusCode: 403, public: true});
      }

      // apply any limits checks
      if(cfg.limits?.profileAgents !== -1) {
        const {count} = await profileAgents.count({accountId});
        if(count >= cfg.limits?.profileAgents) {
          throw new BedrockError(
            'Permission denied; Maximum profile agents for account ' +
            `"${cfg.limits.profileAgents}" already reached.`, {
              name: 'NotAllowedError',
              details: {
                httpStatusCode: 403,
                public: true
              }
            });
        }
      }

      // create a new meter, edv options, and keystore options
      const [{id: edvMeterId}, {id: kmsMeterId}] = await Promise.all([
        createMeter({
          // controller of meter is the app that runs bedrock-profile-http
          controller: APP_ID,
          // use default EDV product; specifying in request not supported
          productId: defaultProducts.edv,
          // use zcap for edv meter creation; when undefined invoke root zcap
          capability: EDV_METER_CREATION_ZCAP,
        }),
        createMeter({
          // controller of meter is the app that runs bedrock-profile-http
          controller: APP_ID,
          // use default webkms product; specifying in request not supported
          productId: defaultProducts.webkms,
          // use zcap for webkms meter creation; when undefined invoke root zcap
          capability: WEBKMS_METER_CREATION_ZCAP,
        })
      ]);
      const edvOptions = {
        baseUrl: cfg.edvBaseUrl,
        meterId: edvMeterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };
      // add any additionally configured EDVs
      if(cfg.additionalEdvs) {
        edvOptions.additionalEdvs = Object.values(cfg.additionalEdvs);
      }
      const keystoreOptions = {
        meterId: kmsMeterId,
        meterCapabilityInvocationSigner: ZCAP_CLIENT.invocationSigner
      };

      const profile = await profiles.create({
        accountId: account,
        didMethod,
        keystoreOptions: {
          profileAgent: keystoreOptions,
          profile: keystoreOptions
        },
        edvOptions: {
          profile: edvOptions
        },
        didOptions
      });

      res.json(profile);
    }));
});
