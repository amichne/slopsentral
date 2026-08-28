import { Type } from "@sinclair/typebox";

const BoundedText = Type.String({ minLength: 1, maxLength: 16_384 });
const SchemaVersion = Type.Integer({ minimum: 1 });

export const KastCapabilityDocument = Type.Object(
  {
    schemaVersion: SchemaVersion,
    operationRegistry: Type.Object(
      {
        schemaVersion: SchemaVersion,
        operationIds: Type.Array(BoundedText, { maxItems: 1_024 }),
      },
      { additionalProperties: true },
    ),
    wireSchema: Type.Object(
      {
        schemaVersion: SchemaVersion,
        wireSchemaId: BoundedText,
      },
      { additionalProperties: true },
    ),
    cliProjection: Type.Object(
      {
        localFlags: Type.Array(BoundedText, { maxItems: 1_024 }),
        lifecycleCommands: Type.Array(BoundedText, { maxItems: 1_024 }),
        commands: Type.Array(BoundedText, { maxItems: 1_024 }),
      },
      { additionalProperties: true },
    ),
  },
  { additionalProperties: true },
);

export const JsonValue = Type.Recursive((Self) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(Self),
    Type.Record(Type.String(), Self),
  ]),
);

export const KastOutput = Type.Union([
  Type.Object(
    { status: Type.Literal("completed"), document: JsonValue },
    { additionalProperties: false },
  ),
  Type.Object(
    { status: Type.Literal("rejected"), diagnostic: JsonValue },
    { additionalProperties: false },
  ),
]);

export const RelationKind = Type.Union(
  [
    Type.Literal("references"),
    Type.Literal("callers"),
    Type.Literal("callees"),
    Type.Literal("implementations"),
    Type.Literal("inheritors"),
    Type.Literal("overrides"),
    Type.Literal("type-uses"),
  ],
  { description: "One canonical Kast semantic relation." },
);
