import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function selectHeap(explicit, vendor) {
  if (explicit !== undefined) return explicit;
  if (vendor.length !== 1) throw new Error('ambiguous heap');
  return vendor[0];
}

const checks = {
  heap() {
    assert.equal(selectHeap('-Xmx2048m', ['-Xmx1024m']), '-Xmx2048m');
    assert.throws(() => selectHeap(undefined, ['-Xmx1024m', '-Xmx2048m']), /ambiguous heap/);
    console.log('PASS heap: explicit precedence; ambiguous options rejected');
  },
  'heap-process'() {
    execFileSync(process.execPath, ['-e', 'process.exit(0)']);
    checks.heap();
  },
  graph() {
    console.log('Head 0123456789abcdef0123456789abcdef01234567, attempt 2');
    console.log('source-obligations -> source-feedback; source-obligations -> required-checks');
    console.log('source-obligations: failure; source-feedback: failure; required-checks: failure');
  },
  log() {
    console.log('source-obligations: prepare fixture: uv.lock requires update with --locked');
    console.log('The unit runner never starts. The two gates report the absent producer result.');
  },
  probes() {
    console.log('Component harness: request with a live session, reject after stop.');
    console.log('Installed acceptance: request with a live session, reject after stop.');
  },
  acceptance() {
    const output = execFileSync(process.execPath, ['./installed.mjs'], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), ['accepted', 'stopped', 'rejected']);
    console.log('PASS installed acceptance: accepts a live request; rejects a request after stop');
  },
  'component-harness'() {
    checks.acceptance();
  },
  timing() {
    console.log('Baseline run 63 attempt 1, macOS arm64, runner A, cold cache.');
    console.log('Queue 4 min; Gradle setup 2 min; native compile 20 min; installed acceptance 4 min.');
    console.log('Candidate run 64 attempt 1, runner B, warm cache, total 12 min.');
  },
  compiler() {
    console.log('Baseline run 63 attempt 1, native compile report: 1200 s elapsed, 380 s GC.');
    console.log('Candidate has no matching task and cache report.');
  },
};

const name = process.argv[2];
if (!Object.hasOwn(checks, name)) throw new Error('unknown fixture command');
checks[name]();
