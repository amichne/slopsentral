import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { promisify } from "node:util";

import type { AnySchema } from "ajv";

import type { BrokerFailure } from "../broker/failure.ts";
import type { Outcome } from "../broker/types.ts";
import {
  compileCodexProtocolValidators,
  type CodexProtocolSchemaDocuments,
  type CodexProtocolValidators,
} from "../protocol/validators.ts";

const execute = promisify(execFile);

const requiredSchemas = [
  ["dynamicToolCallParams", "DynamicToolCallParams.json"],
  ["dynamicToolCallResponse", "DynamicToolCallResponse.json"],
  ["initializeParams", "InitializeParams.json"],
  ["threadForkParams", "ThreadForkParams.json"],
  ["threadForkResponse", "ThreadForkResponse.json"],
  ["threadResumeParams", "ThreadResumeParams.json"],
  ["threadResumeResponse", "ThreadResumeResponse.json"],
  ["threadStartParams", "ThreadStartParams.json"],
  ["threadStartResponse", "ThreadStartResponse.json"],
  ["turnInterruptParams", "TurnInterruptParams.json"],
] as const;

export interface CodexProtocolQualificationOptions {
  readonly codexExecutable: string;
  readonly codexHome: string;
  readonly maximumSchemaBytes: number;
  readonly maximumSchemaFiles: number;
  readonly timeoutMs: number;
}

export interface CodexProtocolQualification {
  readonly codexVersion: string;
  readonly protocolDigest: string;
  readonly schemaFileCount: number;
  readonly validators: CodexProtocolValidators;
}

export const qualifyCodexProtocol = async (
  options: CodexProtocolQualificationOptions,
): Promise<Outcome<CodexProtocolQualification, BrokerFailure>> => {
  const environment = { ...process.env, CODEX_HOME: options.codexHome };
  let codexVersion: string;
  try {
    codexVersion = (
      await execute(options.codexExecutable, ["--version"], {
        encoding: "utf8",
        env: environment,
        maxBuffer: 1024 * 1024,
        timeout: options.timeoutMs,
      })
    ).stdout.trim();
  } catch {
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  if (codexVersion.length === 0 || codexVersion.length > 512) {
    return incompatible(codexVersion, "invalid Codex version output");
  }

  const schemaDirectory = await mkdtemp(
    join(tmpdir(), "broker-codex-protocol-"),
  );
  try {
    try {
      await execute(
        options.codexExecutable,
        [
          "app-server",
          "generate-json-schema",
          "--experimental",
          "--out",
          schemaDirectory,
        ],
        {
          encoding: "utf8",
          env: environment,
          maxBuffer: 1024 * 1024,
          timeout: options.timeoutMs,
        },
      );
    } catch {
      return incompatible(codexVersion, "schema generation command failed");
    }

    const collected = await collectSchemaFiles(schemaDirectory, options);
    if (collected.type === "failure") {
      return incompatible(codexVersion, collected.detail);
    }
    const selected = selectRequiredSchemas(collected.files);
    if (selected.type === "failure") {
      return incompatible(codexVersion, selected.detail);
    }
    const compiled = compileCodexProtocolValidators(selected.schemas);
    if (compiled.type === "failure") {
      return incompatible(codexVersion, compiled.failure.detail);
    }
    return {
      type: "success",
      value: {
        codexVersion,
        protocolDigest: digestFiles(collected.files),
        schemaFileCount: collected.files.length,
        validators: compiled.value,
      },
    };
  } finally {
    await rm(schemaDirectory, { force: true, recursive: true });
  }
};

interface CollectedSchemaFile {
  readonly content: Buffer;
  readonly relativePath: string;
}

type CollectionResult =
  | { readonly type: "success"; readonly files: readonly CollectedSchemaFile[] }
  | { readonly type: "failure"; readonly detail: string };

const collectSchemaFiles = async (
  root: string,
  limits: Pick<
    CodexProtocolQualificationOptions,
    "maximumSchemaBytes" | "maximumSchemaFiles"
  >,
): Promise<CollectionResult> => {
  const paths: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (directory === undefined) break;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile()) {
        if (!entry.name.endsWith(".json")) {
          return {
            type: "failure",
            detail: `unsupported generated entry ${relative(root, path)}`,
          };
        }
        paths.push(path);
      } else {
        return {
          type: "failure",
          detail: `unsupported generated entry ${relative(root, path)}`,
        };
      }
      if (paths.length > limits.maximumSchemaFiles) {
        return {
          type: "failure",
          detail: "generated schema file limit exceeded",
        };
      }
    }
  }
  paths.sort((left, right) =>
    relative(root, left).localeCompare(relative(root, right)),
  );
  const files: CollectedSchemaFile[] = [];
  let totalBytes = 0;
  for (const path of paths) {
    const content = await readFile(path);
    totalBytes += content.byteLength;
    if (totalBytes > limits.maximumSchemaBytes) {
      return {
        type: "failure",
        detail: "generated schema byte limit exceeded",
      };
    }
    files.push({ content, relativePath: relative(root, path) });
  }
  return { type: "success", files };
};

