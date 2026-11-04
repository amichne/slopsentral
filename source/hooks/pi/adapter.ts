import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { readHookSettings, registerHookControls, type Adapter, type Hook, type HookEvent, type HookSettings } from './controls.ts';
export type { Adapter, Hook } from './controls.ts';
export type Result =
  | { readonly type: 'accepted'; readonly context: string }
  | { readonly type: 'blocked'; readonly reason: string }
  | { readonly type: 'failed'; readonly reason: string };
const limit = 1024 * 1024;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function privatePython(root: string): { type: 'external' } | { type: 'ready'; executable: string } | { type: 'failed'; reason: string } {
  const packages = path.dirname(path.dirname(root));
  const packageState = path.dirname(packages);
  if (path.basename(packages) !== 'packages' || path.basename(packageState) !== 'slopsentral-setup') return { type: 'external' };
  try {
    const state = path.join(fs.realpathSync(os.homedir()), '.pi', 'slopsentral-hook-runtime');
    const receipt = path.join(state, 'hook-runtime.json');
    const info = fs.lstatSync(receipt);
    if (!info.isFile() || info.size > 64 * 1024 || fs.realpathSync(receipt) !== receipt) return { type: 'failed', reason: 'HOOK_RUNTIME_INVALID' };
    const value: unknown = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    if (!object(value) || Object.keys(value).sort().join() !== 'executable,platform,python,schemaVersion,sha256'
      || value.schemaVersion !== 1 || value.platform !== process.platform + '-' + process.arch || value.python !== '3.12.14'
      || typeof value.executable !== 'string' || typeof value.sha256 !== 'string'
      || !value.executable.startsWith('hook-runtime-3.12.14-' + value.platform + '/')
      || value.executable.split('/').some(part => !part || part === '.' || part === '..')) return { type: 'failed', reason: 'HOOK_RUNTIME_INVALID' };
    const executable = path.join(state, value.executable);
    const executableInfo = fs.statSync(executable);
    if (fs.realpathSync(executable) !== executable || !executableInfo.isFile() || executableInfo.size > 64 * 1024 * 1024
      || !(executableInfo.mode & 0o111)
      || crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex') !== value.sha256) return { type: 'failed', reason: 'HOOK_RUNTIME_CHANGED' };
    return { type: 'ready', executable };
  } catch { return { type: 'failed', reason: 'HOOK_RUNTIME_UNAVAILABLE' }; }
}

export function decode(text: string): Result {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { type: 'failed', reason: 'HOOK_INVALID_JSON' }; }
  if (!object(value) || Object.keys(value).some(k => !['decision', 'reason', 'hookSpecificOutput', 'systemMessage'].includes(k)))
    return { type: 'failed', reason: 'HOOK_INVALID_RESPONSE' };
  if (value.decision !== undefined) {
    return value.decision === 'block' && typeof value.reason === 'string' && value.reason.trim()
      ? { type: 'blocked', reason: value.reason }
      : { type: 'failed', reason: 'HOOK_INVALID_DECISION' };
  }
  const output = value.hookSpecificOutput;
  if (output !== undefined && (!object(output) || typeof output.additionalContext !== 'string'))
    return { type: 'failed', reason: 'HOOK_INVALID_CONTEXT' };
  if (value.systemMessage !== undefined && typeof value.systemMessage !== 'string')
    return { type: 'failed', reason: 'HOOK_INVALID_MESSAGE' };
  return { type: 'accepted', context: [object(output) ? output.additionalContext : '', value.systemMessage ?? ''].filter(Boolean).join('\n') };
}

