#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const repoArgIndex = args.indexOf("--repo");
const observationsArgIndex = args.indexOf("--observations");
const jsonOutput = args.includes("--json");
const requireAllObserved = args.includes("--require-all-observed");
const repoRoot =
  repoArgIndex >= 0 && args[repoArgIndex + 1]
    ? path.resolve(args[repoArgIndex + 1])
    : process.cwd();
const observationsPath =
  observationsArgIndex >= 0 && args[observationsArgIndex + 1]
    ? path.resolve(repoRoot, args[observationsArgIndex + 1])
    : path.join(repoRoot, "source/evals/routing/fixtures/golden-routing-observations.json");

const findings = [];

function fail(message) {
  findings.push(message);
}

function readJson(absolutePath) {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`${relativeToRepo(absolutePath)}: invalid JSON (${error.message})`);
    return null;
  }
}

function relativeToRepo(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function listJsonFiles(relativePath) {
  const root = path.join(repoRoot, relativePath);
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.name.endsWith(".json")) {
        output.push(absolutePath);
      }
    }
  };
  visit(root);
  return output.sort();
}

function assertNoPrivateLocalStrings(owner, value) {
  if (typeof value === "string") {
    if (value.includes("/Users/")) fail(`${owner}: must not contain private absolute paths`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrivateLocalStrings(owner, item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) assertNoPrivateLocalStrings(owner, child);
}

function loadRoutingCases() {
  const cases = new Map();
  const caseFiles = [];
  for (const file of listJsonFiles("source/evals/routing")) {
    const payload = readJson(file);
    if (!payload || payload.type !== "ROUTING_CASE_SET") continue;
    caseFiles.push(relativeToRepo(file));
    if (payload.schemaVersion !== 2) {
      fail(`${relativeToRepo(file)}: routing case set must use schemaVersion 2`);
      continue;
    }
    for (const routingCase of payload.cases ?? []) {
      assertNoPrivateLocalStrings(`${relativeToRepo(file)}:${routingCase.id ?? "<missing-id>"}`, routingCase);
      if (cases.has(routingCase.id)) {
        fail(`${relativeToRepo(file)}: duplicate routing case id ${routingCase.id}`);
      } else {
        cases.set(routingCase.id, { file: relativeToRepo(file), ...routingCase });
      }
    }
  }
  return { cases, caseFiles };
}

function assertSubset(owner, field, observed, expected) {
  if (!Array.isArray(observed) || observed.length === 0) {
    fail(`${owner}: ${field} must be a non-empty array`);
    return;
  }
  const expectedSet = new Set(expected);
  for (const value of observed) {
    if (!expectedSet.has(value)) fail(`${owner}: ${field} contains text not present in case contract: ${value}`);
  }
}

function assertSameSet(owner, field, observed, expected) {
  assertSubset(owner, field, observed, expected);
  const observedSet = new Set(observed ?? []);
  for (const value of expected) {
    if (!observedSet.has(value)) fail(`${owner}: ${field} is missing required item: ${value}`);
  }
}

function scoreObservations(cases) {
  const payload = readJson(observationsPath);
  if (!payload) {
    return {
      observationCount: 0,
      passed: 0,
      observedCaseIds: new Set(),
      requiredCaseIds: new Set(),
    };
  }
  const ownerPath = relativeToRepo(observationsPath);
  assertNoPrivateLocalStrings(ownerPath, payload);
  if (payload.type !== "ROUTING_REPLAY_SET") fail(`${ownerPath}: type must be ROUTING_REPLAY_SET`);
  if (payload.schemaVersion !== 1) fail(`${ownerPath}: schemaVersion must be 1`);
  const requiredCaseIds = requiredCasesFromPayload(ownerPath, payload, cases);
  if (!Array.isArray(payload.observations) || payload.observations.length === 0) {
    fail(`${ownerPath}: observations must be a non-empty array`);
    return {
      observationCount: 0,
      passed: 0,
      observedCaseIds: new Set(),
      requiredCaseIds,
    };
  }

  const seen = new Set();
  let passed = 0;
  for (const [index, observation] of payload.observations.entries()) {
    const owner = `${ownerPath}: observations[${index}]`;
    if (observation.type !== "ROUTING_OBSERVATION") fail(`${owner}: type must be ROUTING_OBSERVATION`);
    if (seen.has(observation.caseId)) fail(`${owner}: duplicate observation for ${observation.caseId}`);
    seen.add(observation.caseId);

    const routingCase = cases.get(observation.caseId);
    if (!routingCase) {
      fail(`${owner}: caseId ${observation.caseId} does not exist in routing corpus`);
      continue;
    }

    const expectedPrimitive = routingCase.expectedPrimitive;
    if (
      observation.routedPrimitive?.type !== expectedPrimitive.type ||
      observation.routedPrimitive?.name !== expectedPrimitive.name
    ) {
      fail(
        `${owner}: routed primitive ${observation.routedPrimitive?.type ?? "<missing>"}/${
          observation.routedPrimitive?.name ?? "<missing>"
        } does not match expected ${expectedPrimitive.type}/${expectedPrimitive.name}`,
      );
    }

    assertSubset(owner, "satisfiedAllowedActions", observation.satisfiedAllowedActions, routingCase.allowedActions);
    assertSubset(
      owner,
      "satisfiedVerificationEvidence",
      observation.satisfiedVerificationEvidence,
      routingCase.verificationEvidence,
    );
    assertSameSet(owner, "avoidedForbiddenActions", observation.avoidedForbiddenActions, routingCase.forbiddenActions);
    if (typeof observation.notes !== "string" || !observation.notes.trim()) {
      fail(`${owner}: notes is required`);
    }
    passed += 1;
  }

  for (const caseId of requiredCaseIds) {
    if (!seen.has(caseId)) fail(`${ownerPath}: missing golden observation for required case ${caseId}`);
  }
  if (requireAllObserved) {
    for (const caseId of cases.keys()) {
      if (!seen.has(caseId)) fail(`${ownerPath}: missing observation for routing case ${caseId}`);
    }
  }

  return { observationCount: payload.observations.length, passed, observedCaseIds: seen, requiredCaseIds };
}

function requiredCasesFromPayload(ownerPath, payload, cases) {
  if (payload.requiredCaseIds === undefined) return new Set();
  if (!Array.isArray(payload.requiredCaseIds) || payload.requiredCaseIds.length === 0) {
    fail(`${ownerPath}: requiredCaseIds must be a non-empty array when provided`);
    return new Set();
  }
  const required = new Set();
  for (const caseId of payload.requiredCaseIds) {
    if (typeof caseId !== "string" || !caseId.trim()) {
      fail(`${ownerPath}: requiredCaseIds contains a non-string or empty value`);
      continue;
    }
    if (!cases.has(caseId)) fail(`${ownerPath}: requiredCaseIds references missing routing case ${caseId}`);
    required.add(caseId);
  }
  return required;
}

const { cases, caseFiles } = loadRoutingCases();
const replay = scoreObservations(cases);
const unobservedCases = [...cases.keys()].filter((caseId) => !replay.observedCaseIds.has(caseId)).sort();

const summary = {
  routingCaseFiles: caseFiles.length,
  routingCases: cases.size,
  requiredCases: replay.requiredCaseIds.size,
  observations: replay.observationCount,
  observedRoutingCases: replay.observedCaseIds.size,
  unobservedRoutingCases: unobservedCases.length,
  passedObservations: findings.length === 0 ? replay.passed : 0,
  coveragePercent: cases.size === 0 ? 0 : Math.round((replay.observedCaseIds.size / cases.size) * 100),
};

if (findings.length > 0) {
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: false, summary, unobservedCases, findings }, null, 2));
  } else {
    for (const finding of findings) console.error(`ERROR ${finding}`);
  }
  process.exit(1);
}

if (jsonOutput) {
  console.log(JSON.stringify({ ok: true, summary, unobservedCases }, null, 2));
} else {
  console.log(
    `OK routing evals: ${summary.routingCases} cases, ${summary.passedObservations}/${summary.requiredCases} required observations passed, ${summary.observedRoutingCases}/${summary.routingCases} cases observed`,
  );
}
