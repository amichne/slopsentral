import { Type } from "@sinclair/typebox";

const BoundedText = Type.String({ minLength: 1, maxLength: 16_384 });
const CliToken = Type.String({ minLength: 1, maxLength: 4_096 });
const InputField = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-z][A-Za-z0-9]*$",
});
const OperationId = Type.String({
  minLength: 3,
  maxLength: 128,
  pattern: "^[a-z][a-z0-9]*(?:\\.[a-z][a-z0-9]*)+$",
});
const SchemaVersion = Type.Integer({ minimum: 1 });
const OpenComponent = Type.Object({}, { additionalProperties: true });
const ToolName = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-z][a-z0-9_]*$",
});

const KastServerToolFields = {
  operationId: OperationId,
  name: ToolName,
  description: BoundedText,
  deferLoading: Type.Boolean(),
  cliUsage: BoundedText,
  inputSchema: Type.Unknown(),
  outputSchema: Type.Unknown(),
  invocation: Type.Object(
    {
      type: Type.Literal("CLI"),
      command: Type.Array(CliToken, { minItems: 1, maxItems: 16 }),
      bindings: Type.Array(
        Type.Object(
          {
            type: Type.Literal("OPTION"),
            inputField: InputField,
            option: Type.String({
              minLength: 3,
              maxLength: 128,
              pattern: "^--[a-z][a-z0-9-]*$",
            }),
          },
          { additionalProperties: false },
        ),
        { maxItems: 64 },
      ),
    },
    { additionalProperties: false },
  ),
} as const;

const KastServerToolV1Document = Type.Object(KastServerToolFields, {
  additionalProperties: false,
});

const KastServerToolV2Document = Type.Object(
  {
    ...KastServerToolFields,
    approvalPolicy: Type.Union([
      Type.Literal("none"),
      Type.Literal("explicit"),
    ]),
  },
  { additionalProperties: false },
);

const KastServerProjectionDocument = Type.Union([
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      namespace: Type.Literal("kast"),
      tools: Type.Array(KastServerToolV1Document, {
        minItems: 1,
        maxItems: 64,
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(2),
      namespace: Type.Literal("kast"),
      tools: Type.Array(KastServerToolV2Document, {
        minItems: 1,
        maxItems: 64,
      }),
    },
    { additionalProperties: false },
  ),
]);

export const KastCapabilityDocument = Type.Object(
  {
    schemaVersion: SchemaVersion,
    operationRegistry: Type.Optional(OpenComponent),
    wireSchema: Type.Optional(OpenComponent),
    cliProjection: Type.Optional(OpenComponent),
    serverProjection: KastServerProjectionDocument,
  },
  { additionalProperties: true },
);
