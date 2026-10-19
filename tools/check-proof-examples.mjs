#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../source/skills/semantic-ratchet/assets');
const digest = '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03';
const wrongDigest = '0'.repeat(64);
const schema = JSON.parse(readFileSync(path.join(assets, 'artifact-result.schema.json'), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 90_000, ...options });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${command} terminated: ${result.signal}`);
  return result;
}

function commandPath(command) {
  const result = run('sh', ['-c', 'command -v "$1"', 'sh', command]);
  assert.equal(result.status, 0, `Required command unavailable: ${command}`);
  const resolved = result.stdout.trim();
  assert.ok(path.isAbsolute(resolved), `Expected an executable path for ${command}: ${resolved}`);
  return resolved;
}

function checkSchema() {
  let checked = 0;
  for (const example of schema.examples) {
    assert.equal(validate(example), true, JSON.stringify(validate.errors));
    checked++;
  }
  // Expectations come from the named invariant, not generated schema fields.
  const invalid = [
    ['missing discriminator', { sha256: digest }, 'required'],
    ['unknown case', { type: 'RETRY_LATER' }, 'const'],
    ['lowercase case', { type: 'published', sha256: digest }, 'const'],
    ['missing case evidence', { type: 'PUBLISHED' }, 'required'],
    ['nullable evidence', { type: 'PUBLISHED', sha256: null }, 'type'],
    ['invalid digest length', { type: 'PUBLISHED', sha256: 'abc' }, 'minLength'],
    ['invalid digest alphabet', { type: 'PUBLISHED', sha256: 'g'.repeat(64) }, 'pattern'],
    ['mixed cases', { type: 'PUBLISHED', sha256: digest, reason: 'EMPTY_CONTENT' }, 'additionalProperties'],
    ['unknown property', { type: 'PUBLISHED', sha256: digest, debug: true }, 'additionalProperties'],
    ['unknown failure reason', { type: 'INPUT_REJECTED', reason: 'SOMETHING' }, 'enum'],
    ['unknown stage', { type: 'STAGE_FAILED', stage: 'UNKNOWN', exit_status: 73 }, 'enum'],
    ['success as failure', { type: 'STAGE_FAILED', stage: 'COPY', exit_status: 0 }, 'minimum'],
    ['unbounded status', { type: 'STAGE_FAILED', stage: 'COPY', exit_status: 256 }, 'maximum'],
    ['missing mismatch evidence', { type: 'CHECKSUM_MISMATCH', expected: digest }, 'required'],
    ['lost cleanup outcome', { type: 'CLEANUP_FAILED', exit_status: 79 }, 'required'],
    ['nested cleanup fiction', { type: 'CLEANUP_FAILED', exit_status: 79,
      outcome: { type: 'CLEANUP_FAILED', outcome: { type: 'PUBLISHED', sha256: digest }, exit_status: 79 } }, 'const'],
  ];
  for (const [name, value, keyword] of invalid) {
    assert.equal(validate(value), false, `${name} must be rejected`);
    assert.ok(validate.errors.some(error => error.keyword === keyword),
      `${name}: expected ${keyword}; got ${JSON.stringify(validate.errors)}`);
    checked++;
  }
  return checked;
}

function checkKotlin(directory) {
  const compiler = commandPath('kotlinc');
  const java = commandPath('java');
  const version = run(compiler, ['-version']);
  assert.equal(version.status, 0, version.stderr);
  const identity = (version.stdout + version.stderr).match(/kotlinc-jvm [^\n]+/u);
  assert.ok(identity, 'Compiler identity must be available');
  const library = path.join(directory, 'domain.jar');
  const compiled = run(compiler, [path.join(assets, 'kotlin/ArtifactProof.kt'),
    path.join(assets, 'kotlin/ArtifactOutputAdapters.kt'), '-d', library]);
  assert.equal(compiled.status, 0, compiled.stderr);
  const legalJar = path.join(directory, 'legal.jar');
  const legal = run(compiler, [path.join(assets, 'kotlin/Legal.kt'), '-classpath', library, '-include-runtime', '-d', legalJar]);
  assert.equal(legal.status, 0, legal.stderr);
  const executed = run(java, ['-classpath', `${legalJar}${path.delimiter}${library}`, 'proof.consumer.LegalKt']);
  assert.equal(executed.status, 0, executed.stderr);
  assert.equal(executed.stdout.trim(), 'KOTLIN_PROOFS_OK', 'Legal-path assertions must execute');
  const forbidden = [
    ['ForgeVerified.kt', [/cannot access/u, /private/u, /VerifiedArtifact/u]],
    ['ForgeMismatch.kt', [/interface/u, /does not have constructors/u, /ChecksumMismatch/u]],
    ['PublishUnverified.kt', [/type mismatch/u, /UnverifiedArtifact/u, /VerifiedArtifact/u]],
    ['ForgetFailure.kt', [/when/u, /must be exhaustive/u, /\bis Mismatch\b/u]],
  ];
  for (const [fixture, diagnostics] of forbidden) {
    const result = run(compiler, [path.join(assets, 'kotlin', fixture), '-classpath', library,
      '-d', path.join(directory, `${fixture}.jar`)]);
    assert.equal(result.status, 1, `${fixture}: expected a compilation rejection, got ${result.stderr}`);
    assert.ok(result.stderr.includes(fixture), `${fixture}: diagnostic must name the fixture`);
    for (const diagnostic of diagnostics) assert.match(result.stderr, diagnostic, fixture);
  }
  return { type: 'CHECKED', legal_programs: 1, compile_rejections: forbidden.length, compiler: identity[0] };
}

export function checkProofExamples({ contractsOnly = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'semantic-ratchet-proof-'));
  try {
    const schemaCases = checkSchema();
    const kotlin = contractsOnly ? { type: 'NOT_RUN', reason: 'CONTRACTS_ONLY' } : checkKotlin(directory);
    return { type: 'PROOF_EXAMPLES_CHECKED', mode: contractsOnly ? 'CONTRACTS_ONLY' : 'ALL',
      schema_cases: schemaCases, kotlin };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--contracts-only'),
    'Usage: node check-proof-examples.mjs [--contracts-only]');
  console.log(JSON.stringify(checkProofExamples({ contractsOnly: args.length === 1 })));
}
