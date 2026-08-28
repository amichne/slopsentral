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
});
