# Unified Slopsentral releases

Slopsentral has one product version for checkout tooling, all authored plugins,
and Codex, GitHub Copilot, Amp, and Pi release artifacts. The shared line starts
at **4.0.1**, above the previous plugin/tooling versions; historical Pi `0.1.N`
releases remain immutable. Dependency versions and schema revisions are independent.

`package.json` owns the product version. Release Please uses one root component,
`slopsentral`, and proposes patch-only increments such as `4.0.1` → `4.0.2`, even
for feature or breaking-change commits. This is an explicit initial policy, not
an assertion that every change is semantically patch-compatible.

## Version PRs and publication

1. Main pushes run `Validate Source`. CI checks the shared version, projects and
   tests all providers, installs the Pi archive, and retains source-bound artifacts.
2. `Release Slopsentral` admits a successful main run whose shared version exceeds
   the latest published version. It publishes the exact retained bytes under `slopsentral-vX.Y.Z`.
   After a version is published, ordinary commits do not create another release of that version.
3. Publication verifies provider manifests, archive digests, installer receipts,
   source identity, and actual GitHub downloads before making the release current.
   It never rebuilds during publication or replaces an existing source tag/asset.
4. After publication succeeds, the publisher marks the merged version PR `autorelease: tagged` and removes `autorelease: pending`.
   The version PR must match the published version and belong to the history of the released source.
5. `Release Please` creates a version PR after a successful release workflow, including a run that needs no release.
6. The workflow merges that PR after both `Validate Source` jobs pass for its exact head.
   The PR must come from the configured App and change only declared version files plus `CHANGELOG.md`.
   Its version must advance by one patch. Forks, stale heads, drafts, and mixed code changes cannot pass this gate.

The App token triggers normal main validation after the automatic merge.
The publisher then promotes the artifacts from that main run. Ordinary code PRs keep their normal merge process.

The first merge bootstraps the unified `4.0.1` release. Subsequent versions come
from release PRs. The existing `Publish Harnesses` workflow continues maintaining
provider branches and the Codex/Copilot trees on main; GitHub release archives are
immutable versioned snapshots, not aliases for a moving provider branch.

Release Please updates the root npm manifest/lock, its version manifest, Python
project/lock metadata, every canonical plugin manifest, and the marketplace's
plugin version references. Generated provider trees are never direct update targets.
Adding a new plugin requires adding its manifest to the release configuration;
`npm run check:release` rejects omissions and mixed product versions.

## Required GitHub App setup

The workflow needs repository-scoped GitHub App credentials to create release PRs.
For a new installation, complete these steps:

1. [Register a GitHub App](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/creating-a-github-app)
   and install it on **amichne/slopsentral only**. No webhook is needed for this
   Actions-driven use.
2. Grant repository **Contents: read/write**, **Pull requests: read/write**, and
   **Issues: read/write** (for Release Please labels). Metadata read access is implicit.
   No administration, Actions-write, or account-wide installation is required.
3. Generate a private key and add these repository Actions secrets:
   - `RELEASE_PLEASE_APP_ID`: the numeric GitHub App ID.
   - `RELEASE_PLEASE_APP_PRIVATE_KEY`: the complete PEM private key.
4. After merging this setup and verifying the bootstrap release, the workflow
   runs automatically. To retry it manually on main:

   ```sh
   gh workflow run release-please.yml --repo amichne/slopsentral --ref main
   ```

Use GitHub's Secrets interface or `gh secret set`; never commit the key, paste it
into an issue/session, or put it in a workflow variable. The App token is scoped
to this repository and revoked after the job. It is not reused for publication.

The App token matters: release PRs created with the built-in `GITHUB_TOKEN` do not
trigger normal PR CI. There is deliberately no silent fallback to that token.
The publisher uses its separate job-scoped token and only runs trusted main code.

## Verification and recovery

```sh
npm run check:release
node --test tools/tests/release-please.test.mjs
uv run --locked pytest tools/python_checks/test_release_version.py tools/python_checks/test_release_assets.py tools/python_checks/test_pi_release_workflows.py
```

The updater test executes the exact Release Please library version bundled by the
pinned action, advances every manifest/lock in a disposable checkout, and verifies
that uv still accepts its lock without rewriting it. Its TOML JSONPath for the uv
root package uses the pinned updater's tagged `name.value` representation; update
that test and the library pin together when changing the action.

Failed checks do not authorize publication. Interrupted publication can leave a
source tag or draft; inspect it before retrying, and never overwrite a conflicting
version. If publication succeeded but lifecycle labeling failed, verify the
published downloads, then rerun only the idempotent label-finalization operation
for that exact published source revision. Do not remove pending labels as a
substitute for verifying a release.

If validation fails after a version PR merges, repair the failure through the normal PR process.
The next successful main run keeps that unpublished version and can publish its tested artifacts.
The publisher then completes the original version PR, even when the released source includes the repair commit.
The Pkl fixture uses a local registry for its publication check. An HTTP failure still stops qualification.

Pi receipt schema 2 binds the release version to `package.json` at the admitted
source commit, independently of the CI run number. Run identity and attempts are
still verified. [Pi installation and recovery](pi-install.md) remain available
without a source checkout, Python, or a build.
