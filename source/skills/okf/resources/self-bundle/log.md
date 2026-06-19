# Directory Update Log

## 2026-06-16
* **Update**: Reworked [validate.py](/systems/validator.md) and [visualize.py](/systems/visualizer.md) onto the shared [okf_common.py](/systems/okf-common.md) parser, with code-aware link extraction and consistent path normalization.
* **Fix**: Resolved code-block link false-positives and the path-normalization inconsistency in the validator (found by the [adversarial audit](/decisions/adversarial-audit-process.md)).
* **Creation**: Added [okf_common.py](/systems/okf-common.md), the [test suite](/reference/testing.md), and three decisions — [shared parser module](/decisions/shared-parser-module.md), [self-contained visualizer](/decisions/self-contained-viz.md), and [producer lints vs conformance](/decisions/producer-lint-vs-conformance.md).
* **Initialization**: Created this self-describing bundle (dogfooding) for okf-knowledge.
* **Creation**: Documented the [/okf command](/systems/okf-command.md), the [validator](/systems/validator.md), and the [visualizer](/systems/visualizer.md).
* **Creation**: Captured the initial [design decisions](/decisions/index.md) — [PyYAML over hand-rolled](/decisions/pyyaml-over-hand-rolled.md), [command-driven over hooks](/decisions/command-driven-over-hooks.md), and the [native /okf trigger](/decisions/name-okf-native-trigger.md).
