# bedrock-profile-http ChangeLog

## 19.0.0 - 2022-xx-xx

### Changed
- **BREAKING**: Require Node.js >=16.
- Test on Node.js 18.x.
- Lint module.

## 18.0.0 - 2022-05-05

### Changed
- **BREAKING**: Update peer deps:
  - `@bedrock/profile@19` that uses `@digitalbazaar/edv-client@14` with a new
  blind attribute version. This version is incompatible with previous versions
  and a manual migration must be performed to update all EDV documents to use
  the new blind attribute version -- or a new deployment is required.

## 17.0.0 - 2022-04-29

### Changed
- **BREAKING**: Update peer deps:
  - `@bedrock/core@6`
  - `@bedrock/app-identity@3`
  - `@bedrock/express@8`
  - `@bedrock/https-agent@4`
  - `@bedrock/passport@10`
  - `@bedrock/profile@18`
  - `@bedrock/validation@7`.

## 16.0.0 - 2022-04-18

### Added
- Add `additionalEdvs` config option. This option is an object that
  can be populated with named EDV options. Each named option must
  includes a `referenceId`. Whenever a new profile is created, the
  specified EDVs will be created at provisioning time.

### Changed
- **BREAKING**: Update peer dependencies:
  - `@bedrock/profile@17`.
- **BREAKING**: Require new `edvBaseUrl` configuration variable. This
  variable must point to the root of the EDV server to be used for
  creating EDVs for profiles.
- **BREAKING**: Use a new version of `@bedrock/profile` that has a new
  continuable profile provisioning process. This process means that "access
  management" will be automatically initialized when a profile is created. A
  new profile's root profile agent will not be written to the database until
  access management is initialized and the profile provisioning process is
  rendered continuable should it fail thereafter. If the process fails prior to
  writing the profile agent to the database, a profile will not be created
  leaving no local state behind (external state may be created and later
  garbage collected). This version of the library must not be used with other
  modules that attempt to initialize access management on the client; those
  client modules must be updated. If an old client module is used, it will
  experience errors and may create superfluous state, but it is not expected
  to corrupt existing profiles.

## 15.0.0 - 2022-04-06

### Changed
- **BREAKING**: Rename package to `@bedrock/profile-http`.
- **BREAKING**: Convert to module (ESM).
- **BREAKING**: Remove default export.
- **BREAKING**: Require node 14.x.

## 14.2.0 - 2022-03-29

### Changed
- Update peer deps:
  - `bedrock@4.5`
  - `bedrock-express@6.4.1`
  - `bedrock-https-agent@2.3`
  - `bedrock-passport@8.1.0`
  - `bedrock-profile@15.1.0`
  - `bedrock-validation@5.6.3`.
- Update internals to use esm style and use `esm.js` to
  transpile to CommonJS.

## 14.1.1 - 2022-03-17

### Fixed
- Ensure zcap invocation target is used to create meter.
- Ensure fully qualified meter ID is properly generated.

## 14.1.0 - 2022-03-17

### Added
- Allow meter creation via zcaps using two new config variables:
  `edvMeterCreationZcap` and `webKmsMeterCreationZcap`. When not set, the
  software will default to previous behavior by using the app-identity to invoke
  the root zcap at the meter creation endpoint.

## 14.0.1 - 2022-03-09

### Fixed
- Fix fetching `account` from session `user`.

## 14.0.0 - 2022-03-08

### Changed
- **BREAKING**: Require `bedrock-passport@8` as a peer dependency which
  requires `bedrock-account@6`.

## 13.0.0 - 2022-03-01

### Changed
- **BREAKING**: Require `bedrock-profile@15` as a peer dependency.

## 12.0.0 - 2022-02-23

### Changed
- **BREAKING**: This version uses `bedrock-profile@14` which uses
  `@digitalbazaar/edv-client@12` which computes encrypted indexes differently
  (more privacy preserving) so it is incompatible with previous versions.

## 11.0.1 - 2022-02-16

### Fixed
- Disallow claiming a profile agent that has already been assigned to another
  account or has a `token`.

## 11.0.0 - 2022-02-16

