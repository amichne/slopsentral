import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AnySchema } from "ajv";

import {
  compileCodexProtocolValidators,
  type CodexProtocolValidators,
} from "../src/protocol/validators.ts";

const objectSchema = (
  required: readonly string[],
  properties: Readonly<Record<string, unknown>>,
): AnySchema => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  additionalProperties: true,
  properties,
  required,
  type: "object",
});

function threadOperationResponseSchema(): AnySchema {
  return objectSchema(["cwd", "thread"], {
    cwd: { type: "string" },
    thread: objectSchema(["id"], { id: { type: "string" } }),
  });
}

export const compatibleProtocolSchemas: Readonly<Record<string, AnySchema>> = {
  "DynamicToolCallParams.json": objectSchema(
    ["arguments", "callId", "threadId", "tool", "turnId"],
    {
      arguments: true,
      callId: { type: "string" },
      namespace: { type: ["string", "null"] },
      threadId: { type: "string" },
      tool: { type: "string" },
      turnId: { type: "string" },
    },
  ),
  "DynamicToolCallResponse.json": objectSchema(["contentItems", "success"], {
    contentItems: { items: { type: "object" }, type: "array" },
    success: { type: "boolean" },
  }),
  "InitializeParams.json": objectSchema(["clientInfo"], {
    capabilities: { type: "object" },
    clientInfo: { type: "object" },
  }),
  "ThreadForkParams.json": objectSchema(["threadId"], {
    threadId: { type: "string" },
  }),
  "ThreadForkResponse.json": threadOperationResponseSchema(),
  "ThreadResumeParams.json": objectSchema(["threadId"], {
    threadId: { type: "string" },
  }),
  "ThreadResumeResponse.json": threadOperationResponseSchema(),
  "ThreadStartParams.json": objectSchema([], {
    dynamicTools: { items: { type: "object" }, type: "array" },
  }),
  "ThreadStartResponse.json": threadOperationResponseSchema(),
  "TurnInterruptParams.json": objectSchema(["threadId", "turnId"], {
    threadId: { type: "string" },
    turnId: { type: "string" },
  }),
};

export const writeProtocolSchemaTree = async (
  root: string,
  omitted: string | undefined = undefined,
): Promise<void> => {
  await mkdir(join(root, "v1"), { recursive: true });
  await mkdir(join(root, "v2"), { recursive: true });
  for (const [fileName, schema] of Object.entries(compatibleProtocolSchemas)) {
    if (fileName === omitted) continue;
    const directory = fileName === "InitializeParams.json" ? "v1" : "v2";
    await writeFile(
      join(root, directory, fileName),
      `${JSON.stringify(schema)}\n`,
      "utf8",
    );
  }
};

export const protocolValidators = (): CodexProtocolValidators => {
  const compiled = compileCodexProtocolValidators({
    dynamicToolCallParams: fixtureSchema("DynamicToolCallParams.json"),
    dynamicToolCallResponse: fixtureSchema("DynamicToolCallResponse.json"),
    initializeParams: fixtureSchema("InitializeParams.json"),
    threadForkParams: fixtureSchema("ThreadForkParams.json"),
    threadForkResponse: fixtureSchema("ThreadForkResponse.json"),
    threadResumeParams: fixtureSchema("ThreadResumeParams.json"),
    threadResumeResponse: fixtureSchema("ThreadResumeResponse.json"),
    threadStartParams: fixtureSchema("ThreadStartParams.json"),
    threadStartResponse: fixtureSchema("ThreadStartResponse.json"),
    turnInterruptParams: fixtureSchema("TurnInterruptParams.json"),
  });
  if (compiled.type === "failure") {
    throw new Error(compiled.failure.detail);
  }
  return compiled.value;
};

const fixtureSchema = (fileName: string): AnySchema => {
  const schema = compatibleProtocolSchemas[fileName];
  if (schema === undefined) throw new Error(`missing fixture ${fileName}`);
  return schema;
};
