// Adapter to the shared AJV source validator, catalog closure, and evidence grammar.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadCatalog, pluginClosure } from '../catalog.mjs';
import { currentSourceEvidenceFindings, currentSourceLocalPaths } from '../routing-source-evidence.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
class UnsupportedSource extends Error {}

function evidence(frozen, repository) {
  const directory = path.join(frozen, 'source/evals');
  const paths = new Set();
  for (const name of fs.readdirSync(directory, { recursive: true })) {
    if (!name.endsWith('.json')) continue;
    const payload = read(path.join(directory, name));
    if (payload.type !== 'ROUTING_CASE_SET') continue;
    for (const {source} of payload.cases) {
      const refs = currentSourceLocalPaths(source).filter(ref => !ref.startsWith('source/'));
      if (refs.length && currentSourceEvidenceFindings({type:'CURRENT_SOURCE', evidenceRefs:refs}, repository, name).length)
        throw new Error('Invalid current evidence');
      for (const ref of refs) paths.add(ref);
    }
  }
  return [...paths].sort();
}

function graph(frozen) {
  const check = execFileSync(process.execPath, [path.resolve(import.meta.dirname, '../validate-source-graph.mjs'), '--repo', frozen], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!check.startsWith('OK')) throw new Error('Invalid source');
  const catalog = loadCatalog(frozen);
  const market = catalog.marketplace;
  if (market.adapters || market.externalMarketplaces?.length) throw new UnsupportedSource();
  const plugins = market.plugins.map(entry => {
    const p = catalog.plugins.find(plugin => plugin.name === entry.name);
    if (p.adapters || entry.plugin.source.type !== 'LOCAL_SOURCE' || entry.plugin.source.path !== './plugins/' + entry.name)
      throw new UnsupportedSource();
    const refs = [...pluginClosure(catalog, p).refs.values()].map(ref => {
      if (ref.source.type !== 'LOCAL_SOURCE' || ref.source.path !== './') throw new UnsupportedSource();
      const reference = { type:ref.type, name:ref.name, sourcePath:'source/' + ref.path };
      if (ref.type === 'HOOK') {
        const hook = catalog.definitions.get('HOOK/' + ref.name);
        reference.hook = { ...hook, adapter:read(path.join(frozen, 'source', hook.path)) };
      }
      if (ref.type === 'AGENT') {
        reference.text = fs.readFileSync(path.join(frozen, reference.sourcePath), 'utf8');
        if (!/^---\n[^]*\n---\n/.test(reference.text)) throw new Error('Incomplete agent frontmatter');
      }
      return reference;
    }).sort((a,b) => (a.type + '/' + a.sourcePath).localeCompare(b.type + '/' + b.sourcePath, 'en'));
    return {name:p.name, description:p.description, version:p.version, tags:entry.tags ?? [],
      interface:p.interface ?? {}, references:refs,
      ...(p.codexMcpServers ? {mcp:'source/plugins/' + p.name + '/.mcp.json'} : {})};
  });
  return {name:market.name, description:market.description, owner:market.owner, plugins};
}

try {
  const [operation, frozen, repository] = process.argv.slice(2);
  console.log(JSON.stringify(operation === 'evidence' ? evidence(frozen, repository) : graph(frozen)));
} catch (error) {
  process.exitCode = error instanceof UnsupportedSource ? 2 : 1;
}
