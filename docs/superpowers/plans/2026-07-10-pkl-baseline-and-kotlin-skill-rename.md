# Pkl Baseline and Kotlin Skill Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pkl engineering to the baseline plugin, provide a safe standalone skill installer, and rename the colliding Kotlin skill.

**Architecture:** Keep all primitives canonical under `source/skills` and compose them by local reference. Add one generic repository command that copies a marketplace-listed skill into a Codex home, while source-graph references and routing fixtures receive a complete structural rename.

**Tech Stack:** POSIX shell, Node.js test runner, JSON marketplace manifests, Intelligence marketplace CLI.

## Global Constraints

- `source/adaptable.marketplace.json` and `source/plugins/*/plugin.json` remain authored sources.
- `.agents/plugins` and `.github/plugin` remain generated proof artifacts and are not edited by hand.
- The old installed skill name `kotlin-standards` is removed without an alias.
- Standalone installation defaults to `${CODEX_HOME:-$HOME/.codex}/skills` and does not use symlinks.
- Push the validated scoped commit directly to `main`.

---

### Task 1: Standalone skill installer

**Files:**
- Create: `source/tools/tests/install-skill.test.mjs`
- Create: `source/tools/install-skill`

**Interfaces:**
- Consumes: a skill name present in `source/adaptable.marketplace.json` and optional `--codex-home <path>` / `--force` flags.
- Produces: a copied skill directory at `<codex-home>/skills/<skill>` and a compact stdout status envelope.

- [ ] **Step 1: Write failing installer behavior tests**

Cover a fresh copy, idempotent repeat, overwrite refusal, forced replacement,
unknown skill rejection, and unknown option rejection with temporary Codex
homes.

- [ ] **Step 2: Run the focused test and verify red**

Run: `node --test source/tools/tests/install-skill.test.mjs`

Expected: FAIL because `source/tools/install-skill` does not exist.

- [ ] **Step 3: Implement the minimal installer**

Parse the two supported flags without prompting, validate the marketplace and
skill source, stage a real directory copy, and atomically place or explicitly
replace the destination.

- [ ] **Step 4: Run the focused test and verify green**

Run: `node --test source/tools/tests/install-skill.test.mjs`

Expected: all installer cases pass.

### Task 2: Source graph composition and rename

**Files:**
- Modify: `source/plugins/engineering-baseline/plugin.json`
- Rename: `source/skills/kotlin-standards/` to `source/skills/kotlin-design-practices/`
- Modify: `source/plugins/kotlin-engineering/plugin.json`
- Modify: `source/adaptable.marketplace.json`
- Modify: `source/hooks/kotlin-horizontalization-check.hook.json`
- Modify: `source/evals/routing/kotlin-engineering-workflows.json`
- Modify: Kotlin sibling skill prose references found by exact-name search.

**Interfaces:**
- Consumes: independently valid `pkl-engineering` and renamed `kotlin-design-practices` primitives.
- Produces: referential baseline composition and a source graph with no `kotlin-standards` identity references.

- [ ] **Step 1: Rename the Kotlin primitive directory and identity**

Use a filesystem move, then update every exact path/name/prose reference found
by `rg -n 'kotlin-standards|Kotlin Standards' source`.

- [ ] **Step 2: Add Pkl to the baseline plugin**

Add one `SKILL` local reference for `skills/pkl-engineering` and update baseline
description/scope metadata to mention typed Pkl configuration work.

- [ ] **Step 3: Run focused source checks**

Run:

```sh
node source/tools/validate-source-graph.mjs
python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin engineering-baseline
python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin kotlin-engineering
```

Expected: every command exits 0.

### Task 3: Full proof and publication

**Files:**
- Verify only; do not edit generated provider output.

**Interfaces:**
- Consumes: the complete authored source diff.
- Produces: portable and hydrated validation evidence plus a published `main` commit.

- [ ] **Step 1: Run required marketplace proof**

Run:

```sh
node source/tools/validate-source-graph.mjs
intelligence validate --repo /Users/amichne/code/slopsentral --portable
rm -rf /tmp/slopsentral-marketplace
intelligence marketplace materialize --repo /Users/amichne/code/slopsentral --provider all --out /tmp/slopsentral-marketplace
intelligence validate --repo /Users/amichne/code/slopsentral --portable --hydrated /tmp/slopsentral-marketplace
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Review and stage only scoped files**

Inspect `git diff --stat`, the targeted diff, and `git diff --cached --check`.

- [ ] **Step 3: Commit and push main**

Run:

```sh
git commit -m "feat: add pkl to engineering baseline"
git push origin main
git fetch origin main
```

Expected: `main` and `origin/main` resolve to the new commit.
