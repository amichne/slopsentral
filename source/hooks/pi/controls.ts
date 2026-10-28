import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAgentDir, getSettingsListTheme, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Container, SettingsList, Text } from '@earendil-works/pi-tui';

export type HookEvent = 'SessionStart' | 'UserPromptSubmit' | 'Stop';
export interface Hook {
  readonly name: string;
  readonly event: HookEvent;
  readonly command: string;
  readonly timeout: number;
}
export interface Adapter {
  readonly plugin: string;
  readonly instructions: readonly string[];
  readonly hooks: readonly Hook[];
}

export type HookSettings =
  | { readonly type: 'ready'; readonly disabled: ReadonlySet<string> }
  | { readonly type: 'failed'; readonly reason: 'HOOK_SETTINGS_INVALID' | 'HOOK_SETTINGS_UNREADABLE' | 'HOOK_SETTINGS_WRITE_FAILED' };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const settingsPath = () => path.join(getAgentDir(), 'slopsentral-hooks.json');

// The standalone ingress mirrors source/schemas/pi/hooks.schema.json without a consumer dependency.
export function parseHookSettings(value: unknown): HookSettings {
  if (!object(value) || Object.keys(value).length !== 2 || value.schemaVersion !== 1
    || !Array.isArray(value.disabled) || !value.disabled.every((id: unknown): id is string =>
      typeof id === 'string' && /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(id))
    || new Set(value.disabled).size !== value.disabled.length)
    return { type: 'failed', reason: 'HOOK_SETTINGS_INVALID' };
  return { type: 'ready', disabled: new Set(value.disabled) };
}

export function readHookSettings(): HookSettings {
  let text: string;
  try { text = fs.readFileSync(settingsPath(), 'utf8'); }
  catch (error) {
    return object(error) && error.code === 'ENOENT'
      ? { type: 'ready', disabled: new Set() }
      : { type: 'failed', reason: 'HOOK_SETTINGS_UNREADABLE' };
  }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { type: 'failed', reason: 'HOOK_SETTINGS_INVALID' }; }
  return parseHookSettings(value);
}

function saveChoice(id: string, enabled: boolean): HookSettings {
  const current = readHookSettings();
  if (current.type === 'failed') return current;
  const disabled = new Set(current.disabled);
  if (enabled) disabled.delete(id); else disabled.add(id);
  const file = settingsPath();
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, disabled: [...disabled].sort() }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch {
    return { type: 'failed', reason: 'HOOK_SETTINGS_WRITE_FAILED' };
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return { type: 'ready', disabled };
}

const nativeEvents = {
  SessionStart: 'before_agent_start (session context)',
  UserPromptSubmit: 'before_agent_start (each request)',
  Stop: 'agent_before_settle (completed)',
};
const catalogChannel = 'slopsentral:hooks:catalog';
const ownerChannel = 'slopsentral:hooks:owner';
interface HookChoice {
  readonly id: string;
  readonly description: string;
  readonly changed: () => void;
}

export function registerHookControls(pi: ExtensionAPI, root: string, adapter: Adapter, changed: () => void): void {
  const choices: HookChoice[] = [...new Set(adapter.hooks.map(hook => hook.name))].map(name => ({
    id: adapter.plugin + '/' + name,
    description: [...new Set(adapter.hooks.filter(hook => hook.name === name).map(hook =>
      `${hook.event} → ${nativeEvents[hook.event]}`)),
      ...new Set(adapter.hooks.filter(hook => hook.name === name).map(hook => hook.command)),
      `Script root: ${root}`].join('\n'),
    changed,
  }));
  // Pi scopes these subscriptions to the extension lifetime, including /reload.
  pi.events.on(catalogChannel, collect => { if (typeof collect === 'function') collect(choices); });
  let claimed = false;
  pi.events.emit(ownerChannel, () => { claimed = true; });
  if (claimed) return;
  pi.events.on(ownerChannel, claim => { if (typeof claim === 'function') claim(); });
  pi.registerCommand('hooks', {
    description: 'Turn Slopsentral hooks on or off and examine their events and scripts',
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) { ctx.ui.notify('Use /hooks in interactive Pi.', 'info'); return; }
      const settings = readHookSettings();
      if (settings.type === 'failed') { ctx.ui.notify(`${settings.reason}: ${settingsPath()}`, 'error'); return; }
      const collected: HookChoice[] = [];
      pi.events.emit(catalogChannel, (entries: readonly HookChoice[]) => { collected.push(...entries); });
      const catalog = new Map(collected.map(choice => [choice.id, choice]));
      if (catalog.size === 0) { ctx.ui.notify('No Slopsentral hooks are loaded.', 'info'); return; }
      await ctx.ui.custom<void>((tui, _theme, _keys, done) => {
        const list = new SettingsList([...catalog.values()].sort((a, b) => a.id.localeCompare(b.id)).map(choice => ({
          id: choice.id, label: choice.id, description: choice.description,
          currentValue: settings.disabled.has(choice.id) ? 'off' : 'on', values: ['on', 'off'],
        })), 8, getSettingsListTheme(), (id, value) => {
          const choice = catalog.get(id);
          if (!choice) return;
          const result = saveChoice(id, value === 'on');
          if (result.type === 'failed') {
            list.updateValue(id, value === 'on' ? 'off' : 'on');
            ctx.ui.notify(`${result.reason}: ${settingsPath()}`, 'error');
          } else choice.changed();
          tui.requestRender();
        }, () => done(), { enableSearch: true });
        const container = new Container();
        container.addChild(new Text('Hooks — Enter/Space: on/off · Esc: done\nChoices apply to Slopsentral hooks across Pi sessions.', 1, 1));
        container.addChild(list);
        return container;
      });
    },
  });
}
