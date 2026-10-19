import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, createWriteToolDefinition, DefaultResourceLoader, initTheme, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai';
import { Input, TuiMainScreen, visibleWidth } from '@earendil-works/pi-tui';
import { tsImport } from 'tsx/esm/api';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');

function fixtureCatalog(config, extra = []) {
  const caps = new Map(extra.map(capability => [capability.id, capability]));
  for (const profile of config.profiles) {
    for (const [type, refs] of [['SKILL', profile.skills], ['INSTRUCTION', profile.instructions], ['AGENT', profile.agents]]) for (const ref of refs) {
      const id = `${type.toLowerCase()}:${ref.name}`;
      const previous = caps.get(id);
      caps.set(id, { id, type, name: ref.name, path: ref.path, dependencies: [], profiles: [...new Set([...(previous?.profiles ?? []), profile.name])] });
    }
    for (const action of profile.hooks) {
      const id = `hook:${action.name}`;
      const previous = caps.get(id);
      const actions = [...(previous?.actions ?? [])];
      if (!actions.some(item => JSON.stringify(item) === JSON.stringify(action))) actions.push(action);
      caps.set(id, { id, type: 'HOOK', name: action.name, dependencies: [], profiles: [...new Set([...(previous?.profiles ?? []), profile.name])], actions });
    }
  }
  return { schemaVersion: 1, capabilities: [...caps.values()] };
}

async function host(t, packagePath, directory, flag, agentDir = path.join(directory, 'agent'), customTools = []) {
  const catalogFile = path.join(packagePath, 'capabilities.json');
  if (!fs.existsSync(catalogFile)) {
    // Controlled fixture actions have no dependencies. Projected packages carry real source edges.
    const config = JSON.parse(fs.readFileSync(path.join(packagePath, 'profiles.json'), 'utf8'));
    fs.writeFileSync(catalogFile, JSON.stringify(fixtureCatalog(config)));
  }
  const previousHome = process.env.CODEX_HOME;
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir; });
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
    settingsManager, sessionManager: SessionManager.inMemory(directory), customTools });
  t.after(() => session.dispose());
  const errors = [];
  let aborts = 0;
  if (flag) session.extensionRunner.setFlagValue('slopsentral-profile', flag);
  await session.bindExtensions({ mode: 'print', onError: error => errors.push(error), abortHandler: () => { aborts++; } });
  return { session, loader, modelRuntime, errors, aborts: () => aborts };
}

async function jsonCommand(session, text) {
  const chunks = [];
  const native = session.extensionRunner.createCommandContext();
  const command = session.extensionRunner.getCommand('slopsentral');
  assert.ok(command);
  await command.handler(text, { ...native, mode: 'rpc', ui: { ...native.ui, notify: message => chunks.push(message) } });
  return JSON.parse(chunks.at(-1));
}

async function until(predicate, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function afterJobs(session) {
  const deadline = Date.now() + 5000;
  while (true) {
    const state = await jsonCommand(session, 'state');
    if (!state.jobs.length) return state;
    assert.ok(Date.now() < deadline, 'native background jobs did not finish');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
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
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  const settle = () => session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({
    contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message'),
  }));
  await session.extensionRunner.emitInput('Examine the fixture.', undefined, 'interactive');
  assert.deepEqual((await settle()).entries, []);
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'edit-1', args: { path: 'module/main.py' } });
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'changed-source-must-stay-private\n');
  const original = { type: 'tool_result', toolName: 'write', toolCallId: 'edit-1', input: { path: 'module/main.py' }, content: [{ type: 'text', text: 'Native edit receipt' }], details: { receipt: 1 }, structuredContent: { saved: true }, isError: false, usage: { input: 1, output: 1 } };
  const recorded = await session.extensionRunner.emitToolResult(original) ?? original;
  assert.deepEqual(recorded, original);
  assert.deepEqual((await settle()).entries, []);
  await session.extensionRunner.emit({ type: 'agent_settled', aborted: false });
  await until(() => notifications.some(message => message.includes('module/main.py')), 'scope assessment');
  assert.equal(JSON.stringify(notifications).includes('changed-source-must-stay-private'), false);
  const journal = () => session.sessionManager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === 'slopsentral-mutations').data;
  assert.deepEqual(journal().pending, ['module/main.py']);
  assert.equal(journal().assessedRevision, journal().revision);
  await session.prompt('/slopsentral-check');
  assert.ok(notifications.some(message => message.includes('Pending scope review')));
  await session.prompt('/slopsentral review The root instructions still describe the module.');
  assert.deepEqual(journal().pending, []);
  await session.prompt('/slopsentral-profile off');
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'edit-2', args: { path: 'module/main.py' } });
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'changed while off\n');
  assert.equal(await session.extensionRunner.emitToolResult(original), undefined);
  assert.deepEqual(journal().pending, ['module/main.py'], 'disabled assessment preserves mutation evidence');
  assert.equal(fs.existsSync(path.join(process.env.CODEX_HOME, 'state/agents-md-scope')), false);
  assert.equal(aborts(), 0);
  assert.deepEqual(errors, []);
});

test('Pi native loader dispatches profile commands, prompt sections, and branch restoration without a provider', { skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_PI_PACKAGE }, async t => {
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
  assert.equal(loader.getSkills().skills.some(s => s.name === 'openapi-contract-authoring'), false);
  assert.ok((await jsonCommand(session, 'state')).effective.capabilities.some(item => item.capability.id === 'skill:openapi-contract-authoring'));
  const tools = session.getActiveToolNames();
  await session.extensionRunner.emitInput('Implement Kotlin tests, prove invariants, and open a pull request', undefined, 'interactive');
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.customType === 'slopsentral-guidance'), false);
  await session.prompt('/slopsentral-kotlin-type-design');
  const kotlinEntry = session.sessionManager.getBranch().at(-1);
  assert.equal(kotlinEntry.customType, 'slopsentral-profile');
  assert.equal(kotlinEntry.data, 'kotlin-type-design');
  const allSkills = loader.getSkills().skills;
  const unrelated = { ...allSkills[0], name: 'unrelated', filePath: path.join(directory, 'unrelated/SKILL.md') };
  fs.mkdirSync(path.dirname(unrelated.filePath));
  fs.writeFileSync(unrelated.filePath, '---\nname: unrelated\ndescription: Unrelated native fixture.\n---\nUse the unrelated fixture.\n');
  const examine = () => session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Design an identifier' },
    { cwd: directory, skills: [...allSkills, unrelated], sections: { existing: 'repository context' } });
  let result = await examine();
  assert.equal(result.systemPromptOptions.sections.existing, 'repository context');
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Engineering Baseline'));
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Kotlin Engineering'));
  assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name), ['unrelated']);
  for (const name of ['kotlin-design-practices', 'kotlin-review', 'negative-capability-proof', 'semantic-ratchet'])
    assert.ok(result.systemPromptOptions.sections.slopsentral_skills.includes(name));
  await session.prompt('/slopsentral-profile type-design');
  result = await examine();
  assert.ok(result.systemPromptOptions.sections.slopsentral_skills.includes('openapi-contract-authoring'));
  await session.prompt('/slopsentral-profile unknown');
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('Slopsentral profile: type-design.'));
  session.sessionManager.branch(kotlinEntry.id);
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: kotlinEntry.id, oldLeafId: undefined, fromExtension: true });
  assert.equal((await examine()).systemPromptOptions.sections.slopsentral_skills.includes('openapi-contract-authoring'), false);
  await session.prompt('/slopsentral-profile off');
  result = await examine();
  assert.equal(result.systemPromptOptions.sections.slopsentral, undefined);
  assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name), ['unrelated']);
  assert.deepEqual(session.getActiveToolNames(), tools);
  await session.prompt('/slopsentral-profile personal-configuration-default');
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral_skills.includes('python-tooling'));
  await session.prompt('/slopsentral-profile documentation-default');
  for (const prompt of ['test', 'What does the word test mean?', 'Please do not publish or push anything.',
    'Write an assertion for this behavior', 'Add regression coverage for this behavior']) {
    await session.extensionRunner.emitInput(prompt, undefined, 'interactive');
    const scoped = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt }, { cwd: directory, skills: allSkills });
    assert.ok(scoped.systemPromptOptions.sections.slopsentral_skills.includes('technical-documentation'));
    assert.equal(scoped.systemPromptOptions.sections.slopsentral_skills.includes('tdd'), false);
    assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.customType === 'slopsentral-guidance'), false);
  }
  assert.deepEqual(errors, []);
});

