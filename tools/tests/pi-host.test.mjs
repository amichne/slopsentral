import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');

async function host(t, packagePath, directory, flag, agentDir = path.join(directory, 'agent')) {
  const previousHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = path.join(path.dirname(agentDir), 'codex');
  t.after(() => { if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome; });
  const settingsManager = SettingsManager.inMemory({ packages: [] });
  fs.mkdirSync(agentDir);
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir, settingsManager,
    additionalExtensionPaths: [packagePath], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd: directory, agentDir, resourceLoader: loader, modelRuntime,
    settingsManager, sessionManager: SessionManager.inMemory(directory) });
  t.after(() => session.dispose());
  const errors = [];
  let aborts = 0;
  if (flag) session.extensionRunner.setFlagValue('slopsentral-profile', flag);
  await session.bindExtensions({ mode: 'print', onError: error => errors.push(error), abortHandler: () => { aborts++; } });
  return { session, loader, errors, aborts: () => aborts };
}

test('projected scope hook reports real edits until an explicit review resolves its gate', { skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_PI_PACKAGE }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi scope lifecycle ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cwd = path.join(directory, 'consumer');
  fs.mkdirSync(path.join(cwd, 'module'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'AGENTS.md'), '# Fixture\nThe root instructions own the module.\n');
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'original\n');
  const git = (...args) => execFileSync('git', ['-C', cwd, '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8' });
  git('init', '--quiet');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--no-gpg-sign', '-m', 'fixture');
  let packagePath = process.env.SLOPSENTRAL_PI_PACKAGE;
  if (!packagePath) {
    project({ source: root, harness: 'pi', out: path.join(directory, 'projection') });
    packagePath = path.join(directory, 'projection/.pi/slopsentral');
  }
  const { session, errors, aborts } = await host(t, packagePath, cwd, undefined, path.join(directory, 'agent'));
  const settle = () => session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({
    contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message'),
  }));
  assert.deepEqual(await session.extensionRunner.emitInput('Examine the fixture.', undefined, 'interactive'), { action: 'continue' });
  assert.deepEqual((await settle()).entries, []);
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'changed-source-must-stay-private\n');
  const original = { type: 'tool_result', toolName: 'write', toolCallId: 'edit-1', input: {}, content: [{ type: 'text', text: 'Native edit receipt' }], details: { receipt: 1 }, structuredContent: { saved: true }, isError: false, usage: { input: 1, output: 1 } };
  const recorded = await session.extensionRunner.emitToolResult(original);
  assert.deepEqual(recorded.content[0], original.content[0]);
  assert.deepEqual(recorded.structuredContent, original.structuredContent);
  assert.deepEqual(recorded.details, original.details);
  assert.deepEqual(recorded.usage, original.usage);
  assert.equal(recorded.isError, false);
  assert.ok(recorded.content.some(part => part.type === 'text' && part.text.includes('module/main.py') && part.text.includes('AGENTS.md')));
  assert.equal(JSON.stringify(recorded).includes('changed-source-must-stay-private'), false);
  const blocked = await settle();
  assert.equal(blocked.continue, false, 'the shipped advisory policy must not continue the run');
  assert.ok(blocked.entries.some(entry => entry.type === 'custom_message' && entry.content.includes('agents-md-scope: BLOCKED') && entry.content.includes('review')));
  const script = path.join(packagePath, 'software-engineering/hooks/agents-md-scope.py');
  const reviewed = JSON.parse(execFileSync('uv', ['run', '--locked', '--script', script, 'review', '--cwd', cwd,
    '--session-id', session.sessionManager.getSessionId(), '--note', 'The root instructions still describe the module.'], { cwd: directory, encoding: 'utf8' }));
  assert.equal(reviewed.type, 'REVIEW_RECORDED');
  assert.deepEqual((await settle()).entries, []);
  const store = path.join(process.env.CODEX_HOME, 'state/agents-md-scope');
  const snapshot = () => fs.readdirSync(store).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(store, name), 'utf8'));
  const saved = snapshot();
  assert.equal(saved.length, 1);
  await session.prompt('/slopsentral-profile off');
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'changed while off\n');
  await session.extensionRunner.emitInput('Examine the fixture.', undefined, 'interactive');
  assert.equal(await session.extensionRunner.emitToolResult(original), undefined);
  assert.deepEqual((await settle()).entries, []);
  assert.deepEqual(snapshot(), saved, 'the off profile must not write hook state');
  assert.equal(aborts(), 0);
  assert.deepEqual(errors, []);
});

