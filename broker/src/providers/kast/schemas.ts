import { Type } from "@sinclair/typebox";

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
