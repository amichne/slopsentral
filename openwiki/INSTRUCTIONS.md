# Slopsentral documentation scope

Document the current authored marketplace and its maintenance workflows in
English OKF pages. Readers are plugin authors, repository maintainers, and users
choosing an installation surface. Explain mechanisms, ownership, and failure
boundaries with source evidence rather than listing files.

Use `source/`, `tools/`, package manifests, schemas, and workflow definitions as
the authorities. Generated provider trees and installed caches are consumers.
Keep the native OpenWiki Claims lifecycle; never use the standalone OKF checker
as a replacement for OpenWiki submission and finalization.

Reuse `docs/glossary.json` and its generated `docs/GLOSSARY.md` reader view.
They already cover `openwiki/**/*.md`; do not create a second glossary under
this wiki. Use the repository-knowledge plugin's controlled-technical-writing
procedure to bootstrap a minimal provisional glossary before the page queue
only when the selected repository has no glossary. Unsupported definitions
remain gaps, and short edits or assessment alone do not trigger creation.

Rewrite current system explanations as task-oriented wiki pages. Preserve the
existing `docs/` runbook URLs, examples, and historical audits as supporting
references; do not rewrite historical findings as current measurements. Link
to those references where their operational detail helps the reader.

Cover source composition, Pkl projection and provider limits, authoring and
validation, releases and tested-byte publication, Pi installation, and portable
global instructions. Keep the quickstart's routing links current. Explain
documentation automation, its two required GitHub secrets, and the distinction
between locally validated setup and an observed successful Actions run.

No wiki update authorizes source edits, workflow edits, package publication,
deployment, or auto-merge. Recurring updates propose completed generated wiki
changes only. Preserve the authored instructions in this file.
