# Pictures That Carry the Argument

A reader takes in a structure, change, or set of numbers faster from a picture than prose.
Before writing a section, ask what shape its content has. When it has one, draw the shape
first. Prose then carries what the picture cannot: the reason, edge cases, and risks.

Give the page a picture of its main point. A page proposing or explaining a change shows
Before and After in Approach. Leave pictures out when the content has no useful shape, such
as a rename or unrelated facts; do not invent a diagram just to fill the template.

## Choose the Picture by the Content

| Content | Picture | Markup |
| --- | --- | --- |
| Request path, pipeline, states, connected parts | Flow | `.flow` with `.node` and `.edge` |
| Parallel work or parts that belong together | Grouped flow | `.group` inside `.flow` |
| A change | Two flows with the same layout | `.compare` with one `.viz` per pane |
| Event order or the path data takes | Motion | `.seq` on `.flow`, `.live` on `.edge` |
| Parts of a request, prompt, command, or config | Labelled parts | `<dl class="parts">` |
| Amounts to compare | Bars on one scale | `<ul class="bars">` |
| Trend, loop, state machine, crossing lines | Chart or diagram | Inline `<svg>` |
| Screen or output the user will see | Mockup | Your own HTML and CSS |
| A relation the reader should try | Control that changes a picture | `<input>` or `<button>` and a short script |
| Call order, logic, file ownership, exact text | Call tree, pseudocode, file tree, diff | `<pre>` or `<pre class="diff">` |

The first six rows are ready in the template. Replace the content and keep the classes:

```html
<figure id="fig-order-jobs">
  <div class="viz">
    <div class="flow row seq">
      <div class="node">Order placed</div>
      <div class="edge live"><span>event</span></div>
      <div class="group" data-label="In parallel">
        <div class="node">Reserve stock</div>
        <div class="node hot">Charge card<small>slowest, 1.2 s</small></div>
      </div>
      <div class="edge"><span>all done</span></div>
      <div class="node ok">Order confirmed</div>
    </div>
  </div>
  <figcaption>Both jobs start together, so the charge sets the total time.</figcaption>
</figure>

<!-- Each of these also goes in its own figure and .viz. -->
<dl class="parts code">
  <div>
    <dt>Method and path</dt>
    <dd>POST /v1/charges</dd>
  </div>
  <div class="hot">
    <dt>Idempotency key</dt>
    <dd>Idempotency-Key: order-8841</dd>
  </div>
</dl>

<ul class="bars">
  <li class="hot" style="--v: 100"><span>Charge card</span><b>1200 ms</b></li>
  <li style="--v: 26"><span>Reserve stock</span><b>310 ms</b></li>
</ul>
```

These numbers illustrate markup, not a real measurement. Replace them with evidence from the
work before using the picture in a document.

- `.viz` frames one picture. Put each `.flow`, `.parts`, `.bars`, SVG, or mockup in one.
- `.flow` runs top to bottom. Add `row` for left to right; a narrow container turns it back
  into a column. Children are `.node`, `.edge`, and `.group` in the order things happen.
- `.node` holds a name and a `<small>` consequence. `hot` marks what matters, `ok` a good end,
  `bad` a failure, and `gone` a removed part.
- `.edge` is an arrow. Its `<span>` holds the label, `hot` colors it, and `live` sends a dot
  along it.
- `.seq` makes children appear in order when the picture scrolls into view. The page adds a
  Replay button to its caption.
- `.parts` takes a `<div>` per part. Add `code` for exact text; it keeps line breaks and
  spaces, so start the text directly after `<dd>`.
- `.bars` takes `--v` per row: its length as a percentage of the longest bar. Bars grow when
  the picture scrolls into view.

## Draw It Well

- **Draw what the system does**, not which files change: the request path, object states,
  call order, or data ownership.
- **Mark only what matters.** Use `hot` on changed or important parts. Leave the rest neutral
  unless showing a good or bad outcome.
- **Keep Before and After aligned.** Use the same layout and labels, so only the difference
  moves. When Before would be empty, show the result alone.
- **Write a consequence that matters** on the part causing it: latency, count, error.
- **Use real names and numbers.** Invented numbers are unsupported claims.
- **Use motion for order or direction.** Steps appear in order, a dot follows data, a bar
  grows to its value. Motion without meaning only delays the reader.
- **Make the picture complete when still.** It must read correctly in a screenshot, in print,
  and with motion turned off. The template does this. Put your own motion inside
  `@media (prefers-reduced-motion: no-preference)`.
- **Say in the caption what the reader should notice.**

Wrap each picture in `<figure id="fig-…">` with a `<figcaption>` so readers can refer to it.

## Your Own Pictures

When the template has no picture for the content, build one. Inline SVG with a `viewBox`,
a mockup in HTML and CSS, or a control with a short script are all fine. Put its `<style>`
inside the figure and its `<script>` directly after it. Start each selector with the figure's
id, so nothing else on the page changes.

Take colors from the page variables so it works in light and dark mode: `--text`, `--muted`,
`--border`, `--line`, `--surface`, `--bg`, `--accent`, `--accent-soft`, `--ok`, `--bad`, `--warn`.
A control shows a useful state before the reader touches it. Use labelled native controls
that work with a keyboard.

## Code as Text

Call trees, pseudocode, file trees, and diffs stay text because their content is code. Put
`<pre>` inside a figure and start each line at the first column. Escape `&` as `&amp;` and
`<` as `&lt;`; a raw `<` can start a tag and swallow the rest of the page.

`<pre class="diff">` highlights lines starting with `+` and `-`. `<pre class="diagram">`
renders an existing text drawing. Use the latter only to carry over a drawing that already
exists, and keep tabs, `&`, `<`, `>`, and emoji out of it. No separate code-explanation skill
is required to use these views.
