import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
function checks(t, mutate, expected) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-contract-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'source'), path.join(fixture, 'source'), { recursive: true });
  const edit = (relative, transform) => {
    const file = path.join(fixture, relative);
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    transform(value);
    fs.writeFileSync(file, JSON.stringify(value));
  };
  mutate(edit, fixture);
  const result = spawnSync(process.execPath, [path.join(root, 'tools/validate-source-graph.mjs'), '--repo', fixture], { encoding: 'utf8' });
  assert.equal(result.status, expected ? 1 : 0, result.stdout + result.stderr);
  if (expected) assert.match(result.stdout + result.stderr, expected);
}
const rejects = checks;

test('accepts reuse of a canonical instruction across plugins', t => {
  checks(t, edit => edit('source/plugins/repository-knowledge/plugin.json', plugin => {
    plugin.instructions.push({ type: 'INSTRUCTION', name: 'engineering-design', path: 'instructions/engineering-design.md', source: { type: 'LOCAL_SOURCE', path: './' } });
  }));
});

test('rejects duplicate identities in the standalone marketplace', t => {
  rejects(t, edit => edit('source/adaptable.marketplace.json', market => {
    market.skills.push(structuredClone(market.skills[0]));
  }), /duplicate marketplace SKILL/i);
});

test('accepts cross-plugin reuse through a hook dependency', t => {
  checks(t, edit => edit('source/hooks/required-skill-read.hook.json', hook => {
    hook.dependsOn = [{ type: 'SKILL', name: 'manage-json-schemas', path: 'skills/manage-json-schemas', source: { type: 'LOCAL_SOURCE', path: './' } }];
  }));
});

test('accepts canonical agent reuse in a profile', t => {
  checks(t, edit => {
    edit('source/plugins/personal-setup/plugin.json', plugin => {
      plugin.agents.push({ type: 'AGENT', name: 'schema-type-enforcer', path: 'agents/schema-type-enforcer.agent.md', source: { type: 'LOCAL_SOURCE', path: './' } });
    });
    edit('source/profiles/agent-authoring-default.json', profile => profile.plugins.push('api-contracts'));
  });
});

test('hooks can be reused across alternative bundles', t => {
  checks(t, edit => edit('source/plugins/repository-knowledge/plugin.json', plugin => {
    plugin.hooks.push({ type: 'HOOK', name: 'source-graph-valid', path: 'hooks/source-graph-valid.hook.json', source: { type: 'LOCAL_SOURCE', path: './' } });
  }));
});

test('rejects duplicate hook activation in a profile', t => {
  rejects(t, edit => {
    edit('source/plugins/repository-knowledge/plugin.json', plugin => {
      plugin.hooks.push({ type: 'HOOK', name: 'source-graph-valid', path: 'hooks/source-graph-valid.hook.json', source: { type: 'LOCAL_SOURCE', path: './' } });
    });
    edit('source/profiles/agent-authoring-default.json', profile => profile.plugins.push('repository-knowledge'));
  }, /agent-authoring-default: selected plugins activate HOOK\/source-graph-valid multiple times/);
});

test('rejects conflicting source locations across bundles', t => {
  rejects(t, edit => edit('source/plugins/personal-setup/plugin.json', plugin => {
    plugin.skills.find(ref => ref.name === 'shell-script-safety').path = 'skills/cli-data-pipelines';
  }), /differs from its canonical marketplace reference/);
});

test('checkout-local planning rejects duplicate hook activation before any host access', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-composition-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'source'), path.join(fixture, 'source'), { recursive: true });
  fs.cpSync(path.join(root, 'tools'), path.join(fixture, 'tools'), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'));
  const file = path.join(fixture, 'source/plugins/personal-setup/plugin.json');
  const plugin = JSON.parse(fs.readFileSync(file, 'utf8'));
  const marketplace = JSON.parse(fs.readFileSync(path.join(fixture, 'source/adaptable.marketplace.json'), 'utf8'));
  plugin.hooks.push(marketplace.hooks.find(ref => ref.name === 'software-engineering-context'));
  fs.writeFileSync(file, JSON.stringify(plugin));
  const codexHome = path.join(fixture, 'unused-home');
  const result = spawnSync(process.execPath, [fs.realpathSync(path.join(fixture, 'tools/profile-lifecycle.mjs')),
    'plan', '--profile', 'agent-authoring-default', '--codex-home', codexHome],
  { encoding: 'utf8', env: { ...process.env, PATH: '' } });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'PROFILE_INVALID_REQUEST');
  assert.match(output.message, /activate HOOK\/software-engineering-context multiple times/);
  assert.equal(fs.existsSync(codexHome), false);
});

test('rejects payload copies under a composition-only plugin', t => {
  rejects(t, (_edit, fixture) => {
    const file = path.join(fixture, 'source/plugins/repository-knowledge/SKILL.md');
    fs.writeFileSync(file, '# Competing payload\n');
  }, /composition-only/i);
});

test('rejects an unknown chooser role instead of hiding a plugin', t => {
  rejects(t, edit => edit('source/plugins/repository-knowledge/plugin.json', plugin => {
    plugin.metadata.role = 'miscellaneous';
  }), /metadata.role must be default, specialty, or advanced/);
});

test('rejects competing default choices', t => {
  rejects(t, edit => edit('source/plugins/repository-knowledge/plugin.json', plugin => {
    plugin.metadata.role = 'default';
  }), /exactly one default plugin/);
});

test('rejects context delivery without the policy it requests', t => {
  rejects(t, edit => edit('source/hooks/software-engineering-context.hook.json', hook => {
    hook.dependsOn.pop();
  }), /instruction arguments must exactly match canonical instruction dependencies/);
});

test('rejects lifecycle omissions and unbounded context configuration', t => {
  rejects(t, edit => edit('source/hooks/codex/kotlin-engineering-context.hooks.json', adapter => {
    adapter.hooks.SessionStart[0].matcher = '^startup$';
    adapter.hooks.SessionStart[0].hooks[0].additionalContextLimit = 0;
  }), /instruction context must cover the complete SessionStart lifecycle/);
});

test('field observations preserve a missing route without inventing success', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-field-contract-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'source'), path.join(fixture, 'source'), { recursive: true });
  const file = path.join(fixture, 'source/evals/routing/field-observations.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  payload.observations[0].route = { type: 'NO_PRIMITIVE_ROUTE' };
  payload.observations[0].outcome = 'DRIFT';
  const check = () => {
    fs.writeFileSync(file, JSON.stringify(payload));
    return spawnSync(process.execPath, [path.join(root, 'tools/validate-source-graph.mjs'), '--repo', fixture], { encoding: 'utf8' });
  };
  const drift = check();
  assert.equal(drift.status, 0, drift.stdout + drift.stderr);
  payload.observations[0].outcome = 'PASS';
  const falsePass = check();
  assert.equal(falsePass.status, 1);
  assert.match(falsePass.stdout + falsePass.stderr, /PASS requires the expected primitive route/);
  payload.observations[0].outcome = 'DRIFT';
  payload.observations[0].route.primitive = { type: 'SKILL', name: 'tdd' };
  const invalidRoute = check();
  assert.equal(invalidRoute.status, 1);
  assert.match(invalidRoute.stdout + invalidRoute.stderr, /observation schema/);
});
