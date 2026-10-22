import { readFileSync } from 'node:fs';

export const description = "Author typed Python tools, schemas, Pkl contracts, agent resources, and explicit personal configuration changes.";

export default async function (amp) {
  // Read required context before registering anything; a missing payload fails loading.
  const instructions = []
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').trim());
  for (const path of [
  "skills/cli-creator",
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
  if (instructions.length) {
    amp.on('agent.start', () => ({ message: {
      content: instructions.join('\n\n'),
      display: false,
    } }));
  }
}
