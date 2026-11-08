import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('../../source/skills/reviewable-artifacts/scripts/share.mjs', import.meta.url))
const page = '<!doctype html><title>Checkout &amp; retries</title><figure id="flow">Request path</figure>'

function workspace(t) {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'artifact-pages-')))
	t.after(() => rmSync(root, { recursive: true, force: true }))
	const dir = join(root, 'artifacts', 'pages')
	mkdirSync(dir, { recursive: true })
	return { root, dir }
}

function run(root, ...args) {
	// No host CLI is available. The script must not need one, even when printing links.
	return spawnSync(process.execPath, [script, ...args], {
		cwd: root,
		env: { ...process.env, PATH: '', AMP_ORB: '1' },
		encoding: 'utf8',
	})
}

test('defaults to portable local files, with encoded paths and decoded titles', (t) => {
	const { root, dir } = workspace(t)
	const path = join(dir, 'checkout notes.html')
	writeFileSync(path, page)
	const result = run(root)
	assert.equal(result.status, 0, result.stderr)
	assert.ok(result.stdout.includes('Checkout & retries'))
	assert.ok(result.stdout.includes(pathToFileURL(path).href))
	assert.match(result.stdout, /local/i)
})

test('supports an explicit directory', (t) => {
	const { root } = workspace(t)
	writeFileSync(join(root, 'report.html'), page)
	const result = run(root, '--dir', root)
	assert.equal(result.status, 0, result.stderr)
	assert.ok(result.stdout.includes(pathToFileURL(join(root, 'report.html')).href))
})

test('check validates without producing delivery links', (t) => {
	const { root, dir } = workspace(t)
	writeFileSync(join(dir, 'report.html'), page)
	const result = run(root, '--check')
	assert.equal(result.status, 0, result.stderr)
	assert.match(result.stdout, /Checked 1 page\(s\): no errors/)
	assert.doesNotMatch(result.stdout, /file:|https?:/)
})

test('forms hosted links under an explicit directory URL, without claiming publication', (t) => {
	const { root, dir } = workspace(t)
	writeFileSync(join(dir, 'checkout #1.html'), page)
	for (const base of ['https://example.invalid/reviews', 'https://example.invalid/reviews/']) {
		const result = run(root, '--base-url', base)
		assert.equal(result.status, 0, result.stderr)
		assert.ok(result.stdout.includes('https://example.invalid/reviews/checkout%20%231.html'))
		assert.match(result.stdout, /not (uploaded|published|verified)/i)
		assert.doesNotMatch(result.stdout, /file:/)
	}
})

test('help works without a pages directory', (t) => {
	const { root } = workspace(t)
	const result = run(root, '--help')
	assert.equal(result.status, 0, result.stderr)
	for (const flag of ['--dir', '--check', '--base-url']) assert.ok(result.stdout.includes(flag))
})

for (const value of ['not-a-url', '/relative', 'file:///tmp/', 'ftp://example.invalid/',
	'https://user:secret@example.invalid/', 'https://example.invalid/?token=secret',
	'https://example.invalid/#section']) {
	test(`rejects unsupported or ambiguous base URL: ${value.replace(/secret/g, 'REDACTED')}`, (t) => {
		const { root, dir } = workspace(t)
		writeFileSync(join(dir, 'report.html'), page)
		const result = run(root, '--base-url', value)
		assert.notEqual(result.status, 0)
		assert.match(result.stderr, /--base-url/)
		assert.equal(result.stdout, '')
		assert.doesNotMatch(result.stderr, /secret/)
	})
}

for (const args of [['--unknown'], ['--dir'], ['--dir', '--check'], ['--base-url'], ['--base-url', '--check']]) {
	test(`rejects invalid arguments: ${args.join(' ')}`, (t) => {
		const { root } = workspace(t)
		const result = run(root, ...args)
		assert.notEqual(result.status, 0)
		assert.match(result.stderr, /Unknown option|requires a value/)
		assert.equal(result.stdout, '')
	})
}

for (const [name, html, message] of [
	['placeholder', `${page}<p>⟦unfinished⟧</p>`, /placeholder/],
	['duplicate id', `${page}<p id="flow">Other block</p>`, /repeats id/],
	['missing title', '<figure id="flow">Request path</figure>', /no <title>/],
	['unclosed pre', `${page}<pre>broken`, /<pre> start tag/],
]) {
	test(`blocks links for every page when one page has a ${name}`, (t) => {
		const { root, dir } = workspace(t)
		writeFileSync(join(dir, 'good.html'), page)
		writeFileSync(join(dir, 'bad.html'), html)
		const result = run(root)
		assert.notEqual(result.status, 0)
		assert.match(result.stderr, message)
		assert.equal(result.stdout, '')
	})
}

test('the bundled template passes after its placeholders are filled', (t) => {
	const { root, dir } = workspace(t)
	const template = readFileSync(new URL('../../source/skills/reviewable-artifacts/assets/page-template.html', import.meta.url), 'utf8')
	writeFileSync(join(dir, 'report.html'), template.replace(/⟦[^⟧]*⟧/g, 'example'))
	const result = run(root, '--check')
	assert.equal(result.status, 0, result.stderr)
	assert.equal(result.stderr, '')
	assert.match(result.stdout, /Checked 1 page/)
})

test('reports an empty directory as an error', (t) => {
	const { root } = workspace(t)
	const result = run(root)
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /No .html pages/)
})

test('reports a missing directory as an error', (t) => {
	const { root } = workspace(t)
	const result = run(root, '--dir', join(root, 'missing'))
	assert.notEqual(result.status, 0)
	assert.match(result.stderr, /Directory does not exist/)
})
