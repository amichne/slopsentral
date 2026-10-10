import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
const schema = JSON.parse(fs.readFileSync(new URL('../source/schemas/primitives/resource-reference.schema.json', import.meta.url)));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

function freezeReference(value) {
  return Object.freeze({ type: 'RESOURCE', name: value.name,
    source: Object.freeze({ type: 'LOCAL_SOURCE', path: './' }), path: value.path,
    ...(value.dependsOn ? { dependsOn: Object.freeze(value.dependsOn.map(freezeReference)) } : {}) });
}

/** Resource references name regular authored files; they never declare workflows. */
export function validateResourceReference(value) {
  if (validate(value)) return { type: 'RESOURCE_REFERENCE_VALID', reference: freezeReference(value) };
  return { type: 'RESOURCE_REFERENCE_REJECTED', reason: 'INVALID_REFERENCE',
    diagnostics: validate.errors.slice(0, 8).map(({ instancePath, keyword }) => ({ path: instancePath, keyword })) };
}