// The host adapter supplies the legacy wire shape to the canonical hook implementation.
// Neither tool arguments nor model text enter the shell command.
export function runHook(hook: Hook, root: string, cwd: string, session: string, signal?: AbortSignal): Promise<Result> {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve({ type: 'failed', reason: 'HOOK_CANCELLED' }); return; }
    const runtime = privatePython(root);
    if (runtime.type === 'failed') { resolve(runtime); return; }
    const script = /^uv run --locked --script (hooks\/[A-Za-z0-9_.-]+\.py)(?: |$)/.exec(hook.command)?.[1];
    if (runtime.type === 'ready') {
      if (!script) { resolve({ type: 'failed', reason: 'HOOK_RUNTIME_UNSUPPORTED_COMMAND' }); return; }
      let source: string;
      try { source = fs.readFileSync(path.join(root, script), 'utf8'); }
      catch { resolve({ type: 'failed', reason: 'HOOK_SCRIPT_UNAVAILABLE' }); return; }
      if (!/^# dependencies = \[\]$/m.test(source)) { resolve({ type: 'failed', reason: 'HOOK_RUNTIME_UNSUPPORTED_DEPENDENCIES' }); return; }
    }
    const selected = runtime.type === 'ready' ? hook.command.replace(/^uv run --locked --script /, '"$SLOPSENTRAL_PYTHON" -I -B ') : hook.command;
    const command = selected.replace(/\bhooks\/[A-Za-z0-9_.-]+/g, file => '"$PLUGIN_ROOT/' + file + '"');
    const child = spawn('/bin/sh', ['-c', 'exec ' + command], {
      cwd, env: { ...process.env, PLUGIN_ROOT: root, SLOPSENTRAL_SCOPE_HOME: getAgentDir(), ...(runtime.type === 'ready' ? { SLOPSENTRAL_PYTHON: runtime.executable } : {}) }, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', bytes = 0, failure: string | undefined;
    const stop = (reason: string) => {
      failure ??= reason;
      if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (!object(error) || error.code !== 'ESRCH') child.kill('SIGKILL'); } }
    };
    const abort = () => stop('HOOK_CANCELLED');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop('HOOK_TIMEOUT'), hook.timeout * 1000);
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.on('error', () => { clean(); resolve({ type: 'failed', reason: 'HOOK_UNAVAILABLE' }); });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { bytes += Buffer.byteLength(chunk); if (bytes > limit) stop('HOOK_OUTPUT_LIMIT'); else stdout += chunk; });
    child.stderr.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > limit) stop('HOOK_OUTPUT_LIMIT'); });
    child.stdin.on('error', () => { /* A process can exit before it reads its input. */ });
    child.on('close', code => {
      clean();
      resolve(failure ? { type: 'failed', reason: failure } : code !== 0
        ? { type: 'failed', reason: `HOOK_EXIT_${code ?? 'SIGNAL'}: ${hook.name}. Examine uv and the hook dependencies.` }
        : decode(stdout));
    });
    child.stdin.end(JSON.stringify({ hook_event_name: hook.event, cwd, session_id: session, source: 'startup', stop_hook_active: false }));
  });
}

export function register(pi: ExtensionAPI, root: string, adapter: Adapter): void {
  let sessionState: { type: 'cold' } | { type: 'ready'; context: string; revision: string } = { type: 'cold' };
  let admission: Result = { type: 'accepted', context: '' };
  let repairState: 'available' | 'used' = 'available';
  registerHookControls(pi, root, adapter, () => { sessionState = { type: 'cold' }; });
  const run = async (event: HookEvent, ctx: ExtensionContext, settings: HookSettings): Promise<Result> => {
    if (settings.type === 'failed') return settings;
    const context: string[] = [];
    for (const hook of adapter.hooks.filter(h => h.event === event && !settings.disabled.has(adapter.plugin + '/' + h.name))) {
      const result = await runHook(hook, root, ctx.cwd, ctx.sessionManager.getSessionId(), ctx.signal);
      if (result.type !== 'accepted') return result;
      if (result.context) context.push(result.context);
    }
    return { type: 'accepted', context: context.join('\n\n') };
  };
  pi.on('session_start', () => {
    sessionState = { type: 'cold' };
    admission = { type: 'accepted', context: '' };
    repairState = 'available';
  });
  pi.on('before_agent_start', async (event, ctx) => {
    repairState = 'available';
    const settings = readHookSettings();
    const revision = settings.type === 'ready' ? JSON.stringify([...settings.disabled].sort()) : '';
    admission = settings.type === 'failed' ? settings : sessionState.type === 'ready' && sessionState.revision === revision
      ? { type: 'accepted', context: sessionState.context }
      : await run('SessionStart', ctx, settings);
    if (admission.type === 'accepted') sessionState = { type: 'ready', context: admission.context, revision };
    const context = admission.type === 'accepted' ? [admission.context] : [];
    try {
      context.push(...adapter.instructions.map(file => fs.readFileSync(path.join(root, file), 'utf8')));
    } catch {
      admission = { type: 'failed', reason: 'INSTRUCTION_UNAVAILABLE' };
    }
    if (admission.type === 'accepted') {
      admission = await run('UserPromptSubmit', ctx, settings);
      if (admission.type === 'accepted') context.push(admission.context);
    }
    if (admission.type !== 'accepted') context.push(`Slopsentral ${adapter.plugin}: ${admission.reason}`);
    return { systemPrompt: event.systemPrompt + '\n\n' + context.filter(Boolean).join('\n\n') };
  });
  pi.on('tool_call', () => {
    const settings = readHookSettings();
    if (settings.type === 'failed') return { block: true, reason: settings.reason };
    return admission.type !== 'accepted' ? { block: true, reason: admission.reason } : undefined;
  });
  pi.on('agent_before_settle', async (event, ctx) => {
    if (event.outcome !== 'completed') return;
    const result = await run('Stop', ctx, readHookSettings());
    const text = result.type === 'accepted' ? result.context : result.reason;
    if (!text) return;
    const repair = result.type === 'blocked' && repairState === 'available';
    if (repair) repairState = 'used';
    const content = result.type === 'accepted' ? text : `Slopsentral ${adapter.plugin}: ${text}`
      + (repair ? '' : '\nUnresolved hook result. No automatic retry remains.');
    return { entries: [...event.entries, { type: 'custom_message', customType: 'slopsentral-' + adapter.plugin, content, display: true }], continue: event.continue || repair };
  });
}