test('Pi 1.2 native loader dispatches profile commands, prompt sections, and branch restoration without a provider', { skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_PI_PACKAGE }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-pi-host-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let packagePath = process.env.SLOPSENTRAL_PI_PACKAGE;
  if (!packagePath) {
    project({ source: root, harness: 'pi', out: path.join(directory, 'projection') });
    packagePath = path.join(directory, 'projection/.pi/slopsentral');
  }
  const { session, loader, errors } = await host(t, packagePath, directory);
  const commands = session.extensionRunner.getRegisteredCommands().map(c => c.name);
  assert.ok(commands.includes('slopsentral-profile'));
  assert.ok(commands.includes('slopsentral-type-design'));
  assert.ok(commands.includes('slopsentral-check'));
  assert.ok(loader.getSkills().skills.some(s => s.name === 'openapi-contract-authoring'));
  const tools = session.getActiveToolNames();
  await session.extensionRunner.emitInput('Implement Kotlin tests, prove invariants, and open a pull request', undefined, 'interactive');
  const hints = session.sessionManager.getBranch().findLast(entry => entry.type === 'custom_message' && entry.customType === 'slopsentral-guidance').content;
  for (const name of ['engineering-design', 'kotlin-engineering', 'tdd', 'semantic-ratchet', 'git-change-flow', 'pull-request-lifecycle']) {
    assert.match(hints, new RegExp(`${name}:`));
    const resource = hints.split('\n').find(line => line.startsWith(`${name}:`)).split(' (source:')[0].slice(name.length + 2);
    assert.ok(fs.existsSync(resource), resource);
  }
  await session.prompt('/slopsentral-kotlin-type-design');
  const kotlinEntry = session.sessionManager.getBranch().at(-1);
  assert.equal(kotlinEntry.customType, 'slopsentral-profile');
  assert.equal(kotlinEntry.data, 'kotlin-type-design');
  const allSkills = loader.getSkills().skills;
  const unrelated = { ...allSkills[0], name: 'unrelated', filePath: path.join(directory, 'unrelated/SKILL.md') };
  const examine = () => session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Design an identifier' },
    { cwd: directory, skills: [...allSkills, unrelated], sections: { existing: 'repository context' } });
  let result = await examine();
  assert.equal(result.systemPromptOptions.sections.existing, 'repository context');
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Engineering Baseline'));
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Kotlin Engineering'));
  assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name).sort(),
    ['kotlin-design-practices', 'kotlin-review', 'negative-capability-proof', 'semantic-ratchet', 'unrelated']);
  await session.prompt('/slopsentral-profile type-design');
  result = await examine();
  assert.ok(result.systemPromptOptions.skills.some(s => s.name === 'openapi-contract-authoring'));
  await session.prompt('/slopsentral-profile unknown');
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('Slopsentral profile: type-design.'));
  session.sessionManager.branch(kotlinEntry.id);
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: kotlinEntry.id, oldLeafId: undefined, fromExtension: true });
  assert.equal((await examine()).systemPromptOptions.skills.some(s => s.name === 'openapi-contract-authoring'), false);
  await session.prompt('/slopsentral-profile off');
  result = await examine();
  assert.equal(result.systemPromptOptions.sections.slopsentral, undefined);
  assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name), ['unrelated']);
  assert.deepEqual(session.getActiveToolNames(), tools);
  await session.prompt('/slopsentral-profile personal-configuration-default');
  assert.ok((await examine()).systemPromptOptions.skills.some(s => s.name === 'python-tooling'));
  assert.deepEqual(errors, []);
});

