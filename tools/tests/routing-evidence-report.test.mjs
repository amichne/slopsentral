import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'source'), path.join(root, 'source'), { recursive: true });
  const file = path.join(root, 'source/evals/routing/field-observations.json');
  const payload = read(file);
  const run = () => spawnSync(process.execPath, [path.join(repo, 'tools/run-routing-evals.mjs'), '--repo', root, '--json', '--require-all-fixtures'], { encoding: 'utf8' });
  const save = () => fs.writeFileSync(file, JSON.stringify(payload));
  return { payload, run, save };
}

test('golden fixtures cannot inflate field coverage or erase drift and incomplete proof', t => {
  const { payload, run, save } = fixture(t);
  // Keep both observations of one case: useful missed route, then a successful replay.
  payload.observations = payload.observations.filter(item => item.caseId === 'shell-check-tdd-uses-stable-red-green-proof');
  payload.observations.find(item => item.outcome === 'PASS').verification = {
    type: 'INCOMPLETE_PROOF', missingEvidence: ['Fresh provider invocation remains unverified.'],
  };
  save();
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.fixtureConsistency.coveredCases, report.summary.routingCases);
  assert.equal(report.summary.fieldObservations.coveredCases, 1);
  assert.equal(report.summary.fieldObservations.total, 2);
  assert.equal(report.summary.fieldObservations.byOutcome.DRIFT, 1);
  assert.equal(report.summary.fieldObservations.byOutcome.PASS, 1);
  assert.equal(report.summary.fieldObservations.incompleteProof, 1);
  assert.equal(report.summary.fieldObservations.usefulOutcomes, 2);
  assert.ok(report.unobservedFieldCases.length > 0);
  assert.equal(Object.hasOwn(report.summary, 'observedRoutingCases'), false);
});

test('field reporting rejects malformed raw observations before counting them', t => {
  const { payload, run, save } = fixture(t);
  payload.observations[0].verification = { type: 'COMPLETE_PROOF', missingEvidence: ['This shape cannot carry complete proof.'] };
  save();
  const result = run();
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.match(report.findings.join('\n'), /observation schema/);
  assert.equal(report.summary.fieldObservations.type, 'INVALID_FIELD_OBSERVATIONS');
});

test('a PASS with no route still fails even when every golden fixture matches', t => {
  const { payload, run, save } = fixture(t);
  payload.observations[0].route = { type: 'NO_PRIMITIVE_ROUTE' };
  payload.observations[0].outcome = 'PASS';
  save();
  const result = run();
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).findings.join('\n'), /PASS requires the expected primitive route/);
});

test('duplicate field IDs fail closed instead of silently double counting evidence', t => {
  const { payload, run, save } = fixture(t);
  payload.observations.push(structuredClone(payload.observations[0]));
  save();
  const result = run();
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).findings.join('\n'), /duplicate id/);
});

test('a selected skill does not manufacture a useful outcome', t => {
  const { payload, run, save } = fixture(t);
  payload.observations = [payload.observations.find(item => item.outcome === 'PASS')];
  payload.observations[0].productiveOutcomeObserved = {
    type: 'NO_USEFUL_OUTCOME', reason: 'The skill loaded, but the requested result was not produced.',
  };
  save();
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const summary = JSON.parse(result.stdout).summary.fieldObservations;
  assert.equal(summary.byOutcome.PASS, 1);
  assert.equal(summary.usefulOutcomes, 0);
  assert.equal(summary.noUsefulOutcomes, 1);
});

test('the field boundary rejects whitespace evidence and private paths before reporting counts', t => {
  const { payload, run, save } = fixture(t);
  const original = structuredClone(payload);
  for (const evidence of ['   ', '/Users/private-owner/private-repository/session.jsonl']) {
    Object.assign(payload, structuredClone(original));
    payload.observations[0].evidenceRefs = [evidence];
    save();
    const result = run();
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.fieldObservations.type, 'INVALID_FIELD_OBSERVATIONS');
    assert.doesNotMatch(result.stdout, /private-owner/);
  }
});
