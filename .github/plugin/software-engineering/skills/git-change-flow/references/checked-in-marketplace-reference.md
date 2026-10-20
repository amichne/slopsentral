# Checked-In Marketplace Reference

Use this reference when creating the durable setup file for a newly onboarded
repository.

## Default Path

Use `.agents/marketplaces.md` unless the repo already has a clear agent-tooling
setup path. The file should be committed with the repository.

## Required Content

The reference should include:

- Purpose: why the repo uses marketplace-driven tooling.
- Marketplace sources: every configured marketplace, its provider, source URL or
  local path, branch or ref when known, and provider entrypoint.
- Default scope: name the selected plugins and the repository tasks they support.
  Marketplace discovery does not imply installing every available plugin.
- Expected plugins: plugin names, marketplace names, and why each is needed for
  this repo.
- Local setup notes: repo-specific instruction files, hook configs, or runtime
  settings that the marketplace setup must respect.
- Refresh path: commands or UI steps used to refresh marketplace entries.
- Validation: checks proving the reference is current and no installed cache
  payload was copied into source.

## Markdown Template

```markdown
# Agent Marketplaces

This repository consumes agent tooling from configured marketplaces. Installed
plugin payloads and runtime caches are not source-of-truth files.

## Marketplace Sources

| Provider | Marketplace | Source | Entrypoint | Scope |
|---|---|---|---|---|
| Codex | slopsentral | https://github.com/amichne/slopsentral/tree/harness/codex | .agents/plugins/marketplace.json | selected plugins only |
| GitHub | slopsentral | https://github.com/amichne/slopsentral/tree/harness/github-copilot | .github/plugin/marketplace.json | selected plugins only |

## Expected Plugins

| Plugin | Marketplace | Purpose | Status |
|---|---|---|---|
| software-engineering | slopsentral | Everyday implementation, testing, Git, PRs, and CI | pending verification |

## Exclusions

Add only specialties this repository needs. Repository Knowledge and required
skill-read policy are optional. Record installation state from observation.

## Refresh

- Refresh marketplace configuration through the runtime marketplace mechanism.
- Re-run the repo validation checks after changing this file.

## Validation

- The marketplace sources above resolve.
- Expected plugins are installed or explicitly marked pending.
- No installed plugin cache or generated marketplace payload is committed.
```

## Structured Variant

If the repo needs a machine-readable reference instead of Markdown, add or name
the schema, parser, generator, or validation command in the same change. Do not
commit ungoverned JSON, TOML, or YAML setup state.
