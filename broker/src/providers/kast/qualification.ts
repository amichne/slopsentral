import { Value } from "@sinclair/typebox/value";

import { canonicalJson, sha256 } from "../../broker/canonical.ts";
import type { Outcome } from "../../broker/types.ts";
import type { ProcessExecutor } from "../process.ts";
import { KastCapabilityDocument } from "./schemas.ts";

const MAXIMUM_KAST_DOCUMENT_BYTES = 512 * 1024;
const MAXIMUM_KAST_VERSION_BYTES = 4 * 1024;

const requiredOperations = [
  "symbol.discover",
  "symbol.resolve",
  "traversal.run",
] as const;

const requiredCommands = [
  "symbol discover --mode <name|location|structure|text> ... --limit <1..1000>",
  "symbol resolve --candidate <candidate-selector>",
  "traversal run --selector <exact-selector> --relation <kind> --maximum-depth <1..1000> --maximum-results <1..1000>",
] as const;

export interface KastQualificationOptions {
  readonly executable: string;
  readonly processExecutor: ProcessExecutor;
  readonly qualificationCwd: string;
}

export interface KastQualification {
  readonly cliVersion: string;
  readonly schemaDigest: string;
  readonly schemaVersion: number;
  readonly wireSchemaId: string;
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
  const document = parseJson(schema.value.stdout);
  if (
    document === undefined ||
    !Value.Check(KastCapabilityDocument, document)
  ) {
    return { type: "failure", failure: { code: "KAST_SCHEMA_INVALID" } };
  }
  const capability = Value.Decode(KastCapabilityDocument, document);
  if (!compatibleCapability(capability)) {
    return { type: "failure", failure: { code: "KAST_SCHEMA_INCOMPATIBLE" } };
  }
  return {
    type: "success",
    value: {
      cliVersion,
      schemaDigest: sha256(canonicalJson(document)),
      schemaVersion: capability.schemaVersion,
      wireSchemaId: capability.wireSchema.wireSchemaId,
    },
  };
};

const compatibleCapability = (
  capability: typeof KastCapabilityDocument.static,
): boolean => {
  if (
    capability.schemaVersion !== capability.operationRegistry.schemaVersion ||
    capability.schemaVersion !== capability.wireSchema.schemaVersion
  ) {
    return false;
  }
  const operations = new Set(capability.operationRegistry.operationIds);
  const commands = new Set(capability.cliProjection.commands);
  if (
    operations.size !== capability.operationRegistry.operationIds.length ||
    commands.size !== capability.cliProjection.commands.length
  ) {
    return false;
  }
  return (
    requiredOperations.every((operation) => operations.has(operation)) &&
    requiredCommands.every((command) => commands.has(command))
  );
};

const parseJson = (source: string): unknown | undefined => {
  try {
    const value: unknown = JSON.parse(source);
    return value;
  } catch {
    return undefined;
  }
};
