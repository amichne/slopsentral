import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export default async function initialize(amp) {
  const { node, workspace, commands } = JSON.parse(
    await readFile(new URL('./fixture.json', import.meta.url), 'utf8'),
  );
  const argsByCommand = new Map(commands.map(command => [command, command.split(' ').slice(1)]));
  amp.registerTool({
    name: 'fixture_command',
    description: 'Run one literal command from the supplied fixture context.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['command'],
      properties: { command: { type: 'string', enum: commands } },
    },
    async execute({ command }) {
      const args = argsByCommand.get(command);
      if (!args) throw new Error('The fixture does not admit this command');
      const child = execute(node, args, { cwd: workspace, env: {}, timeout: 15_000, maxBuffer: 128 * 1024 });
      child.child.stdin?.end();
      const result = await child;
      return result.stdout;
    },
  });
}
