import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const read = name => readFileSync(join(request.artifacts, name), 'utf8');
const events = read('events.jsonl').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const response = read('final-response.txt');
const amp = request.host === 'amp';
const commands = new Map();
const invoked = new Set();
const toolResults = new Set();

for (const event of events) {
  if (!amp && event.type === 'item.completed' && event.item.type === 'command_execution') {
    const item = event.item;
    const raw = item.command.replace(/^.*? -lc /u, '').replace(/^['"]|['"]$/gu, '');
    invoked.add(raw);
    if (item.exit_code === 0) commands.set(raw, item.aggregated_output);
  }
  if (!amp || !['assistant', 'user'].includes(event.type)) continue;
  for (const block of event.message.content) {
    if (block.type === 'tool_use') {
      if (block.name.endsWith('fixture_command')) invoked.add(block.input.command);
      commands.set(block.id, block);
    }
    if (block.type === 'tool_result' && !block.is_error) toolResults.add(block);
  }
}
if (amp) {
  for (const result of toolResults) {
    const use = commands.get(result.tool_use_id);
    if (use?.name.endsWith('fixture_command')) commands.set(use.input.command, JSON.stringify(result.content));
  }
}
const output = action => String(commands.get('node ./checks.mjs ' + action) ?? '');
const idle = action => !invoked.has('node ./checks.mjs ' + action);
const skill = request.case.scenario.expectedPrimitive.name;
const provisions = JSON.parse(read('provisioning.json'));
const readSkill = amp ? [...commands].some(([id, tool]) =>
  tool.name === 'skill' && tool.input.name.endsWith(':' + skill)
  && [...toolResults].some(result => result.tool_use_id === id)) :
  [...commands.keys()].some(cmd => cmd.includes('/' + skill + '/SKILL.md'));
const finalStatus = JSON.parse(read('final-status.json')).stdout;
const finalDiff = JSON.parse(read('final-diff.json')).stdout;
const head = JSON.parse(read('final-head.json')).stdout.trim();
const findings = {
  'smallest-heap-proof': [
    /PASS heap: explicit precedence; ambiguous options rejected/u.test(output('heap')),
    idle('heap-process') && /ambigu/iu.test(response) && /explicit/iu.test(response),
  ],
  'ci-failed-producer-fanout': [
    /source-obligations/u.test(output('graph')) && /uv\.lock/u.test(output('log')),
    ['source-obligations', 'source-feedback', 'required-checks', '0123456', 'uv.lock', '--locked']
      .every(value => response.includes(value)) && /attempt[^\d]{0,12}2/iu.test(response),
  ],
  'installed-harness-proof-replacement': [
    /Installed acceptance/u.test(output('probes')) &&
      /PASS installed acceptance: accepts a live request; rejects a request after stop/u.test(output('acceptance')),
    idle('component-harness') && /reject/iu.test(response) && /stop/iu.test(response),
  ],
  'gradle-native-report-fallback': [
    /native compile 20 min/u.test(output('timing')) && /380 s GC/u.test(output('compiler')),
    /native/iu.test(response) && /20 min|1200|1,200/u.test(response) &&
      /cache/iu.test(response) && /runner/iu.test(response) &&
      /inconclusive|cannot|can.t|no comparable|no measured|insufficient|unsupported|unmatched/iu.test(response),
  ],
};
const assess = (pass, evidence) => ({ status: pass ? 'pass' : 'fail', evidence });
const checks = findings[request.case.scenario.id];
console.log(JSON.stringify({
  caseId: request.case.id,
  traceSha256: request.traceSha256,
  checks: request.case.scenario.successChecklist.map((requirement, index) => ({
    requirement, ...assess(checks[index], ['events.jsonl', 'final-response.txt']),
  })),
  route: assess(provisions.length > 0 && readSkill, ['events.jsonl', 'provisioning.json']),
  scope: assess(finalStatus === '' && finalDiff === '' && head === request.fixture.revision,
    ['final-status.json', 'final-diff.json', 'final-head.json']),
}));