function fixture(t, hooks, mode = 'ENFORCING') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi native actions ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, 'package');
  fs.mkdirSync(path.join(packagePath, 'extensions'), { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'fixture/hooks'), { recursive: true });
  for (const name of ['slopsentral.ts', 'runtime.ts']) fs.copyFileSync(path.join(root, 'source/hooks/pi', name), path.join(packagePath, 'extensions', name));
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ type: 'module', pi: { extensions: ['./extensions/slopsentral.ts'], skills: [] } }));
  const base = { description: 'Controlled native adapter fixture', skills: [], instructions: [], agents: [], hooks, hookPolicy: mode };
  fs.writeFileSync(path.join(packagePath, 'profiles.json'), JSON.stringify({ schemaVersion: 1, defaultProfile: 'fixture', profiles: [{ name: 'fixture', ...base }, { name: 'second', ...base }] }));
  fs.writeFileSync(path.join(packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(p.cwd!==process.cwd()||!p.session_id)process.exit(3);console.log(JSON.stringify({decision:'block',reason:'controlled rejection'}));`);
  return { directory, packagePath };
}

test('native flag choice persists and remains stable on session restoration', async t => {
  const f = fixture(t, []);
  const { session, errors } = await host(t, f.packagePath, f.directory, 'second');
  assert.equal(session.sessionManager.getBranch().at(-1).data, 'second');
  session.extensionRunner.setFlagValue('slopsentral-profile', 'fixture');
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  assert.equal(session.sessionManager.getBranch().at(-1).data, 'second');
  assert.deepEqual(errors, []);
});

test('native hook policies distinguish disabled, advisory, and enforcing failures across each event', async t => {
  for (const mode of ['OFF', 'ADVISORY', 'ENFORCING']) await t.test(mode, async t => {
    const hooks = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'].map(event => ({
      name: 'gate', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2,
      ...(event === 'PreToolUse' ? { matcher: '^read_file$' } : {}),
    }));
    const f = fixture(t, hooks, mode);
    const ledger = path.join(f.directory, 'events.jsonl');
    fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); fs.appendFileSync(${JSON.stringify(ledger)},p.hook_event_name+'\\n'); console.log(JSON.stringify({decision:'block',reason:'controlled '+p.hook_event_name+' rejection'}));`);
    const { session, errors, aborts } = await host(t, f.packagePath, f.directory);
    const notifications = [];
    session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
    session.sessionManager.appendMessage({ role: 'user', content: 'Examine the fixture.', timestamp: 0 });
    await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the fixture.' }, { cwd: f.directory });
    assert.deepEqual(await session.extensionRunner.emitInput('Examine the fixture.', undefined, 'rpc'), { action: mode === 'ENFORCING' ? 'handled' : 'continue' });
    const call = { type: 'tool_call', toolName: 'read', toolCallId: 'read-1', input: { path: 'fixture.txt' } };
    assert.equal(await session.extensionRunner.emitToolCall({ ...call, toolName: 'write' }), undefined, 'an unmatched tool must not run the gate');
    const permission = await session.extensionRunner.emitToolCall(call);
    if (mode === 'ENFORCING') {
      assert.equal(permission.block, true);
      assert.match(permission.reason, /controlled PreToolUse rejection/);
    } else assert.equal(permission, undefined);
    const original = { type: 'tool_result', toolName: 'read', toolCallId: 'read-1', input: {}, content: [{ type: 'text', text: 'original evidence' }], details: { receipt: 1 }, isError: false };
    const result = await session.extensionRunner.emitToolResult(original);
    if (mode === 'OFF') assert.equal(result, undefined);
    else {
      assert.deepEqual(result.content[0], original.content[0]);
      assert.match(result.content.at(-1).text, /controlled PostToolUse rejection/);
    }
    assert.equal(aborts(), mode === 'ENFORCING' ? 1 : 0);
    const settle = await session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({
      contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message'),
    }));
    assert.equal(settle.continue, mode === 'ENFORCING');
    if (mode === 'OFF') assert.deepEqual(settle.entries, []);
    else assert.ok(settle.entries.some(entry => entry.type === 'custom_message' && entry.content.includes('controlled Stop rejection')));
    const events = () => fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8').trim().split('\n') : [];
    assert.deepEqual(events(), mode === 'OFF' ? [] : ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']);
    const prior = notifications.length;
    await session.prompt('/slopsentral-check');
    assert.equal(events().at(-1), 'Stop', 'explicit gates must also run with the OFF policy');
    assert.ok(notifications.slice(prior).some(message => message.includes('controlled Stop rejection')));
    assert.deepEqual(errors, []);
  });
});

test('invalid native startup and branch selections abort until a valid command repairs state', async t => {
  const f = fixture(t, []);
  const h = await host(t, f.packagePath, f.directory, 'unknown');
  const examine = () => h.session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'probe' }, { cwd: f.directory });
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('UNKNOWN_PROFILE'));
  assert.equal(h.aborts(), 1);
  await h.session.prompt('/slopsentral-profile fixture');
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('Slopsentral profile: fixture.'));
  h.session.sessionManager.appendCustomEntry('slopsentral-profile', 'removed-profile');
  await h.session.extensionRunner.emit({ type: 'session_tree', newLeafId: h.session.sessionManager.getLeafId(), fromExtension: true });
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('UNKNOWN_PROFILE'));
  assert.equal(h.aborts(), 2);
  assert.deepEqual(h.errors, []);
});