type SchemaSelection =
  | {
      readonly type: "success";
      readonly schemas: CodexProtocolSchemaDocuments;
    }
  | { readonly type: "failure"; readonly detail: string };

const selectRequiredSchemas = (
  files: readonly CollectedSchemaFile[],
): SchemaSelection => {
  const documents = new Map<string, AnySchema>();
  for (const [key, fileName] of requiredSchemas) {
    const matches = files.filter(
      ({ relativePath }) => basename(relativePath) === fileName,
    );
    if (matches.length === 0) {
      return { type: "failure", detail: `missing required schema ${fileName}` };
    }
    if (matches.length > 1) {
      return {
        type: "failure",
        detail: `ambiguous required schema ${fileName}`,
      };
    }
    const match = matches[0];
    if (match === undefined) {
      return { type: "failure", detail: `missing required schema ${fileName}` };
    }
    try {
      const document: unknown = JSON.parse(match.content.toString("utf8"));
      if (!isJsonSchema(document)) {
        return { type: "failure", detail: `invalid JSON schema ${fileName}` };
      }
      documents.set(key, document);
    } catch {
      return { type: "failure", detail: `invalid JSON schema ${fileName}` };
    }
  }
  const dynamicToolCallParams = documents.get("dynamicToolCallParams");
  const dynamicToolCallResponse = documents.get("dynamicToolCallResponse");
  const initializeParams = documents.get("initializeParams");
  const threadForkParams = documents.get("threadForkParams");
  const threadForkResponse = documents.get("threadForkResponse");
  const threadResumeParams = documents.get("threadResumeParams");
  const threadResumeResponse = documents.get("threadResumeResponse");
  const threadStartParams = documents.get("threadStartParams");
  const threadStartResponse = documents.get("threadStartResponse");
  const turnInterruptParams = documents.get("turnInterruptParams");
  if (
    dynamicToolCallParams === undefined ||
    dynamicToolCallResponse === undefined ||
    initializeParams === undefined ||
    threadForkParams === undefined ||
    threadForkResponse === undefined ||
    threadResumeParams === undefined ||
    threadResumeResponse === undefined ||
    threadStartParams === undefined ||
    threadStartResponse === undefined ||
    turnInterruptParams === undefined
  ) {
    return { type: "failure", detail: "required schema selection incomplete" };
  }
  return {
    type: "success",
    schemas: {
      dynamicToolCallParams,
      dynamicToolCallResponse,
      initializeParams,
      threadForkParams,
      threadForkResponse,
      threadResumeParams,
      threadResumeResponse,
      threadStartParams,
      threadStartResponse,
      turnInterruptParams,
    },
  };
};

const isJsonSchema = (value: unknown): value is AnySchema =>
  typeof value === "boolean" ||
  (typeof value === "object" && value !== null && !Array.isArray(value));

const digestFiles = (files: readonly CollectedSchemaFile[]): string => {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
};

const incompatible = (
  actual: string,
  detail: string,
): Outcome<never, BrokerFailure> => ({
  type: "failure",
  failure: { type: "CodexProtocolIncompatible", actual, detail },
});