function fixture(t, hooks, mode = 'ENFORCING') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi native actions ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, 'package');
  fs.mkdirSync(path.join(packagePath, 'extensions'), { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'fixture/hooks'), { recursive: true });
  const adapters = process.env.SLOPSENTRAL_PI_PACKAGE ? path.join(process.env.SLOPSENTRAL_PI_PACKAGE, 'extensions') : path.join(root, 'source/hooks/pi');
  for (const name of fs.readdirSync(adapters).filter(name => name.endsWith('.ts'))) fs.copyFileSync(path.join(adapters, name), path.join(packagePath, 'extensions', name));
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ type: 'module', pi: { extensions: ['./extensions/slopsentral.ts'], skills: [] } }));
  const base = { description: 'Controlled native adapter fixture', skills: [], instructions: [], agents: [], hooks, hookPolicy: mode };
  fs.writeFileSync(path.join(packagePath, 'profiles.json'), JSON.stringify({ schemaVersion: 1, defaultProfile: 'fixture', profiles: [{ name: 'fixture', ...base }, { name: 'second', ...base }] }));
  fs.writeFileSync(path.join(packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(p.cwd!==process.cwd()||!p.session_id)process.exit(3);console.log(JSON.stringify({decision:'block',reason:'controlled rejection'}));`);
  return { directory, packagePath };
}

function managedSkillsFixture(t, { unavailable = true, nativeExposure = false } = {}) {
  const f = fixture(t, []);
  const skills = ['human', 'model', 'either', 'disabled', 'unavailable'].map(name => ({
    name: `${name}-fixture`, path: `fixture/skills/${name}-fixture/SKILL.md`,
    ...(['human', 'model', 'either'].includes(name) ? { invocation: name } : {}),
  }));
  const contents = new Map();
  for (const skill of skills.filter(skill => !unavailable || skill.name !== 'unavailable-fixture')) {
    const file = path.join(f.packagePath, skill.path);
    fs.mkdirSync(path.join(path.dirname(file), 'references'), { recursive: true });
    const body = `---\nname: ${skill.name}\ndescription: Description for ${skill.name}.\n---\nPrivate body for ${skill.name}. Read references/example.md.\n`;
    fs.writeFileSync(file, body);
    fs.writeFileSync(path.join(path.dirname(file), 'references/example.md'), 'Canonical relative fixture.\n');
    contents.set(skill.name, body);
  }
  const profilesFile = path.join(f.packagePath, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
  config.profiles[0].skills = skills.filter(skill => skill.name !== 'disabled-fixture' && skill.name !== 'unavailable-fixture');
  config.profiles[1].skills = skills.filter(skill => skill.name === 'disabled-fixture');
  fs.writeFileSync(profilesFile, JSON.stringify(config));
  const unselected = { id: 'skill:unavailable-fixture', type: 'SKILL', name: 'unavailable-fixture',
    path: 'fixture/skills/unavailable-fixture/SKILL.md', dependencies: [], profiles: [] };
  fs.writeFileSync(path.join(f.packagePath, 'capabilities.json'), JSON.stringify(fixtureCatalog(config, [unselected])));
  const manifestFile = path.join(f.packagePath, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, name: 'slopsentral-fixture', version: '0.0.0',
    pi: { ...manifest.pi, skills: nativeExposure ? ['./fixture/skills'] : [] } }));
  return { ...f, skills, contents };
}

async function managedTool(session, args) {
  const tool = session.extensionRunner.getToolDefinition('slopsentral_skill');
  assert.ok(tool, 'the model route must use the registered native callback');
  return tool.execute('managed-fixture', args, undefined, undefined, session.extensionRunner.createCommandContext());
}

async function withSkillReadLedger(f, run) {
  const original = fs.openSync;
  const reads = [];
  const paths = new Set(f.skills.map(skill => path.join(f.packagePath, skill.path)));
  fs.openSync = function(file, ...args) {
    if (typeof file === 'string' && paths.has(file)) reads.push(file);
    return original.call(this, file, ...args);
  };
  try { return await run(reads); }
  finally { fs.openSync = original; }
}

async function nativeTools(session, modelRuntime, calls) {
  const model = modelRuntime.getModels('openai')[0];
  assert.ok(model, 'the bundled model catalog supplies a fixture identity');
  await modelRuntime.setRuntimeApiKey('openai', 'isolated-fixture-key');
  await session.setModel(model);
  let turn = 0;
  session.agent.streamFunction = () => {
    const content = turn++ === 0 ? calls.map((call, index) => ({ type: 'toolCall', id: `native-${index}`, name: call.name, arguments: call.args }))
      : [{ type: 'text', text: 'Fixture complete.' }];
    const message = { role: 'assistant', content, api: model.api, provider: model.provider, model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: turn === 1 ? 'toolUse' : 'stop', timestamp: Date.now() };
    const stream = new AssistantMessageEventStream();
    stream.push({ type: 'done', reason: message.stopReason, message });
    stream.end();
    return stream;
  };
  await session.prompt('Apply the exact fixture tool calls.');
}

test('managed invocation registers the native model tool', async t => {
  const f = fixture(t, []);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  assert.ok(session.getActiveToolNames().includes('slopsentral_skill'));
  assert.deepEqual(errors, []);
});

test('managed invocation exposes the human skill catalog through the native command', async t => {
  const f = fixture(t, []);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const result = await jsonCommand(session, 'skill');
  assert.equal(result.type, 'skill-catalog');
  assert.deepEqual(result.skills, []);
  assert.deepEqual(errors, []);
});

test('managed invocation uses one resolved plan for catalogs, human commands, and model callbacks', async t => {
  const f = managedSkillsFixture(t);
  const { session, loader, errors } = await host(t, f.packagePath, f.directory);
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.enabled, true);
  assert.equal(state.effective.enabledOrigin, 'defaults');
  assert.equal(typeof state.effective.generation, 'string');
  assert.ok(state.effective.generation.length > 0);
  assert.equal(typeof state.effective.revision, 'string');
  assert.equal(state.package.name, 'slopsentral-fixture');
  assert.equal(state.package.version, '0.0.0');
  assert.equal(typeof state.package.hostVersion, 'string');
  assert.ok(Object.hasOwn(state.package, 'sourceSha'));
  const generation = state.effective.generation;
  const resolved = name => state.effective.capabilities.find(item => item.capability.id === `skill:${name}-fixture`);
  for (const mode of ['human', 'model', 'either']) {
    assert.deepEqual(resolved(mode).binding, { type: 'skill', invocation: mode, origin: 'profile' });
    assert.equal(resolved(mode).resource.type, 'captured');
    assert.equal(resolved(mode).resource.path, path.join(f.packagePath, `fixture/skills/${mode}-fixture/SKILL.md`));
    assert.equal(resolved(mode).resource.digest, crypto.createHash('sha256').update(f.contents.get(`${mode}-fixture`)).digest('hex'));
  }
  assert.equal(resolved('disabled').state, 'disabled');
  assert.equal(resolved('unavailable').state, 'unavailable');
  const human = await jsonCommand(session, 'skill');
  assert.equal(human.generation, generation);
  assert.deepEqual(human.skills.map(skill => [skill.name, skill.invocation]).sort(), [['either-fixture', 'either'], ['human-fixture', 'human']]);
  const unrelated = { name: 'unrelated-fixture', description: 'Unrelated native skill.', filePath: path.join(f.directory, 'unrelated/SKILL.md') };
  fs.mkdirSync(path.dirname(unrelated.filePath));
  fs.writeFileSync(unrelated.filePath, '---\nname: unrelated-fixture\ndescription: Unrelated native fixture.\n---\nUse the unrelated fixture.\n');
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the fixture.' },
    { cwd: f.directory, skills: [...loader.getSkills().skills, unrelated], sections: { existing: 'Existing context.' } });
  assert.deepEqual(prompt.systemPromptOptions.skills.map(skill => skill.name), ['unrelated-fixture']);
  assert.equal(prompt.systemPromptOptions.sections.existing, 'Existing context.');
  const catalog = prompt.systemPromptOptions.sections.slopsentral_skills;
  assert.ok(catalog.includes('model-fixture'));
  assert.ok(catalog.includes('either-fixture'));
  for (const name of ['human-fixture', 'disabled-fixture', 'unavailable-fixture']) assert.equal(catalog.includes(name), false);
  for (const body of f.contents.values()) assert.equal(JSON.stringify(prompt).includes(body), false);
  const expected = {
    human: { human: 'loaded', model: 'FORBIDDEN', either: 'loaded', disabled: 'DISABLED', unavailable: 'UNAVAILABLE', unknown: 'UNKNOWN_SKILL' },
    model: { human: 'FORBIDDEN', model: 'loaded', either: 'loaded', disabled: 'DISABLED', unavailable: 'UNAVAILABLE', unknown: 'UNKNOWN_SKILL' },
  };
  for (const [surface, cases] of Object.entries(expected)) {
    for (const [name, outcome] of Object.entries(cases)) {
      await withSkillReadLedger(f, async reads => {
        const nameWithSuffix = `${name}-fixture`;
        const result = surface === 'human'
          ? await jsonCommand(session, `skill ${nameWithSuffix}`)
          : await managedTool(session, { name: nameWithSuffix, generation });
        const details = surface === 'human' ? result : result.details;
        if (outcome === 'loaded') {
          assert.equal(details.type, 'loaded', `${surface}:${name}`);
          assert.equal(details.name, nameWithSuffix);
          assert.equal(details.generation, generation);
          assert.deepEqual(details.resource, resolved(name).resource);
          assert.equal(details.baseDir, path.dirname(resolved(name).resource.path));
          const content = surface === 'human' ? result.content : result.content.map(part => part.type === 'text' ? part.text : '').join('\n');
          assert.ok(content.includes(`Private body for ${nameWithSuffix}.`));
          assert.ok(content.includes('references/example.md'));
          assert.deepEqual(reads, [resolved(name).resource.path]);
        } else {
          assert.equal(details.type, 'rejected', `${surface}:${name}`);
          assert.equal(details.code, outcome, `${surface}:${name}`);
          assert.deepEqual(reads, [], `${surface}:${name} must reject before the loader reads a body`);
        }
      });
    }
  }
  assert.deepEqual(errors, []);
});

test('managed invocation dispatches the model tool through a real Pi run', async t => {
  const f = managedSkillsFixture(t);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const { generation } = (await jsonCommand(session, 'state')).effective;
  await nativeTools(session, modelRuntime, [
    { name: 'slopsentral_skill', args: { name: 'model-fixture', generation } },
    { name: 'slopsentral_skill', args: { name: 'human-fixture', generation } },
  ]);
  const results = session.messages.filter(message => message.role === 'toolResult' && message.toolName === 'slopsentral_skill');
  assert.equal(results.length, 2);
  assert.equal(results[0].details.type, 'loaded');
  assert.equal(results[0].details.generation, generation);
  assert.equal(results[0].details.baseDir, path.join(f.packagePath, 'fixture/skills/model-fixture'));
  assert.ok(JSON.stringify(results[0].content).includes('Private body for model-fixture.'));
  assert.equal(results[1].isError, true);
  assert.equal(results[1].details.code, 'FORBIDDEN');
  assert.equal(JSON.stringify(results[1]).includes('Private body for human-fixture.'), false);
  assert.deepEqual(errors, []);
});

test('managed invocation rejects forged surfaces, stale generations, and changed resources', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const generation = (await jsonCommand(session, 'state')).effective.generation;
  const definition = session.extensionRunner.getToolDefinition('slopsentral_skill');
  assert.deepEqual(Object.keys(definition.parameters.properties).sort(), ['generation', 'name']);
  assert.deepEqual([...definition.parameters.required].sort(), ['generation', 'name']);
  await withSkillReadLedger(f, async reads => {
    const forged = await managedTool(session, { name: 'human-fixture', generation, origin: 'human' });
    assert.equal(forged.details.code, 'INVALID_REQUEST');
    assert.equal((await managedTool(session, { name: 'model-fixture' })).details.code, 'INVALID_REQUEST');
    assert.equal((await managedTool(session, { name: '../model-fixture', generation })).details.code, 'INVALID_REQUEST');
    const controller = new AbortController();
    controller.abort();
    const aborted = await definition.execute('aborted-fixture', { name: 'model-fixture', generation }, controller.signal,
      undefined, session.extensionRunner.createCommandContext());
    assert.equal(aborted.details.code, 'ABORTED');
    assert.deepEqual(reads, []);
  });
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"skills":{"skill:either-fixture":{"invocation":"human"}}}')).type, 'saved');
  const next = (await jsonCommand(session, 'state')).effective;
  assert.notEqual(next.generation, generation);
  assert.deepEqual(next.capabilities.find(item => item.capability.id === 'skill:either-fixture').binding,
    { type: 'skill', invocation: 'human', origin: 'session' });
  await withSkillReadLedger(f, async reads => {
    const stale = await managedTool(session, { name: 'either-fixture', generation });
    assert.equal(stale.details.code, 'STALE_GENERATION');
    assert.equal((await managedTool(session, { name: 'either-fixture', generation: next.generation })).details.code, 'FORBIDDEN');
    assert.deepEqual(reads, []);
  });
  assert.equal((await jsonCommand(session, 'skill either-fixture')).type, 'loaded');
  const file = path.join(f.packagePath, 'fixture/skills/model-fixture/SKILL.md');
  fs.writeFileSync(file, `${f.contents.get('model-fixture')}Changed after admission.\n`);
  const changed = await managedTool(session, { name: 'model-fixture', generation: next.generation });
  assert.equal(changed.details.code, 'STALE_RESOURCE');
  assert.equal(JSON.stringify(changed).includes('Changed after admission.'), false);
  assert.deepEqual(errors, []);
});

test('managed invocation rejects a stale oversized skill before body bytes load', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const { generation } = (await jsonCommand(session, 'state')).effective;
  const file = path.join(f.packagePath, 'fixture/skills/model-fixture/SKILL.md');
  fs.truncateSync(file, 2 * 1024 * 1024);
  const originalOpen = fs.openSync;
  const originalRead = fs.readSync;
  const descriptors = new Set();
  let bytesRead = 0;
  fs.openSync = function(candidate, ...args) {
    const descriptor = originalOpen.call(this, candidate, ...args);
    if (candidate === file) descriptors.add(descriptor);
    return descriptor;
  };
  fs.readSync = function(descriptor, ...args) {
    const count = originalRead.call(this, descriptor, ...args);
    if (descriptors.has(descriptor)) bytesRead += count;
    return count;
  };
  let result;
  try { result = await managedTool(session, { name: 'model-fixture', generation }); }
  finally { fs.openSync = originalOpen; fs.readSync = originalRead; }
  assert.equal(result.details.code, 'STALE_RESOURCE');
  assert.equal(bytesRead, 0, 'the loader must reject the oversized opened resource before a body read');
  assert.deepEqual(errors, []);
});

test('managed invocation rejects a FIFO replacement without a writer', { timeout: 10000 }, t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(f.packagePath, 'node_modules'), 'dir');
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    import { execFileSync } from 'node:child_process';
    import { AdmittedSkill, captureResources, loadSkill } from ${JSON.stringify(path.join(f.packagePath, 'extensions/skills.ts'))};
    import { resolveSettings } from ${JSON.stringify(path.join(f.packagePath, 'extensions/settings.ts'))};
    const packagePath = process.argv[1];
    const config = JSON.parse(fs.readFileSync(path.join(packagePath, 'profiles.json'), 'utf8'));
    const catalog = JSON.parse(fs.readFileSync(path.join(packagePath, 'capabilities.json'), 'utf8')).capabilities;
    const captured = captureResources(packagePath, catalog);
    const plan = resolveSettings(config, catalog, [], captured.unavailable, captured.resources);
    assert.equal(plan.type, 'effective');
    const admitted = AdmittedSkill.admit(plan, 'model-fixture', 'model', plan.generation);
    assert.ok(admitted instanceof AdmittedSkill);
    fs.rmSync(admitted.resource.path);
    execFileSync('mkfifo', [admitted.resource.path]);
    assert.ok(fs.statSync(admitted.resource.path).isFIFO());
    console.log('FIFO_READY');
    console.log(JSON.stringify(loadSkill(admitted)));
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, f.packagePath],
    { cwd: root, encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  assert.ok(result.stdout.includes('FIFO_READY'), `the isolated FIFO fixture did not reach the loader: ${result.stderr}`);
  assert.equal(result.error, undefined, `the isolated loader did not return: ${result.error?.message}`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').at(-1)), { type: 'rejected', code: 'STALE_RESOURCE' });
});

test('managed invocation blocks owned native skill commands before Pi expansion', async t => {
  const f = managedSkillsFixture(t);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  const before = session.messages.length;
  const commands = session.extensionRunner.getRegisteredCommands().map(command => command.name);
  for (const name of ['human', 'model', 'either', 'disabled', 'unavailable']) {
    assert.ok(commands.includes(`skill:${name}-fixture`));
    await session.prompt(`/skill:${name}-fixture`);
    assert.equal(session.messages.length, before, 'the native spelling must not become ordinary model input');
  }
  assert.equal(notifications.length, 5);
  for (const message of notifications) assert.ok(message.includes('LEGACY_SKILL_ROUTE'));
  assert.equal(commands.includes('skill:unrelated-fixture'), false);
  assert.deepEqual(errors, []);
});

test('managed invocation rejects duplicate native exposure before a managed body loads', async t => {
  const f = managedSkillsFixture(t, { unavailable: false, nativeExposure: true });
  const { session, loader, errors, aborts } = await host(t, f.packagePath, f.directory);
  const native = loader.getSkills().skills;
  assert.ok(native.some(skill => skill.name === 'human-fixture'), 'Pi must discover the duplicate through its real resource loader');
  const before = (await jsonCommand(session, 'state')).effective;
  await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine duplicate native exposure.' }, { cwd: f.directory, skills: native });
  assert.equal(aborts(), 1);
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.effective, before);
  assert.ok(state.errors.includes('DUPLICATE_NATIVE_SKILL'));
  await withSkillReadLedger(f, async reads => {
    const model = await managedTool(session, { name: 'model-fixture', generation: before.generation });
    assert.equal(model.details.code, 'INVALID_PLAN');
    assert.equal((await jsonCommand(session, 'skill human-fixture')).code, 'INVALID_PLAN');
    assert.deepEqual(reads, []);
  });
  assert.deepEqual(errors, []);
});

test('managed invocation rejects a native symlink alias of a human-only skill', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const aliasRoot = path.join(f.directory, 'native-skills');
  fs.mkdirSync(aliasRoot);
  const canonical = path.join(f.packagePath, 'fixture/skills/human-fixture');
  fs.symlinkSync(canonical, path.join(aliasRoot, 'human-fixture'), 'dir');
  const manifestFile = path.join(f.packagePath, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, pi: { ...manifest.pi, skills: ['../native-skills'] } }));
  const { session, loader, errors, aborts } = await host(t, f.packagePath, f.directory);
  const skills = loader.getSkills().skills;
  const alias = skills.find(skill => skill.name === 'human-fixture');
  assert.ok(alias, 'Pi must discover the external directory alias');
  assert.equal(alias.filePath, path.join(aliasRoot, 'human-fixture/SKILL.md'));
  assert.equal(fs.realpathSync(alias.filePath), path.join(canonical, 'SKILL.md'));
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the alias.' },
    { cwd: f.directory, skills });
  assert.equal(aborts(), 1);
  assert.equal(prompt.systemPromptOptions.skills.some(skill => skill.name === 'human-fixture'), false);
  assert.ok((await jsonCommand(session, 'state')).errors.includes('DUPLICATE_NATIVE_SKILL'));
  assert.deepEqual(errors, []);
});

test('managed invocation rejects deleted native resource metadata before a run', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const nativeFile = path.join(f.directory, 'native-skills/unrelated-fixture/SKILL.md');
  fs.mkdirSync(path.dirname(nativeFile), { recursive: true });
  fs.writeFileSync(nativeFile, '---\nname: unrelated-fixture\ndescription: Unrelated native fixture.\n---\nUse the unrelated fixture.\n');
  const manifestFile = path.join(f.packagePath, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, pi: { ...manifest.pi, skills: ['../native-skills'] } }));
  const { session, loader, errors, aborts } = await host(t, f.packagePath, f.directory);
  const skills = loader.getSkills().skills;
  assert.ok(skills.some(skill => skill.filePath === nativeFile));
  const generation = (await jsonCommand(session, 'state')).effective.generation;
  fs.rmSync(nativeFile);
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine deleted native metadata.' },
    { cwd: f.directory, skills });
  assert.equal(aborts(), 1);
  assert.deepEqual(prompt.systemPromptOptions.skills, []);
  assert.ok((await jsonCommand(session, 'state')).errors.includes('NATIVE_RESOURCE_UNAVAILABLE'));
  await withSkillReadLedger(f, async reads => {
    assert.equal((await managedTool(session, { name: 'model-fixture', generation })).details.code, 'INVALID_PLAN');
    assert.deepEqual(reads, []);
  });
  assert.deepEqual(errors, []);
});

test('managed invocation changes generation when a branch restores identical profile content', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const { session, errors } = await host(t, f.packagePath, f.directory);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"profile":"fixture"}')).type, 'saved');
  const before = (await jsonCommand(session, 'state')).effective;
  const anchor = session.sessionManager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === 'slopsentral-profile');
  assert.ok(anchor);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"profile":"fixture"}')).type, 'saved');
  const intermediate = (await jsonCommand(session, 'state')).effective;
  session.sessionManager.branch(anchor.id);
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: anchor.id, oldLeafId: undefined, fromExtension: true });
  const restored = (await jsonCommand(session, 'state')).effective;
  assert.equal(restored.profile, before.profile);
  assert.equal(restored.revision, before.revision);
  assert.notEqual(restored.generation, before.generation);
  assert.notEqual(restored.generation, intermediate.generation);
  await withSkillReadLedger(f, async reads => {
    assert.equal((await managedTool(session, { name: 'model-fixture', generation: before.generation })).details.code, 'STALE_GENERATION');
    assert.deepEqual(reads, []);
  });
  assert.equal((await managedTool(session, { name: 'model-fixture', generation: restored.generation })).details.type, 'loaded');
  assert.deepEqual(errors, []);
});

test('managed profile rejects an incomplete first plan before hooks and skill loads', async t => {
  const action = { name: 'fixture-effect', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  const ledger = path.join(f.directory, 'initial-effect');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ledger)},'ran');console.log('{}');`);
  const profilesFile = path.join(f.packagePath, 'profiles.json');
  const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
  const missing = { name: 'missing-fixture', path: 'fixture/skills/missing-fixture/SKILL.md' };
  profiles.profiles[0].skills.push(missing);
  fs.writeFileSync(profilesFile, JSON.stringify(profiles));
  const { session, errors, aborts } = await host(t, f.packagePath, f.directory);
  assert.equal((await jsonCommand(session, 'state')).effective.type, 'rejected');
  await withSkillReadLedger({ ...f, skills: [missing] }, async reads => {
    assert.equal((await jsonCommand(session, 'skill missing-fixture')).code, 'INVALID_PLAN');
    assert.equal((await managedTool(session, { name: 'missing-fixture', generation: 'unadmitted' })).details.code, 'INVALID_PLAN');
    assert.deepEqual(reads, []);
  });
  assert.deepEqual(await session.extensionRunner.emitInput('A request needs a complete plan.', undefined, 'interactive'), { action: 'handled' });
  await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'A request needs a complete plan.' }, { cwd: f.directory, skills: [] });
  assert.equal(aborts(), 1);
  assert.equal(fs.existsSync(ledger), false);
  const file = path.join(f.packagePath, missing.path);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '---\nname: missing-fixture\ndescription: Repaired fixture.\n---\nUse the repaired canonical body.\n');
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1}')).type, 'saved');
  assert.equal((await jsonCommand(session, 'skill missing-fixture')).type, 'loaded');
  assert.equal(fs.existsSync(ledger), false);
  assert.deepEqual(errors, []);
});

