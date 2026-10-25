# Slopsentral

Focused engineering skills for Codex, GitHub Copilot, and native Pi.
Five repository-owned plugins cover software design, Kotlin, IntelliJ plugins,
developer tools, and repository knowledge.

[Documentation](https://slopsentral.michne.com) · [Install Codex or Copilot](https://slopsentral.michne.com/guides/install) · [Plugin catalog](https://slopsentral.michne.com/reference/catalog)

## Set up Pi

With Pi on `PATH`, Node.js 22.19 or later, curl, and system tar on macOS or Linux,
run this from your project:

```bash
bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/amichne/slopsentral/main/tools/install-pi.sh | sh'
```

The command installs the current verified native skill package and migrates old
Slopsentral registrations. It preserves unrelated settings and keeps recovery
backups. Installed Pi versions are used best-effort, without an exact-version gate.
Start a fresh Pi session and verify discovery with `/skill:semantic-ratchet`.

[Scope, upgrades, and recovery](https://slopsentral.michne.com/guides/pi) · [Qualified release contents](https://slopsentral.michne.com/reference/releases) · [Contribute](https://slopsentral.michne.com/maintainers/contribute)
