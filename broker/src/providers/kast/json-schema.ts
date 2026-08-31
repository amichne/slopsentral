import type { TProperties, TSchema } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

import type { Outcome } from "../../broker/types.ts";

const MAXIMUM_SCHEMA_DEPTH = 32;
const MAXIMUM_SCHEMA_PROPERTIES = 256;
const MAXIMUM_SCHEMA_VARIANTS = 64;

export type JsonSchemaProjectionFailure = {
  readonly code: "KAST_JSON_SCHEMA_UNSUPPORTED";
};

/** Refines the supported installed JSON Schema subset into executable TypeBox proof. */
export const projectJsonSchema = (
  document: unknown,
): Outcome<TSchema, JsonSchemaProjectionFailure> => project(document, 0);

const project = (
  document: unknown,
  depth: number,
): Outcome<TSchema, JsonSchemaProjectionFailure> => {
  if (depth > MAXIMUM_SCHEMA_DEPTH || !isRecord(document)) return rejected();
  const keys = Object.keys(document);
  if (keys.length === 0) return admitted(Type.Unknown());
  if (Array.isArray(document.anyOf)) {
    if (
      !onlyKeys(document, ["anyOf", "description"]) ||
      document.anyOf.length === 0 ||
      document.anyOf.length > MAXIMUM_SCHEMA_VARIANTS
    ) {
      return rejected();
    }
    const variants = projectList(document.anyOf, depth + 1);
    return variants.type === "failure"
      ? variants
      : admitted(Type.Union(variants.value, schemaOptions(document)));
  }
  switch (document.type) {
    case "object":
      return projectObject(document, depth);
    case "array":
      return projectArray(document, depth);
    case "string":
      return projectString(document);
    case "integer":
      return projectInteger(document);
    case "number":
      return projectNumber(document);
    case "boolean":
      return projectBoolean(document);
    case "null":
      return projectNull(document);
    default:
      return rejected();
  }
};

const projectObject = (
  document: Readonly<Record<string, unknown>>,
  depth: number,
): Outcome<TSchema, JsonSchemaProjectionFailure> => {
  const propertiesDocument = document.properties;
  const requiredDocument = document.required;
  if (
    !onlyKeys(document, [
      "type",
      "additionalProperties",
      "properties",
      "required",
      "description",
    ]) ||
    document.additionalProperties !== false ||
    !isRecord(propertiesDocument) ||
    !isUniqueStringArray(requiredDocument) ||
    Object.keys(propertiesDocument).length > MAXIMUM_SCHEMA_PROPERTIES
  ) {
    return rejected();
  }
  const required = new Set(requiredDocument);
  const propertyNames = Object.keys(propertiesDocument);
  if ([...required].some((name) => !Object.hasOwn(propertiesDocument, name))) {
    return rejected();
  }
  const properties: TProperties = {};
  for (const name of propertyNames) {
    const projected = project(propertiesDocument[name], depth + 1);
    if (projected.type === "failure") return projected;
    properties[name] = required.has(name)
      ? projected.value
      : Type.Optional(projected.value);
  }
  return admitted(
    Type.Object(properties, {
      ...schemaOptions(document),
      additionalProperties: false,
    }),
  );
};

const projectArray = (
  document: Readonly<Record<string, unknown>>,
  depth: number,
): Outcome<TSchema, JsonSchemaProjectionFailure> => {
  const minItems = document.minItems;
  const maxItems = document.maxItems;
  if (
    !onlyKeys(document, [
      "type",
      "items",
      "minItems",
      "maxItems",
      "description",
    ]) ||
    !Object.hasOwn(document, "items") ||
    !optionalNonNegativeInteger(minItems) ||
    !optionalNonNegativeInteger(maxItems)
  ) {
    return rejected();
  }
  const items = project(document.items, depth + 1);
  if (items.type === "failure") return items;
  return admitted(
    Type.Array(items.value, {
      ...schemaOptions(document),
      ...(minItems === undefined ? {} : { minItems }),
      ...(maxItems === undefined ? {} : { maxItems }),
    }),
  );
};

