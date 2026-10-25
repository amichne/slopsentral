import { readFileSync } from 'node:fs';

export const description = "Author typed Python tools, schemas, Pkl contracts, and agent resources. Install language servers and ast-grep or change requested personal configuration.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = []
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
  instructions.unshift("Amp global plugins may lose bundled scripts' executable permissions. When a\nskill documents a direct script command, read its shebang and invoke that\ninterpreter explicitly with the absolute script path and original arguments.\nPreserve interpreter flags: for `#!/usr/bin/env -S uv run --locked --script`,\nuse `uv run --locked --script <script-path> ...`; for `#!/usr/bin/env python3`,\nuse `python3 <script-path> ...`. Do not chmod or edit installed plugin caches.");
  for (const path of [
  "skills/ast-grep",
  "skills/cli-creator",
  "skills/lsp-management",
  "skills/manage-json-schemas",
  "skills/openapi-contract-authoring",
  "skills/personal-setup-management",
  "skills/pkl-engineering",
  "skills/plugin-composition-authoring",
  "skills/python-tooling",
  "skills/skill-primitive-authoring"
]) {
    await amp.registerSkill({ path });
  }
  amp.on('agent.start', () => ({ message: {
    content: instructions.join('\n\n'),
    display: false,
  } }));
}
