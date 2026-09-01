import type { ProviderToolSchema } from "../../broker/types.ts";

export interface KastCliOptionBinding {
  readonly type: "OPTION";
  readonly inputField: string;
  readonly option: string;
}

export interface KastCliInvocation {
  readonly type: "CLI";
  readonly command: readonly string[];
  readonly bindings: readonly KastCliOptionBinding[];
}

export interface KastServerTool extends ProviderToolSchema {
  readonly operationId: string;
  readonly approvalPolicy: "none" | "explicit";
  readonly cliUsage: string;
  readonly invocation: KastCliInvocation;
}

export interface KastServerContract {
  readonly schemaVersion: number;
  readonly namespace: "kast";
  readonly tools: readonly KastServerTool[];
}
