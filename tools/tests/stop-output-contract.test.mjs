import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const projection = process.env.STOP_MARKETPLACE_ROOT;
const owners = {
  'code-knowledge-drift': 'repository-knowledge',
  'source-graph-valid': 'agent-tooling',
  'pkl-evaluate-check': 'pkl-configuration',
  'pkl-format-check': 'pkl-configuration',
  'pkl-test-check': 'pkl-configuration',
};
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;

function run(t, name, prepare = () => {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'stop-output-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  prepare(cwd);
  const root = projection ? path.join(projection, '.agents/plugins', owners[name]) : path.join(repo, 'source');
  const config = path.join(root, projection ? 'hooks' : 'hooks/codex', `${name}.hooks.json`);
  let command = JSON.parse(fs.readFileSync(config)).hooks.Stop[0].hooks[0].command;
  if (!projection) command = command.replace(/\bhooks\/[\w.-]+/g, value => quote(path.join(root, value)));
  const result = spawnSync('bash', ['-c', command], {
    cwd, env: { ...process.env, PLUGIN_ROOT: root, INTELLIGENCE_CHANGED_FILES: '' },
    input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false, session_id: 'contract', cwd }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.ok(output && typeof output === 'object' && !Array.isArray(output));
  assert.ok(Object.keys(output).every(key => ['systemMessage', 'decision', 'reason'].includes(key)), 'stdout must contain the host response, not a CLI report');
  assert.ok(result.stdout.length < 1024, 'hook feedback must stay bounded');
  return { ...result, output, cwd };
}

for (const name of Object.keys(owners)) {
  test(`${name} configured Stop command returns host JSON on skipped or unavailable checks`, t => {
    const result = run(t, name);
    assert.equal(Object.hasOwn(result.output, 'decision'), false);
    assert.equal(typeof result.output.systemMessage, 'string');
  });
}

function bundle(cwd) {
  fs.mkdirSync(path.join(cwd, 'docs'));
  fs.writeFileSync(path.join(cwd, 'App.kt'), 'class App\n');
  fs.writeFileSync(path.join(cwd, 'docs/app.md'), '---\ntype: Kotlin Type\ncode_sources:\n  - path: App.kt\n---\n');
}

test('knowledge Stop retains advisory drift counts without forwarding paths', t => {
  const result = run(t, 'code-knowledge-drift', cwd => {
    bundle(cwd);
    assert.equal(spawnSync('git', ['init', '-q', cwd]).status, 0);
  });
  assert.match(result.output.systemMessage, /outcome=ok.*impacted-concepts=1/);
  assert.equal(Object.hasOwn(result.output, 'decision'), false);
  assert.doesNotMatch(result.stdout + result.stderr, /App\.kt|app\.md|stop-output-/);
});

test('knowledge Stop keeps metadata and tooling failures observable and advisory', t => {
  const invalid = run(t, 'code-knowledge-drift', cwd => {
    bundle(cwd);
    fs.writeFileSync(path.join(cwd, 'docs/app.md'), '# Private source payload\n');
    assert.equal(spawnSync('git', ['init', '-q', cwd]).status, 0);
  });
  assert.match(invalid.output.systemMessage, /outcome=invalid.*metadata-issues=1/);
  assert.equal(Object.hasOwn(invalid.output, 'decision'), false);
  assert.doesNotMatch(invalid.stdout + invalid.stderr, /Private source payload|app\.md/);
  assert.equal(JSON.parse(invalid.stderr).outcome, 'invalid');
  const failed = run(t, 'code-knowledge-drift', bundle);
  assert.match(failed.output.systemMessage, /outcome=error.*code=git-status-failed/);
  assert.equal(Object.hasOwn(failed.output, 'decision'), false);
  assert.equal(JSON.parse(failed.stderr).code, 'git-status-failed');
});

test('source graph Stop preserves a failed required check as continuation feedback', t => {
  const result = run(t, 'source-graph-valid', cwd => {
    fs.mkdirSync(path.join(cwd, 'source'));
    fs.writeFileSync(path.join(cwd, 'source/adaptable.marketplace.json'), '{}');
  });
  assert.equal(result.output.decision, 'block');
  assert.match(result.output.reason, /outcome=check-failed/);
});
