import { Type } from "@sinclair/typebox";

import { canonicalJson } from "../../broker/canonical.ts";
import { defineTool } from "../../broker/index.ts";
import type { KastRuntime } from "./runtime.ts";
import { KastOutput, RelationKind } from "./schemas.ts";

const presentKastOutput = (output: typeof KastOutput.static) => ({
  success: output.status === "completed",
  contentItems: [{ type: "inputText" as const, text: canonicalJson(output) }],
});

const Limit = Type.Integer({ minimum: 1, maximum: 1_000 });
const NonBlankText = Type.String({ minLength: 1, maxLength: 16_384 });
const WorkspaceFile = Type.String({ minLength: 1, maxLength: 4_096 });

const SymbolDiscoverInput = Type.Union([
  Type.Object(
    {
      mode: Type.Literal("name"),
      query: NonBlankText,
      kind: Type.Union([
        Type.Literal("file"),
        Type.Literal("class"),
        Type.Literal("symbol"),
      ]),
      match: Type.Union([Type.Literal("fuzzy"), Type.Literal("exact-name")]),
      limit: Limit,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      mode: Type.Literal("location"),
      file: WorkspaceFile,
      offset: Type.Integer({ minimum: 0 }),
      limit: Limit,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { mode: Type.Literal("structure"), file: WorkspaceFile, limit: Limit },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      mode: Type.Literal("text"),
      query: NonBlankText,
      scope: Type.Literal("workspace"),
      limit: Limit,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      mode: Type.Literal("text"),
      query: NonBlankText,
      scope: Type.Literal("file"),
      file: WorkspaceFile,
      limit: Limit,
    },
    { additionalProperties: false },
  ),
]);

export const kastSymbolDiscover = defineTool<
  KastRuntime,
  typeof SymbolDiscoverInput,
  typeof KastOutput
>({
  name: "symbol_discover",
  description:
    "Discover bounded Kotlin symbol candidates through Kast's canonical operation.",
  input: SymbolDiscoverInput,
  output: KastOutput,
  loading: "deferred",
  invoke: (runtime, input, context) => {
    const arguments_ = ["symbol", "discover", `--mode=${input.mode}`];
    switch (input.mode) {
      case "name":
        arguments_.push(
          `--query=${input.query}`,
          `--kind=${input.kind}`,
          `--match=${input.match}`,
        );
        break;
      case "location":
        arguments_.push(`--file=${input.file}`, `--offset=${input.offset}`);
        break;
      case "structure":
        arguments_.push(`--file=${input.file}`);
        break;
      case "text":
        arguments_.push(`--query=${input.query}`, `--scope=${input.scope}`);
        if (input.scope === "file") arguments_.push(`--file=${input.file}`);
        break;
    }
    arguments_.push(`--limit=${input.limit}`);
    return runtime.execute(arguments_, context);
  },
  present: presentKastOutput,
});

const SymbolResolveInput = Type.Object(
  { candidate: NonBlankText },
  { additionalProperties: false },
);

export const kastSymbolResolve = defineTool<
  KastRuntime,
  typeof SymbolResolveInput,
  typeof KastOutput
>({
  name: "symbol_resolve",
  description:
    "Refine one Kast discovery candidate to an exact generation-bound selector.",
  input: SymbolResolveInput,
  output: KastOutput,
  loading: "deferred",
  invoke: (runtime, input, context) =>
    runtime.execute(
      ["symbol", "resolve", `--candidate=${input.candidate}`],
      context,
    ),
  present: presentKastOutput,
});

const TraversalRunInput = Type.Object(
  {
    selector: NonBlankText,
    relation: RelationKind,
    maximumDepth: Limit,
    maximumResults: Limit,
  },
  { additionalProperties: false },
);

export const kastTraversalRun = defineTool<
  KastRuntime,
  typeof TraversalRunInput,
  typeof KastOutput
>({
  name: "traversal_run",
  description:
    "Traverse one Kast semantic relation with explicit depth and result bounds.",
  input: TraversalRunInput,
  output: KastOutput,
  loading: "deferred",
  invoke: (runtime, input, context) =>
    runtime.execute(
      [
        "traversal",
        "run",
        `--selector=${input.selector}`,
        `--relation=${input.relation}`,
        `--maximum-depth=${input.maximumDepth}`,
        `--maximum-results=${input.maximumResults}`,
      ],
      context,
    ),
  present: presentKastOutput,
});

export const kastTools = [
  kastSymbolDiscover,
  kastSymbolResolve,
  kastTraversalRun,
] as const;
