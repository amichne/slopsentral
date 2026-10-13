import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { auditProfileComposition, loadCatalog, pluginClosure } from '../catalog.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const readSchema = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const profileSchema = readSchema('source/schemas/profiles/workflow-profile.schema.json');
const catalogSchema = readSchema('source/schemas/catalog/catalog.schema.json');
const canonical = new Map(['skills', 'agents', 'instructions', 'hooks', 'resources']
  .flatMap(kind => catalog.marketplace[kind] ?? [])
  .map(ref => [`${ref.type}/${ref.name}`, ref]));

function taggedExamples(value, type) {
  if (Array.isArray(value)) return value.flatMap(item => taggedExamples(item, type));
  if (!value || typeof value !== 'object') return [];
  return [...(value.type === type ? [value] : []),
    ...Object.values(value).flatMap(item => taggedExamples(item, type))];
}

function plugin(name) {
  const result = catalog.plugins.find(candidate => candidate.name === name);
  assert.ok(result, `example references missing plugin ${name}`);
  return result;
}

test('workflow profile examples resolve their plugin selections', () => {
  const examples = taggedExamples(profileSchema, 'WORKFLOW_PROFILE');
  assert.ok(examples.length > 0);
  for (const example of examples) {
    for (const name of example.plugins) plugin(name);
    assert.deepEqual(auditProfileComposition(catalog, example), []);
  }
  for (const name of profileSchema.properties.plugins.items.examples) plugin(name);
  for (const names of profileSchema.properties.plugins.examples)
    for (const name of names) plugin(name);
});

test('catalog plugin examples resolve each advertised primitive in its owner', () => {
  const examples = taggedExamples(catalogSchema, 'CATALOG_PLUGIN');
  assert.ok(examples.length > 0);
  for (const example of examples) {
    const closure = pluginClosure(catalog, plugin(example.name));
    for (const identity of example.primitives)
      assert.ok(closure.refs.has(identity), `${example.name} does not compose ${identity}`);
  }
  const properties = catalogSchema.properties.plugins.items.properties;
  for (const name of properties.name.examples) plugin(name);
  for (const identity of properties.primitives.items.examples)
    assert.ok(canonical.has(identity), `example references missing primitive ${identity}`);
});

test('catalog asset examples resolve their canonical paths and composing plugins', () => {
  const examples = taggedExamples(catalogSchema, 'CATALOG_ASSET');
  assert.ok(examples.length > 0);
  for (const example of examples) {
    const identity = `${example.primitiveType}/${example.name}`;
    const reference = canonical.get(identity);
    assert.ok(reference, `example references missing asset ${identity}`);
    assert.equal(example.path, reference.path);
    for (const name of example.plugins)
      assert.ok(pluginClosure(catalog, plugin(name)).refs.has(identity), `${name} does not compose ${identity}`);
  }
  const properties = catalogSchema.properties.assets.items.properties;
  for (const name of properties.name.examples)
    assert.ok([...canonical.values()].some(ref => ref.name === name), `example references missing asset ${name}`);
  for (const sourcePath of properties.path.examples)
    assert.ok([...canonical.values()].some(ref => ref.path === sourcePath), `example references missing path ${sourcePath}`);
  for (const name of properties.plugins.items.examples) plugin(name);
  for (const names of properties.plugins.examples)
    for (const name of names) plugin(name);
});
