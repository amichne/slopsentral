#!/usr/bin/env node
// Checks self-contained HTML pages and prints local or explicitly supplied hosted links.
// Does not start a server, upload files, or change access. See --help.
// Adapted from Amp creating-artifacts; see ../references/provenance.md.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_DIR = 'artifacts/pages'
const HELP = `Check HTML artifacts and print delivery links (Node.js 22+).

Usage: node share.mjs [--dir DIR] [--check] [--base-url URL]

--dir DIR       Pages directory (default: artifacts/pages, relative to cwd).
--check         Validate only; print no links.
--base-url URL  Existing HTTP(S) directory URL; files must be hosted separately.
--help          Show this help.

Without --base-url, prints local file URLs. No server, upload, or network request.
Examples:
  node share.mjs --check
  node share.mjs --dir reports
  node share.mjs --base-url https://example.org/reviews/
`

function parseBaseURL(value) {
	let url
	try {
		url = new URL(value)
	} catch {
		throw new Error('--base-url requires an absolute HTTP(S) directory URL')
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
		throw new Error('--base-url must be HTTP(S), without credentials, a query, or a fragment')
	}
	url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
	return url
}

function parseArgs(argv) {
	const args = { dir: DEFAULT_DIR, check: false, delivery: { kind: 'local' } }
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		if (arg === '--check') {
			args.check = true
		} else if (arg === '--dir' || arg === '--base-url') {
			const value = argv[index + 1]
			if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`)
			if (arg === '--dir') args.dir = value
			else args.delivery = { kind: 'hosted', baseURL: parseBaseURL(value) }
			index += 1
		} else {
			throw new Error(`Unknown option: ${arg}. Valid options: --dir, --check, --base-url, --help`)
		}
	}
	return args
}

function decodeEntities(text) {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
}

/**
 * Removes every match of the pattern. Repeats until nothing matches, because one removal can
 * join the text around it into a new match.
 */
function removeAll(text, pattern) {
	let previous
	do {
		previous = text
		text = text.replace(pattern, '')
	} while (text !== previous)
	return text
}

/**
 * Checks one page for the problems that break reading or commenting.
 * Errors stop sharing; warnings are printed and sharing continues.
 */
function checkPage(html) {
	const errors = []
	const warnings = []

	const title = decodeEntities(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
		.replace(/\s+/g, ' ')
		.trim()
	if (!title) errors.push('has no <title>')

	const visible = removeAll(html, /<!--[\s\S]*?-->/g)

	// Markup only: code samples, scripts, and styles can hold anything.
	const markup = visible.replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/gi, '<$1></$1>')

	const placeholders = (visible.match(/⟦/g) ?? []).length
	if (placeholders > 0) {
		errors.push(`still has ${placeholders} template placeholder(s) marked with ⟦ ⟧`)
	}

	const drawings = [...visible.matchAll(/<pre\b[^>]*\sclass\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/pre>/gi)].filter(
		(match) => match[1].split(/\s+/).includes('diagram'),
	)
	const drawingsWithTabs = drawings.filter((match) => match[2].includes('\t')).length
	if (drawingsWithTabs > 0) {
		errors.push(
			`has ${drawingsWithTabs} drawing(s) with a tab character, which breaks the alignment: start each line of a <pre class="diagram"> at the first column and use spaces`,
		)
	}
	if (drawings.some((match) => /&(?:amp|lt|gt|#\d+|#x[0-9a-f]+);/i.test(match[2]))) {
		warnings.push('has a drawing with an escaped character; check in a screenshot that it still lines up')
	}

	const content = removeAll(visible, /<(script|style)\b[\s\S]*?<\/\1>/gi)
	const preOpens = (content.match(/<pre\b/gi) ?? []).length
	const preCloses = (content.match(/<\/pre\s*>/gi) ?? []).length
	if (preOpens !== preCloses) {
		errors.push(
			`has ${preOpens} <pre> start tag(s) but ${preCloses} end tag(s): inside a <pre>, write < as &lt; and & as &amp;`,
		)
	}

	if (!/<figure\b/i.test(markup)) {
		warnings.push(
			'has no picture: show the main point in a <figure>, unless the page has nothing with a shape to draw',
		)
	}

	const seen = new Set()
	const duplicates = new Set()
	for (const match of markup.matchAll(/<[a-z][^>]*?\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
		const id = match[1] ?? match[2]
		if (seen.has(id)) duplicates.add(id)
		seen.add(id)
	}
	if (duplicates.size > 0) {
		errors.push(`repeats id(s), so a comment cannot point at one block: ${[...duplicates].join(', ')}`)
	}

	const itemsWithoutID = [...markup.matchAll(/<[a-z][^>]*\sclass\s*=\s*"([^"]*)"[^>]*>/gi)].filter(
		(match) => match[1].split(/\s+/).includes('item') && !/\sid\s*=/.test(match[0]),
	).length
	if (itemsWithoutID > 0) {
		warnings.push(`has ${itemsWithoutID} class="item" block(s) without an id`)
	}

	const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
		.map((match) => match[1])
		.join('\n')
	const external =
		/<(?:script|img|iframe|video|audio|source)\b[^>]*\ssrc\s*=\s*["']?(?:https?:)?\/\//i.test(markup) ||
		/<link\b[^>]*\shref\s*=\s*["']?(?:https?:)?\/\//i.test(markup) ||
		/@import|url\(\s*["']?(?:https?:)?\/\//i.test(styles)
	if (external) {
		warnings.push('loads a script, style, font, or image from another site')
	}

	return { title, errors, warnings }
}

function main() {
	const argv = process.argv.slice(2)
	if (argv.includes('--help')) {
		console.log(HELP)
		return
	}
	const args = parseArgs(argv)
	const dir = resolve(args.dir)
	if (!existsSync(dir)) throw new Error(`Directory does not exist: ${dir}`)

	const pages = readdirSync(dir)
		.filter((name) => name.endsWith('.html'))
		.map((name) => ({ name, path: join(dir, name), modified: statSync(join(dir, name)).mtimeMs }))
		.sort((a, b) => b.modified - a.modified)
	if (pages.length === 0) throw new Error(`No .html pages in ${dir}`)

	let failed = false
	for (const page of pages) {
		const { title, errors, warnings } = checkPage(readFileSync(page.path, 'utf8'))
		page.title = title || page.name
		for (const error of errors) console.error(`ERROR   ${page.name} ${error}`)
		for (const warning of warnings) console.error(`WARNING ${page.name} ${warning}`)
		if (errors.length > 0) failed = true
	}
	if (failed) {
		console.error('Fix the errors, then run this script again. Nothing was shared.')
		process.exitCode = 1
		return
	}
	if (args.check) {
		console.log(`Checked ${pages.length} page(s): no errors.`)
		return
	}

	switch (args.delivery.kind) {
		case 'local':
			console.log('Local files only; these links are not accessible to other machines:')
			for (const page of pages) console.log(`${page.title}\n  ${pathToFileURL(page.path).href}`)
			break
		case 'hosted':
			console.log('Hosted links (files not uploaded; availability and access not verified):')
			for (const page of pages) {
				console.log(`${page.title}\n  ${new URL(encodeURIComponent(page.name), args.delivery.baseURL).href}`)
			}
			break
		default:
			throw new Error('Unsupported delivery mode')
	}
}

try {
	main()
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
}
