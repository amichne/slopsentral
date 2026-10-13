import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { currentSourceLocalPaths, currentSourceEvidenceFindings } from '../routing-source-evidence.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const rootEvidence = ['README.md', 'package.json', 'LICENSE', '.gitignore', 'proof-data', '..name'];
const invalidEvidence = ['./README.md', '../README.md', '/README.md', 'C:\\README.md',
  'docs\\README.md', 'docs//README.md', 'docs/../README.md',
  'README.md ', ' README.md', '\tREADME.md', 'README.md\n', ' ./README.md',
  ' docs/README.md', 'docs/README.md ', '\u00a0README.md\u00a0'];

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
      for (const ref of currentSourceLocalPaths(entry.source)) {
        if (!fs.existsSync(path.join(repo, ref))) missing.push(`${entry.id}: ${ref}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

for (const script of ['validate-source-graph.mjs', 'run-routing-evals.mjs']) {
  test(`${script} accepts root files and rejects each missing current root file`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-root-source-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const entry of ['source', 'tools', 'docs', '.github']) {
      fs.cpSync(path.join(repo, entry), path.join(root, entry), { recursive: true,
        filter: item => !item.split(path.sep).includes('__pycache__') });
    }
    const file = path.join(root, 'source/evals/routing/pkl-engineering-workflows.json');
    const corpus = read(file);
    corpus.cases[0].source.evidenceRefs = rootEvidence;
    fs.writeFileSync(file, JSON.stringify(corpus));
    for (const ref of rootEvidence) fs.writeFileSync(path.join(root, ref), 'current evidence\n');
    const run = () => spawnSync(process.execPath,
      [path.join(repo, 'tools', script), '--repo', root], { encoding: 'utf8' });
    const baseline = run();
    assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
    for (const ref of rootEvidence) {
      fs.unlinkSync(path.join(root, ref));
      const rejected = run();
      assert.equal(rejected.status, 1, `${ref}: ${rejected.stdout}${rejected.stderr}`);
      assert.ok((rejected.stdout + rejected.stderr).includes(`CURRENT_SOURCE evidence file is unavailable: ${ref}`));
      fs.writeFileSync(path.join(root, ref), 'current evidence\n');
    }
    for (const ref of invalidEvidence) {
      corpus.cases[0].source.evidenceRefs = [ref];
      fs.writeFileSync(file, JSON.stringify(corpus));
      const rejected = run();
      assert.equal(rejected.status, 1, `${ref}: ${rejected.stdout}${rejected.stderr}`);
      assert.ok((rejected.stdout + rejected.stderr).includes(`CURRENT_SOURCE evidence path is invalid: ${ref}`));
    }
  });

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

test('root evidence uses the same canonical path rules as nested evidence', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-canonical-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.mkdirSync(path.join(root, '..directory'));
  fs.writeFileSync(path.join(root, '..directory/evidence'), 'evidence\n');
  fs.writeFileSync(path.join(root, 'README.md'), 'evidence\n');
  for (const ref of invalidEvidence) {
    assert.deepEqual(currentSourceEvidenceFindings({ type: 'CURRENT_SOURCE', evidenceRefs: [ref] }, root, 'fixture'),
      [`fixture: CURRENT_SOURCE evidence path is invalid: ${ref}`]);
  }
  assert.deepEqual(currentSourceEvidenceFindings({ type: 'CURRENT_SOURCE',
    evidenceRefs: ['..directory/evidence'] }, root, 'fixture'), []);
});

test('URI, descriptive, and historical references keep their nonlocal meaning', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-nonlocal-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nonlocal = ['https://example.invalid/evidence', 'http://example.invalid/evidence',
    'file:///outside/README.md', 'urn:evidence:README.md',
    'User requested a focused plugin for amichne/shell-config.',
    ' https://example.invalid/evidence ', ' Source evidence supports the routing fixture. '];
  const source = { type: 'CURRENT_SOURCE', evidenceRefs: nonlocal };
  assert.deepEqual(currentSourceLocalPaths(source), []);
  assert.deepEqual(currentSourceEvidenceFindings(source, root, 'fixture'), []);
  for (const type of ['CODEX_SESSION', 'MEMORY_INDEX', 'USER_CLARIFICATION', 'LOCAL_VALIDATION']) {
    const historical = { type, evidenceRefs: [...rootEvidence, ...invalidEvidence, 'docs/missing-evidence.md'] };
    assert.deepEqual(currentSourceLocalPaths(historical), []);
    assert.deepEqual(currentSourceEvidenceFindings(historical, root, 'fixture'), []);
  }
});