test('managed profile migrates off to none with explicit overrides and keeps an invalid replacement inactive', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const { session, errors } = await host(t, f.packagePath, f.directory);
  assert.equal((await jsonCommand(session, 'set user {"schemaVersion":1,"capabilities":{"skill:disabled-fixture":true}}')).type, 'saved');
  await session.prompt('/slopsentral-profile off');
  const empty = await jsonCommand(session, 'state');
  assert.equal(empty.effective.profile, 'none');
  assert.ok(empty.effective.migrations.includes('off → none: explicit overrides remain'));
  const override = empty.effective.capabilities.find(item => item.capability.id === 'skill:disabled-fixture');
  assert.equal(override.state, 'enabled');
  assert.equal(override.origin, 'user');
  assert.equal((await jsonCommand(session, 'skill disabled-fixture')).type, 'loaded');
  const invalid = await jsonCommand(session, 'set session {"schemaVersion":1,"profile":"missing-profile"}');
  assert.equal(invalid.type, 'rejected');
  assert.deepEqual((await jsonCommand(session, 'state')).effective, empty.effective);
  const missing = {
    schemaVersion: 1,
    additions: [{ id: 'skill:missing-local', type: 'SKILL', name: 'missing-local', path: 'missing/SKILL.md', dependencies: [], profiles: [] }],
  };
  assert.equal((await jsonCommand(session, `set session ${JSON.stringify(missing)}`)).type, 'rejected');
  assert.deepEqual((await jsonCommand(session, 'state')).effective, empty.effective);
  assert.deepEqual(errors, []);
});