test('native startup rejection aborts each dependent run and preserves its prompt scope', async t => {
  const action = { name: 'gate', event: 'SessionStart', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  const h = await host(t, f.packagePath, f.directory);
  for (let index = 0; index < 2; index++) {
    const result = await h.session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'probe' }, { cwd: f.directory });
    assert.ok(result.systemPromptOptions.sections.slopsentral.includes('Startup hooks failed: gate: BLOCKED'));
  }
  assert.equal(h.aborts(), 2);
  assert.deepEqual(h.errors, []);
});

test('native completion adapter preserves notices and permits only one enforcement continuation', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  session.sessionManager.appendMessage({ role: 'user', content: 'controlled task', timestamp: 0 });
  const dispatch = outcome => session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome }, entries => ({
    contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [],
    canContinue: entries.some(entry => entry.type === 'custom_message'),
  }));
  const first = await dispatch('completed');
  assert.equal(first.valid, true);
  assert.equal(first.continue, true);
  assert.ok(first.entries.some(e => e.type === 'custom_message' && e.content.includes('gate: BLOCKED')));
  for (const entry of first.entries) if (entry.type === 'custom') session.sessionManager.appendCustomEntry(entry.customType, entry.data);
  const second = await dispatch('completed');
  assert.equal(second.continue, false);
  assert.ok(second.entries.some(e => e.type === 'custom_message' && e.content.includes('after one continuation')));
  const aborted = await dispatch('aborted');
  assert.deepEqual(aborted.entries, []);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `console.log(JSON.stringify({systemMessage:'advisory findings: 2'}))`);
  const advisory = await dispatch('completed');
  assert.equal(advisory.continue, false);
  assert.ok(advisory.entries.some(e => e.type === 'custom_message' && e.content.includes('advisory findings: 2')));
  assert.deepEqual(errors, []);
});

test('native prompt and post-tool adapters preserve context and original tool evidence', async t => {
  const hooks = ['UserPromptSubmit', 'PostToolUse', 'Stop'].map(event => ({ name: 'scope', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 }));
  const f = fixture(t, hooks, 'ADVISORY');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(!p.session_id||p.cwd!==process.cwd())process.exit(3); console.log(JSON.stringify(p.hook_event_name==='Stop'?{decision:'block',reason:'Run the scope review command before completion.'}:{hookSpecificOutput:{hookEventName:p.hook_event_name,additionalContext:p.hook_event_name+' scope guidance'}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const input = await session.extensionRunner.emitInput('Examine source changes', undefined, 'interactive');
  assert.deepEqual(input, { action: 'continue' });
  assert.ok(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.content.includes('UserPromptSubmit scope guidance')));
  const original = { type: 'tool_result', toolName: 'custom_probe', toolCallId: 'probe-1', input: {}, content: [{ type: 'text', text: 'Original tool evidence' }], details: { receipt: 7 }, structuredContent: { state: 'recorded' }, isError: true, usage: { input: 1, output: 2 } };
  const result = await session.extensionRunner.emitToolResult(original);
  assert.deepEqual(result.content[0], original.content[0]);
  assert.ok(result.content.some(part => part.type === 'text' && part.text.includes('PostToolUse scope guidance')));
  assert.deepEqual(result.details, original.details);
  assert.deepEqual(result.structuredContent, original.structuredContent);
  assert.equal(result.isError, true);
  assert.deepEqual(result.usage, original.usage);
  const completion = await session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({ contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(e => e.type === 'custom_message') }));
  assert.ok(completion.entries.some(entry => entry.type === 'custom_message' && entry.content.includes('Run the scope review command before completion.')));
  assert.equal(completion.continue, false);
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  await session.prompt('/slopsentral-check');
  assert.ok(notifications.some(message => message.includes('Run the scope review command before completion.')));
  assert.deepEqual(errors, []);
});

test('native prompt hooks receive the current text and input source before any model turn', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:JSON.stringify({prompt:p.prompt,source:p.source})}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const images = [{ type: 'image', data: 'controlled-image', mimeType: 'image/png' }];
  for (const [text, source] of [['Fix Kotlin "quoted" code\n$HOME $(no-command)', 'interactive'], ['A different RPC request', 'rpc'], ['An extension-supplied message', 'extension']]) {
    assert.deepEqual(await session.extensionRunner.emitInput(text, images, source), { action: 'continue' });
    const entry = session.sessionManager.getBranch().findLast(e => e.type === 'custom_message' && e.customType === 'slopsentral-prompt-hooks');
    assert.deepEqual(JSON.parse(entry.content), { prompt: text, source });
  }
  assert.deepEqual(errors, []);
});

