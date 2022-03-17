# bedrock-profile-http ChangeLog

## 14.1.1 - 2022-03-xx

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
