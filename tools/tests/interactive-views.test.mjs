import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, linkSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const skill = fileURLToPath(new URL('../../source/skills/interactive-views/', import.meta.url))
const script = join(skill, 'scripts/render.mjs')
const fragment = '<div class="ui-header"><p class="ui-title">Queue time fell</p></div><div id="chart"></div><script>{ ui.bars(document.getElementById("chart"), { items: [{ label: "Before", value: 80 }, { label: "After", value: 20, highlight: true }] }) }</script>'

function workspace(t) {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'interactive-views-')))
	t.after(() => rmSync(root, { recursive: true, force: true }))
	const input = join(root, 'source.html')
	const output = join(root, 'view.html')
	writeFileSync(input, fragment)
	return { root, input, output }
}

function run(root, ...args) {
	return spawnSync(process.execPath, [script, ...args], {
		cwd: root,
		env: { ...process.env, PATH: '' },
		encoding: 'utf8',
	})
}

test('renders a standalone document without a browser, host CLI, or network', (t) => {
	const { root, input, output } = workspace(t)
	const result = run(root, input, '--out', output, '--title', 'Queue <time> & retries')
	assert.equal(result.status, 0, result.stderr)
	const html = readFileSync(output, 'utf8')
	assert.match(html, /^<!doctype html>/i)
	assert.match(html, /<title>Queue &lt;time&gt; &amp; retries<\/title>/)
	assert.match(html, /name="viewport"/)
	assert.match(html, /prefers-color-scheme: dark/)
	assert.match(html, /--foreground:/)
	assert.match(html, /window\.ui =/)
	assert.match(html, /id=\\"i-check\\"/)
	assert.ok(html.indexOf('window.ui =') < html.indexOf('ui.bars(document.getElementById'))
	assert.match(html, /Content-Security-Policy/)
	assert.doesNotMatch(html, /__AMP_VIEW_ICONS__|__VIEW_ICONS__|amp-view|<script\b[^>]*\bsrc\s*=/i)
	assert.match(result.stdout, /file:/)
	assert.doesNotMatch(result.stdout, /https?:/)
})

test('help succeeds without input or output', (t) => {
	const { root } = workspace(t)
	const result = run(root, '--help')
	assert.equal(result.status, 0, result.stderr)
	for (const option of ['--out', '--title', '--overwrite']) assert.ok(result.stdout.includes(option))
})

for (const args of [[], ['--unknown'], ['source.html', '--out'], ['source.html', '--out', '--title'], ['source.html', '--out', 'view.html', '--title'], ['source.html', 'extra.html', '--out', 'view.html']]) {
	test(`rejects incomplete or unknown arguments: ${args.join(' ') || '(none)'}`, (t) => {
		const { root, output } = workspace(t)
		const result = run(root, ...args)
		assert.equal(result.status, 2, result.stderr)
		assert.match(result.stderr, /Usage:/)
		assert.equal(existsSync(output), false)
	})
}

test('does not overwrite a delivery file without explicit opt-in', (t) => {
	const { root, input, output } = workspace(t)
	writeFileSync(output, 'Keep this version')
	const result = run(root, input, '--out', output)
	assert.notEqual(result.status, 0)
	assert.equal(readFileSync(output, 'utf8'), 'Keep this version')
	assert.match(result.stderr, /--overwrite/)
})

test('updates the same output when overwrite is explicit', (t) => {
	const { root, input, output } = workspace(t)
	writeFileSync(output, 'Old version')
	const result = run(root, input, '--out', output, '--overwrite')
	assert.equal(result.status, 0, result.stderr)
	assert.match(readFileSync(output, 'utf8'), /Queue time fell/)
})

test('never overwrites the source fragment', (t) => {
	const { root, input } = workspace(t)
	const result = run(root, input, '--out', input, '--overwrite')
	assert.notEqual(result.status, 0)
	assert.equal(readFileSync(input, 'utf8'), fragment)
})

for (const [label, source, message] of [
	['empty source', '', /empty/i],
	['complete document', '<!doctype html><html><head></head><body>Already standalone</body></html>', /fragment/i],
	['oversized source', 'x'.repeat(100_001), /100,?000|100 KB/],
]) {
	test(`rejects ${label} before touching the output`, (t) => {
		const { root, input, output } = workspace(t)
		writeFileSync(input, source)
		const result = run(root, input, '--out', output)
		assert.notEqual(result.status, 0)
		assert.match(result.stderr, message)
		assert.equal(existsSync(output), false)
	})
}

test('rejects a symlink output even with overwrite', (t) => {
	const { root, input, output } = workspace(t)
	const other = join(root, 'other.html')
	writeFileSync(other, 'Keep this file')
	symlinkSync(other, output)
	const result = run(root, input, '--out', output, '--overwrite')
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /symlink/)
	assert.equal(readFileSync(other, 'utf8'), 'Keep this file')
})

test('does not overwrite the input through a hard link', (t) => {
	const { root, input, output } = workspace(t)
	linkSync(input, output)
	const result = run(root, input, '--out', output, '--overwrite')
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /input fragment/)
	assert.equal(readFileSync(input, 'utf8'), fragment)
})

test('measures the source limit in UTF-8 bytes, not characters', (t) => {
	const { root, input, output } = workspace(t)
	writeFileSync(input, 'é'.repeat(50_001))
	const result = run(root, input, '--out', output)
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /100,000 bytes/)
	assert.equal(existsSync(output), false)
})

test('works after the entire standalone skill is relocated', (t) => {
	const { root, input, output } = workspace(t)
	const installed = join(root, 'installed-skill')
	cpSync(skill, installed, { recursive: true })
	const result = spawnSync(process.execPath, [join(installed, 'scripts/render.mjs'), input, '--out', output], {
		cwd: root,
		env: { ...process.env, PATH: '' },
		encoding: 'utf8',
	})
	assert.equal(result.status, 0, result.stderr)
	assert.match(readFileSync(output, 'utf8'), /window\.ui =/)
})

test('reports a missing input without creating an output', (t) => {
	const { root, output } = workspace(t)
	const result = run(root, 'missing.html', '--out', output)
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /input|ENOENT/i)
	assert.equal(existsSync(output), false)
})

test('all ten bundled source examples build with only the shipped kit', (t) => {
	const { root } = workspace(t)
	const examples = readdirSync(join(skill, 'assets/examples')).filter((name) => name.endsWith('.html'))
	assert.equal(examples.length, 10)
	for (const example of examples) {
		const output = join(root, example)
		const result = run(root, join(skill, 'assets/examples', example), '--out', output)
		assert.equal(result.status, 0, `${example}: ${result.stderr}`)
		assert.match(readFileSync(output, 'utf8'), /window\.ui =/)
	}
})
