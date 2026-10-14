import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const sourceSkill = path.resolve(process.env.SLOPSENTRAL_OPENAPI_SKILL_ROOT
  ?? path.join(root, 'source/skills/openapi-contract-authoring'));
const readiness = spawnSync('uv', ['run', '--locked', 'python', '-c',
  'import pytest, yaml, sys; print(sys.executable)'], {
  cwd: root, encoding: 'utf8', timeout: 30_000,
});
assert.equal(readiness.status, 0, `Python dependency readiness: ${readiness.stderr}`);
const python = readiness.stdout.trim();

function installedSkill(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-openapi-installed-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const skill = path.join(directory, 'skills/openapi-contract-authoring');
  fs.cpSync(sourceSkill, skill, { recursive: true, filter: source =>
    !source.split(path.sep).includes('__pycache__') && !source.endsWith('.pyc') });
  assert.equal(fs.existsSync(path.join(directory, 'source')), false);
  assert.equal(fs.existsSync(path.join(directory, 'pyproject.toml')), false);
  const text = fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
  const commands = [...text.matchAll(/^```sh\n([\s\S]*?)^```/gmu)]
    .flatMap(match => match[1].trim().split('\n'))
    .filter(line => line.startsWith('uv run '));
  assert.equal(commands.length, 2, 'Both documented OpenAPI commands must run.');
  return { skill, commands };
}

function runDocumented(skill, command) {
  const [binary, ...arguments_] = command.trim().split(/\s+/u);
  assert.equal(binary, 'uv');
  const environment = { ...process.env };
  for (const key of ['PYTHONPATH', 'PYTHONHOME', 'UV_PROJECT', 'UV_WORKING_DIRECTORY']) {
    delete environment[key];
  }
  environment.UV_PYTHON = python;
  environment.VIRTUAL_ENV = path.dirname(path.dirname(python));
  environment.UV_OFFLINE = '1';
  return spawnSync(binary, arguments_, {
    cwd: skill, env: environment, encoding: 'utf8', timeout: 30_000,
  });
}

test('both documented OpenAPI commands run from the installed skill without source checkout paths', async t => {
  const { skill, commands } = installedSkill(t);
  for (const [index, command] of commands.entries()) {
    await t.test(command, () => {
      const result = runDocumented(skill, command);
      assert.equal(result.status, 0, `${command}\n${result.stdout}\n${result.stderr}`);
      if (index === 0) {
        assert.equal((result.stdout.match(/^OK references\/[^\n]+\.openapi\.yaml$/gmu) ?? []).length, 3);
      } else {
        assert.match(result.stdout, /\b2 passed\b/u);
      }
    });
  }
});

test('the installed OpenAPI helper rejects a nullable fixture through its documented command', t => {
  const { skill, commands } = installedSkill(t);
  fs.writeFileSync(path.join(skill, 'references/constrained-primitives.openapi.yaml'),
    'type: object\nproperties:\n  name:\n    type: [string, "null"]\n');
  const result = runDocumented(skill, commands[0]);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /type unions cannot include null/u);
  assert.equal(result.stdout, '');
});
