import type { TSchema } from "@sinclair/typebox";

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

export interface KastServerTool {
  readonly operationId: string;
  readonly name: string;
  readonly description: string;
  readonly deferLoading: boolean;
  readonly cliUsage: string;
  readonly inputSchema: TSchema;
  readonly outputSchema: TSchema;
  readonly invocation: KastCliInvocation;
}

export interface KastServerContract {
  readonly schemaVersion: number;
  readonly namespace: "kast";
  readonly tools: readonly KastServerTool[];
}
