# Develocity API Evidence

Assume full API access to the organization's Develocity instance. Discover the
instance URL, server version, project identity, existing client/connector, and
credential capability from repository configuration and the execution environment.
Do not ask for scan screenshots when an API model can answer the question.

## Collection Procedure

1. Obtain the API manual and OpenAPI specification for the deployed server.
   Prefer the structured Develocity API over raw Export API events when it
   exposes the needed evidence. Discover supported build-list filters, models,
   query limits, pagination, and data availability from that contract. Do not
   invent endpoints or JSON field names from another server version.
2. Use the existing authenticated client or a schema-derived client. Authenticate
   through the supported bearer-token boundary without printing headers or
   persisting tokens in reports. Keep requests within the intended project and
   time window; full API capability is not a reason to export unrelated builds.
3. Enumerate every page for the declared cohort. Follow documented cursors or
   time/build boundaries, deduplicate scan IDs, and preserve the query, time
   bounds, server/API version, and retrieval time. Record truncation explicitly.
   Handle rate limits with bounded backoff and documented retry hints.
4. Resolve summaries to the supported detailed Gradle, task/cache, performance,
   environment, and test models needed by the experiment. Check availability
   per model; a published scan can precede completed processing. Poll only within
   a bounded deadline. Retained or unsupported models cannot be recovered by
   treating a summary as complete evidence.
5. Join scans to source revision and workload. For GitHub Actions, use run ID,
   run attempt, job ID or explicit job identity, matrix dimensions, and invocation
   identity. One job may run several builds; a retry is a distinct attempt.
   Require existing tags/custom values or add minimal durable correlation
   metadata to the build's publishing boundary. Never infer identity solely from
   timestamps or a branch name. Distinguish PR head SHA from tested merge SHA.
6. Validate response shape against the versioned contract. Preserve source scan
   ID, model name, unit, and field mapping for every derived metric. Unknown enum
   values or changed field shapes invalidate that mapping until updated.

## Finite Evidence Outcomes

At any collector boundary distinguish: complete, authentication-failed,
authorization-failed, rate-limited, transport-failed, schema-unsupported,
model-unavailable, processing-pending, query-truncated, and identity-unresolved.
Only complete evidence can enter an acceptance cohort. Keep build failure as an
orthogonal build outcome; an accurately collected failed build is not a
collection failure. Record excluded/incomplete counts to expose selection bias.

If implementing a collector, use closed tagged outcomes carrying the evidence
needed by each state, validate persisted output against a schema, and test
successful collection plus missing models, schema drift, pagination, retry
exhaustion, and ambiguous identity. Emit bounded stage/outcome counts and latency
at discovery, enumeration, model retrieval, validation, and correlation; do not
log payloads, access keys, or full environment values.

Kotlin compiler details may require version-supported Kotlin build reports.
Build-scan custom-value limits can truncate those details even with full API
access. Retain report artifacts when needed and correlate them by invocation.
Use native reports or a focused Gradle Profiler experiment to fill a stated gap;
do not silently replace missing API evidence with a timing guessed from logs.

Authority: [Develocity API manual](https://docs.gradle.com/develocity/api-manual/)
and its versioned OpenAPI specification. Resolve links for the actual server;
current public documentation is not proof of the deployed schema.