test('managed local additions release unrelated native command names after removal', async t => {
  const f = fixture(t, []);
  const file = path.join(f.directory, 'local-route/SKILL.md');
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, '---\nname: local-route\ndescription: Unrelated native fixture.\n---\nNative instructions remain available.\n');
  fs.writeFileSync(path.join(f.packagePath, 'package.json'), JSON.stringify({ type: 'module', pi: { extensions: ['./extensions/slopsentral.ts'], skills: ['../local-route'] } }));
  const { session, modelRuntime, loader, errors } = await host(t, f.packagePath, f.directory);
  assert.ok(loader.getSkills().skills.some(skill => skill.name === 'local-route'));
  await nativeTools(session, modelRuntime, []);
  const settings = { schemaVersion: 1, additions: [{ id: 'skill:local-route', type: 'SKILL', name: 'local-route', path: file, dependencies: [], profiles: [] }] };
  assert.equal((await jsonCommand(session, `set session ${JSON.stringify(settings)}`)).type, 'saved');
  assert.deepEqual(await session.extensionRunner.emitInput('/skill:local-route', undefined, 'interactive'), { action: 'handled' });
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1}')).type, 'saved');
  assert.equal(session.extensionRunner.getCommand('skill:local-route'), undefined);
  assert.deepEqual(await session.extensionRunner.emitInput('/skill:local-route', undefined, 'interactive'), { action: 'continue' });
  await session.prompt('/skill:local-route');
  const user = session.messages.findLast(message => message.role === 'user');
  assert.ok(JSON.stringify(user.content).includes('Native instructions remain available.'));
  assert.deepEqual(errors, []);
});

test('managed profile preview resolves a candidate without effects or activation', async t => {
  const action = { name: 'fixture-effect', event: 'SessionStart', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  const ledger = path.join(f.directory, 'preview-effect');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ledger)},'ran');console.log('{}');`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const before = await jsonCommand(session, 'state');
  const branch = session.sessionManager.getBranch();
  const result = await jsonCommand(session, 'preview session {"schemaVersion":1,"enabled":false}');
  assert.equal(result.type, 'preview');
  assert.equal(result.effective.enabled, false);
  assert.equal(result.effective.enabledOrigin, 'session');
  assert.ok(result.effective.generation.startsWith('preview:'));
  const after = await jsonCommand(session, 'state');
  assert.deepEqual(after.effective, before.effective);
  assert.deepEqual(after.journal, before.journal);
  assert.deepEqual(session.sessionManager.getBranch(), branch);
  assert.equal(fs.existsSync(path.join(f.directory, '.pi/slopsentral.json')), false);
  assert.equal(fs.existsSync(ledger), false);
  const missing = { schemaVersion: 1, additions: [{ id: 'skill:missing-preview', type: 'SKILL', name: 'missing-preview',
    path: 'missing-preview/SKILL.md', profiles: [], dependencies: [] }] };
  assert.equal((await jsonCommand(session, `preview project ${JSON.stringify(missing)}`)).type, 'rejected');
  assert.deepEqual((await jsonCommand(session, 'state')).effective, before.effective);
  assert.deepEqual(session.sessionManager.getBranch(), branch);
  assert.equal(fs.existsSync(path.join(f.directory, '.pi/slopsentral.json')), false);
  assert.equal(fs.existsSync(ledger), false);
  assert.deepEqual(errors, []);
});

test('managed disabled state stops automatic effects and collection with an explicit journal gap', async t => {
  const action = { name: 'fixture-effect', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = managedSkillsFixture(t, { unavailable: false });
  const profilesFile = path.join(f.packagePath, 'profiles.json');
  const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
  profiles.profiles[0].hooks = [action, { ...action, event: 'Stop' }];
  profiles.profiles[0].hookPolicy = 'ADVISORY';
  fs.writeFileSync(profilesFile, JSON.stringify(profiles));
  const oldCatalog = JSON.parse(fs.readFileSync(path.join(f.packagePath, 'capabilities.json'), 'utf8'));
  fs.writeFileSync(path.join(f.packagePath, 'capabilities.json'), JSON.stringify(fixtureCatalog(profiles,
    oldCatalog.capabilities.filter(capability => capability.profiles.length === 0))));
  const ledger = path.join(f.directory, 'effects');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(ledger)},'effect\\n');console.log('{}');`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  await jsonCommand(session, 'state');
  await jsonCommand(session, 'skill');
  assert.equal(fs.existsSync(ledger), false, 'inspection must not run hooks');
  await session.extensionRunner.emitInput('First input.', undefined, 'interactive');
  assert.equal(fs.readFileSync(ledger, 'utf8'), 'effect\n');
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'before-disable', args: { path: 'before.txt' } });
  const before = (await jsonCommand(session, 'state')).journal;
  assert.deepEqual(before.pending, ['before.txt']);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"enabled":false}')).type, 'saved');
  const disabled = await jsonCommand(session, 'state');
  assert.equal(disabled.effective.enabled, false);
  assert.equal(disabled.effective.enabledOrigin, 'session');
  assert.deepEqual(disabled.journal.pending, before.pending);
  assert.ok(disabled.journal.gaps.includes('COLLECTION_DISABLED'));
  assert.deepEqual((await jsonCommand(session, 'skill')).skills, []);
  await withSkillReadLedger(f, async reads => {
    assert.equal((await jsonCommand(session, 'skill either-fixture')).code, 'DISABLED');
    const model = await managedTool(session, { name: 'either-fixture', generation: disabled.effective.generation });
    assert.equal(model.details.code, 'DISABLED');
    assert.deepEqual(reads, []);
  });
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'after-disable', args: { path: 'after.txt' } });
  assert.deepEqual(await session.extensionRunner.emitInput('Input while disabled.', undefined, 'interactive'), { action: 'continue' });
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Input while disabled.' }, { cwd: f.directory, skills: [] });
  assert.equal(prompt.systemPromptOptions.sections.slopsentral, undefined);
  assert.equal(prompt.systemPromptOptions.sections.slopsentral_skills, undefined);
  await session.extensionRunner.emit({ type: 'agent_settled', aborted: false });
  const settled = await afterJobs(session);
  assert.deepEqual(settled.journal, disabled.journal);
  assert.equal(fs.readFileSync(ledger, 'utf8'), 'effect\n');
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  const restored = await jsonCommand(session, 'state');
  assert.equal(restored.effective.enabled, false);
  assert.deepEqual(restored.journal, disabled.journal);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"enabled":true}')).type, 'saved');
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'after-enable', args: { path: 'resumed.txt' } });
  const resumed = await jsonCommand(session, 'state');
  assert.deepEqual(resumed.journal.pending, ['before.txt', 'resumed.txt']);
  assert.ok(resumed.journal.gaps.includes('COLLECTION_DISABLED'));
  assert.deepEqual(errors, []);
});

