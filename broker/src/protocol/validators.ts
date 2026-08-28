import Ajv from "ajv";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";

import type { Outcome } from "../broker/types.ts";

export interface CodexProtocolSchemaDocuments {
  readonly dynamicToolCallParams: AnySchema;
  readonly dynamicToolCallResponse: AnySchema;
  readonly initializeParams: AnySchema;
  readonly threadForkParams: AnySchema;
  readonly threadForkResponse: AnySchema;
  readonly threadResumeParams: AnySchema;
  readonly threadResumeResponse: AnySchema;
  readonly threadStartParams: AnySchema;
  readonly threadStartResponse: AnySchema;
  readonly turnInterruptParams: AnySchema;
}

export interface CodexProtocolValidators {
  readonly dynamicToolCallParams: ValidateFunction<unknown>;
  readonly dynamicToolCallResponse: ValidateFunction<unknown>;
  readonly initializeParams: ValidateFunction<unknown>;
  readonly threadForkParams: ValidateFunction<unknown>;
  readonly threadForkResponse: ValidateFunction<unknown>;
  readonly threadResumeParams: ValidateFunction<unknown>;
  readonly threadResumeResponse: ValidateFunction<unknown>;
  readonly threadStartParams: ValidateFunction<unknown>;
  readonly threadStartResponse: ValidateFunction<unknown>;
  readonly turnInterruptParams: ValidateFunction<unknown>;
}

interface ProtocolSchemaInvalid {
  readonly type: "ProtocolSchemaInvalid";
  readonly detail: string;
}

export const compileCodexProtocolValidators = (
  schemas: CodexProtocolSchemaDocuments,
): Outcome<CodexProtocolValidators, ProtocolSchemaInvalid> => {
  try {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });
    return {
      type: "success",
      value: {
        dynamicToolCallParams: ajv.compile<unknown>(
          schemas.dynamicToolCallParams,
        ),
        dynamicToolCallResponse: ajv.compile<unknown>(
          schemas.dynamicToolCallResponse,
        ),
        initializeParams: ajv.compile<unknown>(schemas.initializeParams),
        threadForkParams: ajv.compile<unknown>(schemas.threadForkParams),
        threadForkResponse: ajv.compile<unknown>(schemas.threadForkResponse),
        threadResumeParams: ajv.compile<unknown>(schemas.threadResumeParams),
        threadResumeResponse: ajv.compile<unknown>(
          schemas.threadResumeResponse,
        ),
        threadStartParams: ajv.compile<unknown>(schemas.threadStartParams),
        threadStartResponse: ajv.compile<unknown>(schemas.threadStartResponse),
        turnInterruptParams: ajv.compile<unknown>(schemas.turnInterruptParams),
      },
    };
  } catch (error) {
    return {
      type: "failure",
      failure: {
        type: "ProtocolSchemaInvalid",
        detail:
          error instanceof Error
            ? error.message
            : "generated schema could not be compiled",
      },
    };
  }
};

export const validationDetail = (
  errors: readonly ErrorObject[] | null | undefined,
): string => {
  const first = errors?.[0];
  return first === undefined
    ? "schema validation failed"
    : `${first.instancePath || "/"}: ${first.message ?? "invalid value"}`;
};
