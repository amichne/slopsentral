---
name: "web-artifacts-builder"
description: "Build self-contained Claude-compatible HTML artifact bundles from React/Vite projects. Use when the requested deliverable must be bundled into one shareable HTML file, especially for stateful or multi-component artifacts. Use frontend-design for general web UI/product design; use this skill for scaffold, shadcn component setup, bundling, and artifact handoff mechanics."
---

# Web Artifacts Builder

Use this skill when the output contract is a self-contained HTML artifact that
can be shared back into a Claude conversation. Do not use it as the general
frontend design authority; pair it with `frontend-design` when the user needs
visual direction, product layout, or polished UI implementation guidance.

To build frontend claude.ai artifacts, follow these steps:
1. Initialize the frontend repo using `scripts/init-artifact.sh`
2. Add only the shadcn/ui components the artifact actually needs
3. Develop your artifact by editing the generated code
4. Verify the app builds
5. Bundle all code into a single HTML file using `scripts/bundle-artifact.sh`
6. Test or inspect the bundled artifact before handoff

**Stack**: React 18 + TypeScript + Vite + Parcel (bundling) + Tailwind CSS + shadcn/ui

## Design & Style Guidelines

VERY IMPORTANT: To avoid what is often referred to as "AI slop", avoid using excessive centered layouts, purple gradients, uniform rounded corners, and Inter font.

## Quick Start

### Step 1: Initialize Project

Run the initialization script to create a new React project:
```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

This creates a fully configured project with:
- React + TypeScript (via Vite)
- Tailwind CSS 3.4.1 with shadcn/ui theming primitives
- Path aliases (`@/`) configured
- `components.json` and `src/lib/utils.ts` configured for shadcn/ui
- Parcel configured for bundling (via `.parcelrc`)
- Node 18+ compatibility (auto-detects and pins Vite version)

### Step 2: Add shadcn/ui Components

Add components on demand with the current shadcn CLI instead of relying on a
vendored component archive:

```bash
pnpm dlx shadcn@latest add button card dialog --yes
```

Use `pnpm dlx shadcn@latest add --help` when selecting less common components
or checking current CLI options.

### Step 3: Develop Your Artifact

To build the artifact, edit the generated files.

### Step 4: Verify the App

Run the project build before bundling:

```bash
pnpm build
```

### Step 5: Bundle to Single HTML File

To bundle the React app into a single HTML artifact:
```bash
bash scripts/bundle-artifact.sh
```

This creates `bundle.html` - a self-contained artifact with all JavaScript, CSS, and dependencies inlined. This file can be directly shared in Claude conversations as an artifact.

**Requirements**: Your project must have an `index.html` in the root directory.

**What the script does**:
- Installs bundling dependencies (parcel, @parcel/config-default, parcel-resolver-tspaths, html-inline)
- Creates `.parcelrc` config with path alias support
- Builds with Parcel (no source maps)
- Inlines all assets into single HTML using html-inline

### Step 6: Inspect and Share Artifact

Inspect `bundle.html` locally before handoff. Use available browser automation
when interaction, layout, or rendering correctness matters.

## Reference

- **shadcn/ui components**: https://ui.shadcn.com/docs/components

## MANUAL MIGRATION REQUIRED

Review unsupported Claude skill fields manually: `license`.
