import { TypeGuard } from "@sinclair/typebox";

import { canonicalJson, sha256 } from "./canonical.ts";
import type { BrokerFailure } from "./failure.ts";
import type { BrokerLimits, Outcome, ProviderRegistration } from "./types.ts";

const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_TOOL_NAME_LENGTH = 64;
const SCHEMA_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

export interface CatalogFailure {
  readonly type: "CatalogInvalid";
  readonly issues: readonly string[];
}

export interface CatalogTool {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly deferLoading: boolean;
}

export interface CatalogNamespace {
  readonly type: "namespace";
  readonly name: string;
  readonly description: string;
  readonly tools: readonly CatalogTool[];
}

export interface Catalog {
  readonly digest: string;
  readonly namespaces: readonly CatalogNamespace[];
  readonly providers: readonly {
    readonly namespace: string;
    readonly schemaDigest: string;
    readonly version: string;
  }[];
}

export const buildCatalog = (
  registrations: readonly ProviderRegistration[],
  limits: BrokerLimits,
): Outcome<Catalog, CatalogFailure | BrokerFailure> => {
  const issues: string[] = [];
  const namespaces = new Set<string>();

  if (registrations.length > limits.maximumDescriptorCount) {
    return {
      type: "failure",
      failure: { type: "BrokerOverloaded", limit: "maximumDescriptorCount" },
    };
  }

  const ordered = [...registrations].sort((left, right) =>
    left.descriptor.namespace.localeCompare(right.descriptor.namespace),
  );
  for (const { descriptor } of ordered) {
    if (!NAMESPACE_PATTERN.test(descriptor.namespace)) {
      issues.push(`invalid namespace: ${descriptor.namespace}`);
    }
    if (namespaces.has(descriptor.namespace)) {
      issues.push(`duplicate namespace: ${descriptor.namespace}`);
    }
    namespaces.add(descriptor.namespace);
    if (!SCHEMA_DIGEST_PATTERN.test(descriptor.schemaDigest)) {
      issues.push(`invalid schema digest: ${descriptor.namespace}`);
    }

    const tools = new Set<string>();
    for (const tool of descriptor.tools) {
      if (
        tool.name.length > MAX_TOOL_NAME_LENGTH ||
        !TOOL_PATTERN.test(tool.name)
      ) {
        issues.push(`invalid tool: ${descriptor.namespace}.${tool.name}`);
      }
      if (tools.has(tool.name)) {
        issues.push(`duplicate tool: ${descriptor.namespace}.${tool.name}`);
      }
      tools.add(tool.name);
      if (!TypeGuard.IsSchema(tool.inputSchema)) {
        issues.push(`invalid schema: ${descriptor.namespace}.${tool.name}`);
      }
      if (!TypeGuard.IsSchema(tool.outputSchema)) {
        issues.push(
          `invalid output schema: ${descriptor.namespace}.${tool.name}`,
        );
      }
    }
  }

  if (issues.length > 0) {
    return { type: "failure", failure: { type: "CatalogInvalid", issues } };
  }

  const document = ordered.map(({ descriptor }) => ({
    namespace: descriptor.namespace,
    schemaDigest: descriptor.schemaDigest,
    providerVersion: descriptor.version,
    tools: [...descriptor.tools]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tool) => ({
        description: tool.description,
        inputSchema: tool.inputSchema,
        loading: tool.loading,
        name: tool.name,
        outputSchema: tool.outputSchema,
      })),
  }));
  const namespacesDocument = document.map((provider) => ({
    type: "namespace" as const,
    name: provider.namespace,
    description: `Typed read-only tools provided by ${provider.namespace}.`,
    tools: provider.tools.map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      deferLoading: tool.loading === "deferred",
    })),
  }));
  if (
    Buffer.byteLength(canonicalJson(document), "utf8") >
    limits.maximumCatalogBytes
  ) {
    return {
      type: "failure",
      failure: { type: "BrokerOverloaded", limit: "maximumCatalogSize" },
    };
  }
  const catalog = {
    digest: sha256(canonicalJson(document)),
    namespaces: namespacesDocument,
    providers: document.map(({ namespace, providerVersion, schemaDigest }) => ({
      namespace,
      schemaDigest,
      version: providerVersion,
    })),
  };

  return { type: "success", value: catalog };
};