test('managed disabled state rejects a review that erases its ongoing collection gap', async t => {
  const f = managedSkillsFixture(t, { unavailable: false });
  const { session, errors } = await host(t, f.packagePath, f.directory);
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'pending-review', args: { path: 'before.txt' } });
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"enabled":false}')).type, 'saved');
  const before = (await jsonCommand(session, 'state')).journal;
  assert.deepEqual(before.pending, ['before.txt']);
  assert.ok(before.gaps.includes('COLLECTION_DISABLED'));
  const review = await jsonCommand(session, 'review The prior paths still use the root instructions.');
  assert.deepEqual(review, { type: 'rejected', code: 'COLLECTION_DISABLED' });
  assert.deepEqual((await jsonCommand(session, 'state')).journal, before);
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'disabled-review', args: { path: 'during-disabled.txt' } });
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"enabled":true}')).type, 'saved');
  const resumed = (await jsonCommand(session, 'state')).journal;
  assert.deepEqual(resumed.pending, ['before.txt']);
  assert.ok(resumed.gaps.includes('COLLECTION_DISABLED'));
  assert.deepEqual(errors, []);
});

test('native mutation path batches first-run edits with zero per-tool subprocesses and no Git', { timeout: 15000 }, async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: ['uv', 'run', '--locked', '--script', 'hooks/agents-md-scope.py'], timeout: 5 };
  const f = fixture(t, ['UserPromptSubmit', 'PostToolUse', 'Stop'].map(event => ({ ...action, event })), 'ADVISORY');
  fs.copyFileSync(path.join(root, 'source/hooks/agents-md-scope.py'), path.join(f.packagePath, 'fixture/hooks/agents-md-scope.py'));
  fs.copyFileSync(path.join(root, 'source/hooks/agents-md-scope.py.lock'), path.join(f.packagePath, 'fixture/hooks/agents-md-scope.py.lock'));
  fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Use fixture rules.\n');
  const bin = path.join(f.directory, 'bin'); fs.mkdirSync(bin);
  const gitLedger = path.join(f.directory, 'git-called');
  const hookLedger = path.join(f.directory, 'hook-called');
  const realUv = execFileSync('which', ['uv'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\necho called >> '${gitLedger}'\nexit 99\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'uv'), `#!/bin/sh\necho called >> '${hookLedger}'\nexec '${realUv}' "$@"\n`, { mode: 0o755 });
  const previousPath = process.env.PATH;
  process.env.PATH = bin + path.delimiter + previousPath;
  t.after(() => { process.env.PATH = previousPath; });
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  const countsDuringTools = [];
  session.subscribe(event => { if (event.type === 'tool_execution_end') countsDuringTools.push(fs.existsSync(hookLedger) ? fs.readFileSync(hookLedger, 'utf8').trim().split('\n').length : 0); });
  await nativeTools(session, modelRuntime, [
    { name: 'write', args: { path: 'module/new.py', content: 'first\n' } },
    { name: 'edit', args: { path: 'module/new.py', oldText: 'first', newText: 'second' } },
  ]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'module/new.py'), 'utf8'), 'second\n');
  assert.deepEqual(countsDuringTools, [0, 0]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('background assessment did not deliver')), 5000);
    const poll = () => notices.some(message => message.includes('module/new.py')) ? (clearTimeout(timer), resolve()) : setTimeout(poll, 10);
    poll();
  });
  assert.equal(fs.readFileSync(hookLedger, 'utf8').trim().split('\n').length, 1);
  assert.equal(fs.existsSync(gitLedger), false);
  const state = session.sessionManager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === 'slopsentral-mutations');
  assert.deepEqual(state.data.pending, ['module/new.py']);
  assert.deepEqual(errors, []);
});

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
    assert.equal(result, undefined, 'hook context preserves the original visible receipt');
    if (mode !== 'OFF') assert.ok((await session.extensionRunner.emitContext([])).some(message => message.customType === 'slopsentral-tool-hooks' && message.content.includes('controlled PostToolUse rejection')));
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
  await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine source changes' }, { cwd: f.directory });
  assert.ok((await session.extensionRunner.emitContext([])).some(message => message.content.includes('UserPromptSubmit scope guidance')));
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message'), false);
  const original = { type: 'tool_result', toolName: 'custom_probe', toolCallId: 'probe-1', input: {}, content: [{ type: 'text', text: 'Original tool evidence' }], details: { receipt: 7 }, structuredContent: { state: 'recorded' }, isError: true, usage: { input: 1, output: 2 } };
  const result = await session.extensionRunner.emitToolResult(original) ?? original;
  assert.deepEqual(result.content, original.content);
  assert.ok((await session.extensionRunner.emitContext([])).some(message => message.customType === 'slopsentral-tool-hooks' && message.content.includes('PostToolUse scope guidance')));
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
    await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: text, images }, { cwd: f.directory });
    const entry = (await session.extensionRunner.emitContext([])).find(e => e.role === 'custom' && e.customType === 'slopsentral-prompt-hooks');
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
  assert.deepEqual(notifications, [], 'shutdown suppresses late reports from the cancelled lifecycle');
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom' && entry.customType === 'slopsentral-stop-continuation'), false);
  assert.deepEqual(errors, []);
});

test('photographed prompts never add keyword hints or expose guidance outside the selected profile', async t => {
  const f = fixture(t, []);
  const configPath = path.join(f.packagePath, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const instructions = ['engineering-design', 'kotlin-engineering'].map(name => ({ name, path: `fixture/instructions/${name}.md` }));
  const tdd = { name: 'tdd', path: 'fixture/skills/tdd/SKILL.md' };
  fs.mkdirSync(path.join(f.packagePath, 'fixture/skills/tdd'), { recursive: true });
  fs.writeFileSync(path.join(f.packagePath, tdd.path), '---\nname: tdd\ndescription: Fixture\n---\nFixture criteria.');
  fs.mkdirSync(path.join(f.packagePath, 'fixture/instructions'));
  for (const ref of instructions) fs.writeFileSync(path.join(f.packagePath, ref.path), `# ${ref.name}\nControlled canonical policy.`);
  config.profiles.push({ ...config.profiles[0], name: 'catalog', instructions, skills: [tdd], hookPolicy: 'OFF' });
  fs.writeFileSync(configPath, JSON.stringify(config));
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const tools = session.getActiveToolNames();
  const hints = () => session.sessionManager.getBranch().filter(e => e.type === 'custom_message' && e.customType === 'slopsentral-guidance');
  for (const text of ['test', 'What does the word test mean?', 'Please do not publish or push anything.',
    'Write an assertion for this behavior', 'Add regression coverage for this behavior',
    '> External text: Kotlin tests; publish everything', '`test`', 'Explain Kotlin', 'Explain Kotlin']) {
    assert.deepEqual(await session.extensionRunner.emitInput(text, undefined, 'interactive'), { action: 'continue' });
    assert.deepEqual(hints(), [], text);
    const result = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: text },
      { cwd: f.directory, skills: [] });
    assert.deepEqual(result.systemPromptOptions.skills, [], text);
    assert.equal(JSON.stringify(result).includes('kotlin-engineering.md'), false, text);
  }
  assert.deepEqual(session.getActiveToolNames(), tools);
  assert.equal(session.sessionManager.getBranch().findLast(e => e.type === 'custom' && e.customType === 'slopsentral-profile').data, 'fixture');
  await session.prompt('/slopsentral-profile off');
  await session.extensionRunner.emitInput('Kotlin', undefined, 'interactive');
  assert.deepEqual(hints(), []);
  await session.prompt('/slopsentral-profile catalog');
  await session.extensionRunner.emitInput('Kotlin', undefined, 'interactive');
  assert.deepEqual(hints(), []);
  for (let index = 0; index < 2; index++) {
    const result = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Kotlin' },
      { cwd: f.directory, skills: [] });
    assert.equal(result.systemPromptOptions.sections.slopsentral.split('# engineering-design').length, 2);
    assert.deepEqual(result.systemPromptOptions.skills, []);
    assert.ok(result.systemPromptOptions.sections.slopsentral_skills.includes('tdd'));
  }
  assert.deepEqual(errors, []);
});

