# Qualify Slopsentral through Microsoft APM

APM 0.35.0 can preserve complete Slopsentral Codex bundles at user scope with Codex CLI 0.163.0 on macOS arm64.
The qualification covers local package acquisition, disabled native registration, direct SessionStart execution, admission refusals, frozen reinstall, and owned removal.
Automatic hook delivery, model behavior, remote acquisition, and other platforms remain untested.

Use the existing [host installer](cli-install.md) for normal Slopsentral installation.
This guide records a separate APM qualification boundary.
The [versioned APM contract](https://github.com/microsoft/apm/blob/v0.35.0/docs/src/content/docs/consumer/installing-from-marketplaces.md#codex-compatibility-bundles-through-apm) requires explicit executable approval and leaves activation, trust, and authentication with Codex.
New registrations stay disabled.
The version gate accepts only Codex 0.163.0; a newer installed Codex does not satisfy it.

The [compatibility record](../tools/apm-compatibility.json) separates qualified pins from observed stable releases and the upstream Codex admission rule.
APM 0.35.0 is current, while stable Codex 0.166.0 exceeds its admitted version.
The current stable uv release is 0.13.7.
Version-maintenance work will qualify candidate binaries before proposing a pin change.

## Run the isolated qualification

The [qualification command](../tools/qualify_apm.py) runs on macOS arm64.
It needs Python 3.12 or 3.13, uv 0.12.9, APM 0.35.0, Codex 0.163.0, and Git.
Supply reviewed executables through absolute paths.
Download separate binaries from the [APM release](https://github.com/microsoft/apm/releases/tag/v0.35.0) and [Codex release](https://github.com/openai/codex/releases/tag/rust-v0.163.0), and verify their published checksums.
The command does not download tools, use credentials, or change active user configuration.

```sh
slopsentral-qualify-apm \
  --source /absolute/path/to/slopsentral \
  --out /tmp/slopsentral-apm-qualification \
  --apm /absolute/path/to/apm-0.35.0 \
  --codex /absolute/path/to/codex-0.163.0 \
  --uv /absolute/path/to/uv-0.12.9 \
  --python /absolute/path/to/python3.12
```

Add the checkout's `bin/` directory to the command's `PATH`, or invoke the script with `uv run --locked --script tools/qualify_apm.py` and the same arguments.
The script and adjacent lock can also be copied together and run outside the checkout.
Use `--self-test` for its dependency-free oracle check.

The output directory must be new.
It retains disposable homes, per-command JSON logs, and the independent payload inventory.
The final JSON response identifies executable digests, observed outcomes, and untested layers.
`QUALIFIED_MECHANISMS` requires every positive and negative control to pass.
If the loose conversion changes, the current negative control stops for reassessment.
After reviewing evidence, remove only that run's output directory.
The harness never removes an existing directory or edits the source bundle.

## What the checks establish

The published package under `.agents/plugins/<plugin>/` includes its compatibility manifest, skills, hooks, instructions, scripts, and locks.
The native APM route transfers the complete package rather than deploying loose skills.
The [assertions](../tools/python_checks/test_qualify_apm.py) reject missing policy, incorrect events, byte or executable-bit changes, indirect payloads, and inherited configuration.

The native qualification:

1. Installs every catalog plugin from local published packages into a credential-free home, with explicit hook approval.
2. Compares every installed file and executable bit against the source, and rejects duplicate loose skill deployment.
3. Checks that every registration is disabled and a foreign registration remains intact.
4. Runs the installed Software Engineering SessionStart command from an unrelated directory and compares its context with both bundled policy files.
5. Checks explicit refusal for missing `PLUGIN_ROOT` and malformed input. A zero process exit cannot establish policy delivery.
6. Repeats a frozen installation and checks preservation of explicit activation and unrelated settings.
7. Checks that removal refuses an activated entry and retains its APM declaration and native configuration.
8. Retires the fixture's activation, removes owned packages, and checks preservation of foreign plugins and unrelated settings.
9. Rejects unapproved executables and project-scope native installation before native configuration changes.

On 2026-11-04, published bundles from revision `ecc73dcec123a0b03993be98f3e9f0c9828ed143` passed these checks:

| Plugin | Files preserved |
| --- | ---: |
| Developer Tooling | 104 |
| IntelliJ Plugin Development | 16 |
| Kotlin Engineering | 62 |
| Repository Knowledge | 171 |
| Software Engineering | 127 |

These are historical observations for Slopsentral 4.0.8, APM 0.35.0, and Codex 0.163.0.
Rerun the qualification for changed bytes.
Native registration and direct execution do not establish automatic delivery to a running agent.
No model or MCP process starts in this qualification.
Only Software Engineering's context command receives semantic execution checks; the other hooks receive payload checks.

## Why loose Copilot conversion is unsupported

The separate Copilot control installs `.github/plugin/software-engineering` through APM with hook approval.
Installation exits successfully and writes hook declarations, but the deployed command retains `$PLUGIN_ROOT` and fails when run without a plugin environment.
The APM 0.35.0 [command-path parser](https://github.com/microsoft/apm/blob/v0.35.0/src/apm_cli/integration/hook_command_paths.py) recognizes braced plugin-root variables.
Slopsentral's commands use unbraced `$PLUGIN_ROOT` and read sibling policy assets.
Rewriting the variable alone does not establish a complete executable closure or the correct host event protocol.

The harness records this unsupported result and checks removal of the owned loose hook declaration.
It does not run a Copilot agent or claim every loose primitive is unsupported.
Use the native host path until complete dependency delivery and semantic host execution have independent proof.
