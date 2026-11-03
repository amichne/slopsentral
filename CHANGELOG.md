# Changelog

## [4.0.8](https://github.com/amichne/slopsentral/compare/slopsentral-v4.0.7...slopsentral-v4.0.8) (2026-11-03)


### Features

* distribute and dogfood source-backed documentation ([#124](https://github.com/amichne/slopsentral/issues/124)) ([7fab294](https://github.com/amichne/slopsentral/commit/7fab29428fe059e9c93b95c3d1d2a1b3d92a006b))

## [4.0.7](https://github.com/amichne/slopsentral/compare/slopsentral-v4.0.6...slopsentral-v4.0.7) (2026-11-03)


### Features

* add the Slopsentral installer and lifecycle command ([4b40b99](https://github.com/amichne/slopsentral/commit/4b40b99dfbc5db31daddd6879ea5c3247bbc9ce2))
* add the Slopsentral installer and lifecycle command ([371bd72](https://github.com/amichne/slopsentral/commit/371bd72e4dbbfadfe38c1d841407d51e458c4b1a))
* expose checkout setup and checks on the project PATH ([22ce985](https://github.com/amichne/slopsentral/commit/22ce9856568ab5779089f63f5f90df1ebfc4db73))
* expose portable CLI commands without file extensions ([78a6921](https://github.com/amichne/slopsentral/commit/78a6921e4998b82d9b2dca7514c930694f6b29d7))
* gate changed prose with the trusted Vale policy ([08688b8](https://github.com/amichne/slopsentral/commit/08688b8bae814661900f6f37d11c7003e0a13d8a))
* prove CI artifact reuse and Gradle task cacheability ([83716fe](https://github.com/amichne/slopsentral/commit/83716fea331e1743c0502080c570838c43511e02))
* standardize Python automation on mise-managed uv ([77cc24c](https://github.com/amichne/slopsentral/commit/77cc24c37316b41f120b0338e2ca8c887c88d126))


### Bug Fixes

* align installer receipts and root instructions ([e63cda9](https://github.com/amichne/slopsentral/commit/e63cda9b30e753243c61e4a671c39ade0256ad5b))
* **ci:** bind PR waits to a revision and resume timeouts ([696bfb8](https://github.com/amichne/slopsentral/commit/696bfb8b10051f96f91d7490f76d56f05c6b370d))
* preserve prose coverage across renames and reduce spelling noise ([34734c5](https://github.com/amichne/slopsentral/commit/34734c51860e9e456b8e8be0c6e745fa833f5c61))

## [4.0.6](https://github.com/amichne/slopsentral/compare/slopsentral-v4.0.5...slopsentral-v4.0.6) (2026-10-28)


### Bug Fixes

* forward Pi hook menu keyboard input ([#117](https://github.com/amichne/slopsentral/issues/117)) ([86584e0](https://github.com/amichne/slopsentral/commit/86584e07b29c973a9203e61b78b4dc449b81ce97))

## [4.0.5](https://github.com/amichne/slopsentral/compare/slopsentral-v4.0.4...slopsentral-v4.0.5) (2026-10-28)


### Bug Fixes

* **ci:** bind PR waits to a revision and resume timeouts ([#113](https://github.com/amichne/slopsentral/issues/113)) ([e1e16ed](https://github.com/amichne/slopsentral/commit/e1e16ed82aa896032cb1c47b242a6daf67278d3c))
* exclude proven remote refreshes from task scope review ([#112](https://github.com/amichne/slopsentral/issues/112)) ([3bf707b](https://github.com/amichne/slopsentral/commit/3bf707b3b0836c009ae390cb9d6cd9ca96f8082c))

## [4.0.4](https://github.com/amichne/slopsentral/compare/slopsentral-v4.0.3...slopsentral-v4.0.4) (2026-10-28)


### Features

* add interactive Pi hook switches ([#109](https://github.com/amichne/slopsentral/issues/109)) ([7e0ed70](https://github.com/amichne/slopsentral/commit/7e0ed70b35e5e2c065111e24b8bb0d8eec3a114f))

## [4.0.3](https://github.com/amichne/slopsentral/compare/slopsentral-v4.0.2...slopsentral-v4.0.3) (2026-10-28)


### Features

* adapt every plugin to native Pi resources ([#107](https://github.com/amichne/slopsentral/issues/107)) ([43a1c30](https://github.com/amichne/slopsentral/commit/43a1c3060e12103b3cb5bd245130f3e3e4d35163))
* add source-backed documentation updates and glossary bootstrapping ([0161711](https://github.com/amichne/slopsentral/commit/0161711d4e5328a17d870673c153a8c38638553d))


### Bug Fixes

* run instruction scope review at turn end ([#106](https://github.com/amichne/slopsentral/issues/106)) ([a454e0a](https://github.com/amichne/slopsentral/commit/a454e0af9b2b05e9af649a69bd9efdc343c3487d))

## 4.0.2

- Use curl for Pi setup downloads with configured certificate trust and proxies.
- Report the failed download host and curl or HTTP status.
- Accept `GH_TOKEN` or `GITHUB_TOKEN` for GitHub API requests without exposing tokens in process arguments.
- Preserve release digests, source provenance, and rejection of plaintext redirects.

## 4.0.1

- Unify Slopsentral tooling, authored plugins, and all provider release artifacts under one version.
- Restore verified native Pi installation without an exact Pi host version requirement.
- Adopt Release Please release PRs and patch-only increments; retain source-bound, tested-asset publication.

Earlier Pi `0.1.N` releases and plugin `3.x` versions remain historical releases.
