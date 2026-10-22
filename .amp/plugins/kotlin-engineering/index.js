import { readFileSync } from 'node:fs';

export const description = "Design, verify, review, and optimize Kotlin and Gradle changes.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = []
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
  for (const path of [
  "skills/gradle-performance-engineering",
  "skills/kotlin-application-stack",
  "skills/kotlin-design-practices",
  "skills/kotlin-gradle-validation",
  "skills/kotlin-review",
  "skills/negative-capability-proof"
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
