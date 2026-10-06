import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

const root = path.resolve(import.meta.dirname, '../..');
const skill = path.join(root, 'source/skills/personal-cli-authoring');
const helper = path.join(skill, 'scripts/teach.mjs');
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'personal teach '));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'tool.mjs'), 'export const purpose = "inspect files";\n');
  fs.writeFileSync(path.join(cwd, '.private'), 'never read this');
  return cwd;
}
function run(cwd, args = [], input = '') {
  assert.ok(fs.existsSync(helper), 'source-backed teach building block must be provided');
  return spawnSync(process.execPath, [helper, '--command', 'inspect', '--source', 'tool.mjs', ...args], {
    cwd, encoding: 'utf8', input, timeout: 10000,
  });
}
function packet(result) {
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  const schema = JSON.parse(fs.readFileSync(path.join(skill, 'references/teach-result.schema.json'), 'utf8'));
  const validate = new Ajv({ strict: true }).compile(schema);
  assert.ok(validate(value), JSON.stringify(validate.errors));
  return value;
}
function failure(result, type) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  const value = JSON.parse(result.stderr);
  assert.equal(value.type, type);
  const schema = JSON.parse(fs.readFileSync(path.join(skill, 'references/teach-result.schema.json'), 'utf8'));
  assert.ok(new Ajv({ strict: true }).compile(schema)(value));
  return value;
}

test('teach preview includes exact source, caller directory and optional question', t => {
  const cwd = fixture(t);
  const value = packet(run(cwd, ['--preview', '--prompt', 'Find large files here']));
  assert.equal(value.type, 'TEACH_CONTEXT');
  assert.equal(value.directory.path, fs.realpathSync(cwd));
  assert.deepEqual(value.directory.entries, ['tool.mjs']);
  assert.deepEqual(value.question, { type: 'PROVIDED', text: 'Find large files here' });
  assert.equal(value.history.type, 'UNAVAILABLE');
  const source = fs.readFileSync(path.join(cwd, 'tool.mjs'));
  assert.equal(value.sources[0].content, source.toString());
  assert.equal(value.sources[0].sha256, createHash('sha256').update(source).digest('hex'));
});

test('teach keeps recent executable summaries and discards operands and shell expressions', t => {
  const cwd = fixture(t);
  const lines = ['TOKEN=PRIVATE curl example.com', 'echo $(cat secret)', ...Array(25).fill('git status --token PRIVATE'), 'rg SECRET file'];
  const value = packet(run(cwd, ['--preview', '--history-stdin'], lines.join('\n')));
  assert.equal(value.history.type, 'COMMAND_NAMES');
  assert.equal(value.history.commands.length, 20);
  assert.equal(value.history.commands.at(-1), 'rg');
  assert.ok(!JSON.stringify(value).includes('PRIVATE'));
  assert.ok(!JSON.stringify(value).includes('SECRET'));
  assert.equal(value.question.type, 'INFER_FROM_CONTEXT');
});

test('missing, oversized and invalid UTF-8 source fail before invoking a backend', t => {
  const cwd = fixture(t);
  fs.unlinkSync(path.join(cwd, 'tool.mjs'));
  failure(run(cwd, ['--preview']), 'SOURCE_UNREADABLE');
  fs.writeFileSync(path.join(cwd, 'tool.mjs'), 'a'.repeat(131073));
  failure(run(cwd, ['--preview']), 'SOURCE_TOO_LARGE');
  fs.writeFileSync(path.join(cwd, 'tool.mjs'), Buffer.from([0xff]));
  failure(run(cwd, ['--preview']), 'SOURCE_INVALID_TEXT');
});

test('source budget and context bounds fail explicitly', t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'dependency.mjs'), 'a'.repeat(131072));
  failure(run(cwd, ['--preview', '--source', 'dependency.mjs']), 'SOURCE_TOO_LARGE');
  failure(run(cwd, ['--preview', '--history-stdin'], 'x'.repeat(32769)), 'HISTORY_TOO_LARGE');
  failure(run(cwd, ['--preview', '--prompt', 'x'.repeat(4097)]), 'INVALID_ARGUMENTS');
  failure(run(cwd, ['--preview', '--unknown']), 'INVALID_ARGUMENTS');
});