test('accepted prompt context reaches one native run without persistent or rejected-input hints', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify(p.prompt==='reject test'?{decision:'block',reason:'controlled rejection'}:{hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'accepted context: '+p.prompt}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const runner = session.extensionRunner;
  const start = prompt => runner.emitBeforeAgentStart({ messageType: 'user', prompt }, { cwd: f.directory });
  const user = { role: 'user', content: 'original user evidence', timestamp: 1 };
  const context = () => runner.emitContext([user]);
  const entries = () => session.sessionManager.getBranch().filter(e => e.type === 'custom_message');
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(await runner.emitInput('accept test', undefined, 'rpc'), { action: 'continue' });
    await start('accept test');
    const messages = await context();
    assert.deepEqual(messages[0], user);
    assert.equal(messages.length, 2);
    assert.equal(messages[1].content, 'accepted context: accept test');
    assert.deepEqual(entries(), []);
  }
  await runner.emit({ type: 'agent_settled', messages: [] });
  assert.deepEqual(await context(), [user]);
  assert.deepEqual(await runner.emitInput('reject test', undefined, 'rpc'), { action: 'handled' });
  await start('reject test');
  assert.deepEqual(await context(), [user]);
  assert.deepEqual(entries(), []);
  for (const reset of [
    () => session.prompt('/slopsentral-profile second'),
    () => runner.emit({ type: 'session_start', reason: 'resume' }),
    () => runner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true }),
  ]) {
    await runner.emitInput('accept test', undefined, 'interactive');
    await reset();
    await start('accept test');
    assert.deepEqual(await context(), [user]);
  }
  await runner.emitInput('accept test', undefined, 'interactive');
  await start('different prompt after another extension');
  assert.deepEqual(await context(), [user]);
  const legacy = ['slopsentral-guidance', 'slopsentral-prompt-hooks'].map(customType => ({ role: 'custom', customType, content: 'legacy hidden hint', display: false, timestamp: 1 }));
  const unrelated = { ...legacy[0], customType: 'unrelated-extension' };
  assert.deepEqual(await runner.emitContext([...legacy, user, unrelated]), [user, unrelated]);
  assert.deepEqual(errors, []);
});

test('session restoration during a native prompt hook rejects its late context', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(ready)},'ready'); const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'stale context'}}));}},10);`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const entered = new Promise((resolve, reject) => {
    const watcher = fs.watch(f.directory, () => { if (fs.existsSync(ready)) { clearTimeout(timer); watcher.close(); resolve(); } });
    const timer = setTimeout(() => { watcher.close(); reject(new Error('prompt hook did not start')); }, 3000);
    t.after(() => { clearTimeout(timer); watcher.close(); });
  });
  const pending = session.extensionRunner.emitInput('accept', undefined, 'rpc');
  await entered;
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true });
  fs.writeFileSync(release, 'release');
  assert.deepEqual(await pending, { action: 'handled' });
  await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'accept' }, { cwd: f.directory });
  assert.deepEqual(await session.extensionRunner.emitContext([]), []);
  assert.deepEqual(errors, []);
});

test('session restoration during native startup cannot restore accepted prompt context', async t => {
  const actions = ['UserPromptSubmit', 'SessionStart'].map(event => ({ name: 'gate', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 }));
  const f = fixture(t, actions);
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));if(p.hook_event_name==='UserPromptSubmit'){console.log(JSON.stringify({hookSpecificOutput:{hookEventName:p.hook_event_name,additionalContext:'stale accepted context'}}));}else{fs.writeFileSync(${JSON.stringify(ready)},'ready');const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log('{}');}},10);}`);
  const { session, errors, aborts } = await host(t, f.packagePath, f.directory);
  await session.extensionRunner.emitInput('accept', undefined, 'rpc');
  const entered = new Promise((resolve, reject) => {
    const watcher = fs.watch(f.directory, () => { if (fs.existsSync(ready)) { clearTimeout(timer); watcher.close(); resolve(); } });
    const timer = setTimeout(() => { watcher.close(); reject(new Error('startup hook did not start')); }, 3000);
    t.after(() => { clearTimeout(timer); watcher.close(); });
  });
  const pending = session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'accept' }, { cwd: f.directory });
  await entered;
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true });
  fs.writeFileSync(release, 'release');
  await pending;
  assert.deepEqual(await session.extensionRunner.emitContext([]), []);
  assert.equal(aborts(), 1);
  assert.deepEqual(errors, []);
});

test('native steering and follow-up keep context until the accepted input reaches a request', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({hookSpecificOutput:{hookEventName:p.hook_event_name,additionalContext:'context for '+p.prompt}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const runner = session.extensionRunner;
  const original = { role: 'user', content: 'original', timestamp: 1 };
  await runner.emitInput('original', undefined, 'rpc');
  session.sessionManager.appendMessage(original);
  await runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'original' }, { cwd: f.directory });
  let messages = [original];
  let expected = 'context for original';
  for (const method of ['steer', 'followUp']) {
    assert.equal(await session[method]('queued '+method, undefined, { source: 'rpc' }), 'queued');
    assert.equal((await runner.emitContext(messages)).at(-1).content, expected, 'a queued input must not erase or precede active context');
    const delivered = { role: 'user', content: 'queued '+method, timestamp: 2 };
    session.sessionManager.appendMessage(delivered);
    messages = [...messages, delivered];
    expected = 'context for queued '+method;
    assert.equal((await runner.emitContext(messages)).at(-1).content, expected);
    assert.equal(session.sessionManager.getBranch().some(e => e.type === 'custom_message'), false);
  }
  assert.deepEqual(errors, []);
});

test('failed native write preserves changed instructions, review obligations, and original error', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: ['uv', 'run', '--locked', '--script', 'hooks/agents-md-scope.py'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  for (const name of ['agents-md-scope.py', 'agents-md-scope.py.lock']) fs.copyFileSync(path.join(root, 'source/hooks', name), path.join(f.packagePath, 'fixture/hooks', name));
  const writer = createWriteToolDefinition(f.directory, { operations: {
    mkdir: async directory => fs.mkdirSync(directory, { recursive: true }),
    writeFile: async (file, content) => { fs.writeFileSync(file, content); throw new Error('Fixture failure after mutation'); },
  } });
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory, undefined, path.join(f.directory, 'agent'), [writer]);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'AGENTS.md', content: 'Use the changed fixture command.\n' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'AGENTS.md'), 'utf8'), 'Use the changed fixture command.\n');
  const result = session.messages.findLast(message => message.role === 'toolResult');
  assert.equal(result.isError, true);
  assert.ok(result.content.some(part => part.text?.includes('Fixture failure after mutation')));
  assert.ok(result.content.some(part => part.text?.includes('Current instructions from "AGENTS.md"') && part.text.includes('Use the changed fixture command.')));
  await until(() => notices.some(message => message.includes('scope review')), 'failed mutation assessment');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['AGENTS.md']);
  assert.equal(state.journal.assessedRevision, state.journal.revision);
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  assert.deepEqual((await jsonCommand(session, 'state')).journal.pending, ['AGENTS.md']);
  assert.deepEqual(errors, []);
});

test('native nested calls and explicit mutation adapters preserve instruction deletion evidence', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: ['uv', 'run', '--locked', '--script', 'hooks/agents-md-scope.py'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  for (const name of ['agents-md-scope.py', 'agents-md-scope.py.lock']) fs.copyFileSync(path.join(root, 'source/hooks', name), path.join(f.packagePath, 'fixture/hooks', name));
  const { Type } = await import('typebox');
  const parameters = Type.Object({ path: Type.String() });
  const tools = [
    { name: 'erase', label: 'erase', description: 'Fixture removal', parameters,
      execute: async (_id, args) => { fs.unlinkSync(path.join(f.directory, args.path)); throw new Error('Fixture failure after deletion'); } },
    { name: 'nested', label: 'nested', description: 'Fixture nested write', parameters,
      execute: async (_id, args, signal, _update, ctx) => ctx.executeTool('write', { path: args.path, content: 'nested source\n' }, { signal }) },
  ];
  fs.mkdirSync(path.join(f.directory, 'module'));
  fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Use root rules.\n');
  fs.writeFileSync(path.join(f.directory, 'module/AGENTS.md'), 'Use module rules.\n');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory, undefined, path.join(f.directory, 'agent'), tools);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"mutationAdapters":{"erase":["path"],"nested":["path"]}}')).type, 'saved');
  await nativeTools(session, modelRuntime, [
    { name: 'nested', args: { path: 'module/new.py' } },
    { name: 'erase', args: { path: 'module/AGENTS.md' } },
  ]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'module/new.py'), 'utf8'), 'nested source\n');
  assert.equal(fs.existsSync(path.join(f.directory, 'module/AGENTS.md')), false);
  const deletion = session.messages.find(message => message.role === 'toolResult' && message.toolName === 'erase');
  assert.equal(deletion.isError, true);
  assert.ok(deletion.content.some(part => part.text?.includes('was deleted')));
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['module/AGENTS.md', 'module/new.py']);
  assert.deepEqual(state.journal.gaps, []);
  assert.deepEqual(errors, []);
});