const projectString = (
  document: Readonly<Record<string, unknown>>,
): Outcome<TSchema, JsonSchemaProjectionFailure> => {
  const minLength = document.minLength;
  const maxLength = document.maxLength;
  const pattern = document.pattern;
  if (
    !onlyKeys(document, [
      "type",
      "const",
      "enum",
      "minLength",
      "maxLength",
      "pattern",
      "description",
    ]) ||
    !optionalNonNegativeInteger(minLength) ||
    !optionalNonNegativeInteger(maxLength) ||
    !optionalString(pattern)
  ) {
    return rejected();
  }
  const options = {
    ...schemaOptions(document),
    ...(minLength === undefined ? {} : { minLength }),
    ...(maxLength === undefined ? {} : { maxLength }),
    ...(pattern === undefined ? {} : { pattern }),
  };
  if (typeof document.const === "string") {
    return admitted(Type.Literal(document.const, options));
  }
  if (document.const !== undefined) return rejected();
  if (document.enum !== undefined) {
    if (!isUniqueStringArray(document.enum) || document.enum.length === 0) {
      return rejected();
    }
    return admitted(
      Type.Union(
        document.enum.map((value) => Type.Literal(value)),
        options,
      ),
    );
  }
  return admitted(Type.String(options));
};

const projectInteger = (
  document: Readonly<Record<string, unknown>>,
): Outcome<TSchema, JsonSchemaProjectionFailure> =>
  projectNumeric(document, (options) => Type.Integer(options));

const projectNumber = (
  document: Readonly<Record<string, unknown>>,
): Outcome<TSchema, JsonSchemaProjectionFailure> =>
  projectNumeric(document, (options) => Type.Number(options));

const projectNumeric = (
  document: Readonly<Record<string, unknown>>,
  create: (options: Readonly<Record<string, unknown>>) => TSchema,
): Outcome<TSchema, JsonSchemaProjectionFailure> => {
  if (
    !onlyKeys(document, ["type", "minimum", "maximum", "description"]) ||
    !optionalFiniteNumber(document.minimum) ||
    !optionalFiniteNumber(document.maximum)
  ) {
    return rejected();
  }
  return admitted(
    create({
      ...schemaOptions(document),
      ...(document.minimum === undefined ? {} : { minimum: document.minimum }),
      ...(document.maximum === undefined ? {} : { maximum: document.maximum }),
    }),
  );
};

const projectBoolean = (
  document: Readonly<Record<string, unknown>>,
): Outcome<TSchema, JsonSchemaProjectionFailure> =>
  onlyKeys(document, ["type", "description"])
    ? admitted(Type.Boolean(schemaOptions(document)))
    : rejected();

const projectNull = (
  document: Readonly<Record<string, unknown>>,
): Outcome<TSchema, JsonSchemaProjectionFailure> =>
  onlyKeys(document, ["type", "description"])
    ? admitted(Type.Null(schemaOptions(document)))
    : rejected();

const projectList = (
  documents: readonly unknown[],
  depth: number,
): Outcome<TSchema[], JsonSchemaProjectionFailure> => {
  const schemas: TSchema[] = [];
  for (const document of documents) {
    const schema = project(document, depth);
    if (schema.type === "failure") return schema;
    schemas.push(schema.value);
  }
  return admitted(schemas);
};

const schemaOptions = (
  document: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> =>
  typeof document.description === "string"
    ? { description: document.description }
    : {};

const onlyKeys = (
  document: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(document).every((key) => allowed.includes(key));

const optionalNonNegativeInteger = (
  value: unknown,
): value is number | undefined =>
  value === undefined ||
  (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

const optionalFiniteNumber = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === "number" && Number.isFinite(value));

const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isUniqueStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === "string") &&
  new Set(value).size === value.length;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const admitted = <Value>(
  value: Value,
): Outcome<Value, JsonSchemaProjectionFailure> => ({
  type: "success",
  value,
});

const rejected = (): Outcome<never, JsonSchemaProjectionFailure> => ({
  type: "failure",
  failure: { code: "KAST_JSON_SCHEMA_UNSUPPORTED" },
});
