# bedrock-profile-http ChangeLog

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
