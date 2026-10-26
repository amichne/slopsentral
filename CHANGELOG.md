# Changelog

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
