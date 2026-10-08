# Terminal Design Language

Use this reference to make visual decisions after the interface contract is
known. Pick one coherent direction; do not combine the catalog into a collage.

## Aesthetic Thesis

Express the direction in one sentence tied to the product and audience. Useful
starting points include a monochrome instrument panel, amber CRT, paper ledger,
playful arcade, calm utility, editorial console, or tactical field display.
Treat these as prompts, not presets.

Choose one signature motif that can survive across states: a distinctive
header, asymmetric divider, status glyph family, progress treatment, or compact
data visualization. Repeat the motif sparingly enough that it remains special.

## Composition

- Match density to the task: dashboards may be dense; wizards and destructive
  actions need breathing room.
- Design wide, compact, and minimal arrangements. Prioritize, wrap, truncate,
  collapse, or scroll deliberately at each width.
- Keep live regions dimensionally stable so updates do not make the layout
  jump.
- Use alignment and whitespace before borders. Too many boxes create box soup.
- Reserve strong borders or background blocks for the region that owns focus
  or the most important state.

Border families carry tone:

- `+-+|` is portable and mechanical.
- `┌─┐│└┘` is neutral and precise.
- `╭─╮│╰╯` is softer.
- `╔═╗║╚╝` is formal or retro.
- `┏━┓┃┗┛` is heavy and industrial.
- `░▒▓█` creates texture, fill, and quantitative weight.

Provide an ASCII fallback for decorative Unicode. Do not require Nerd Fonts or
special fonts unless the user explicitly controls the deployment environment.

## Type and Glyphs

Create hierarchy with weight, dimming, case, spacing, and placement. Keep body
copy easy to scan; reserve uppercase or spaced lettering for short labels.
Choose a small glyph vocabulary, such as `›`, `◆`, `●`, `○`, `✓`, `×`, and
arrows, then assign each glyph one stable meaning.

Measure rendered cell width rather than string length. ANSI sequences,
combining marks, emoji, and wide Unicode glyphs must not break alignment or
truncation.

## Color

Define semantic roles such as background, surface, primary text, secondary
text, accent, focus, warning, and failure. Start with the lowest color depth the
product supports, then enhance for 256-color or true-color terminals.

Use contrast, labels, and glyphs alongside hue. Avoid default red/green status
pairs as the only distinction. Keep large background fills and gradients for
controlled environments where the terminal's theme is known.

## Motion and Feedback

- Animate only to show progress, causality, or a meaningful transition.
- Never delay an operation to finish an animation.
- Stop spinners and live renderers on every exit path.
- Disable animation for non-interactive output and when the application exposes
  a reduced-motion or no-animation setting.
- Prefer one characteristic progress or transition treatment over many small
  effects.

Braille spinners, block progress bars, sparklines, and live charts can add
character, but always pair them with textual state or values.

## Data Display

- Align numbers by decimal or units and labels by reading order.
- Size table columns by priority; preserve the key identifier before secondary
  metadata.
- Label axes, ranges, missing values, and stale data in charts and gauges.
- Use trees only for real hierarchy and indentation only while nesting remains
  scannable.
- Distinguish selected, focused, disabled, pending, successful, and failed
  states without relying on color alone.

## Anti-Patterns

Reject generic cyberpunk styling without product justification, every region in
a box, arbitrary ANSI colors, raw escape codes leaking into redirected output,
fixed-width layouts, clipped help text, hidden keybindings, jittering live
regions, gratuitous ASCII banners, animations that slow work, and decoration
that obscures errors or recovery actions.