test('native session shutdown cancels an active manual gate without a continuation', { skip: process.platform === 'win32', timeout: 15000 }, async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 30 };
  const f = fixture(t, [action]);
  const pidPath = path.join(f.directory, 'ready');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';process.on('SIGTERM',()=>{});fs.writeFileSync(${JSON.stringify(pidPath + '.tmp')},String(process.pid));fs.renameSync(${JSON.stringify(pidPath + '.tmp')},${JSON.stringify(pidPath)});setInterval(()=>{},1000);`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  const ready = new Promise((resolve, reject) => {
    const watcher = fs.watch(f.directory, () => { if (fs.existsSync(pidPath)) { clearTimeout(timer); watcher.close(); resolve(); } });
    const timer = setTimeout(() => { watcher.close(); reject(new Error('manual gate never reached its ready stage')); }, 10000);
    t.after(() => { clearTimeout(timer); watcher.close(); });
  });
  const pending = session.prompt('/slopsentral-check');
  t.after(() => session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }));
  await ready;
  const pid = Number(fs.readFileSync(pidPath, 'utf8'));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } });
  process.kill(pid, 0);
  await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
  await pending;
  assert.ok(notifications.some(message => message.includes('gate: ABORTED')));
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom' && entry.customType === 'slopsentral-stop-continuation'), false);
  assert.deepEqual(errors, []);
});

test('native input adds bounded authored guidance immediately without selecting a profile or running hooks', async t => {
  const f = fixture(t, []);
  const configPath = path.join(f.packagePath, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const instructions = ['engineering-design', 'kotlin-engineering'].map(name => ({ name, path: `fixture/instructions/${name}.md` }));
  fs.mkdirSync(path.join(f.packagePath, 'fixture/instructions'));
  for (const ref of instructions) fs.writeFileSync(path.join(f.packagePath, ref.path), `# ${ref.name}\nControlled canonical policy.`);
  config.profiles.push({ ...config.profiles[0], name: 'catalog', instructions, hookPolicy: 'OFF' });
  fs.writeFileSync(configPath, JSON.stringify(config));
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const tools = session.getActiveToolNames();
  const hints = () => session.sessionManager.getBranch().filter(e => e.type === 'custom_message' && e.customType === 'slopsentral-guidance');
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(await session.extensionRunner.emitInput('Explain Kotlin', undefined, 'interactive'), { action: 'continue' });
    assert.equal(hints().length, index + 1);
    const text = hints().at(-1).content;
    assert.ok(text.indexOf('engineering-design:') < text.indexOf('kotlin-engineering:'));
    assert.equal(text.split('engineering-design:').length, 2);
    assert.equal(text.includes('Controlled canonical policy.'), false);
    assert.ok(Buffer.byteLength(text) <= 8192);
  }
  await session.extensionRunner.emitInput('What is the weather?', undefined, 'interactive');
  assert.equal(hints().length, 2);
  assert.deepEqual(session.getActiveToolNames(), tools);
  assert.equal(session.sessionManager.getBranch().findLast(e => e.type === 'custom' && e.customType === 'slopsentral-profile').data, 'fixture');
  await session.prompt('/slopsentral-profile off');
  await session.extensionRunner.emitInput('Kotlin', undefined, 'interactive');
  assert.equal(hints().length, 2);
  await session.prompt('/slopsentral-profile catalog');
  await session.extensionRunner.emitInput('Kotlin', undefined, 'interactive');
  assert.equal(hints().length, 2);
  for (let index = 0; index < 2; index++) {
    const result = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Kotlin' }, { cwd: f.directory });
    assert.equal(result.systemPromptOptions.sections.slopsentral.split('# engineering-design').length, 2);
  }
  assert.deepEqual(errors, []);
});
