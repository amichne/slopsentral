#!/usr/bin/env node
// Adapts the upstream creating-views preview assembly into a browser-independent renderer.
// See ../references/provenance.md. Only render trusted, locally authored fragments.
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HELP = `Render a trusted HTML fragment with the bundled view kit (Node.js 22+).

Usage: node render.mjs INPUT --out OUTPUT [--title TEXT] [--overwrite]

INPUT          HTML body fragment, including inline style/script; at most 100,000 bytes.
--out OUTPUT   Standalone .html file. Its parent directory must already exist.
--title TEXT   Browser title (default: input filename without its extension).
--overwrite    Replace an existing regular output file, but never the input.
--help         Show this help.

No browser, package installation, server, upload, or network request is needed.
Examples:
  node render.mjs chart.source.html --out chart.html
  node render.mjs chart.source.html --out chart.html --title "Queue latency" --overwrite
`
const ICON_MARKER = "'__VIEW_ICONS__'"

class UsageError extends Error {}

function parseArgs(argv) {
	const args = { input: '', output: '', title: '', overwrite: false }
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		if (arg === '--overwrite') {
			args.overwrite = true
		} else if (arg === '--out' || arg === '--title') {
			const value = argv[++index]
			if (!value || value.startsWith('--')) throw new UsageError(`${arg} requires a value`)
			if (arg === '--out') args.output = value
			else args.title = value
		} else if (arg.startsWith('-')) {
			throw new UsageError(`Unknown option: ${arg}`)
		} else if (!args.input) {
			args.input = arg
		} else {
			throw new UsageError('Only one input fragment is accepted')
		}
	}
	if (!args.input || !args.output) throw new UsageError('INPUT and --out OUTPUT are required')
	if (!/\.html?$/i.test(args.output)) throw new UsageError('--out must name an .html or .htm file')
	return args
}

function escapeText(text) {
	return text.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
	})[character])
}

// Pure assembly. Filesystem reads and writes stay in main(). This is not an HTML sanitizer.
export function renderView(fragment, kit, title) {
	if (!fragment.trim()) throw new Error('Input fragment is empty')
	if (Buffer.byteLength(fragment, 'utf8') > 100_000) throw new Error('Input fragment exceeds 100,000 bytes; aggregate the data first')
	if (/<!doctype\b|<\/?(?:html|head|body)\b/i.test(fragment)) {
		throw new Error('Expected an HTML body fragment, not a complete document; omit the document wrapper')
	}
	if (kit.script.split(ICON_MARKER).length !== 2) throw new Error('Bundled kit has an invalid icon insertion marker')
	// Escape < in the sprite's JS string so it cannot terminate the surrounding script element.
	const script = kit.script.replace(ICON_MARKER, () => JSON.stringify(kit.icons).replace(/</g, '\\u003c'))
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">
<title>${escapeText(title)}</title>
<style>${kit.style}</style>
<script>${script}</script>
</head>
<body><main class="view-shell">
${fragment}
</main></body>
</html>
`
}

function main() {
	const argv = process.argv.slice(2)
	if (argv.includes('--help')) {
		console.log(HELP)
		return
	}
	const args = parseArgs(argv)
	const input = realpathSync(resolve(args.input))
	const output = resolve(args.output)
	const existing = lstatSync(output, { throwIfNoEntry: false })
	if (input === output) throw new Error('Output must not replace the input fragment')
	if (existing) {
		if (!existing.isFile() || existing.isSymbolicLink()) throw new Error('Output must be a regular file, not a directory or symlink')
		const source = lstatSync(input)
		if (source.dev === existing.dev && source.ino === existing.ino) throw new Error('Output must not replace the input fragment')
		if (!args.overwrite) throw new Error('Output exists; use --overwrite to update that file explicitly')
	}
	const kitDir = join(dirname(fileURLToPath(import.meta.url)), '../assets/kit')
	const kit = {
		style: readFileSync(join(kitDir, 'kit.css'), 'utf8'),
		script: readFileSync(join(kitDir, 'kit.js'), 'utf8'),
		icons: readFileSync(join(kitDir, 'icons.svg'), 'utf8'),
	}
	const title = args.title || basename(input).replace(/\.html?$/i, '')
	const document = renderView(readFileSync(input, 'utf8'), kit, title)
	writeFileSync(output, document, { flag: args.overwrite ? 'w' : 'wx' })
	console.log(`Local view (not uploaded): ${pathToFileURL(output).href}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main()
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error))
		if (error instanceof UsageError) console.error(HELP)
		process.exitCode = error instanceof UsageError ? 2 : 1
	}
}
