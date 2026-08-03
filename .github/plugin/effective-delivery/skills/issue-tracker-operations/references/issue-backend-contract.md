# Issue Backend Facade Requirement Matrix

**Status:** Normative

**Version:** 1

**Scope:** Read-only issue selection, issue reads, capability discovery, and direct blocker maps.

This specification defines observable behavior. It does not define provider
internals. The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## 1. Verification methods

| Code | Verification method |
|---|---|
| `INS` | Inspect source, specifications, or composed manifests. |
| `CT` | Run a contract test against public behavior. |
| `UT` | Run a focused deterministic test. |
| `IT` | Run a test across the facade and a provider boundary. |
| `ADV` | Run a misuse, containment, or secret-seeding test. |

Documentation alone does not satisfy a behavioral requirement.

## 2. Dependency order

```text
G0  Input and result contract
 ↓
G1  Backend selection and capability admission
 ↓
G2  Provider command execution
 ↓
G3  Provider output normalization
 ↓
G4  Issue and direct blocker evidence
```

A later gate MAY be prototyped early. It MUST NOT be accepted before its
prerequisite gate passes.

| Gate | Exit condition |
|---|---|
| `G0` | Inputs, outcomes, failures, and coverage have closed contracts. |
| `G1` | One supported backend is selected, and the requested operation is admitted. |
| `G2` | One declared provider command executes with captured status. |
| `G3` | Provider data parses into the canonical result or produces rejection. |
| `G4` | Direct blocker direction and bounded coverage are explicit. |

## 3. Control requirements

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| CTL-001 | Requirement identifiers MUST be permanent. | Retired identifiers remain reserved. | INS | None |
| CTL-002 | Each requirement MUST define one verifiable obligation. | Each row has one pass or fail condition. | INS | None |
| CTL-003 | Implemented behavior MUST reference executable evidence. | Section 10 maps behavior to commands. | INS, CT | CTL-001 |
| CTL-004 | A requirement MUST NOT pass before its prerequisites pass. | Tests reject invalid completion order. | CT | CTL-003 |

## 4. Selection and capability requirements

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| CFG-001 | Each operation MUST select exactly one backend. | The result contains one `backend` value. | CT | G0 |
| CFG-002 | `--backend` MUST override environment selection. | A conflicting environment value does not change the explicit selection. | CT | CFG-001 |
| CFG-003 | Environment selection MUST use `EFFECTIVE_DELIVERY_ISSUE_BACKEND`. | `github` and `jira` select their adapters. | CT | CFG-001 |
| CFG-004 | Unsupported backend values MUST be rejected before provider execution. | The failure is `BACKEND_UNSUPPORTED`, and no provider command runs. | CT, ADV | CFG-003 |
| CFG-005 | This specification MUST NOT define a GitLab backend. | Capability and selection contracts contain no GitLab variant. | INS, CT | CFG-004 |
| CAP-001 | Capability output MUST identify native and unsupported operations. | Each known capability has one support value. | CT | CFG-001 |
| CAP-002 | Unsupported operations MUST NOT reach a provider command. | No write command exists in the facade parser. | INS, CT | CAP-001 |

## 5. Provider requirements

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| GH-001 | GitHub issue reads MUST execute through native `gh`. | The command evidence names `gh`. | IT | G1 |
| GH-002 | GitHub blocker reads MUST use the versioned dependency endpoints. | Both `blocked_by` and `blocking` endpoints execute. | IT | GH-001 |
| GH-003 | GitHub API requests MUST declare version `2026-03-10`. | Each dependency command includes the version header. | IT | GH-002 |
| JIR-001 | Jira work item reads MUST execute through Atlassian `acli`. | The command evidence names `acli`. | IT | G1 |
| JIR-002 | Jira reads MUST use the `jira workitem` command family. | View and link-list tests preserve the command path. | IT | JIR-001 |
| JIR-003 | The facade MUST NOT invoke the legacy `jira` executable. | Provider doubles expose only `acli` and `gh`. | INS, CT | JIR-001 |
| JIR-004 | The facade MUST NOT wrap `jira-resolve-ticket`. | Effective Delivery composes this independent primitive. | INS | JIR-003 |

