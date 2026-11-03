import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { project } from '../project-marketplaces.mjs';

const repository = path.resolve(import.meta.dirname, '../..');
const relativeRuntime = 'scripts/documentation.py';
const canonicalSkill = path.join(repository, 'source/skills/code-knowledge-base');
const surfaces = [
  {
    harness: 'codex',
    variable: 'REUSE_CODEX_PROJECTION',
    projectedSkill: root => path.join(root, '.agents/plugins/repository-knowledge/skills/code-knowledge-base'),
  },
  {
    harness: 'github-copilot',
    variable: 'REUSE_COPILOT_PROJECTION',
    projectedSkill: root => path.join(root, '.github/plugin/repository-knowledge/skills/code-knowledge-base'),
  },
  {
    harness: 'amp',
    variable: 'SLOPSENTRAL_AMP_ROOT',
    projectedSkill: root => path.join(root, 'repository-knowledge/skills/code-knowledge-base'),
    freshRoot: root => path.join(root, '.amp/plugins'),
  },
  {
    harness: 'pi',
    variable: 'SLOPSENTRAL_PI_PACKAGE',
    projectedSkill: root => path.join(root, 'repository-knowledge/skills/code-knowledge-base'),
    freshRoot: root => path.join(root, '.pi/slopsentral'),
  },
];

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function inventory(root) {
  return fs.readdirSync(root, { recursive: true })
    .filter(name => !name.split(path.sep).includes('.git') && fs.statSync(path.join(root, name)).isFile())
    .sort()
    .map(name => [name, fs.readFileSync(path.join(root, name)), fs.statSync(path.join(root, name)).mode & 0o777]);
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function fixture(root) {
  const config = {
    schemaVersion: 2,
    knowledge: { type: 'OKF', root: 'knowledge' },
    sourceRoots: ['app/'],
    documentRoots: ['README.md', 'knowledge/', 'handbook/'],
    entrypoints: ['README.md'],
    auxiliary: [],
    archives: [],
    fingerprintIgnores: [],
    areas: [{
      id: 'service',
      sources: ['app/'],
      pages: ['handbook/guide.md', 'knowledge/service.md'],
    }],
  };
  write(root, 'app/service.py', 'def ready():\n    return "ready"\n');
  write(root, 'README.md', '# Service\n\nRead the [guide](handbook/guide.md), [knowledge index](knowledge/index.md), and [explanation](knowledge/service.md).\n');
  write(root, 'handbook/guide.md', '# Use the service\n\nRead the [service explanation](../knowledge/service.md#ready-state) and [source](../app/service.py).\n');
  write(root, 'knowledge/index.md', '# Knowledge\n\n[Service](service.md)\n');
  write(root, 'knowledge/service.md', [
    '---', 'type: Service', 'title: Service readiness',
    'description: The service returns its ready state.', '---',
    '# Service readiness', '', '## Ready state', '',
    'The [source](../app/service.py) returns `ready`.', '',
    'Use the [guide](../handbook/guide.md).', '',
  ].join('\n'));
  write(root, '.knowledge/coverage.json', JSON.stringify(config, null, 2) + '\n');
  git(root, ['init', '--quiet']);
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
    'commit', '--quiet', '-m', 'independent service fixture']);
  return config;
}

