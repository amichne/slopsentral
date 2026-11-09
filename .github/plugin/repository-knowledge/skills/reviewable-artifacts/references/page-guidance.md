# Writing a Page People Can Review

## What Goes in a Page

A page lets the reader act: approve, redirect, decide, or take the result and move on.
These rules hold for every kind of page.

- **Ground each claim in something you read.** Name the files, functions, commands, and
  sources. Label anything you could not verify as an assumption.
- **Give one answer.** State one conclusion or recommend one option. The reader should not
  have to choose between options that look equal. Put the others under Alternatives, each
  with the specific reason it lost.
- **Ask only what the reader must decide.** A question belongs under Decisions needed when
  its answer changes what happens next and neither the code nor the request settles it.
  Give options, a recommendation, and what happens while the answer is missing. Use a
  provisional default only for a reversible choice already authorized by the user. Otherwise
  mark the affected work blocked and continue independent work. Silence is not permission.
- **Write down what is still open.** A topic belongs under Not yet specified when it belongs
  on the page but you cannot yet state it as a precise claim or question. Name the area and
  what it waits for. The test is whether you can state the question now, not whether you can
  answer it: a question you can state goes under Decisions needed. When an item becomes
  clear, replace it with a block that takes the next free tag.
- **Say what could prove the page wrong.** Put each assumption that may be false under Risks,
  with the earliest signal that it is false.
- **Say what the page leaves out** under Out of scope when a reader could assume it is covered.
- **Size the page to the content.** A short page needs the summary and two or three blocks.
  Delete an empty section instead of filling it.

The template has more sections than one document needs. Keep the parts that fit, and name
summary rows to fit. "Needs from you" stays first on every page.

| Document | Other summary rows | Main sections |
| --- | --- | --- |
| Plan | Goal, Approach, Done when, Size | Approach, Steps |
| Proposal or design | Goal, Approach, Size | Approach |
| Research, investigation, or review | Answer, Confidence | Findings, most important first; Evidence |
| Comparison of options | Recommendation, Compared on | Findings, with one comparison table |
| Status report | State, Next | What changed, Steps with current chips |
| Explanation of a system or change | Main point | Approach with pictures, Findings for the parts |

Every kind keeps Decisions needed, Risks, Not yet specified, Out of scope, and Alternatives
when it has content for them. For a document not in the table, start from Summary and Findings.

## Write for the Reader Who Skims

Most readers read the header and summary, scan the headings and tags, and open details only
where they disagree. Write for that reader.

- **The header and summary stand alone.** Open with "Needs from you". Write "Nothing, this is
  for your information" when that is true. A reader who stops after the summary knows what
  you need and the main point.
- **Headings state the takeaway.** Write "Write to both stores first, then switch reads", not
  "Migration strategy". Fixed section names such as Steps and Risks stay as they are.
- **One idea per block, and its first sentence carries the point.** Keep paragraphs to three
  sentences.
- **Choose the form by the content.** Numbered items for a sequence, a table for things
  compared on the same attributes, a picture for behavior, structure, and amounts, and
  `<details>` for proof and long code.
- **Keep the main path short.** Put material needed only to check your work into `<details>`
  under Evidence or Alternatives. Never hide a decision or risk in `<details>`.
- **Use the same word for the same thing.** Put file paths, commands, and identifiers in
  `<code>`.
- **Keep the page self-contained.** Keep every style and script inline. Load no scripts,
  fonts, styles, or images from another site. Use inline SVG or embedded data for pictures.
  Links to cited sources are fine; the document itself must remain readable offline.

## Review the Reader's Path

Before delivery, read only the header, summary, headings, tags, and captions. Can you tell
what the page says, what the reader must decide, and what remains unverified? If not, change
those blocks before adding more prose.

Then check that each decision and risk is visible without opening details, and that evidence
names the actual source rather than just asserting confidence. A short page with one clear
answer is better than a complete-looking template full of empty sections.
