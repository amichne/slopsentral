#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSchema(name) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, "source/schemas/profiles", `${name}.schema.json`), "utf8"),
  );
}

const ajv = addFormats(new Ajv2020({
  allErrors: true,
  discriminator: true,
  strict: true,
  strictTypes: false,
}));
const workflowProfileValidator = ajv.compile(loadSchema("workflow-profile"));
const profileTransactionValidator = ajv.compile(loadSchema("profile-transaction"));

export class ProfileContractError extends Error {
  constructor(contract, source, errors) {
    super(`${source} violates ${contract}: ${ajv.errorsText(errors, { separator: "; " })}`);
    this.contract = contract;
    this.source = source;
    this.validationErrors = errors;
  }
}

function assertContract(validator, contract, value, source) {
  if (!validator(value)) {
    throw new ProfileContractError(contract, source, structuredClone(validator.errors));
  }
  return value;
}

export function validateWorkflowProfile(value, source = "workflow profile") {
  return assertContract(workflowProfileValidator, "WORKFLOW_PROFILE", value, source);
}

export function validateProfileTransaction(value, source = "profile transaction") {
  return assertContract(profileTransactionValidator, "PROFILE_TRANSACTION", value, source);
}

function validateAuthoredProfiles() {
  const directory = path.join(repoRoot, "source/profiles");
  const files = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  for (const name of files) {
    const file = path.join(directory, name);
    validateWorkflowProfile(JSON.parse(fs.readFileSync(file, "utf8")), path.relative(repoRoot, file));
  }
  return files.length;
}

function main() {
  try {
    const transactionIndex = process.argv.indexOf("--transaction");
    if (transactionIndex >= 0) {
      const file = process.argv[transactionIndex + 1];
      if (!file) throw new Error("--transaction requires a manifest path");
      validateProfileTransaction(JSON.parse(fs.readFileSync(file, "utf8")), file);
      process.stdout.write(`Profile transaction contract OK: ${file}\n`);
      return;
    }
    const count = validateAuthoredProfiles();
    process.stdout.write(`Workflow profile contracts OK: ${count} profiles\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
