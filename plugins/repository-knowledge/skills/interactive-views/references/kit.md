# The Bundled View Kit

The kit is a local asset, not a service provided by a chat UI. `scripts/render.mjs` inlines
`assets/kit/kit.css`, `kit.js`, and `icons.svg` before the source fragment. It adds a document
title, viewport metadata, and a restrictive resource policy. Open the resulting HTML file
in a modern browser; it needs no build system, dev server, packages, or remote resources.
The script runs with Node.js 22 or later.

Do not open the source examples directly and expect styled charts. They deliberately contain
only the body fragment so every example shares one kit owner. Render the closest example,
then edit a workspace copy. Do not change the installed kit for one user's visualization.

## Source Examples

Paths are relative to this skill's installed directory. All data is illustrative; replace it
with the user's evidence and label any remaining synthetic values before delivery.

| Source under `assets/examples/` | Pattern |
| --- | --- |
| `indexed-lines.html` | A multiple, plotted against each series' own baseline |
| `highlighted-bars.html` | Ranking, one highlight, gray tail row, shares |
| `cumulative-share.html` | Cumulative share on a log axis, pointer and keyboard readout |
| `calculation.html` | Derivation ledger, changeable inputs, computed title, marginal cost |
| `decision-matrix.html` | Weighted decision, computed pick, smallest change that flips it |
| `design-options.html` | Today as baseline, three directions, stress condition, working actions |
| `flowchart.html` | Highlighted path, row-to-column responsive layout |
| `sequence.html` | Sequence diagram and synced state ledger |
| `race-timeline.html` | Concurrent callers on one axis, marked failure, switch to the fix |
| `tree.html` | Indented outline, expanded path, tree keyboard controls |

Example assembly (substitute the installed directory and workspace output path):

```text
node <skill>/scripts/render.mjs <skill>/assets/examples/flowchart.html --out /path/flowchart.html --title "A healthy canary gates rollout"
```

For a revision, repeat with `--overwrite`. That flag may replace an existing regular output
file, never the source or a symlink. Source fragments must be nonempty and at most 100,000
UTF-8 bytes. Full documents are rejected rather than given duplicate wrappers and scripts.
Open an already complete, self-contained document directly instead.

## Theme Tokens

Tokens are defined by the bundled stylesheet, with light and dark palettes selected through
`prefers-color-scheme`. An embedding host is not assumed to synchronize its theme. Use browser
light/dark emulation to inspect both; confirm any host-specific theme bridge separately.

| Token | Use |
| --- | --- |
| `--background` | Page background |
| `--foreground` | Primary text and the point that matters |
| `--muted-foreground` | Secondary text, axes, labels |
| `--border` | Hairline rules and zero baseline |
| `--grid` | Fainter chart gridlines |
| `--card` | Subtle surface for a real object |
| `--muted` | Hover, selection, neutral fills |
| `--chart-1` … `--chart-6` | Data series in order |
| `--chart-context` | Gray context series |
| `--series-1` … `--series-10` | Dashboard composition palette |
| `--success`, `--warning`, `--destructive` | Status marks with text |
| `--link` | Links and keyboard focus |
| `--radius` | Default 8px corners |
| `--font-sans`, `--font-mono` | System sans and monospace |

The base stylesheet uses 13px/20px sans text and zero body margin. The standalone shell adds
a small gutter and a 720px maximum width. Use `.ui-title` on a semantic heading or paragraph
instead of accepting a browser-default large heading. Style ordinary links explicitly.

## Text, Layout, and Controls

- `.ui-header` wraps `.ui-title` (13px, 500) and `.ui-sub` (12px muted), with 16px below.
  Every view opens with one, prototypes included.
- `.ui-label`, `.ui-caption`, `.ui-muted`, `.ui-num` (tabular), `.ui-big` (headline number),
  `.ui-mono`, and `code`.
- `.ui-stack` (grid, `--gap` defaults to 12px), `.ui-row` (flex, 8px gap), `.ui-rule`.
- `.ui-btn` with `.primary`, `.outline`, `.danger`, `.sm`, `.icon`, `.circle`.
- `.ui-seg` with `<button data-value="…" aria-selected="true">` children. It emits `change`
  with `event.detail.value`. Keep labels short enough for 360px. The kit upgrades it after
  insertion; handle the event on the containing element.
