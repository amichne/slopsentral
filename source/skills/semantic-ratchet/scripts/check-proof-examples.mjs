#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
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

function checkShell(directory) {
  const commands = [
    ['mktemp', 'PREPARE', commandPath('mktemp')],
    ['cp', 'COPY', commandPath('cp')],
    ['chmod', 'FREEZE', commandPath('chmod')],
    ['shasum', 'HASH', commandPath('shasum')],
    ['node', 'PUBLISH', process.execPath],
    ['rm', 'CLEANUP', commandPath('rm')],
  ];
  let checked = 0;
  const cases = [
    { name: 'workspace failure', faultStage: 'PREPARE', faultStatus: 74,
      outcome: { type: 'STAGE_FAILED', stage: 'PREPARE', exit_status: 74 }, status: 1, events: [] },
    { name: 'untrusted workspace path', mode: 'MALFORMED_WORKSPACE',
      outcome: { type: 'PROTOCOL_FAILED', stage: 'PREPARE' }, status: 1, events: [] },
    { name: 'preparation interrupted before ownership', mode: 'INTERRUPT_PREPARE',
      outcome: { type: 'PREPARATION_INTERRUPTED', signal: 'TERM' }, status: 1, events: [], retainedWorkspace: true },
    { name: 'matching snapshot', outcome: { type: 'PUBLISHED', sha256: digest }, status: 0,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'], published: true },
    { name: 'mutable source', mode: 'MUTATE_SOURCE', outcome: { type: 'PUBLISHED', sha256: digest }, status: 0,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'], published: true },
    { name: 'closed stdout after publication', closedStdout: true, status: 74,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'], published: true },
    { name: 'closed stdout after failed cleanup', closedStdout: true, faultStage: 'CLEANUP', faultStatus: 79,
      status: 74,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'], published: true, retainedWorkspace: true },
    { name: 'both result channels closed', closedStdout: true, closedStderr: true,
      status: 74, events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'], published: true },
    { name: 'mismatch', expected: wrongDigest,
      outcome: { type: 'CHECKSUM_MISMATCH', expected: wrongDigest, observed: digest }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'CLEANUP'] },
    { name: 'copy failure', faultStage: 'COPY', faultStatus: 74,
      outcome: { type: 'STAGE_FAILED', stage: 'COPY', exit_status: 74 }, status: 1, events: ['COPY', 'CLEANUP'] },
    { name: 'freeze failure', faultStage: 'FREEZE', faultStatus: 74,
      outcome: { type: 'STAGE_FAILED', stage: 'FREEZE', exit_status: 74 }, status: 1,
      events: ['COPY', 'FREEZE', 'CLEANUP'] },
    { name: 'hash failure', faultStage: 'HASH', faultStatus: 74,
      outcome: { type: 'STAGE_FAILED', stage: 'HASH', exit_status: 74 }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'CLEANUP'] },
    { name: 'missing hasher', faultStage: 'HASH', faultStatus: 127,
      outcome: { type: 'TOOL_UNAVAILABLE', stage: 'HASH' }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'CLEANUP'] },
    { name: 'malformed hash reply', mode: 'MALFORMED_HASH',
      outcome: { type: 'PROTOCOL_FAILED', stage: 'HASH' }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'CLEANUP'] },
    { name: 'destination conflict', destinationExists: 'FILE',
      outcome: { type: 'STAGE_FAILED', stage: 'PUBLISH', exit_status: 73 }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'] },
    { name: 'destination is directory', destinationExists: 'DIRECTORY',
      outcome: { type: 'STAGE_FAILED', stage: 'PUBLISH', exit_status: 73 }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'] },
    { name: 'unconfirmed publication', faultStage: 'PUBLISH', faultStatus: 70,
      outcome: { type: 'PUBLICATION_UNCONFIRMED', exit_status: 70 }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'] },
    { name: 'cleanup after publication', faultStage: 'CLEANUP', faultStatus: 79,
      outcome: { type: 'CLEANUP_FAILED', outcome: { type: 'PUBLISHED', sha256: digest }, exit_status: 79 }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'], published: true, retainedWorkspace: true },
    { name: 'cleanup after rejection', expected: wrongDigest, faultStage: 'CLEANUP', faultStatus: 79,
      outcome: { type: 'CLEANUP_FAILED', outcome: { type: 'CHECKSUM_MISMATCH',
        expected: wrongDigest, observed: digest }, exit_status: 79 }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'CLEANUP'], retainedWorkspace: true },
    { name: 'empty content', content: '', outcome: { type: 'INPUT_REJECTED', reason: 'EMPTY_CONTENT' },
      status: 1, events: ['COPY', 'CLEANUP'] },
    { name: 'malformed digest', expected: 'abc', outcome: { type: 'INPUT_REJECTED', reason: 'DIGEST_SHAPE' },
      status: 1, events: [] },
    { name: 'missing arguments', noArgs: true, outcome: { type: 'INPUT_REJECTED', reason: 'ARGUMENT_COUNT' },
      status: 1, events: [] },
    { name: 'copy interrupted', mode: 'INTERRUPT_COPY',
      outcome: { type: 'INTERRUPTED', stage: 'COPY', signal: 'TERM' }, status: 1, events: ['COPY', 'CLEANUP'] },
    { name: 'publication interrupted', mode: 'INTERRUPT_PUBLISH',
      outcome: { type: 'PUBLICATION_INTERRUPTED', signal: 'TERM' }, status: 1,
      events: ['COPY', 'FREEZE', 'HASH', 'PUBLISH', 'CLEANUP'] },
  ];
  for (const fixture of cases) {
    const base = path.join(directory, `shell-${checked}`);
    const tools = path.join(base, 'tools');
    const staging = path.join(base, 'staging');
    mkdirSync(tools, { recursive: true });
    mkdirSync(staging);
    const source = path.join(base, 'input with spaces.bin');
    const destination = path.join(base, 'published with spaces.bin');
    const eventsFile = path.join(base, 'events');
    const untrustedWorkspace = path.join(base, 'untrusted-workspace');
    mkdirSync(untrustedWorkspace);
    writeFileSync(path.join(untrustedWorkspace, 'keep'), 'unverified path must not be removed');
    writeFileSync(source, fixture.content ?? 'hello\n');
    if (fixture.destinationExists === 'FILE') writeFileSync(destination, 'existing destination\n');
    if (fixture.destinationExists === 'DIRECTORY') mkdirSync(destination);
    for (const [command, stage, executable] of commands) {
      const wrapper = `#!/bin/sh\nset -u\n` +
        (stage === 'PREPARE' ? '' : `printf '%s\\n' '${stage}' >> "$PROOF_EVENTS"\n`) +
        `if [ "$PROOF_FAULT_STAGE" = '${stage}' ]; then exit "$PROOF_FAULT_STATUS"; fi\n` +
        (stage === 'PREPARE' ?
          `if [ "$PROOF_MODE" = INTERRUPT_PREPARE ]; then\n` +
          `  workspace=$(${shellQuote(executable)} "$@") || exit $?\n` +
          `  printf '%s\\n' "$workspace"\n  kill -TERM "$PROOF_MAIN_PID"\n  exit 0\nfi\n` :
          `if [ "$PROOF_MODE" = 'INTERRUPT_${stage}' ]; then kill -TERM "$PPID"; exit 143; fi\n`) +
        (stage === 'PREPARE' ?
          `if [ "$PROOF_MODE" = MALFORMED_WORKSPACE ]; then printf '%s\\n' "$PROOF_UNTRUSTED_WORKSPACE"; exit 0; fi\n` : '') +
        (stage === 'HASH' ?
          `if [ "$PROOF_MODE" = MALFORMED_HASH ]; then printf '%s\\n' garbage; exit 0; fi\n` +
          `if [ "$PROOF_MODE" = MUTATE_SOURCE ]; then printf '%s\\n' changed > "$PROOF_SOURCE"; fi\n` : '') +
        `exec ${shellQuote(executable)} "$@"\n`;
      writeFileSync(path.join(tools, command), wrapper, { mode: 0o700 });
    }
    const args = fixture.noArgs ? [] : [source, fixture.expected ?? digest, destination];
    const launch = 'PROOF_MAIN_PID=$$; export PROOF_MAIN_PID; ' +
      (fixture.closedStdout ? 'exec 1>&-; ' : '') +
      (fixture.closedStderr ? 'exec 2>&-; ' : '') +
      'exec sh "$@"';
    const result = run('sh', ['-c', launch, 'sh', path.join(assets, 'publish-verified.sh'), ...args], {
      env: { ...process.env, PATH: `${tools}${path.delimiter}${process.env.PATH}`, TMPDIR: staging,
        PROOF_EVENTS: eventsFile, PROOF_SOURCE: source, PROOF_MODE: fixture.mode ?? 'NORMAL',
        PROOF_UNTRUSTED_WORKSPACE: untrustedWorkspace,
        PROOF_FAULT_STAGE: fixture.faultStage ?? 'NONE', PROOF_FAULT_STATUS: String(fixture.faultStatus ?? 74) },
    });
    assert.equal(result.status, fixture.status, `${fixture.name}: ${result.stderr}`);
    if (fixture.closedStdout) {
      assert.equal(result.stdout, '', `${fixture.name}: stdout cannot deliver an outcome`);
      if (fixture.closedStderr) assert.equal(result.stderr, '', `${fixture.name}: neither channel can deliver an outcome`);
      // No message parsing: the explicit transport status carries the failure.
    } else {
      const delivered = result.stdout;
      assert.equal(delivered.trim().split('\n').length, 1, `${fixture.name}: one structured outcome`);
      const outcome = JSON.parse(delivered);
      assert.equal(validate(outcome), true, `${fixture.name}: ${JSON.stringify(validate.errors)}`);
      assert.deepEqual(outcome, fixture.outcome, fixture.name);
    }
    const events = existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').trim().split('\n') : [];
    assert.deepEqual(events, fixture.events, `${fixture.name}: forbidden later stage ran`);
    if (fixture.published) {
      assert.equal(readFileSync(destination, 'utf8'), 'hello\n', `${fixture.name}: verified snapshot must be published`);
    } else if (fixture.destinationExists === 'FILE') {
      assert.equal(readFileSync(destination, 'utf8'), 'existing destination\n', 'existing destination changed');
    } else if (fixture.destinationExists === 'DIRECTORY') {
      assert.deepEqual(readdirSync(destination), [], 'publication must not redirect into a directory');
    } else {
      assert.equal(existsSync(destination), false, `${fixture.name}: publication occurred`);
    }
    if (fixture.mode === 'MUTATE_SOURCE') assert.equal(readFileSync(source, 'utf8'), 'changed\n');
    assert.equal(readFileSync(path.join(untrustedWorkspace, 'keep'), 'utf8'), 'unverified path must not be removed');
    assert.equal(readdirSync(staging).length, fixture.retainedWorkspace ? 1 : 0, `${fixture.name}: cleanup evidence`);
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
  const compiled = run(compiler, [path.join(assets, 'kotlin/ArtifactProof.kt'), '-d', library]);
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
    const shellCases = checkShell(directory);
    const kotlin = contractsOnly ? { type: 'NOT_RUN', reason: 'CONTRACTS_ONLY' } : checkKotlin(directory);
    return { type: 'PROOF_EXAMPLES_CHECKED', mode: contractsOnly ? 'CONTRACTS_ONLY' : 'ALL',
      schema_cases: schemaCases, shell_cases: shellCases, kotlin };
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
