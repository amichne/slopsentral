import Ajv2020 from 'ajv/dist/2020.js';

// Both the source gate and report runner validate raw payloads through this boundary.
export function validateFieldObservations(payload, schema, cases) {
  const validate = new Ajv2020({ strict: false, discriminator: true, allErrors: true }).compile(schema);
  if (!validate(payload)) {
    return { type: 'INVALID_FIELD_OBSERVATIONS', failures: [{ type: 'OBSERVATION_SCHEMA_FAILURE', errors: validate.errors.map(error => ({ path: error.instancePath, message: error.message })) }] };
  }
  const failures = [];
  const inspectPrivacy = (value, location) => {
    if (typeof value === 'string' && value.includes('/Users/')) failures.push({ type: 'PRIVATE_LOCAL_EVIDENCE', path: location });
    else if (Array.isArray(value)) value.forEach((item, index) => inspectPrivacy(item, `${location}/${index}`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => inspectPrivacy(child, `${location}/${key}`));
  };
  inspectPrivacy(payload, '');
  const seen = new Set();
  for (const observation of payload.observations) {
    if (seen.has(observation.id)) failures.push({ type: 'DUPLICATE_OBSERVATION_ID', id: observation.id });
    seen.add(observation.id);
    const routingCase = cases.get(observation.caseId);
    if (!routingCase) {
      failures.push({ type: 'UNKNOWN_ROUTING_CASE', id: observation.id, caseId: observation.caseId });
    } else if (observation.outcome === 'PASS' && (
      observation.route.type !== 'PRIMITIVE_ROUTE' ||
      observation.route.primitive.type !== routingCase.expectedPrimitive.type ||
      observation.route.primitive.name !== routingCase.expectedPrimitive.name
    )) {
      failures.push({ type: 'UNEXPECTED_PASS_ROUTE', id: observation.id, expected: routingCase.expectedPrimitive });
    }
  }
  return failures.length ? { type: 'INVALID_FIELD_OBSERVATIONS', failures } : { type: 'VALID_FIELD_OBSERVATIONS', observations: payload.observations };
}

export function fieldObservationFindings(result) {
  if (result.type === 'VALID_FIELD_OBSERVATIONS') return [];
  return result.failures.flatMap(failure => {
    switch (failure.type) {
      case 'OBSERVATION_SCHEMA_FAILURE': return failure.errors.map(error => `observation schema ${error.path} ${error.message}`);
      case 'DUPLICATE_OBSERVATION_ID': return [`duplicate id ${failure.id}`];
      case 'UNKNOWN_ROUTING_CASE': return [`${failure.id}: caseId ${failure.caseId} does not exist in routing corpus`];
      case 'UNEXPECTED_PASS_ROUTE': return [`${failure.id}: PASS requires the expected primitive route ${failure.expected.type}/${failure.expected.name}`];
      case 'PRIVATE_LOCAL_EVIDENCE': return [`${failure.path}: must not contain private absolute paths`];
      default: throw new Error(`Unsupported field observation failure: ${failure.type}`);
    }
  });
}

export function summarizeFieldObservations(result, cases) {
  if (result.type === 'INVALID_FIELD_OBSERVATIONS') return { type: 'INVALID_FIELD_OBSERVATIONS' };
  const byOutcome = { PASS: 0, DRIFT: 0, BLOCKED: 0, NEEDS_REPLAY_CASE: 0 };
  const proof = { COMPLETE_PROOF: 0, INCOMPLETE_PROOF: 0, UNASSESSED_PROOF: 0 };
  const productive = { USEFUL_OUTCOME: 0, NO_USEFUL_OUTCOME: 0, UNASSESSED_OUTCOME: 0 };
  const covered = new Set();
  let traceSupported = 0;
  for (const observation of result.observations) {
    covered.add(observation.caseId);
    byOutcome[observation.outcome] += 1;
    proof[observation.verification.type] += 1;
    productive[observation.productiveOutcomeObserved.type] += 1;
    if (observation.activationEvidence.type === 'TOOL_TRACE') traceSupported += 1;
  }
  return {
    type: 'FIELD_OBSERVATION_SUMMARY', total: result.observations.length,
    coveredCases: covered.size, coveragePercent: cases.size ? Math.round(100 * covered.size / cases.size) : 0,
    byOutcome, traceSupported, reportedRoutes: result.observations.length - traceSupported,
    completeProof: proof.COMPLETE_PROOF, incompleteProof: proof.INCOMPLETE_PROOF, unassessedProof: proof.UNASSESSED_PROOF,
    usefulOutcomes: productive.USEFUL_OUTCOME, noUsefulOutcomes: productive.NO_USEFUL_OUTCOME, unassessedOutcomes: productive.UNASSESSED_OUTCOME,
  };
}