test('adapter receives structured context on stdin without a shell and failure is typed', t => {
  const cwd = fixture(t);
  const adapter = path.join(cwd, 'adapter.mjs');
  fs.writeFileSync(adapter, 'let s=""; for await (const c of process.stdin) s+=c; const p=JSON.parse(s.slice(s.indexOf("{\\n"))); console.log(p.command+":"+process.argv[2]+":"+p.question.text);');
  const result = run(cwd, ['--prompt', 'literal $(touch BAD)', '--adapter', process.execPath, '--adapter-arg', adapter, '--adapter-arg', 'two words']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'inspect:two words:literal $(touch BAD)');
  assert.ok(!fs.existsSync(path.join(cwd, 'BAD')));
  fs.writeFileSync(adapter, 'process.exit(7);');
  assert.equal(failure(run(cwd, ['--adapter', process.execPath, '--adapter-arg', adapter]), 'ASSISTANT_FAILED').exitCode, 7);
  failure(run(cwd, ['--adapter', path.join(cwd, 'absent')]), 'ASSISTANT_UNAVAILABLE');
});

test('sample tool composes filters, JSON, teach and offline Zsh completion', t => {
  const cwd = fixture(t);
  const sample = path.join(skill, 'assets/personal-size.mjs');
  const exec = args => spawnSync(process.execPath, [sample, ...args], { cwd, encoding: 'utf8' });
  fs.writeFileSync(path.join(cwd, 'large file'), '1234567890');
  const normal = exec(['--min-bytes', '10', '--json']);
  assert.equal(normal.status, 0, normal.stderr);
  const resultSchema = JSON.parse(fs.readFileSync(path.join(skill, 'assets/personal-size-result.schema.json'), 'utf8'));
  const validateResult = new Ajv({ strict: true }).compile(resultSchema);
  const normalValue = JSON.parse(normal.stdout);
  assert.ok(validateResult(normalValue), JSON.stringify(validateResult.errors));
  assert.deepEqual(normalValue.files.map(f => f.name), ['large file', 'tool.mjs']);
  for (const args of [['--min-bytes=-1'], ['--min-bytes', '1.5'], ['--min-bytes', '9007199254740992'], ['--json', '--teach']]) {
    const rejected = exec(args);
    assert.equal(rejected.status, 2);
    assert.equal(rejected.stdout, '');
    assert.ok(validateResult(JSON.parse(rejected.stderr)));
  }
  const teach = packet(exec(['--teach', 'Show files over 10 bytes', '--teach-preview']));
  assert.equal(teach.command, 'personal-size');
  assert.equal(teach.sources.length, 2);
  assert.match(teach.sources[0].content, /min-bytes/);
  const generated = exec(['--completions', 'zsh']);
  assert.equal(generated.status, 0, generated.stderr);
  const completion = path.join(cwd, '_personal-size');
  fs.writeFileSync(completion, generated.stdout);
  const loaded = spawnSync('zsh', ['-f', '-c', 'compdef() { :; }; _arguments() { print -rl -- "$@"; }; source "$1"; source "$1"; _personal_size', '_', completion], { encoding: 'utf8' });
  assert.equal(loaded.status, 0, loaded.stderr);
  assert.match(loaded.stdout, /--teach\[/);
  assert.match(loaded.stdout, /--min-bytes/);
  for (const flag of exec(['--help']).stdout.matchAll(/^  (--\S+)/gm)) {
    assert.ok(loaded.stdout.includes(flag[1]), `${flag[1]} must be completed from the option definitions`);
  }
});

test('sample shell wrapper supplies parent history only for teach and preserves failure status', t => {
  const cwd = fixture(t);
  const bin = path.join(cwd, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'personal-size'), '#!/bin/sh\nexec "' + process.execPath + '" "' + path.join(skill, 'assets/personal-size.mjs') + '" "$@"\n', { mode: 0o755 });
  const wrapper = path.join(skill, 'assets/personal-size.zsh');
  const result = spawnSync('zsh', ['-f', '-c', 'source "$1"; source "$1"; print -s -- "rg SECRET file"; personal-size --teach --teach-preview', '_', wrapper], { cwd, env: { ...process.env, PATH: bin + ':' + process.env.PATH }, encoding: 'utf8' });
  assert.deepEqual(packet(result).history.commands, ['rg']);
  const failed = spawnSync('zsh', ['-f', '-c', 'source "$1"; personal-size --bad', '_', wrapper], { cwd, env: { ...process.env, PATH: bin + ':' + process.env.PATH }, encoding: 'utf8' });
  assert.equal(failed.status, 2);
  const noHistory = spawnSync('zsh', ['-f', '-c', 'source "$1"; personal-size --teach --teach-preview', '_', wrapper], { cwd, env: { ...process.env, PATH: bin + ':' + process.env.PATH }, encoding: 'utf8' });
  assert.equal(packet(noHistory).history.type, 'UNAVAILABLE');
});
