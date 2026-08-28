import type { TSchema } from "@sinclair/typebox";
import { TypeGuard } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { canonicalJson, sha256 } from "../../broker/canonical.ts";
import type { Outcome } from "../../broker/types.ts";
import type { ProcessExecutor } from "../process.ts";
import type { KastServerContract, KastServerTool } from "./contract.ts";
import { projectJsonSchema } from "./json-schema.ts";
import { KastCapabilityDocument } from "./schemas.ts";

const MAXIMUM_KAST_DOCUMENT_BYTES = 512 * 1024;
const MAXIMUM_KAST_VERSION_BYTES = 4 * 1024;
const SUPPORTED_SERVER_PROJECTION_SCHEMA_VERSION = 1;

export interface KastQualificationOptions {
  readonly executable: string;
  readonly processExecutor: ProcessExecutor;
  readonly qualificationCwd: string;
}

export interface KastQualification {
  readonly cliVersion: string;
  readonly contract: KastServerContract;
  readonly schemaDigest: string;
  readonly schemaVersion: number;
  readonly serverProjectionVersion: number;
  readonly toolCount: number;
}

export type KastQualificationFailure =
  | { readonly code: "KAST_VERSION_UNAVAILABLE" }
  | { readonly code: "KAST_VERSION_INVALID" }
  | { readonly code: "KAST_SCHEMA_UNAVAILABLE" }
  | { readonly code: "KAST_SCHEMA_INVALID" }
  | { readonly code: "KAST_SCHEMA_INCOMPATIBLE" };

export const qualifyKast = async (
  options: KastQualificationOptions,
  signal: AbortSignal,
): Promise<Outcome<KastQualification, KastQualificationFailure>> => {
  const version = await options.processExecutor({
    executable: options.executable,
    arguments: ["--version"],
    cwd: options.qualificationCwd,
    maximumOutputBytes: MAXIMUM_KAST_VERSION_BYTES,
    signal,
  });
  if (version.type === "failure" || version.value.exitCode !== 0) {
    return { type: "failure", failure: { code: "KAST_VERSION_UNAVAILABLE" } };
  }
  const cliVersion = version.value.stdout.trim();
  if (!cliVersion.startsWith("kast ") || cliVersion.length > 512) {
    return { type: "failure", failure: { code: "KAST_VERSION_INVALID" } };
  }

  const schema = await options.processExecutor({
    executable: options.executable,
    arguments: ["--schema"],
    cwd: options.qualificationCwd,
    maximumOutputBytes: MAXIMUM_KAST_DOCUMENT_BYTES,
    signal,
  });
  if (schema.type === "failure" || schema.value.exitCode !== 0) {
    return { type: "failure", failure: { code: "KAST_SCHEMA_UNAVAILABLE" } };
  }
  const parsed = parseJson(schema.value.stdout);
  if (
    parsed.type === "rejected" ||
    !Value.Check(KastCapabilityDocument, parsed.value)
  ) {
    return { type: "failure", failure: { code: "KAST_SCHEMA_INVALID" } };
  }
  const capability = Value.Decode(KastCapabilityDocument, parsed.value);
  const contract = admitContract(capability);
  if (contract.type === "rejected") {
    return {
      type: "failure",
      failure: { code: "KAST_SCHEMA_INCOMPATIBLE" },
    };
  }
  return {
    type: "success",
    value: {
      cliVersion,
      contract: contract.value,
      schemaDigest: sha256(canonicalJson(parsed.value)),
      schemaVersion: capability.schemaVersion,
      serverProjectionVersion: capability.serverProjection.schemaVersion,
      toolCount: contract.value.tools.length,
    },
  };
};

type Capability = typeof KastCapabilityDocument.static;

type ContractAdmission =
  | { readonly type: "admitted"; readonly value: KastServerContract }
  | { readonly type: "rejected" };

const admitContract = (capability: Capability): ContractAdmission => {
  if (
    capability.serverProjection.schemaVersion !==
    SUPPORTED_SERVER_PROJECTION_SCHEMA_VERSION
  ) {
    return { type: "rejected" };
  }
  const tools = capability.serverProjection.tools;
  if (
    hasDuplicates(tools.map(({ name }) => name)) ||
    hasDuplicates(tools.map(({ operationId }) => operationId))
  ) {
    return { type: "rejected" };
  }

  const admittedTools: KastServerTool[] = [];
  for (const tool of tools) {
    const inputSchema = projectJsonSchema(tool.inputSchema);
    const outputSchema = projectJsonSchema(tool.outputSchema);
    if (inputSchema.type === "failure" || outputSchema.type === "failure") {
      return { type: "rejected" };
    }
    const properties = inputSchemaProperties(inputSchema.value);
    if (properties.type === "rejected") return properties;
    const inputFields = tool.invocation.bindings.map(
      ({ inputField }) => inputField,
    );
    const options = tool.invocation.bindings.map(({ option }) => option);
    const boundFields = new Set(inputFields);
    if (
      hasDuplicates(inputFields) ||
      hasDuplicates(options) ||
      [...properties.values].some((property) => !boundFields.has(property)) ||
      inputFields.some((field) => !properties.values.has(field))
    ) {
      return { type: "rejected" };
    }
    admittedTools.push({
      operationId: tool.operationId,
      name: tool.name,
      description: tool.description,
      deferLoading: tool.deferLoading,
      cliUsage: tool.cliUsage,
      inputSchema: inputSchema.value,
      outputSchema: outputSchema.value,
      invocation: {
        type: "CLI",
        command: [...tool.invocation.command],
        bindings: tool.invocation.bindings.map((binding) => ({ ...binding })),
      },
    });
  }
  return {
    type: "admitted",
    value: {
      schemaVersion: capability.serverProjection.schemaVersion,
      namespace: "kast",
      tools: admittedTools,
    },
  };
};

type SchemaProperties =
  | { readonly type: "admitted"; readonly values: ReadonlySet<string> }
  | { readonly type: "rejected" };

const inputSchemaProperties = (schema: TSchema): SchemaProperties => {
  if (schema.type === "object" && isRecord(schema.properties)) {
    if (
      Object.values(schema.properties).some(
        (property) =>
          !TypeGuard.IsSchema(property) || !isCliOptionScalarSchema(property),
      )
    ) {
      return { type: "rejected" };
    }
    return {
      type: "admitted",
      values: new Set(Object.keys(schema.properties)),
    };
  }
  if (!Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
    return { type: "rejected" };
  }
  const values = new Set<string>();
  for (const variant of schema.anyOf) {
    if (!TypeGuard.IsSchema(variant)) return { type: "rejected" };
    const properties = inputSchemaProperties(variant);
    if (properties.type === "rejected") return properties;
    properties.values.forEach((property) => values.add(property));
  }
  return { type: "admitted", values };
};

const isCliOptionScalarSchema = (schema: TSchema): boolean => {
  if (
    schema.type === "string" ||
    schema.type === "integer" ||
    schema.type === "number" ||
    schema.type === "boolean"
  ) {
    return true;
  }
  return (
    Array.isArray(schema.anyOf) &&
    schema.anyOf.length > 0 &&
    schema.anyOf.every(
      (variant) =>
        TypeGuard.IsSchema(variant) && isCliOptionScalarSchema(variant),
    )
  );
};

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type JsonParsing =
  | { readonly type: "parsed"; readonly value: unknown }
  | { readonly type: "rejected" };

const parseJson = (source: string): JsonParsing => {
  try {
    const value: unknown = JSON.parse(source);
    return { type: "parsed", value };
  } catch {
    return { type: "rejected" };
  }
};
