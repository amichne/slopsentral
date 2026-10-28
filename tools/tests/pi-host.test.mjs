import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

const root = path.resolve(import.meta.dirname, '../..');
test('native Pi delivers plugin instructions and enforces instruction review before settlement', {
  skip: !process.env.SLOPSENTRAL_PI_PACKAGE && !process.env.PKL_BIN,
}, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-native-default-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let pkg = process.env.SLOPSENTRAL_PI_PACKAGE;
  if (!pkg) {
    const out = path.join(directory, 'projection');
    execFileSync(process.execPath, ['tools/project-marketplaces.mjs', '--source', root, '--harness', 'pi', '--out', out], { cwd: root });
    pkg = path.join(out, '.pi/slopsentral');
  }
  if (process.env.SLOPSENTRAL_PI_PACKAGE) {
    const privatePackage = path.join(directory, 'package');
    fs.cpSync(pkg, privatePackage, { recursive: true });
    pkg = privatePackage;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')));
  assert.equal(manifest.pi.skills.length, 30);
  assert.equal(manifest.pi.extensions.length, 2);
  assert.equal(manifest.peerDependencies, undefined);
  const agentDir = path.join(directory, 'agent');
  const cwd = path.join(directory, 'project');
  fs.mkdirSync(cwd);
  fs.mkdirSync(agentDir);
  execFileSync('git', ['init', '-q', cwd]);
  fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'Use the repository instructions.\n');
  fs.writeFileSync(path.join(cwd, 'example.py'), 'value = 1\n');
  execFileSync('git', ['-C', cwd, 'add', '.']);
  execFileSync('git', ['-C', cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture']);
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir; });
  fs.writeFileSync(path.join(agentDir, 'AGENTS.md'), 'Pi global instructions.\n');
  const previousHome = process.env.HOME;
  process.env.HOME = directory;
  t.after(() => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
  const settingsManager = SettingsManager.inMemory({ packages: [pkg] });
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
  await resourceLoader.reload();
  assert.equal(resourceLoader.getSkills().skills.length, 30);
  assert.deepEqual(resourceLoader.getSkills().diagnostics, []);
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  assert.equal(resourceLoader.getExtensions().extensions.filter(e => e.path.startsWith(pkg)).length, 2);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, resourceLoader, modelRuntime,
    sessionManager: SessionManager.inMemory(cwd) });
  t.after(() => session.dispose());
  await session.bindExtensions({ mode: 'print', onError: error => assert.fail(error.message) });
  assert.equal(session.extensionRunner.getRegisteredCommands().some(c => c.name.startsWith('slopsentral')), false);
  assert.equal(session.getActiveToolNames().some(name => name.startsWith('slopsentral')), false);
  assert.equal([...session.extensionRunner.getFlags().keys()].some(name => name.startsWith('slopsentral')), false);
  const runner = session.extensionRunner;
  assert.equal(runner.getRegisteredCommands().filter(command => command.name === 'hooks').length, 1);
  assert.deepEqual(runner.getCommandDiagnostics(), []);
  const start = await runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the fixture.' }, { cwd });
  assert.ok(start.systemPromptOptions.forceSystemPrompt.includes(fs.readFileSync(path.join(pkg, 'software-engineering/instructions/engineering-design.md'), 'utf8')));
  assert.equal(await runner.emitToolCall({ type: 'tool_call', toolCallId: 'read-1', toolName: 'read', input: { path: 'example.py' } }), undefined);
  const context = () => ({ contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: true });
  const settled = () => runner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, context);
  assert.equal((await settled()).continue, false);
  fs.writeFileSync(path.join(cwd, 'example.py'), 'value = 2\n');
  fs.writeFileSync(path.join(agentDir, 'AGENTS.md'), 'Revised Pi global instructions.\n');
  const blocked = await settled();
  assert.equal(blocked.continue, true, JSON.stringify(blocked));
  assert.match(JSON.stringify(blocked.entries), /review/);
  assert.ok(JSON.stringify(blocked.entries).includes(path.join(agentDir, 'AGENTS.md')));
  assert.equal(fs.existsSync(path.join(directory, '.codex/state')), false);
  const repeated = await settled();
  assert.equal(repeated.continue, false);
  assert.match(JSON.stringify(repeated.entries), /Unresolved hook result/);
  execFileSync('uv', ['run', '--locked', '--script', path.join(pkg, 'software-engineering/hooks/agents-md-scope.py'),
    'review', '--cwd', cwd, '--session-id', session.sessionManager.getSessionId(), '--note', 'The value change obeys the repository instructions.'], { cwd, env: { ...process.env, SLOPSENTRAL_SCOPE_HOME: agentDir } });
  const reviewed = await settled();
  assert.equal(reviewed.continue, false);
  assert.equal(reviewed.entries.some(e => JSON.stringify(e).includes('Unresolved')), false);
  const instruction = path.join(pkg, 'software-engineering/instructions/engineering-design.md');
  const original = fs.readFileSync(instruction);
  fs.renameSync(instruction, instruction + '.fixture-backup');
  t.after(() => { if (fs.existsSync(instruction + '.fixture-backup')) fs.renameSync(instruction + '.fixture-backup', instruction); });
  await runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine a missing instruction.' }, { cwd });
  assert.deepEqual(await runner.emitToolCall({ type: 'tool_call', toolCallId: 'read-2', toolName: 'read', input: { path: 'example.py' } }), { block: true, reason: 'INSTRUCTION_UNAVAILABLE' });
  fs.renameSync(instruction + '.fixture-backup', instruction);
  assert.deepEqual(fs.readFileSync(instruction), original);
  await runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine a repaired instruction.' }, { cwd });
  assert.equal(await runner.emitToolCall({ type: 'tool_call', toolCallId: 'read-3', toolName: 'read', input: { path: 'example.py' } }), undefined);
  t.diagnostic('Native Pi 1.3.0: 30 skills, two prompts, two adapters, real scope rejection and review, no model request.');
});