### Added
- Add ability to specify default products via bedrock config system. Currently,
  products (such as EDV and WebKMS services) may not be specified in requests
  to create profiles and profile agents. However, the product IDs used may
  now be specified via the bedrock config system.

### Changed
- **BREAKING**: Use app identity to create keystore and EDV meters instead
  of configured `meterService`.

### Fixed
- Ensure session account matches profile agent account before performing
  actions via HTTP API.

### Removed
- **BREAKING**: Removed `meterService.client` configuration -- replaced with
  app identity from `bedrock-app-identity`.

## 10.0.0 - 2022-02-10

### Changed
- **BREAKING**: This version of the module now requires `bedrock-profile@13`
  as a peer dependency.
- **BREAKING**: The `capabilities/delegate` endpoint now requires a `zcap` that
  is to be delegated to be posted. The zcap invocation key for a profile agent
  will no longer be delegated.
- **BREAKING**: `controller` must be posted instead of `invoker` or `delegator`
  at service endpoints that previously accepted them.

## 9.0.0 - 2021-09-21

### Changed
- **BREAKING**: This version of the module now requires `bedrock-app-identity@1`
  as a peer dependency.
- A zCap invocation via http-sigs is now added to requests for meter creation.

## 8.0.0 - 2021-08-31

### Changed
- **BREAKING**: This version of the module must be used against a KMS
  service that does not require a meter usage zcap to create a keystore
  but requires instead only a `meterId`.

## 7.0.0 - 2021-08-24

### Changed
- Drop support for Node.js 10.x.

### Removed
- **BREAKING**: Remove config variables for `privateKmsBaseUrl` and
  `publicKmsBaseUrl`. The KMS is now configured via `bedrock-profile`.

## 6.0.0 - 2021-05-21

### Changed
- **BREAKING**: Use [bedrock-profile@10](https://github.com/digitalbazaar/bedrock-profile/blob/main/CHANGELOG.md).
  - Updates related to `ed25519-2020` signature suite and verification keys
    support.
- Remove unused cors dependency.
- Update test deps and fix tests.

## 5.0.1 - 2020-12-14

### Changed
- Update `bedrock-profile@8` and fix tests.

## 5.0.0 - 2020-09-25

### Changed
- **BREAKING**: Requires peer of `bedrock-profile@7`.

### Added
- Add computed config variables for `privateKmsBaseUrl` and `publicKmsBaseUrl`.
  The keystore for the profile agents zCap key is created in the private KMS
  because it is accessed by a capabilityAgent that is generated from a secret
  that is stored in the database. If the database is stolen, the attacker
  cannot use the secret to hit the private KMS. The attacker must also break
  into the network.

## 4.7.0 - 2020-09-16

### Added
- Add schema validation for zcap `expires` field and related tests.

## 4.6.1 - 2020-08-19

### Fixed
- Correct typo in validation schema title and update tests.

## 4.6.0 - 2020-07-21

### Changed
- Improve schema validation.
- Improve test coverage.

## 4.5.0 - 2020-06-30

### Changed
- Update test deps.
- Update CI workflow.

## Fixed
- Remove unused bedrock-account peer dep.

## 4.4.0 - 2020-06-24

### Changed
- Update peer deps and upgrade deps test suite.

## 4.3.0 - 2020-05-18

### Changed
- Add support for `did:v1` resolution.

## 4.2.0 - 2020-04-20

### Added
- Schema validation on HTTP APIs.

## 4.1.0 - 2020-04-17

### Added
- Support Veres One type DIDs for profile creation.

### Changed
- Setup CI workflow.

## 4.0.0 - 2020-04-03

### Changed
- **BREAKING**: Use bedrock-profile@4.

## 3.0.0 - 2020-04-02

### Changed
- **BREAKING**: Use bedrock-profile@3.

### Added
- Add support for application tokens.

## 2.0.0 - 2020-03-12

### Changed
- **BREAKING**: Use bedrock-profile@2.
- **BREAKING**: Remove APIs related to capability sets.

## 1.0.0 - 2020-03-06

- See git history for changes.
