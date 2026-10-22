import { readFileSync } from 'node:fs';

export const description = "Build, test, package, and diagnose IntelliJ Platform plugins.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = []
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
  for (const path of [
  "skills/intellij-platform-testing",
  "skills/intellij-plugin-delivery",
  "skills/intellij-psi-indexing"
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
