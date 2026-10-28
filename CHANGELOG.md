# Changelog

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
