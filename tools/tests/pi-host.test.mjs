import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { prepareHookRuntime } from '../setup-pi.mts';

const root = path.resolve(import.meta.dirname, '../..');
for (const managed of [false, true]) test(`native Pi delivers instructions and enforces review (${managed ? 'private runtime' : 'external runtime'})`, {
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
  let python;
  if (managed) {
    const state = path.join(directory, 'slopsentral-setup');
    python = await prepareHookRuntime(state);
    assert.equal(await prepareHookRuntime(state, () => assert.fail('A current runtime must not download again')), python);
    const destination = path.join(state, 'packages', 'fixture');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(pkg, destination);
    pkg = destination;
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
  if (managed) {
    const previousPath = process.env.PATH;
    const bin = path.join(directory, 'runtime-bin');
    fs.mkdirSync(bin);
    fs.symlinkSync('/usr/bin/git', path.join(bin, 'git'));
    process.env.PATH = bin;
    t.after(() => { if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath; });
  }
  assert.equal(runner.getRegisteredCommands().filter(command => command.name === 'hooks').length, 1);
  assert.deepEqual(runner.getCommandDiagnostics(), []);
  const prompt = () => runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the fixture.' }, { cwd });
  const read = id => runner.emitToolCall({ type: 'tool_call', toolCallId: id, toolName: 'read', input: { path: 'example.py' } });
  // Resource discovery alone does not prove that installed hooks can run.
  // Hide every host runtime; Pi itself remains loaded in this process.
  if (!managed) {
    const previousPath = process.env.PATH;
    const emptyBin = path.join(directory, 'empty-bin');
    fs.mkdirSync(emptyBin);
    process.env.PATH = emptyBin;
    try {
      const unavailable = await prompt();
      assert.match(unavailable.systemPromptOptions.forceSystemPrompt, /HOOK_EXIT_127/);
      assert.match((await read('missing-uv')).reason, /HOOK_EXIT_127/);
    } finally {
      if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    }
  } else {
    await prompt();
    assert.equal(await read('no-system-python-or-uv'), undefined);
  }
  // Break a real bundled script after discovery and require a later request to
  // establish admission again, without reloading the extension or the session.
  const hookScript = path.join(pkg, 'software-engineering/hooks/agents-md-scope.py');
  fs.renameSync(hookScript, hookScript + '.fixture-backup');
  try {
    const unavailable = await prompt();
    const reason = managed ? /HOOK_SCRIPT_UNAVAILABLE/ : /HOOK_EXIT_2/;
    assert.match(unavailable.systemPromptOptions.forceSystemPrompt, reason);
    assert.match((await read('missing-script')).reason, reason);
  } finally {
    fs.renameSync(hookScript + '.fixture-backup', hookScript);
  }
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
  execFileSync(python ?? 'uv', [...(managed ? ['-I', '-B'] : ['run', '--locked', '--script']), path.join(pkg, 'software-engineering/hooks/agents-md-scope.py'),
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
