import { existsSync, readFileSync } from 'node:fs';

export const description = "Design proof-preserving boundaries and implement, verify, and deliver software with uv-managed Python automation.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = [
  "instructions/agent-execution.md",
  "instructions/engineering-design.md"
]
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
  const scriptedSkills = new Set();
  for (const path of [
  "skills/git-change-flow",
  "skills/github-ci-operations",
  "skills/issue-tracker-operations",
  "skills/mise-project-tooling",
  "skills/pull-request-lifecycle",
  "skills/python-tooling",
  "skills/semantic-ratchet",
  "skills/tdd"
]) {
    await amp.registerSkill({ path });
    if (existsSync(new URL(path + '/scripts/', import.meta.url))) {
      scriptedSkills.add("software-engineering:" + path.slice('skills/'.length));
    }
  }
  amp.on('agent.start', () => instructions.length === 0 ? undefined : ({
    message: { content: instructions.join('\n\n'), display: false },
  }));
  if (scriptedSkills.size === 0) return;
  const guidance = "Amp global plugins can lose bundled scripts' executable permissions. When a\nskill documents a direct script command, read its shebang and invoke that\ninterpreter explicitly with the absolute script path and original arguments.\nPreserve interpreter flags: for `#!/usr/bin/env -S uv run --locked --script`,\nuse `uv run --locked --script <script-path> ...`; for `#!/usr/bin/env python3`,\nuse `python3 <script-path> ...`. Do not chmod or edit installed plugin caches.";
  amp.on('tool.result', ({ tool, input, status, output }) => {
    if (tool !== 'skill' || status !== 'done' || !scriptedSkills.has(input?.name)
      || !Array.isArray(output?.content) || output.content.some(part => part?.text === guidance)) return;
    return { status, output: { ...output, content: [...output.content, { type: 'text', text: guidance }] } };
  });
}
