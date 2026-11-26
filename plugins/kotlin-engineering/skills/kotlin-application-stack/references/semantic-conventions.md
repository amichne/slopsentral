# OpenTelemetry Semantic Conventions

Use the current OpenTelemetry Semantic Conventions registry as the naming
authority. Repository-pinned SDK and convention versions override remembered
examples.

## Selection Order

1. Search the current [Attribute Registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/)
   for the concept.
2. Prefer a stable registered attribute.
3. If only an experimental attribute fits, record the dependency and migration
   owner before using it.
4. Create a custom attribute only when no registered concept applies. Use a
   reverse-DNS organization namespace and document its type, value set,
   placement, cardinality, and owner.
5. Validate the emitted data against the repository's selected convention
   version and backend queries.

Do not copy a remembered legacy attribute name into new code. Confirm current
names and migration guidance in the
[Semantic Conventions specification](https://opentelemetry.io/docs/specs/semconv/).

## Placement

| Level | Meaning |
| --- | --- |
| Resource | Stable identity and environment of the process or service |
| Instrumentation scope | Identity and version of the instrumentation library |
| Span | One operation or request |
| Log record | One structured event correlated with active context |
| Metric data point | Aggregate observation with bounded dimensions |

Place a fact once at the strongest correct level. Do not repeat resource
identity on every span, put request-specific identity on a resource, or use
high-cardinality values as metric attributes.

## Naming And Cardinality

- Span names describe a bounded operation, typically a stable verb and object
  or a framework-provided route template. They do not contain identifiers, raw
  URLs, query text, or outcome messages.
- Metric names and units follow the selected semantic convention. Metric
  attributes come from finite or tightly bounded sets.
- Structured event names use stable domain vocabulary. Variant-specific detail
  is carried in typed fields, not encoded into the event name.
- Error classification uses a stable type or outcome class. Human-readable
  messages and stack traces are diagnostic detail, never metric dimensions.
- High-cardinality values belong only in spans or logs when they are necessary,
  permitted, and protected by the telemetry data policy.

## Typed Kotlin Mapping

Map sealed Kotlin outcomes to semantic attributes in one exhaustive adapter.
Keep the domain variant as the source of truth and derive the wire string at the
telemetry boundary. Do not let OpenTelemetry string constants become the domain
model.

Unexpected exceptions may use the current `exception.*` conventions. Expected
domain failures use their explicit outcome classification and should not be
fabricated as thrown exceptions merely to fit instrumentation APIs.

## Migration

Treat convention changes as contract migrations:

- identify the pinned old and target convention versions;
- enumerate affected producers, collectors, dashboards, alerts, and queries;
- prefer additive compatibility when consumers cannot move atomically;
- verify the new shape from exported telemetry;
- remove legacy names only after downstream consumers are proven migrated.

Unknown or unsupported convention versions fail closed. Do not silently invent
an attribute or claim compliance from a backend's best-effort normalization.
