import { readFileSync } from 'node:fs';

export const description = "Write technical documentation and maintain source-backed repository knowledge, navigation, and overlays.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = []
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
  for (const path of [
  "skills/code-knowledge-base",
  "skills/controlled-technical-writing",
  "skills/local-repository-navigation",
  "skills/technical-documentation"
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