test('read-only native runs launch no scope process and shell changes expose a coverage gap', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  const ledger = path.join(f.directory, 'calls');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(ledger)},'ran\n');console.log('{}');`);
  fs.writeFileSync(path.join(f.directory, 'read.txt'), 'fixture');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  await nativeTools(session, modelRuntime, [{ name: 'read', args: { path: 'read.txt' } }]);
  assert.equal(fs.existsSync(ledger), false);
  await nativeTools(session, modelRuntime, [{ name: 'bash', args: { command: "printf 'fixture' > shell-file.txt" } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'shell-file.txt'), 'utf8'), 'fixture');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, []);
  assert.ok(state.journal.gaps.includes('UNSUPPORTED_TOOL: bash'));
  assert.ok(state.coverage[0].includes('external edits'));
  assert.deepEqual(errors, []);
});

function barrierHook(f) {
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  const exited = path.join(f.directory, 'exited');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);fs.writeFileSync(${JSON.stringify(exited)},'completed');console.log(JSON.stringify({systemMessage:'barrier released'}));}},5);`);
  return { ready, release, exited };
}

test('native background hooks do not delay settlement or lose distinct prompt obligations', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  const barrier = barrierHook(f);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"report","output":{"type":"ALWAYS"},"context":"none"}}}')).type, 'saved');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'first.txt', content: 'first' } }]);
  await until(() => fs.existsSync(barrier.ready), 'background admission');
  assert.equal(fs.existsSync(barrier.exited), false, 'the first native run returned before release');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'second.txt', content: 'second' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'second.txt'), 'utf8'), 'second');
  assert.equal(fs.existsSync(barrier.exited), false, 'the second native run also returned before release');
  assert.equal((await jsonCommand(session, 'state')).jobs.length, 2);
  fs.writeFileSync(barrier.release, 'release');
  await until(() => notices.filter(message => message.includes('barrier released')).length === 2, 'both background deliveries');
  assert.equal((await afterJobs(session)).recent.length, 2);
  assert.deepEqual(errors, []);
});

for (const transition of ['configuration', 'session-tree', 'external-branch', 'cancellation']) test(`native background results cannot cross ${transition}`, async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  if (transition === 'external-branch') { fs.mkdirSync(path.join(f.directory, '.git')); fs.writeFileSync(path.join(f.directory, '.git/HEAD'), 'ref: refs/heads/first\n'); }
  const barrier = barrierHook(f);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"report","output":{"type":"ALWAYS"},"context":"none"}}}');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'pending.txt', content: 'pending' } }]);
  await until(() => fs.existsSync(barrier.ready), 'background barrier');
  const pid = Number(fs.readFileSync(barrier.ready, 'utf8'));
  if (transition === 'configuration') await jsonCommand(session, 'set session {"schemaVersion":1,"capabilities":{"hook:gate":false}}');
  if (transition === 'session-tree') await session.extensionRunner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true });
  if (transition === 'external-branch') fs.writeFileSync(path.join(f.directory, '.git/HEAD'), 'ref: refs/heads/other\n');
  if (transition === 'cancellation') {
    const key = (await jsonCommand(session, 'state')).jobs[0];
    assert.ok(key);
    assert.equal((await jsonCommand(session, `cancel ${key}`)).type, 'cancellation-requested');
  }
  fs.writeFileSync(barrier.release, 'release');
  await until(() => { try { process.kill(pid, 0); return false; } catch (error) { if (error.code !== 'ESRCH') throw error; return true; } }, 'stale job exit');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['pending.txt']);
  assert.deepEqual(state.recent, []);
  assert.equal(notices.some(message => message.includes('barrier released')), false);
  assert.deepEqual(errors, []);
});

test('native SettingsList saves a hook toggle, restores the branch, and changes real tool permission', async t => {
  const action = { name: 'gate', event: 'PreToolUse', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], matcher: '^write$', timeout: 5 };
  const f = fixture(t, [action]);
  const configFile = path.join(f.packagePath, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.profiles[0].instructions.push({ name: 'missing', path: 'fixture/missing.md' });
  fs.writeFileSync(configFile, JSON.stringify(config));
  fs.writeFileSync(path.join(f.packagePath, 'fixture/missing.md'), 'Use the repaired fixture instructions.\n');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const importedTerminal = await tsImport('./fixtures/pi-virtual-terminal.ts', import.meta.url);
  const { VirtualTerminal } = importedTerminal.default ?? importedTerminal;
  initTheme('dark');
  const terminal = new VirtualTerminal(60, 18);
  const tui = new TuiMainScreen(terminal, true);
  const editor = new Input();
  tui.addChild(editor); tui.setFocus(editor); tui.start();
  t.after(() => tui.stop());
  let component;
  let closed = false;
  const ui = session.extensionRunner.createCommandContext().ui;
  session.extensionRunner.setUIContext({ ...ui, notify: () => {}, setStatus: () => {}, custom: factory => new Promise(resolve => {
    component = factory(tui, ui.theme, {}, value => {
      tui.removeChild(component); tui.addChild(editor); tui.setFocus(editor); tui.requestRender(); closed = true; resolve(value);
    });
    tui.removeChild(editor); tui.addChild(component); tui.setFocus(component); tui.requestRender();
  }) }, 'tui');
  const pending = session.prompt('/slopsentral');
  await until(() => component !== undefined, 'native menu');
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('Save scope')));
  terminal.sendInput('\x1b[B'); terminal.sendInput('\r'); // Save scope: session -> project.
  for (const character of 'Hooks') terminal.sendInput(character);
  terminal.sendInput('\r'); // Open the hook picker.
  terminal.sendInput('\r'); // Configure gate.
  terminal.sendInput('\r'); // Enabled: on -> off.
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('off')));
  const saved = JSON.parse(fs.readFileSync(path.join(f.directory, '.pi/slopsentral.json'), 'utf8'));
  assert.deepEqual(saved.capabilities, { 'hook:gate': false });
  for (const character of 'Execution') terminal.sendInput(character);
  terminal.sendInput('\r');
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('INVALID_SETTINGS')));
  terminal.sendInput('\x15');
  for (const character of 'Exclude regex') terminal.sendInput(character);
  terminal.sendInput('\r'); terminal.sendInput('['); terminal.sendInput('\r');
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('INVALID_SETTINGS')));
  terminal.sendInput('\x15'); terminal.sendInput('^benign:'); terminal.sendInput('\r');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, '.pi/slopsentral.json'), 'utf8')).hooks['hook:gate'].output.pattern, '^benign:');
  terminal.sendInput('\x15');
  terminal.resize(26, 10); tui.requestRender();
  await terminal.waitForRender();
  for (const line of component.render(26)) assert.ok(visibleWidth(line) <= 26);
  terminal.sendInput('\x1b'); // Return to hook picker.
  terminal.sendInput('\x1b'); // Return to main menu.
  terminal.sendInput('\x1b'); // Close the main menu with its search intact.
  await pending;
  assert.equal(closed, true);
  terminal.sendInput('restored-focus');
  assert.equal(editor.getValue(), 'restored-focus');
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'allowed.txt', content: 'allowed' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'allowed.txt'), 'utf8'), 'allowed');
  session.extensionRunner.setUIContext({ notify: () => {}, setStatus: () => {} }, 'print');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'hook:gate').origin, 'project');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:missing').state, 'enabled');
  assert.equal((await jsonCommand(session, 'set project {"schemaVersion":1,"capabilities":{"hook:gate":true}}')).type, 'saved');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'blocked.txt', content: 'must not appear' } }]);
  assert.equal(fs.existsSync(path.join(f.directory, 'blocked.txt')), false);
  assert.equal(session.messages.findLast(message => message.role === 'toolResult').isError, true);
  assert.deepEqual(errors, []);
});

test('output suppression preserves blocking decisions and routes structured context outside the tool receipt', async t => {
  const hooks = ['PreToolUse', 'PostToolUse', 'Stop'].map(event => ({ name: 'gate', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 }));
  const f = fixture(t, hooks);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(p.hook_event_name==='PostToolUse'?{hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:'private hook context'}}:{decision:'block',reason:'controlled denial'}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"foreground","critical":"blocking","output":{"type":"NEVER"},"context":"structured"}}}');
  const call = { type: 'tool_call', toolName: 'write', toolCallId: 'hidden-1', input: { path: 'file.txt' } };
  assert.equal((await session.extensionRunner.emitToolCall(call)).block, true);
  const original = { type: 'tool_result', toolName: 'write', toolCallId: 'hidden-1', input: call.input, content: [{ type: 'text', text: 'original evidence' }], details: { receipt: 1 }, isError: false, structuredContent: { original: true } };
  const result = await session.extensionRunner.emitToolResult(original) ?? original;
  assert.deepEqual(result, original, 'hidden hook output must not enter a visible native receipt');
  assert.ok((await session.extensionRunner.emitContext([])).some(message => message.customType === 'slopsentral-tool-hooks' && message.content.includes('private hook context')));
  session.sessionManager.appendMessage({ role: 'user', content: 'fixture', timestamp: 0 });
  const settled = await session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({ contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message') }));
  assert.equal(settled.continue, true);
  assert.equal(settled.entries.some(entry => entry.type === 'custom_message' && entry.display === true), false);
  assert.deepEqual(notices, []);
  assert.deepEqual(errors, []);
});

