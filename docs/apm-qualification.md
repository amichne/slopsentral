# Qualify Slopsentral through Microsoft APM

APM 0.35.0 has a complete-bundle route for Codex compatibility plugins.
Its contract requires Codex CLI 0.163.0, user scope, and explicit approval of executable types.
New native registrations stay disabled.
Activation, trust, authentication, and execution remain with Codex.

Use the existing [host installer](cli-install.md) for normal Slopsentral installation.
This guide records the separate APM qualification boundary.
It does not establish support for another Codex version or another platform.

## Keep the bundle intact

The published Codex package under `.agents/plugins/<plugin>/` contains its compatibility manifest, skills, hooks, instructions, scripts, and locks.
APM's native route preserves that package instead of deploying loose skills.
APM's [versioned contract](https://github.com/microsoft/apm/blob/v0.35.0/docs/src/content/docs/consumer/installing-from-marketplaces.md#codex-compatibility-bundles-through-apm) documents the admission and ownership rules.

The initial macOS arm64 check installed the Software Engineering package from Slopsentral revision `ecc73dcec123a0b03993be98f3e9f0c9828ed143` into disposable homes.
All 127 installed files matched the published bytes and executable bits.
The registration stayed disabled.
Running its installed SessionStart command from an unrelated directory emitted the expected bundled policy.
Removing `PLUGIN_ROOT` produced `continue: false` with `INVALID_PLUGIN_ROOT`, despite process exit zero.
The structured response determines whether policy was delivered.

## Evidence still required

The qualification needs repeatable checks across all published plugins, rejected approvals and scopes, frozen installation, and ownership-safe removal.
Native registration and direct command execution do not prove that a running agent receives context or invokes a hook automatically.
No model or MCP process was started by the initial check.

APM's loose Copilot conversion is a different contract.
Its 0.35.0 command-path parser recognizes braced plugin-root variables; Slopsentral's Codex commands use unbraced `$PLUGIN_ROOT` and load sibling policy assets.
Do not infer Copilot runtime support from a successful APM install.
