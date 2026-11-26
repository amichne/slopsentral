# Quiet, Precise Visual Design

These rules style the view's own explanation and controls. Inside a mockup of an existing
product, that product's source and design rules win. The bundled kit supplies defaults; it
is not an instruction to make every product look alike.

## Frame and Layout

- Design for a compact 720px view and a 360px phone. The standalone page adds a small gutter.
  Keep the useful content under about 600px tall; beyond that, cut or split it. This is a
  reading target, not an assumption that a host automatically resizes an iframe.
- Put content on the page background, without an enclosing card. Structure with space first,
  hairline rules second, and surfaces last.
- A surface (`var(--card)`, a hairline ring, `var(--radius)` corners) stands for a real object:
  a window, menu, or code panel. Never wrap a chart or prose in a card or put a box in a box.
  Use `.ui-stat` tiles only on dashboards, where each states a named fact.
- Space on a 4px scale: 4–8px inside a group, at least twice that between groups. Put more
  space above a heading than below it. Pad real surfaces by 12–16px.
- Left-align on a few shared edges. Do not center text or layouts.
- Nest radii concentrically: the inner radius is the outer radius minus the padding.
- Use no shadows except for a mocked floating element such as a menu:
  `box-shadow: 0 0 0 1px var(--border), 0 4px 12px -4px rgb(0 0 0 / 0.16)`.
- At 360px, nothing scrolls sideways or gets clipped. Give grid and flex children
  `min-width: 0`, let rows wrap, and reflow wide structures into one column. Do not hide
  overflow to conceal a layout failure.
- Size content from its width, never a host frame's height. Avoid `vh` and `height: 100%` on
  `html` or `body` in embedded views. Prefer document scrolling to nested scroll regions.

## Type

- Use 11px for ticks, captions, and compact code; 12px for secondary text; 13px for body and
  titles; and 15px or 20px for one headline number when that number is the point. Larger
  user or product accessibility requirements take precedence; test zoom and text resizing.
- Use weights 400 and 500. Build hierarchy with size and two text colors, `--foreground`
  and `--muted-foreground`, not heavy weight.
- Use semantic elements where appropriate and style them explicitly. The kit's `.ui-title`
  can go on a heading; do not rely on browser-default heading sizes or bold.
- Set `font-variant-numeric: tabular-nums` on aligned numbers and right-align numeric columns.
  Write `1.2k`, `3.4M`, `412 ms`, `+12%`, `−3`, with consistent precision across a set.
- Use `--font-mono` for code, commands, paths, ids, and diff stats, not ordinary labels.
- Labels are sentence case, short and specific. No eyebrow labels, all caps, letter spacing,
  emoji, metadata strings such as "A · B · C", or trailing arrows. Copy inside a mockup
  follows the product's rules instead. Dashboard section labels are a limited exception.
- Use `text-wrap: balance` on titles and `pretty` on prose; keep prose under 65 characters
  per line.

## Color

Most of a good view is `--foreground`, `--muted-foreground`, `--border`, and `--grid`.

1. Draw everything in grays first.
2. Color only what the takeaway names: one thing in `--chart-1`; when it names two or three,
   use `--chart-1`, `--chart-2`, `--chart-3`. Keep the rest in `--chart-context`.
3. One hue means one thing throughout the view. Blue cannot mean one service in the first
   chart and another category in the next.
4. Use status colors only on small marks with text: a dot, delta, or badge. Status means good
   or bad, not an event or a category. Distinguish series with labels and shapes too.
5. Never put text on a saturated fill. No gradients, glows, tinted panels, or colored side
   borders. Inside a mockup, use the real product colors from its source.
6. Do not fade necessary text below `--muted-foreground`. Mark "not yet" or "not taken" with
   dashes or an outline, not opacity.

Use kit tokens for every view color. The palette definitions themselves live in the bundled
stylesheet, not an agent's host. For many categories, ordered values, and diverging values,
read the Charts reference.

## Interaction and Motion

Add interaction only when it answers a question: exact values, what happens if, which option
feels right, or where something is. The view makes its point before anyone touches it.

- Use native buttons, inputs, and labelled controls. The kit's `.ui-btn`, `.ui-seg`, and
  `.ui-range` supply consistent styling; they are optional, not host APIs.
- Gate hover styles with `@media (hover: hover)`. Hover is higher contrast, without a color
  transition. Anything revealed on hover also works by tap and keyboard.
- Show focus with `outline: 2px solid var(--link); outline-offset: 1px`. Support the obvious
  keys: Enter, Escape, arrows to step. Preserve focus when replacing a control during render.
- Animate only to explain a change. Use short, roughly 150–200ms ease-out transitions on
  `transform` and `opacity`; enter from a 2px offset with a fade. Turn motion off under
  `prefers-reduced-motion: reduce`. Never animate the whole view in, loop, or pulse merely
  for decoration. A prototype of a shipped looping state is an explicit exception.
- Keep interactive state in one object and render from it. Offer Reset or another way to
  try again. Restore focus after a re-render.

The inherited kit is a starting point, not a blanket accessibility guarantee. Test the
interaction you use; do not assume every chart helper has the same keyboard behavior.

## Never by Default

Cards around charts or prose; rows of identical tiles outside dashboards; bold display text;
more than four text sizes; hover-only facts; dark tooltip boxes; full-view entrance motion;
pulsing dots; `transition: all`; hover effects on everything; gradients; glows; emoji; icon
pedestals; colored left borders; hard-coded palette values in the view's own markup.
