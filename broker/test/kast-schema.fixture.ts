const textSchema = {
  type: "string",
  minLength: 1,
  maxLength: 16_384,
} as const;

const countSchema = {
  type: "integer",
  minimum: 1,
  maximum: 1_000,
} as const;

const outputSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", const: "completed" },
        document: {},
      },
      required: ["status", "document"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", const: "rejected" },
        diagnostic: {},
      },
      required: ["status", "diagnostic"],
    },
  ],
} as const;

const tool = (
  operationId: string,
  name: string,
  description: string,
  cliUsage: string,
  command: readonly string[],
  inputSchema: Readonly<Record<string, unknown>>,
  bindings: readonly (readonly [inputField: string, option: string])[],
) => ({
  operationId,
  name,
  description,
  deferLoading: true,
  cliUsage,
  inputSchema,
  outputSchema,
  invocation: {
    type: "CLI",
    command: [...command],
    bindings: bindings.map(([inputField, option]) => ({
      type: "OPTION",
      inputField,
      option,
    })),
  },
});

export const compatibleKastSchema = (schemaVersion = 1) => ({
  schemaVersion,
  operationRegistry: {
    schemaVersion,
    operationIds: ["symbol.discover", "symbol.resolve", "traversal.run"],
  },
  wireSchema: {
    schemaVersion,
    wireSchemaId: `kast-wire-v${schemaVersion}`,
  },
  cliProjection: {
    localFlags: ["--help", "--version", "--schema"],
    lifecycleCommands: ["start", "stop", "status"],
    commands: [
      "symbol discover --mode <name|location|structure|text> ... --limit <1..1000>",
      "symbol resolve --candidate <candidate-selector>",
      "traversal run --selector <exact-selector> --relation <kind> --maximum-depth <1..1000> --maximum-results <1..1000>",
    ],
  },
  serverProjection: {
    schemaVersion: 1,
    namespace: "kast",
    tools: [
      tool(
        "symbol.discover",
        "symbol_discover",
        "Discover bounded Kotlin symbol candidates.",
        "symbol discover --mode name --query <query> --kind <kind> --match <match> --limit <1..1000>",
        ["symbol", "discover"],
        {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                mode: { type: "string", const: "name" },
                query: textSchema,
                kind: { type: "string", enum: ["file", "class", "symbol"] },
                match: {
                  type: "string",
                  enum: ["fuzzy", "exact-name"],
                },
                limit: countSchema,
              },
              required: ["mode", "query", "kind", "match", "limit"],
            },
          ],
        },
        [
          ["mode", "--mode"],
          ["query", "--query"],
          ["kind", "--kind"],
          ["match", "--match"],
          ["limit", "--limit"],
        ],
      ),
      tool(
        "symbol.resolve",
        "symbol_resolve",
        "Resolve one discovery candidate.",
        "symbol resolve --candidate <candidate-selector>",
        ["symbol", "resolve"],
        {
          type: "object",
          additionalProperties: false,
          properties: { candidate: textSchema },
          required: ["candidate"],
        },
        [["candidate", "--candidate"]],
      ),
      tool(
        "traversal.run",
        "traversal_run",
        "Traverse one bounded semantic relation.",
        "traversal run --selector <exact-selector> --relation <kind> --maximum-depth <1..1000> --maximum-results <1..1000>",
        ["traversal", "run"],
        {
          type: "object",
          additionalProperties: false,
          properties: {
            selector: textSchema,
            relation: {
              type: "string",
              enum: [
                "references",
                "callers",
                "callees",
                "implementations",
                "inheritors",
                "overrides",
                "type-uses",
              ],
            },
            maximumDepth: countSchema,
            maximumResults: countSchema,
          },
          required: ["selector", "relation", "maximumDepth", "maximumResults"],
        },
        [
          ["selector", "--selector"],
          ["relation", "--relation"],
          ["maximumDepth", "--maximum-depth"],
          ["maximumResults", "--maximum-results"],
        ],
      ),
    ],
  },
});

export const dynamicKastSchema = () => {
  const schema = compatibleKastSchema();
  schema.operationRegistry.operationIds = ["symbol.resolve"];
  schema.cliProjection.commands = [
    "symbol resolve --candidate <candidate-selector>",
  ];
  schema.serverProjection.tools = [
    tool(
      "symbol.resolve",
      "installed_symbol_lookup",
      "Shape supplied by the selected installed Kast executable.",
      "symbol resolve --candidate <candidate-selector>",
      ["symbol", "resolve"],
      {
        type: "object",
        additionalProperties: false,
        properties: {
          selection: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["selection"],
      },
      [["selection", "--candidate"]],
    ),
  ];
  return schema;
};
