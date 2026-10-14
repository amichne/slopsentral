import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv from 'ajv';

const repo = path.resolve(import.meta.dirname, '../..');
const skill = path.join(repo, 'source/skills/code-knowledge-base');
const schema = JSON.parse(fs.readFileSync(path.join(skill, 'references/knowledge-overlay.schema.json')));
const validate = new Ajv({ strict: true }).compile(schema);
const base = { type: 'KNOWLEDGE_MANIFEST', schemaVersion: 1, repositories: [
  { type: 'INVISIBLE', repository: '/workspace/source', knowledgeRepository: '/workspace/source-knowledge', documents: 'docs', instructions: 'AGENTS.md' },
] };

function parse(payload) {
  const script = 'import json,sys; sys.path.insert(0,sys.argv[1]); from knowledge_overlay import Manifest,parse_manifest; print(isinstance(parse_manifest(json.load(sys.stdin)),Manifest))';
  const result = spawnSync('python3', ['-B', '-c', script, path.join(skill, 'scripts')], {
    input: JSON.stringify(payload), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() === 'True';
}

test('manifest schema and typed parser agree on both modes and invalid boundaries', () => {
  const accepted = [base, ...schema.examples, { ...base, repositories: [] }];
  for (const payload of accepted) {
    assert.equal(validate(payload), true, JSON.stringify(validate.errors));
    assert.equal(parse(payload), true);
  }
  const mutations = [
    v => { v.extra = 'unsupported'; },
    v => { v.schemaVersion = true; },
    v => { v.repositories[0].type = 'INVISBLE'; },
    v => { delete v.repositories[0].knowledgeRepository; },
    v => { v.repositories[0].repository = '/..'; },
    v => { v.repositories[0].repository = '/workspace/../source'; },
    v => { v.repositories[0].repository = 'relative'; },
    v => { v.repositories[0].documents = '../docs'; },
    v => { v.repositories[0].documents = './docs'; },
    v => { v.repositories[0].instructions = '/AGENTS.md'; },
    v => { v.repositories[0].instructions = 'a\u0000b'; },
    v => { v.repositories[0].instructions = '\ud800'; },
    v => { v.repositories[0].instructions = 'a'.repeat(4097); },
    v => { v.repositories = Array.from({ length: 129 }, () => structuredClone(base.repositories[0])); },
  ];
  for (const mutate of mutations) {
    const payload = structuredClone(base);
    mutate(payload);
    assert.equal(validate(payload), false, JSON.stringify(payload));
    assert.equal(parse(payload), false, JSON.stringify(payload));
  }
  const duplicate = structuredClone(base);
  duplicate.repositories.push(structuredClone(duplicate.repositories[0]));
  assert.equal(parse(duplicate), false, 'the parser also enforces unique source repository identities');
});

test('configured SessionStart adapter loads sibling guidance in source and projected layouts', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-overlay-contract-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const source = fs.realpathSync(fixture);
  const knowledge = path.join(source, 'knowledge');
  const target = path.join(source, 'target');
  for (const root of [knowledge, target]) {
    fs.mkdirSync(root);
    assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
  }
  fs.mkdirSync(path.join(knowledge, 'docs'));
  fs.writeFileSync(path.join(knowledge, 'AGENTS.md'), 'Keep citations tied to source.\n');
  assert.equal(spawnSync('git', ['-C', knowledge, 'add', 'AGENTS.md']).status, 0);
  const manifest = path.join(source, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ ...base, repositories: [{ ...base.repositories[0], repository: target, knowledgeRepository: knowledge }] }));
  const root = process.env.KNOWLEDGE_MARKETPLACE_ROOT
    ? path.join(process.env.KNOWLEDGE_MARKETPLACE_ROOT, '.agents/plugins/repository-knowledge')
    : path.join(repo, 'source');
  const config = path.join(root, process.env.KNOWLEDGE_MARKETPLACE_ROOT ? 'hooks' : 'hooks/codex', 'knowledge-overlay.hooks.json');
  const adapter = JSON.parse(fs.readFileSync(config)).hooks.SessionStart[0];
  assert.equal(adapter.matcher, '^(startup|resume|clear|compact)$');
  assert.equal(adapter.hooks[0].additionalContextLimit, 8192);
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  const command = process.env.KNOWLEDGE_MARKETPLACE_ROOT ? adapter.hooks[0].command
    : adapter.hooks[0].command.replace(/\bhooks\/[\w.-]+/g, value => quote(path.join(root, value)));
  for (const lifecycle of ['startup', 'resume', 'clear', 'compact']) {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-c', command], {
      cwd: target, input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'contract', source: lifecycle, cwd: target }),
      env: { ...process.env, BASH_ENV: '', ENV: '', SLOPSENTRAL_KNOWLEDGE_MANIFEST: manifest, PLUGIN_ROOT: root }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /Keep citations tied to source/);
    assert.equal(JSON.parse(result.stderr).outcome, 'LOADED');
  }
  assert.equal(spawnSync('git', ['-C', target, 'status', '--porcelain=v1'], { encoding: 'utf8' }).stdout, '');
  assert.deepEqual(fs.readdirSync(target), ['.git']);
});