- `.ui-range` on a labelled `<input type="range">` fills its track to the thumb.

## Surfaces and Marks

- `.ui-pane`, `.ui-pane-header`, `.ui-pane-body`: a mocked window or pane.
- `.ui-float`: floating menu or panel; `.ui-surface`: subtle wash with a hairline ring.
- `.ui-menu`, `.ui-menu-item`, `.ui-hint`, `.ui-menu-sep`.
- `.ui-table`, with `.num` on numeric cells.
- `.ui-chip`, `.ui-kbd`, `.ui-avatar`, `.ui-dot`, `.ui-status`, `.ui-delta`.
- Status and delta marks accept `data-tone="success|warning|danger|info"`.
- Generic chat pieces: `.ui-user-msg`, `.ui-tool-row`, `.ui-composer`,
  `.ui-composer-input`, `.ui-composer-footer`, `.ui-spacer`, `.ui-send`, `.ui-caret`.
  These are illustrative anatomy, not a promise to match any product.
- Wireframes: `.ui-wire`, `.ui-wire-box`, `.ui-note`.
- Dashboards: `.ui-section`, `.ui-stats` with `.ui-stat`, `.ui-stat-label`, `.ui-stat-value`,
  `.ui-stat-sub`; `.ui-legend` with `<span><i style="--c: var(--series-1)"></i>Name</span>`.

Motion helpers include `.ui-enter` and `.ui-spin`. Reduced motion is respected by the kit;
custom animations and scripts must respect it too.

## Icons

Write `<i data-icon="check"></i>` with `.sm` (14px) or `.xs` (12px), or call
`ui.icon('check', 'sm')`. The inline sprite is bundled, including its upstream attribution
comment. Common names: `check`, `x`, `info`, `circle-alert`, `triangle-alert`, `loader-circle`,
`clock`, `arrow-up`, `arrow-right`, `arrow-down`, `chevron-right`, `chevron-down`, `plus`,
`minus`, `search`, `file`, `folder`, `git-branch`, `database`, `server`, `play`, `pause`.
Inspect `assets/kit/icons.svg` for the exact inventory. Use provider logos only to identify
the real provider, not as decoration or a claim of affiliation.

## `window.ui`

Wrap source scripts in `{ … }`. The renderer loads the kit before those scripts; no external
`window.ui` is required. Read the matching source example before calling a helper.

- `ui.line(el, options)`: `x` labels; `series` with `{ name, values, highlight, color }`;
  `format(v)`, `unit`, `height` (200), `min`, `max`, `xTicks`, `labels`, `tooltipTitle(i)`.
  `annotations` accepts bands (`from`, `to`), rules (`y`), markers (`at`), and points
  (`series`, `at`), each with a `label`. Returns `{ update(partialOptions) }`. Direct labels,
  hover readout, and left/right arrow keys are built in.
- `ui.bars(el, options)`: `items` with `{ label, value, highlight, muted }`, or `values` arrays
  with `keys` for stacked parts. Options: `format`, `share`, `max`, `mono`, `sort: false`.
  Returns `{ update(partialOptions) }`. Add a keyboard-readable table or caption for any
  essential detail that only the helper's hover reveals.
- `ui.stack(el, options)`: `x`; `series` with `{ name, values, icon, color }`; `percent`
  (true), `height` (200), `legend` (true), `format`, `tooltipTitle`. Composition columns,
  first series at the bottom. Pair with text/table access to every part, not hover alone.
- `ui.leaderboard(el, options)`: `items` with `{ name, sub, value, delta, icon, color }`;
  `format`, `deltaUnit` ('pts'). Keeps input order; an absent delta shows "new".
- `ui.sparkline(el, values, { color })`: a small trend with an end dot.
- `ui.tween(el, value, { format })`: animates a readout in place.
- `ui.format(value, { compact, digits, unit, prefix, percent })`: consistent numeric text.

These helpers are a starting point for valid, nonempty data. Validate your inputs, divisions,
units, finite values, and ranges before calling them. Do not treat the kit as a general chart
library or infer that every helper validates arbitrary data.
