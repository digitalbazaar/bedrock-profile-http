# bedrock-profile-http ChangeLog

## 5.1.0 - 2020-12-TBD

### Changed
- Update [bedrock-profile@10](https://github.com/digitalbazaar/bedrock-profile/blob/main/CHANGELOG.md), update test deps and fix tests.
  - Supports `ed25519-2020` signature suite and verification keys.

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
