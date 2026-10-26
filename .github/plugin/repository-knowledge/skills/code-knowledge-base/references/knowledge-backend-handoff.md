# Knowledge Backend Handoff

Inspect repository instructions, existing knowledge configuration, source
citations, and the requested destination before writing pages. This skill owns
OKF documents and their checker. OpenWiki execution belongs to the existing
external `openwiki` skill and its repository tooling; preserve that provenance
and load it by name when available. Do not copy it into this marketplace, run
the OKF checker over OpenWiki pages, or silently create a second knowledge store.

For an authorized OpenWiki generation or rewrite, first use
controlled-technical-writing to reuse the repository glossary or create a
minimal source-backed provisional glossary when none exists. Keep its JSON
source and generated reader view outside OpenWiki's managed page queue, and
include the wiki paths in its controlled document scope. Do not create another
glossary merely because the backend changes.

Then follow the external integration's native lifecycle: begin at the absolute
Git top-level, submit a repository-specific plan when required, consume one
assigned page at a time, submit sparse Claim decisions, and finish only after
the queue completes. OpenWiki validates OKF frontmatter and owns Claim IDs,
sidecars, indexes, provenance, and run state. Never substitute standalone OKF
validation for that lifecycle or report a partial run as complete.

For recurring updates, inspect the installed OpenWiki version's supported CI
entrypoint. Pin the package and model, run only trusted default-branch source,
and propose documentation-only changes for review. Keep generation credentials
separate from a repository-scoped publication token. Do not auto-merge, publish
source changes, or enable a schedule through remote writes without authority.

For a requested sibling Git repository with no source diff, select the OKF
overlay described in knowledge-overlay.md. OpenWiki workspace linking does not
establish separate source and storage roots. Do not start its normal generation
in invisible mode without a qualified external-storage capability.

If OpenWiki is requested but its owner or tools are unavailable, retain the
backend decision and report the missing capability. Installation and remote
publication need their own applicable authority. An ordinary code task does not
require knowledge generation because a backend marker exists.

For an authorized migration, inventory source pages and citations, preserve
prose and source identity, and track each page through the destination's native
validation. For refresh, identify affected pages, regenerate or revise through
the owning backend, and check Claims/citations and repository gates. Counts alone
do not prove semantic preservation. Report migrated, refreshed, unresolved, and
unverified obligations separately, including pending CI at the exact revision.
