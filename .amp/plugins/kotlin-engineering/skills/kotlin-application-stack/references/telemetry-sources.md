# Sources And Synthesis Record

This skill is a Kotlin-focused local rewrite. It does not copy upstream skill
payloads, scripts, examples, templates, or vendor-specific configuration.

## Audited Skills

| Source | Audited commit | License | Decision |
| --- | --- | --- | --- |
| [addyosmani/agent-skills: observability-and-instrumentation](https://github.com/addyosmani/agent-skills/tree/d2c37ef6225dd8726cdd369a8030307f48592d26/skills/observability-and-instrumentation) | `d2c37ef6225dd8726cdd369a8030307f48592d26` | MIT | Retain operator-question-first design, signal selection, structured events, cardinality discipline, actionable alerts, and telemetry verification |
| [dash0hq/agent-skills: otel-semantic-conventions](https://github.com/dash0hq/agent-skills/tree/b809d934546a57c740b567014f5a0c67b906ebb5/skills/otel-semantic-conventions) | `b809d934546a57c740b567014f5a0c67b906ebb5` | Apache-2.0 | Retain registry-first naming, stability checks, correct placement, bounded cardinality, namespaced custom attributes, and migration discipline |

## Local Synthesis

Retain:

- every signal answers a concrete operator question;
- metrics detect aggregate change, traces localize work, and structured logs
  explain individual events;
- metric dimensions and span names remain bounded;
- symptom-based alerts are actionable and verified;
- OpenTelemetry registry names outrank custom vocabulary.

Strengthen or add:

- pure Kotlin domain logic with telemetry confined to explicit effect
  boundaries;
- exhaustive mapping from closed typed outcomes to stable telemetry classes;
- expected domain failure kept distinct from unexpected exceptions;
- repository-pinned convention versions and live registry authority over copied
  rename tables;
- fail-closed treatment of unknown convention versions and unsupported
  attributes.

Exclude:

- TypeScript- and Node-specific setup examples;
- Dash0-only derived attributes, ingestion behavior, and product links;
- universal sampling, alert-severity, or correlation-ID mandates that require
  deployment-specific evidence;
- copied attribute catalogs that will drift from the OpenTelemetry registry.

## First-Party Authority

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [OpenTelemetry Attribute Registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/)
- [OpenTelemetry semantic-conventions repository](https://github.com/open-telemetry/semantic-conventions)