test('external settings changes invalidate jobs and malformed settings keep the last accepted gates', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  const barrier = barrierHook(f);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"report","output":{"type":"ALWAYS"},"context":"none"}}}');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'changed.txt', content: 'changed' } }]);
  await until(() => fs.existsSync(barrier.ready), 'external setting barrier');
  const projectFile = path.join(f.directory, '.pi/slopsentral.json');
  fs.mkdirSync(path.dirname(projectFile), { recursive: true });
  fs.writeFileSync(projectFile, JSON.stringify({ schemaVersion: 1, capabilities: { 'hook:gate': false } }));
  fs.writeFileSync(barrier.release, 'release');
  await until(() => fs.existsSync(barrier.exited), 'old process completion');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'hook:gate').state, 'disabled');
  assert.equal(notices.some(message => message.includes('barrier released')), false);
  fs.writeFileSync(projectFile, '{broken');
  assert.equal((await jsonCommand(session, 'state')).effective.capabilities.find(item => item.capability.id === 'hook:gate').state, 'disabled');
  assert.ok((await jsonCommand(session, 'state')).errors.some(message => message.includes('project:')));
  assert.equal((await jsonCommand(session, 'set project {"schemaVersion":1}')).type, 'saved');
  assert.deepEqual((await jsonCommand(session, 'state')).errors, []);
  assert.deepEqual(errors, []);
});

test('scope snapshots preserve later edits while a background assessment finishes', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log(JSON.stringify({decision:'block',assessment:'ASSESSED',reason:JSON.stringify(p.changed_paths)}));}},5);`);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'first.txt', content: 'first' } }]);
  await until(() => fs.existsSync(ready), 'scope snapshot');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'later.txt', content: 'later' } }]);
  fs.writeFileSync(release, 'release');
  await until(() => notices.some(message => message.includes('later.txt')), 'new scope snapshot');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['first.txt', 'later.txt']);
  assert.equal(state.journal.assessedRevision, state.journal.revision);
  assert.equal(state.recent.length, 1, 'the stale first result never commits');
  assert.equal(notices.length, 1);
  assert.deepEqual(errors, []);
});

test('manual hook runs keep dependency rejection and use the same deadline policy owner', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 30 };
  const f = fixture(t, [action], 'ADVISORY');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `console.log('{}');`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"foreground","critical":"report","output":{"type":"NEVER"},"context":"none","timeoutSeconds":5}}}')).type, 'saved');
  const result = await jsonCommand(session, 'run hook:gate');
  assert.equal(result.type, 'hook-results');
  assert.equal(result.runs[0].action.timeout, 5);
  assert.equal(result.runs[0].result.type, 'completed');
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"blocking","output":{"type":"NEVER"},"context":"none"}}}')).type, 'rejected');
  assert.equal((await jsonCommand(session, 'run hook:absent')).code, 'UNKNOWN_HOOK');
  fs.writeFileSync(path.join(f.packagePath, 'capabilities.json'), JSON.stringify({ schemaVersion: 1, capabilities: [
    { id: 'resource:missing', type: 'RESOURCE', name: 'missing', path: 'fixture/missing.txt', dependencies: [], profiles: ['fixture'] },
    { id: 'hook:gate', type: 'HOOK', name: 'gate', dependencies: ['resource:missing'], profiles: ['fixture'], actions: [action] },
  ] }));
  const second = await host(t, f.packagePath, f.directory, undefined, path.join(f.directory, 'second-agent'));
  await jsonCommand(second.session, 'set session {"schemaVersion":1,"capabilities":{"hook:gate":false,"resource:missing":false}}');
  const blocked = await jsonCommand(second.session, 'run hook:gate');
  assert.equal(blocked.runs[0].result.code, 'BLOCKED');
  assert.match(blocked.runs[0].result.reason, /DEPENDENCY_UNAVAILABLE/);
  assert.deepEqual(second.errors, []);
  assert.deepEqual(errors, []);
});

test('local additions reject missing files and compose after explicit repair', async t => {
  const f = fixture(t, [], 'ADVISORY');
  const instruction = path.join(f.directory, 'local-rules.md');
  const skill = path.join(f.directory, 'local-skill/SKILL.md');
  const resource = path.join(f.directory, 'data.json');
  fs.mkdirSync(path.dirname(skill));
  fs.writeFileSync(skill, '---\nname: local-skill\ndescription: Local fixture skill.\n---\nUse the fixture.\n');
  fs.writeFileSync(resource, '{}');
  const additions = [
    { id: 'instruction:local-rules', type: 'INSTRUCTION', name: 'local-rules', path: 'local-rules.md', dependencies: [], profiles: [] },
    { id: 'skill:local-skill', type: 'SKILL', name: 'local-skill', path: skill, dependencies: [], profiles: [] },
    { id: 'resource:local-data', type: 'RESOURCE', name: 'local-data', path: resource, dependencies: [], profiles: [] },
  ];
  const { session, loader, errors } = await host(t, f.packagePath, f.directory);
  const before = await jsonCommand(session, 'state');
  assert.equal((await jsonCommand(session, `set project ${JSON.stringify({ schemaVersion: 1, additions })}`)).type, 'rejected');
  assert.deepEqual((await jsonCommand(session, 'state')).effective, before.effective);
  fs.writeFileSync(instruction, 'Use these recovered local instructions.\n');
  assert.equal((await jsonCommand(session, `set project ${JSON.stringify({ schemaVersion: 1, additions })}`)).type, 'saved');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:local-rules').state, 'enabled');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:local-rules').capability.path, instruction);
  await session.extendResourcesFromExtensions('reload');
  assert.equal(loader.getSkills().skills.some(item => item.filePath === skill), false);
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'fixture' }, { cwd: f.directory, skills: loader.getSkills().skills });
  assert.ok(prompt.systemPromptOptions.sections.slopsentral.includes('Use these recovered local instructions.'));
  assert.ok(prompt.systemPromptOptions.sections.slopsentral.includes(resource));
  assert.equal(prompt.systemPromptOptions.skills.some(item => item.filePath === skill), false);
  assert.ok(prompt.systemPromptOptions.sections.slopsentral_skills.includes('local-skill'));
  assert.equal((await jsonCommand(session, 'skill local-skill')).baseDir, path.dirname(skill));
  await jsonCommand(session, 'set session {"schemaVersion":1,"capabilities":{"instruction:local-rules":false,"skill:local-skill":false}}');
  const disabled = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'fixture' }, { cwd: f.directory, skills: loader.getSkills().skills });
  assert.equal(disabled.systemPromptOptions.sections.slopsentral.includes('Use these recovered local instructions.'), false);
  assert.ok(disabled.systemPromptOptions.sections.slopsentral.includes(resource));
  assert.equal(disabled.systemPromptOptions.skills.some(item => item.filePath === skill), false);
  assert.equal(disabled.systemPromptOptions.sections.slopsentral_skills, undefined);
  assert.deepEqual(errors, []);
});

test('an unreadable branch identity rejects assessment without a subprocess or an assessed receipt', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  fs.mkdirSync(path.join(f.directory, '.git'));
  fs.writeFileSync(path.join(f.directory, '.git/HEAD'), 'invalid branch metadata');
  const ledger = path.join(f.directory, 'must-not-run');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ledger)},'ran');console.log(JSON.stringify({decision:'block',assessment:'ASSESSED',reason:'fixture'}));`);
  const { session, modelRuntime } = await host(t, f.packagePath, f.directory);
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'pending.txt', content: 'pending' } }]);
  const state = await afterJobs(session);
  assert.equal(fs.existsSync(ledger), false);
  assert.equal(state.journal.assessedRevision, 0);
  assert.deepEqual(state.journal.pending, ['pending.txt']);
  assert.match(state.recent[0].result.reason, /WORKSPACE_IDENTITY_UNAVAILABLE/);
});

test('an invalid catalog keeps repair commands but rejects the first plan and its effects', async t => {
  const action = { name: 'gate', event: 'PreToolUse', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  const profilesFile = path.join(f.packagePath, 'profiles.json');
  const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
  profiles.profiles[0].instructions.push({ name: 'rules', path: 'fixture/rules.md' });
  fs.writeFileSync(profilesFile, JSON.stringify(profiles));
  fs.writeFileSync(path.join(f.packagePath, 'fixture/rules.md'), 'Use the isolated fixture instructions.');
  fs.writeFileSync(path.join(f.packagePath, 'capabilities.json'), '{"schemaVersion":999}');
  const ledger = path.join(f.directory, 'hook-must-not-run');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ledger)},'ran');console.log('{}');`);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'fixture' }, { cwd: f.directory, skills: [] });
  assert.equal(prompt.systemPromptOptions.sections.slopsentral.includes('Use the isolated fixture instructions.'), false);
  assert.ok(session.extensionRunner.getRegisteredCommands().some(command => command.name === 'slopsentral'));
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'forbidden.txt', content: 'must not write' } }]);
  assert.equal(fs.existsSync(ledger), false, 'unknown dependencies must not authorize a hook process');
  assert.equal(fs.existsSync(path.join(f.directory, 'forbidden.txt')), false, 'the affected blocking operation must remain blocked');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.type, 'rejected');
  assert.ok(state.effective.code.includes('RESOURCE_UNAVAILABLE'));
  assert.ok(state.errors.includes('INVALID_CATALOG'));
  assert.deepEqual(errors, []);
});

test('malformed first-load settings reject effects until a settings command repairs the layer', async t => {
  const action = { name: 'gate', event: 'PreToolUse', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), "console.log('{}');");
  fs.mkdirSync(path.join(f.directory, '.pi'));
  fs.writeFileSync(path.join(f.directory, '.pi/slopsentral.json'), '{broken');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'forbidden.txt', content: 'must not write' } }]);
  assert.equal(fs.existsSync(path.join(f.directory, 'forbidden.txt')), false, 'unadmitted settings must not select default hook semantics');
  assert.equal((await jsonCommand(session, 'state')).effective.type, 'rejected');
  assert.ok(session.extensionRunner.getRegisteredCommands().some(command => command.name === 'slopsentral'));
  assert.equal((await jsonCommand(session, 'set project {"schemaVersion":1}')).type, 'saved');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'recovered.txt', content: 'recovered' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'recovered.txt'), 'utf8'), 'recovered');
  assert.equal((await jsonCommand(session, 'state')).effective.type, 'effective');
  assert.deepEqual(errors, []);
});
