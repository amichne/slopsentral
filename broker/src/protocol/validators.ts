import Ajv from "ajv";

import dynamicToolCallParamsSchema from "../../generated/protocol/codex-cli-0.149.1/schema/DynamicToolCallParams.json" with { type: "json" };
import initializeParamsSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v1/InitializeParams.json" with { type: "json" };
import threadStartParamsSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/ThreadStartParams.json" with { type: "json" };
import threadResumeParamsSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/ThreadResumeParams.json" with { type: "json" };
import threadResumeResponseSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/ThreadResumeResponse.json" with { type: "json" };
import threadForkParamsSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/ThreadForkParams.json" with { type: "json" };
import threadForkResponseSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/ThreadForkResponse.json" with { type: "json" };
import threadStartResponseSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/ThreadStartResponse.json" with { type: "json" };
import turnInterruptParamsSchema from "../../generated/protocol/codex-cli-0.149.1/schema/v2/TurnInterruptParams.json" with { type: "json" };
import type { InitializeParams } from "../../generated/protocol/codex-cli-0.149.1/typescript/InitializeParams";
import type { DynamicToolCallParams } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/DynamicToolCallParams";
import type { ThreadStartParams } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/ThreadStartParams";
import type { ThreadResumeParams } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/ThreadResumeResponse";
import type { ThreadForkParams } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/ThreadForkParams";
import type { ThreadForkResponse } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/ThreadForkResponse";
import type { ThreadStartResponse } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/ThreadStartResponse";
import type { TurnInterruptParams } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/TurnInterruptParams";

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });

export const validateInitializeParams = ajv.compile<InitializeParams>(
  initializeParamsSchema,
);
export const validateDynamicToolCallParams = ajv.compile<DynamicToolCallParams>(
  dynamicToolCallParamsSchema,
);
export const validateThreadStartParams = ajv.compile<ThreadStartParams>(
  threadStartParamsSchema,
);
export const validateThreadResumeParams = ajv.compile<ThreadResumeParams>(
  threadResumeParamsSchema,
);
export const validateThreadResumeResponse = ajv.compile<ThreadResumeResponse>(
  threadResumeResponseSchema,
);
export const validateThreadForkParams = ajv.compile<ThreadForkParams>(
  threadForkParamsSchema,
);
export const validateThreadForkResponse = ajv.compile<ThreadForkResponse>(
  threadForkResponseSchema,
);
export const validateThreadStartResponse = ajv.compile<ThreadStartResponse>(
  threadStartResponseSchema,
);
export const validateTurnInterruptParams = ajv.compile<TurnInterruptParams>(
  turnInterruptParamsSchema,
);

export const validationDetail = (
  errors: typeof validateInitializeParams.errors,
): string => {
  const first = errors?.[0];
  return first === undefined
    ? "schema validation failed"
    : `${first.instancePath || "/"}: ${first.message ?? "invalid value"}`;
};
