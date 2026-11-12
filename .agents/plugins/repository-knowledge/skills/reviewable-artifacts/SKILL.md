---
name: reviewable-artifacts
description: "Create skimmable, self-contained HTML documents for people to review: plans, proposals, research, investigations, comparisons, status reports, and explanations. Use when asked for an artifact, standalone HTML page, or document to share; when readers outside the thread need a durable review copy; or when visualizations carry an argument that chat cannot render. Keep ordinary plans and answers inline by default. Works with local files, attachments, and approved static hosts; requires no particular agent or hosting service."
---

# Reviewable Artifacts

An artifact here is a document for a person to read, written as one self-contained HTML page.
A reader can skim it in two minutes, refer to a specific block, and find that block again after
revisions. The file is the document. Hosting and commenting are optional delivery features,
not requirements for creating it.

`<skill>` means this skill's installed directory, not the workspace root. Resolve it before
using bundled files. Run the checker from the workspace root; it needs Node.js 22 or later
and no packages. Creating and opening a page does not require Node.js.

## When to Make a Page

The reply in the chat is the default. A page costs the reader a click and a switch of context,
so make one when the user asks for an artifact or a page, or when the document needs something
chat cannot give:

- **Readers outside this thread.** Teammates must review, approve, or comment on specific parts
  without reading the thread. They need a copy or a link they can actually open.
- **A life beyond this turn.** The document will be revised over days or consulted while work
  runs. Keep its file name and, where hosting supports it, its URL stable.
- **Visualizations that carry the argument.** Before-and-after structure, flows, charts,
  animated sequences, or a control the reader can try that prose cannot hold.

Length alone is not a reason. Plans stated before implementation, plans requested mid-thread
for the user's own use, and ordinary answers stay inline unless one of these reasons holds.
Screenshots, recordings, data files, and application UIs are not document pages covered here.

## Workflow

1. **Investigate.** Read the code, docs, and data the page depends on. A page written from memory
   sends the reader to review guesses.
2. **Create the page.** Use the project's existing document directory, or `artifacts/pages/`
   when there is none. Name the topic in kebab-case, such as `redis-sessions.html`. Copy
   [the template](assets/page-template.html) there with the available file tools. Keep that
   file name for the document's lifetime. Replace every `⟦…⟧` placeholder and delete unused
   sections. Keep the template's styles and script; a picture may bring its own.
3. **Write for the reader.** Read [page guidance](references/page-guidance.md) before drafting.
   It covers the summary, document shapes, decisions, evidence, and skimmable blocks. Read
   [pictures](references/pictures.md) when adding a visualization, animation, or code view.
4. **Check.** Run the bundled checker, passing `--dir` when using a different directory:

   ```text
   node <skill>/scripts/share.mjs --check --dir artifacts/pages
   ```

   Fix its errors and review its warnings. It checks common mistakes, not full HTML validity
   or rendering. If Node.js is unavailable, inspect placeholders, titles, unique ids, escaped
   code, and external dependencies manually; state that the automated check did not run.
5. **Look at the page.** Use any available browser tool or local browser. Inspect each picture
   and wide table: nothing overlaps, text is not cut off, and nothing escapes its block. Motion
   builds for about two seconds after scrolling into view; inspect after that. Check a narrow
   screen too when you built a picture. If browser access is unavailable, report that rendering
   remains unchecked rather than claiming a visual pass.
6. **Deliver.** Choose an available method under Sharing below. Reply with the link, attachment,
   or file path first, then at most five lines: what you need by tag and name, the main point,
   and how to give feedback. Do not repeat the document in the reply.
7. **Stop or continue.** If the user asked for the document, deliver it and end the turn. If the
   page describes requested work, continue with parts no open decision affects.
8. **Keep it current.** Revise the same file after feedback or decisions. Update status chips
   while work runs, so the document shows the real state.

## Make Feedback Precise

No review service is built into the page. Readers can quote a tag in chat, email, or an issue,
or use comments provided by their chosen host.

- **Give every reviewable block a unique `id`** naming its content, such as `step-dual-write`,
  not its position. Keep ids stable so fragment links still identify the same block.
- **Give decisions, findings, steps, and risks visible tags**: Q1, F1, S1, R1. After delivery,
  never renumber or reuse a tag. A new block takes the next free number.
- **Put one decision, finding, step, or risk in each element.** Start it with identifying words
  so quoted text is enough to find it.
- **Do not obstruct reading or host controls.** Avoid fixed overlays and full-page controls.

When feedback arrives:

1. Find the block by tag, fragment id, quoted text, or the host's selector. Ask when the target
   is ambiguous; do not assume a particular comment payload or automatic return to this thread.
2. Change that block and every block it affects.
3. Record the change under What changed with the tags involved; raise the header version.
4. Keep settled questions in place with a `done` chip such as "Decided: A". Deleting them
   breaks references readers already quoted.
5. Check again, update the delivery copy if authorized, and reply with what changed and the
   same link or file. For attachments, send the revised version; old copies do not update.

Answer a question-only comment in the thread. Add the answer to the page when other readers
would ask the same thing.

## Sharing

Choose the least infrastructure that reaches the intended readers:

- **Local file or attachment.** Give the user the file using the harness's supported file-link
  or attachment mechanism, or give its path. Without flags, the checker prints local file
  URLs. They work only where those files exist; they are not remote sharing links.
- **Local preview.** Use an available preview tool or an existing loopback-only static server.
  A localhost URL is a preview for that machine, not a link for teammates. Do not expose the
  workspace or start a public tunnel just to return a link.
- **Existing approved host.** Use the user's established static hosting or document-sharing
  workflow when publication is authorized. Serve only the artifact directory, not the whole
  workspace. The checker can form links for files hosted separately:

  ```text
  node <skill>/scripts/share.mjs --dir artifacts/pages --base-url https://docs.example.org/reviews/
  ```

  This prints URLs; it does not upload, start a server, verify reachability, or change access.
  Confirm the actual page and intended readers' access before calling a link shared. Never
  infer access from who can read this chat. Do not promise comments, stable URLs, or persistence
  unless the delivery method provides them.

Do not publish, change visibility, install tools, or commit files merely to deliver a page.
Offer a repository copy or another host when the user needs a longer-lived document; take the
corresponding action only with authorization. When remote delivery is unavailable, deliver the
file and state the limit instead of inventing a URL.

Example reply for a local deliverable:

```text
artifacts/pages/checkout-timeouts.html

I need one answer: Q1 (may the handler return before the charge completes).
The handler waits for the payment provider; retries push requests past 30 seconds.
F1 has the measurements. F3 is not reproduced.
Reply with a tag, such as "Q1: take B". This is a local file, not a hosted link.
```

## Completion

The page is self-contained, grounded, skimmable, and free of placeholders and duplicate ids.
Tags remain stable. State which automated and visual checks ran, how the reader can open the
page and give feedback, and any delivery limits. Publication is separate from file creation.

This is a portable adaptation, not an official host integration. Read
[provenance](references/provenance.md) when maintaining or redistributing it.
