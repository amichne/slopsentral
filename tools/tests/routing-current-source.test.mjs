import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const localPath = /^(?:source|tools|docs|\.github|\.agents)\//;

test('current Astra scenarios route to surviving skills', () => {
  const document = fs.readFileSync(path.join(repo, 'source/evals/astra-workstreams.md'), 'utf8');
  const rows = document.split('\n').filter(line => line.startsWith('| ')).slice(2);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    const name = row.split('|')[2].trim();
    assert.ok(fs.existsSync(path.join(repo, 'source/skills', name, 'SKILL.md')), name);
  }
});

test('every CURRENT_SOURCE repository path names an existing file', () => {
  const missing = [];
  for (const file of fs.readdirSync(path.join(repo, 'source/evals/routing'))) {
    if (!file.endsWith('.json')) continue;
    for (const entry of read(path.join(repo, 'source/evals/routing', file)).cases ?? []) {
      if (entry.source.type !== 'CURRENT_SOURCE') continue;
      for (const ref of entry.source.evidenceRefs) {
        if (localPath.test(ref) && !fs.existsSync(path.join(repo, ref))) missing.push(`${entry.id}: ${ref}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

for (const script of ['validate-source-graph.mjs', 'run-routing-evals.mjs']) {
  test(`${script} rejects missing current evidence and preserves historical evidence`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-current-source-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const entry of ['source', 'tools', 'docs', '.github']) {
      fs.cpSync(path.join(repo, entry), path.join(root, entry), { recursive: true,
        filter: item => !item.split(path.sep).includes('__pycache__') });
    }
    const file = path.join(root, 'source/evals/routing/pkl-engineering-workflows.json');
    const corpus = read(file);
    const run = () => spawnSync(process.execPath,
      [path.join(repo, 'tools', script), '--repo', root], { encoding: 'utf8' });
    const save = () => fs.writeFileSync(file, JSON.stringify(corpus));
    const baseline = run();
    assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
    const missing = 'source/skills/missing-evidence/SKILL.md';
    corpus.cases[0].source.evidenceRefs = [missing];
    save();
    const rejected = run();
    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
    assert.match(rejected.stdout + rejected.stderr, /CURRENT_SOURCE.*missing-evidence/);
    corpus.cases[0].source.type = 'LOCAL_VALIDATION';
    save();
    const historical = run();
    assert.equal(historical.status, 0, historical.stdout + historical.stderr);
  });
}
