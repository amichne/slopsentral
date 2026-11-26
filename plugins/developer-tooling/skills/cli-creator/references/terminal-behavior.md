# Terminal Behavior

Preserve the application's output contract before visual changes.
Use the existing terminal framework and capability detection.
Do not introduce raw escape sequences when the framework owns the operation.

## States and Actions

Map startup, pending work, empty results, content, success, failure, and cancellation where the workflow reaches them.
Each state must expose its useful information and legal actions.
Define keyboard paths, focus order, minimum width, wrapping, and truncation.
Keep live regions stable during updates.
Keep commands operable without motion, color, or decorative glyphs.

## Presentation

Place the primary action and its result first.
Use spacing and alignment before borders or decoration.
Keep a consistent set of semantic style tokens for focus, selection, pending work, success, and failure.
Never encode meaning through color, shape, or motion alone.
Provide text labels and ASCII alternatives.
Measure terminal cell width for Unicode alignment and truncation.
Preserve identifiers before secondary table columns.
Label units, ranges, missing values, and stale data.

## Terminal Effects

Honor `NO_COLOR` and the application's reduced-motion policy.
Use plain output for non-interactive streams.
Stop progress renderers on every exit path.
Never delay completion for an animation.
Restore terminal state after failure, cancellation, and interruption.
Keep stdout clean for structured modes.

## Evidence

Exercise the primary workflow in a real terminal at normal and narrow widths.
Include the keyboard flow and each changed state.
Repeat with color disabled and with limited Unicode support.
Redirect stdout and parse the structured result.
Examine terminal restoration after accepted and failed operations.
A screenshot alone does not prove keyboard behavior, output contracts, or restoration.
