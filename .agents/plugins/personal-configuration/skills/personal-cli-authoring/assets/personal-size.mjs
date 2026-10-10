#!/usr/bin/env node
// A small retained example: parsing -> inspection -> filtering -> presentation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runTeach } from '../scripts/teach.mjs';

const self = fileURLToPath(import.meta.url);
const commandOptions = {
  help: { type: 'boolean', description: 'Show static help offline' },
  'min-bytes': { type: 'string', description: 'Include regular files at least this size' },
  json: { type: 'boolean', description: 'Emit a FILE_SIZES object' },
  completions: { type: 'string', description: 'Print offline completion source for zsh' },
  teach: { type: 'boolean', description: 'Explain usage here, with an optional question' },
  'teach-preview': { type: 'boolean', description: 'Print teaching context locally' },
  'teach-history-stdin': { type: 'boolean', description: 'Summarize recent commands supplied on stdin' },
  'teach-adapter': { type: 'string', description: 'Use this executable as the assistant adapter' },
  'teach-adapter-arg': { type: 'string', multiple: true, description: 'Append one adapter argument; repeatable' },
};
function fail(type) {
  process.stderr.write(JSON.stringify({ type }) + '\n');
  return type === 'INVALID_ARGUMENTS' ? 2 : 1;
}
function completions() {
  const quote = text => "'" + text.replaceAll("'", "'\\''") + "'";
  const specs = Object.entries(commandOptions).map(([name, option]) =>
    `${option.multiple ? '*' : ''}--${name}[${option.description}]${option.type === 'string' ? ':value:' : ''}`);
  return '#compdef personal-size\n_personal_size() {\n  _arguments ' +
    [...specs, '1:question:'].map(quote).join(' \\\n    ') + '\n}\ncompdef _personal_size personal-size\n';
}
function main(argv) {
  let values, positionals;
  try { ({ values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: commandOptions })); }
  catch { return fail('INVALID_ARGUMENTS'); }
  if (values.help) {
    console.log('personal-size [--min-bytes N] [--json]\npersonal-size --teach [QUESTION] [--teach-preview]');
    for (const [name, option] of Object.entries(commandOptions)) console.log(`  --${name}  ${option.description}`);
    return 0;
  }
  if (values.completions !== undefined) {
    if (values.completions !== 'zsh' || positionals.length || Object.keys(values).length !== 1) return fail('INVALID_ARGUMENTS');
    process.stdout.write(completions());
    return 0;
  }
  if (values.teach) {
    if (values.json || values['min-bytes'] !== undefined || positionals.length > 1) return fail('INVALID_ARGUMENTS');
    const args = ['--command', 'personal-size', '--source', self,
      '--source', fileURLToPath(new URL('../scripts/teach.mjs', import.meta.url))];
    if (positionals.length) args.push('--prompt', positionals[0]);
    if (values['teach-preview']) args.push('--preview');
    if (values['teach-history-stdin']) args.push('--history-stdin');
    if (values['teach-adapter']) args.push('--adapter', values['teach-adapter']);
    for (const arg of values['teach-adapter-arg'] ?? []) args.push('--adapter-arg', arg);
    return runTeach(args);
  }
  if (positionals.length || Object.keys(values).some(k => k.startsWith('teach-'))) return fail('INVALID_ARGUMENTS');
  const raw = values['min-bytes'] ?? '0';
  if (!/^(0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) return fail('INVALID_ARGUMENTS');
  let files;
  try {
    files = fs.readdirSync(process.cwd(), { withFileTypes: true }).filter(f => f.isFile() && !f.name.startsWith('.'))
      .map(f => ({ name: f.name, bytes: fs.statSync(path.join(process.cwd(), f.name)).size }))
      .filter(f => f.bytes >= Number(raw)).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return fail('DIRECTORY_UNREADABLE'); }
  if (values.json) console.log(JSON.stringify({ type: 'FILE_SIZES', files }));
  else for (const file of files) console.log(`${file.bytes}\t${file.name}`);
  return 0;
}
process.exitCode = main(process.argv.slice(2));