The GitHub dependency endpoints are defined by the
[GitHub issue dependency API](https://docs.github.com/en/rest/issues/issue-dependencies?apiVersion=2026-03-10).
The Jira commands are defined by the Atlassian CLI references for
[`workitem view`](https://developer.atlassian.com/cloud/acli/reference/commands/jira-workitem-view/)
and [`workitem link list`](https://developer.atlassian.com/cloud/acli/reference/commands/jira-workitem-link-list/).

## 6. Dependency map requirements

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| DEP-001 | Each edge MUST use one directional `BLOCKS` relation. | The source blocks the target in every edge. | CT, IT | G3 |
| DEP-002 | Incoming blockers MUST become edges from the blocker to the root. | `KAST-7` to `KAST-42` is preserved. | CT | DEP-001 |
| DEP-003 | Outgoing blockers MUST become edges from the root to the blocked issue. | `KAST-42` to `KAST-99` is preserved. | CT | DEP-001 |
| DEP-004 | Blocker links MUST remain distinct from containment. | Coverage marks hierarchy as `UNSUPPORTED`. | CT | DEP-001 |
| DEP-005 | The map MUST declare a traversal depth of one. | Coverage contains `depth: 1`. | CT | DEP-001 |
| DEP-006 | A direct map MUST NOT claim transitive completeness. | Coverage marks transitive traversal as `UNSUPPORTED`. | CT | DEP-005 |

## 7. Output and failure requirements

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| OUT-001 | Every operation MUST produce `COMPLETE` or `REJECTED`. | The schema excludes other outcomes. | INS, CT | G0 |
| OUT-002 | Canonical results MUST be machine-readable JSON. | `--json` validates against the closed schema. | CT | OUT-001 |
| OUT-003 | Default output MUST be TOON derived from the canonical result. | Equivalent fields occur in JSON and TOON. | CT | OUT-002 |
| OUT-004 | Every provider call MUST retain executable, arguments, and exit status. | The result contains command evidence. | CT, IT | G2 |
| OUT-005 | A complete direct map MUST include bounded coverage. | Depth, blocker, hierarchy, and transitive states exist. | CT | DEP-005 |
| FLR-001 | Each failure MUST have a stable identifier. | Equivalent failures retain their identifier. | CT | OUT-001 |
| FLR-002 | A failure MUST state whether mutation started. | Every rejection says `NOT_STARTED`. | CT | FLR-001 |
| FLR-003 | Provider JSON failures MUST remain distinct from command failures. | Invalid JSON and nonzero exit use different identifiers. | UT, IT | G2 |
| FLR-004 | Transport success MUST NOT imply semantic success. | Invalid provider JSON produces `REJECTED`. | CT | FLR-003 |

The human projection follows the current
[TOON v4.1 specification](https://toonformat.dev/reference/spec). Canonical JSON
remains the validation authority.

## 8. Security and mutation requirements

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| SEC-001 | Provider commands MUST execute without a shell. | The runner passes an argument vector to `subprocess.run`. | INS | G2 |
| SEC-002 | Results MUST NOT include the full process environment. | Output contains only declared fields and command evidence. | ADV | OUT-002 |
| SEC-003 | Provider error text MUST NOT become canonical evidence. | Failure output excludes raw standard error. | ADV | FLR-001 |
| MUT-001 | This version MUST NOT expose a remote mutation command. | The parser contains only capabilities, view, and dependency-map. | INS, CT | CAP-002 |
| MUT-002 | A complete read MUST NOT imply write support. | Write capabilities remain `UNSUPPORTED`. | CT | MUT-001 |

## 9. Explicit non-goals

| ID | Requirement | Acceptance evidence | Verification | Depends on |
|---|---|---|---|---|
| NGL-001 | The facade MUST NOT infer blocker links from issue body text. | Only native provider relationship data creates edges. | INS, IT | DEP-001 |
| NGL-002 | The facade MUST NOT collapse parent-child links into blockers. | Hierarchy remains a separate capability. | CT | DEP-004 |
| NGL-003 | The facade MUST NOT claim support for unimplemented writes. | Create, update, and comment stay `UNSUPPORTED`. | CT | CAP-001 |
| NGL-004 | The facade MUST NOT claim arbitrary backend support. | Supported backends form a closed set. | CT | CFG-004 |

## 10. Requirement-to-evidence ledger

| Evidence | Requirements |
|---|---|
| `python3 -m unittest discover -s source/skills/issue-tracker-operations/scripts/tests -p 'test_*.py'` | CFG-001 through CFG-005, CAP-001, GH-001 through GH-003, JIR-001 through JIR-003, DEP-001 through DEP-006, OUT-001 through OUT-005, FLR-001, FLR-002, MUT-001, MUT-002, NGL-002 through NGL-004 |
| `node source/skills/manage-json-schemas/scripts/schema-contracts.js policy --schema source/skills/issue-tracker-operations/references/issue-backend-result.schema.json` | OUT-001, OUT-002 |
| `schema-contracts.js validate` against each file under `references/examples` | OUT-001 through OUT-005, FLR-001, FLR-002 |
| `node --test source/tools/tests/effective-delivery-plugin.test.mjs` | JIR-004, CAP-002 |
| `node source/tools/validate-source-graph.mjs` | CTL-003, JIR-004 |
| `git diff --check` | CTL-003 |

## 11. Red-green acceptance

| Phase | Required evidence |
|---|---|
| `BASELINE` | Existing Effective Delivery tests and source-graph checks pass. |
| `RED` | Facade tests fail because the executable and plugin composition are absent. |
| `GREEN` | The same tests pass with the new facade and composed primitive. |

Implementation existence does not establish requirement completion.