for (const surface of surfaces) {
  test(`${surface.harness}: shipped documentation gate works in an independent OKF repository`, {
    skip: !process.env.PKL_BIN && !process.env[surface.variable],
  }, t => {
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'documentation portability ')));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    let projection = process.env[surface.variable];
    if (!projection) {
      const output = project({
        source: repository,
        harness: surface.harness,
        out: path.join(directory, 'projection'),
        pkl: process.env.PKL_BIN,
      }).out;
      projection = surface.freshRoot ? surface.freshRoot(output) : output;
    }
    const projectedSkill = surface.projectedSkill(projection);
    for (const relative of [relativeRuntime, `${relativeRuntime}.lock`, 'SKILL.md',
      'references/portable-documentation.md', 'references/documentation.schema.json',
      'assets/portable-project/README.md', 'assets/portable-project/.knowledge/coverage.json',
      'assets/portable-project/.knowledge/review.lock.json']) {
      assert.deepEqual(fs.readFileSync(path.join(projectedSkill, relative)),
        fs.readFileSync(path.join(canonicalSkill, relative)), `${surface.harness}: ${relative} preserves canonical bytes`);
    }

    // Only shipped scripts and their locks enter the runtime location. No
    // checkout tools, project metadata, source modules, or host registration.
    const installed = path.join(directory, 'installed scripts');
    fs.cpSync(path.join(projectedSkill, 'scripts'), installed, {
      recursive: true,
      filter: file => !file.split(path.sep).some(part => ['__pycache__', '.pytest_cache', '.ruff_cache'].includes(part)),
    });
    const runtime = path.join(installed, 'documentation.py');
    const consumer = path.join(directory, 'consumer repository ; $(literal)');
    fs.mkdirSync(consumer);
    const config = fixture(consumer);
    const unrelated = path.join(directory, 'unrelated cwd');
    fs.mkdirSync(unrelated);
    const environment = Object.fromEntries(Object.entries(process.env)
      .filter(([name]) => (!name.startsWith('UV_') || name === 'UV_PYTHON_INSTALL_DIR')
        && !name.startsWith('PYTHON') && name !== 'VIRTUAL_ENV'));
    environment.UV_NO_CONFIG = '1';
    environment.UV_PYTHON_DOWNLOADS = 'never';
    environment.PYTHONNOUSERSITE = '1';
    const invoke = command => spawnSync('uv', [
      'run', '--locked', '--script', runtime, command,
      '--repo', consumer, '--config', '.knowledge/coverage.json', '--lock', '.knowledge/review.lock.json',
    ], { cwd: unrelated, env: environment, encoding: 'utf8', timeout: 60_000 });
    function result(command, status, type, code) {
      const before = command === 'check' ? inventory(consumer) : undefined;
      const gitBefore = git(consumer, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
      const process = invoke(command);
      assert.equal(process.status, status, process.stdout + process.stderr);
      const report = JSON.parse(process.stdout);
      assert.equal(report.type, type, JSON.stringify(report));
      if (code) assert.equal(report.code, code, JSON.stringify(report));
      if (before) {
        assert.deepEqual(inventory(consumer), before, 'check must preserve every consumer file and mode');
        assert.equal(git(consumer, ['status', '--porcelain=v1', '-z', '--untracked-files=all']), gitBefore,
          'check must preserve the consumer Git status');
      }
      return report;
    }

    result('record', 0, 'RECORDED');
    result('check', 0, 'CURRENT');
    assert.equal(fs.existsSync(path.join(consumer, 'openwiki')), false,
      'standalone OKF admission needs no OpenWiki checkpoint or Claim sidecars');
    assert.equal(fs.existsSync(path.join(consumer, 'docs')), false,
      'portable admission must use configured document roots');
    assert.equal(fs.existsSync(path.join(consumer, 'pyproject.toml')), false);
    assert.equal(fs.existsSync(path.join(consumer, 'uv.lock')), false);
    assert.deepEqual(fs.readdirSync(unrelated), [], 'the unrelated cwd must remain empty');

    const source = path.join(consumer, 'app/service.py');
    const originalSource = fs.readFileSync(source);
    fs.appendFileSync(source, '# Changed implementation.\n');
    const stale = result('check', 1, 'STALE');
    assert.ok(stale.affected.service.includes('app/service.py'), JSON.stringify(stale));
    fs.writeFileSync(source, originalSource);
    result('check', 0, 'CURRENT');

    const guide = path.join(consumer, 'handbook/guide.md');
    const originalGuide = fs.readFileSync(guide);
    fs.appendFileSync(guide, '\nRead the [absent source](../app/absent.py).\n');
    result('check', 2, 'REJECTED', 'LINKS');
    fs.writeFileSync(guide, originalGuide);

    const concept = path.join(consumer, 'knowledge/service.md');
    const originalConcept = fs.readFileSync(concept, 'utf8');
    fs.writeFileSync(concept, originalConcept.replace('type: Service', 'type: ""'));
    result('check', 2, 'REJECTED', 'OKF');
    fs.writeFileSync(concept, originalConcept);

    const configPath = path.join(consumer, '.knowledge/coverage.json');
    const originalConfig = fs.readFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify({ ...config, schemaVersion: 1 }));
    result('check', 2, 'REJECTED', 'INPUT');
    fs.unlinkSync(configPath);
    result('check', 2, 'REJECTED', 'INPUT');
    fs.writeFileSync(configPath, originalConfig);
    result('check', 0, 'CURRENT');

    const lock = `${runtime}.lock`;
    const originalLock = fs.readFileSync(lock);
    fs.unlinkSync(lock);
    const missingLock = invoke('check');
    assert.equal(missingLock.status, 2, missingLock.stdout + missingLock.stderr);
    assert.match(missingLock.stderr, /lockfile/i);
    assert.equal(missingLock.stdout, '', 'missing packaged dependency lock must reject before input admission');
    fs.writeFileSync(lock, originalLock);
    result('check', 0, 'CURRENT');
  });
}
