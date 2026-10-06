---
name: "repository-onboarding"
description: "Set up a repository for marketplace-driven AI tooling. Use when onboarding a new repo, refreshing a checked-in marketplace reference, installing core marketplace plugins, or documenting which configured marketplaces should be available by default."
---

# Repository Onboarding

Use this skill to make a repository ready to consume skills, principles, hooks,
and plugins from remote marketplaces without vendoring installed plugin payloads
or local cache copies.

## Operating Contract

- Prefer remote marketplace sources over copying plugin payloads into the repo.
- Discover configured marketplaces, then select only capabilities needed by the
  repository. A configured marketplace does not imply installing all its plugins.
- Keep setup evidence in a checked-in reference file. Use
  `.agents/marketplaces.md` unless the repo already has a documented equivalent.
- Treat installed plugin directories and local caches as observations, not
  source.
- Keep private cleanup and migration utilities out of newly onboarded repo
  references.
- If the repo needs JSON, TOML, YAML, or another structured setup file, name the
  owning schema, parser, generator, or validation command before committing it.

## Workflow

1. Read repository policy.
   Inspect root instructions, existing agent-tooling setup, docs, plugin
   manifests, and hook configuration before adding setup files.

2. Discover configured marketplaces.
   Use runtime configuration, marketplace list commands, or existing checked-in
   setup docs. Record each marketplace source, provider entrypoint, branch or
   ref when available, and whether the source is remote or local-only.

3. Choose the default setup scope.
   For code work, start with Software Engineering and add the language, platform,
   or output specialties needed by the repository. Writing-only setup can use
   Technical Writing alone. Keep knowledge generation and skill-read policy opt-in.
   When worktree automation is requested, select the upstream Worktrunk plugin
   alongside Software Engineering. Keep its marketplace and payload owned by
   max-sixty/worktrunk; use git-change-flow for task isolation and project checks.

4. Write the checked-in reference.
   Create or update the repo's marketplace reference with the configured
   marketplaces, expected core plugins, local repo notes, refresh commands, and
   validation steps. Use
   [checked-in-marketplace-reference.md](references/checked-in-marketplace-reference.md)
   for the default structure.

5. Apply runtime setup.
   Install or enable plugins through the runtime marketplace mechanism. Do not
   copy generated marketplace payloads, installed plugin folders, or cache
   directories into source. Worktrunk's Codex plugin is `worktrunk@worktrunk`;
   confirm the marketplace resolves to max-sixty/worktrunk before installing.
   Verify installation separately from native hook delivery. Discover a missing
   CLI as a setup requirement rather than manufacturing command availability.

6. Verify.
   Confirm the reference file is tracked, remote marketplace sources resolve,
   expected plugins are installed or documented as pending, and no local cache
   paths became source-of-truth references.

## Completion Criteria

- The repo has a checked-in marketplace reference.
- The reference distinguishes discovered marketplaces from selected plugins
  and explains how each selection supports the repository.
- Core plugins and hooks are enabled from marketplace sources, not vendored
  payloads.
- Structured setup data has an owning schema, parser, generator, or validation
  command.
- Private cleanup and migration utilities are absent.
