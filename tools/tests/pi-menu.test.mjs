import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
import { initTheme } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';

initTheme('dark');
const imported = await tsImport('../../source/hooks/pi/menu.ts', import.meta.url);
const menu = imported.default ?? imported;

test('native profile picker searches, navigates, selects, and cancels through keyboard input', () => {
  const choices = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const selected = [];
  let cancelled = 0;
  const picker = menu.profilePicker(choices, name => selected.push(name), () => cancelled++);
  picker.handleInput('b');
  picker.handleInput('e');
  assert.ok(picker.render(32).some(line => line.includes('beta')));
  picker.handleInput('\r');
  assert.deepEqual(selected, ['beta']);
  picker.handleInput('\x1b');
  assert.equal(cancelled, 1);
  for (const width of [16, 32, 80]) for (const line of picker.render(width)) assert.ok(visibleWidth(line) <= width);
});

test('upstream VirtualTerminal renders native picker cells, scrolling, custom keys, and resize', async t => {
  const { TuiMainScreen, getKeybindings, KeybindingsManager, setKeybindings, TUI_KEYBINDINGS } = await import('@earendil-works/pi-tui');
  const importedTerminal = await tsImport('./fixtures/pi-virtual-terminal.ts', import.meta.url);
  const { VirtualTerminal } = importedTerminal.default ?? importedTerminal;
  const previous = getKeybindings();
  setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, { 'tui.select.down': ['ctrl+n'], 'tui.select.up': ['ctrl+p'] }));
  t.after(() => setKeybindings(previous));
  const terminal = new VirtualTerminal(32, 12);
  const tui = new TuiMainScreen(terminal, true);
  t.after(() => tui.stop());
  const selections = [];
  const picker = menu.profilePicker(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'], name => selections.push(name), () => {});
  tui.addChild(picker); tui.setFocus(picker); tui.start();
  for (let index = 0; index < 6; index++) terminal.sendInput('\x0e');
  await terminal.waitForRender();
  let viewport = terminal.getViewport();
  assert.ok(viewport.some(line => line.includes('eta')));
  terminal.sendInput('\r');
  assert.deepEqual(selections, ['eta']);
  terminal.resize(18, 10);
  tui.requestRender();
  await terminal.waitForRender();
  viewport = terminal.getViewport();
  for (const line of viewport) assert.ok(visibleWidth(line) <= 18);
  terminal.sendInput('\x10'); terminal.sendInput('\r');
  assert.deepEqual(selections, ['eta', 'zeta'], 'resizing preserves selection and native keybindings');
});
