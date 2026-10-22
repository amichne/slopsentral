import { readFileSync } from 'node:fs';

export const description = "Design proof-preserving boundaries and implement, verify, and deliver software with uv-managed Python automation.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = [
  "instructions/agent-execution.md",
  "instructions/engineering-design.md"
]
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
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
  }
  if (instructions.length) {
    amp.on('agent.start', () => ({ message: {
      content: instructions.join('\n\n'),
      display: false,
    } }));
  }
}
