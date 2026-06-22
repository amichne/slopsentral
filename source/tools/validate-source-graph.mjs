#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const repoArgIndex = args.indexOf("--repo");
const repoRoot =
  repoArgIndex >= 0 && args[repoArgIndex + 1]
    ? path.resolve(args[repoArgIndex + 1])
    : process.cwd();
const sourceRoot = path.join(repoRoot, "source");

const allowedSharedSkills = new Map([
  ["manage-json-schemas", ["agent-platform-authoring", "api-contracts"]],
  ["reference-doc-workflow", ["agent-platform-authoring", "code-knowledge-base"]],
  ["repository-signature-indexing", ["agent-platform-authoring", "code-knowledge-base"]],
  ["shell-script-safety", ["agent-platform-authoring", "git-ci-operations"]],
  ["site-docs-authoring", ["agent-platform-authoring", "code-knowledge-base"]],
]);

const routingCaseTypes = new Set([
  "TRIGGER_MISS",
  "WRONG_PRIMITIVE",
  "LOADED_BYPASSED",
  "ADAPTER_DRIFT",
  "SCHEMA_FRICTION",
  "SETUP_FRICTION",
]);

const findings = [];

function fail(message) {
  findings.push(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function readDirNames(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listFiles(relativePath, predicate = () => true) {
  const root = path.join(repoRoot, relativePath);
  if (!fs.existsSync(root)) return [];
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (predicate(absolutePath)) {
        output.push(absolutePath);
      }
    }
  };
  visit(root);
  return output.sort();
}

function relativeToRepo(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function parseFrontmatter(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath}: missing frontmatter file`);
    return {};
  }
  const text = fs.readFileSync(absolutePath, "utf8");
  if (!text.startsWith("---\n")) {
    fail(`${relativePath}: missing YAML frontmatter`);
    return {};
  }
  const end = text.indexOf("\n---", 4);
  if (end < 0) {
    fail(`${relativePath}: unterminated YAML frontmatter`);
    return {};
  }
  const fields = {};
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    fields[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return fields;
}

function sorted(values) {
  return [...values].sort();
}

function sameSet(left, right) {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addOwner(index, name, owner) {
  const owners = index.get(name) ?? [];
  owners.push(owner);
  index.set(name, owners);
}

function assertUniqueRefs(owner, kind, refs) {
  const counts = new Map();
  for (const ref of refs ?? []) {
    counts.set(ref.name, (counts.get(ref.name) ?? 0) + 1);
  }
  for (const [name, count] of counts) {
    if (count > 1) {
      fail(`${owner}: ${kind} reference ${name} appears ${count} times`);
    }
  }
}

function validatePrimitiveRef(ref, owner) {
  if (!ref || typeof ref !== "object") {
    fail(`${owner}: invalid primitive reference`);
    return;
  }
  if (ref.source?.type !== "LOCAL_SOURCE" || ref.source?.path !== "./") {
    fail(`${owner}: ${ref.name ?? "<unnamed>"} must use LOCAL_SOURCE ./`);
  }
  if (!ref.path || !ref.name || !ref.type) {
    fail(`${owner}: primitive reference is missing type, name, or path`);
    return;
  }

  const relativePath = `source/${ref.path}`;
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${owner}: ${ref.type} ${ref.name} points at missing ${relativePath}`);
    return;
  }

  if (ref.type === "SKILL") {
    const skillFile = path.join(relativePath, "SKILL.md");
    const fields = parseFrontmatter(skillFile);
    if (fields.name !== ref.name) {
      fail(`${owner}: skill ${ref.name} path ${ref.path} has frontmatter name ${fields.name ?? "<missing>"}`);
    }
    validateSkillDescription(skillFile, fields, owner);
  } else if (ref.type === "AGENT") {
    const fields = parseFrontmatter(relativePath);
    if (fields.name !== ref.name) {
      fail(`${owner}: agent ${ref.name} path ${ref.path} has frontmatter name ${fields.name ?? "<missing>"}`);
    }
  } else if (ref.type === "HOOK") {
    const hook = readJson(relativePath);
    if (hook?.name !== ref.name) {
      fail(`${owner}: hook ${ref.name} path ${ref.path} has manifest name ${hook?.name ?? "<missing>"}`);
    }
    if (hook?.path && !fs.existsSync(path.join(sourceRoot, hook.path))) {
      fail(`${owner}: hook ${ref.name} adapter path source/${hook.path} is missing`);
    }
    if (hook?.path) validateHookAdapter(ref.name, hook.path);
  } else if (ref.type === "INSTRUCTION") {
    if (!fs.statSync(absolutePath).isFile()) {
      fail(`${owner}: instruction ${ref.name} must point at a file`);
    }
  } else {
    fail(`${owner}: unsupported primitive type ${ref.type}`);
  }

  for (const dependency of ref.dependsOn ?? []) {
    validatePrimitiveRef(dependency, `${owner} dependency of ${ref.name}`);
  }
}

function validateHookAdapter(hookName, adapterPath) {
  const relativePath = `source/${adapterPath}`;
  const adapter = readJson(relativePath);
  if (!adapter) return;
  const commands = [];
  collectHookCommands(adapter, commands);
  if (commands.length === 0) {
    fail(`${relativePath}: hook adapter ${hookName} does not define any command hooks`);
  }
  for (const command of commands) {
    const match = command.match(/^(bash|python3)\s+hooks\/([A-Za-z0-9_.-]+)(?:\s|$)/);
    if (!match) {
      fail(`${relativePath}: hook command must call bash/python3 hooks/<script>: ${command}`);
      continue;
    }
    const runner = match[1];
    const scriptName = match[2];
    const scriptPath = path.join(sourceRoot, "hooks", scriptName);
    if (!fs.existsSync(scriptPath)) {
      fail(`${relativePath}: hook command points at missing source/hooks/${scriptName}`);
      continue;
    }
    if (runner === "bash") {
      const mode = fs.statSync(scriptPath).mode;
      if (!scriptName.endsWith(".sh")) {
        fail(`${relativePath}: bash command should target a .sh script: ${scriptName}`);
      }
      if ((mode & 0o111) === 0) {
        fail(`${relativePath}: bash script source/hooks/${scriptName} must be executable`);
      }
    }
    if (runner === "python3" && !scriptName.endsWith(".py")) {
      fail(`${relativePath}: python3 command should target a .py script: ${scriptName}`);
    }
  }
}

function collectHookCommands(value, commands) {
  if (Array.isArray(value)) {
    for (const item of value) collectHookCommands(item, commands);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.command === "string") commands.push(value.command);
  for (const child of Object.values(value)) collectHookCommands(child, commands);
}

function validateSkillDescription(relativePath, fields, owner) {
  const description = fields.description ?? "";
  const wordCount = description.split(/\s+/).filter(Boolean).length;
  if (!description) {
    fail(`${owner}: ${relativePath} is missing a description`);
  }
  if (description === "Internal consolidated skill from a prior migration source.") {
    fail(`${owner}: ${relativePath} exposes placeholder migration text`);
  }
  if (wordCount > 0 && wordCount < 8) {
    fail(`${owner}: ${relativePath} description is too short to route reliably`);
  }
}

function pluginManifestPath(pluginName) {
  return `source/plugins/${pluginName}/plugin.json`;
}

const marketplace = readJson("source/adaptable.marketplace.json");
if (!marketplace) process.exit(1);

const pluginDirs = readDirNames("source/plugins");
const pluginManifests = new Map();
for (const pluginName of pluginDirs) {
  const manifest = readJson(pluginManifestPath(pluginName));
  if (manifest) pluginManifests.set(pluginName, manifest);
}

const catalogPlugins = new Map();
for (const entry of marketplace.plugins ?? []) {
  catalogPlugins.set(entry.name, entry);
  const pluginName = entry.plugin?.name;
  const pluginPath = entry.plugin?.source?.path?.replace(/^\.\//, "");
  if (!pluginName || !pluginPath) {
    fail(`source/adaptable.marketplace.json: plugin entry ${entry.name ?? "<unnamed>"} is missing plugin reference data`);
    continue;
  }
  const manifest = pluginManifests.get(pluginName);
  if (!manifest) {
    fail(`source/adaptable.marketplace.json: plugin entry ${entry.name} points at missing ${pluginName}`);
    continue;
  }
  if (pluginPath !== `plugins/${pluginName}`) {
    fail(`source/adaptable.marketplace.json: plugin ${pluginName} must reference ./plugins/${pluginName}`);
  }
  if (manifest.name !== entry.name || manifest.name !== pluginName) {
    fail(`source/adaptable.marketplace.json: plugin entry ${entry.name} does not match manifest name ${manifest.name}`);
  }
  if (manifest.version !== entry.plugin.version) {
    fail(`source/adaptable.marketplace.json: plugin ${pluginName} version ${entry.plugin.version} does not match manifest ${manifest.version}`);
  }
}

for (const pluginName of pluginDirs) {
  if (!catalogPlugins.has(pluginName)) {
    fail(`${pluginManifestPath(pluginName)}: plugin is missing from source/adaptable.marketplace.json`);
  }
}

const catalogSkillNames = new Set();
for (const ref of marketplace.skills ?? []) {
  catalogSkillNames.add(ref.name);
  validatePrimitiveRef(ref, "source/adaptable.marketplace.json");
}
for (const ref of marketplace.agents ?? []) validatePrimitiveRef(ref, "source/adaptable.marketplace.json");
for (const ref of marketplace.hooks ?? []) validatePrimitiveRef(ref, "source/adaptable.marketplace.json");
for (const ref of marketplace.instructions ?? []) validatePrimitiveRef(ref, "source/adaptable.marketplace.json");

const skillOwners = new Map();
const agentOwners = new Map();
const hookOwners = new Map();

for (const [pluginName, manifest] of pluginManifests) {
  const owner = pluginManifestPath(pluginName);
  for (const field of ["role", "scope", "dailyDriver", "notFor"]) {
    if (!manifest.metadata?.[field]) {
      fail(`${owner}: metadata.${field} is required for routing and disambiguation`);
    }
  }
  assertUniqueRefs(owner, "skill", manifest.skills);
  assertUniqueRefs(owner, "agent", manifest.agents);
  assertUniqueRefs(owner, "hook", manifest.hooks);
  for (const ref of manifest.skills ?? []) {
    validatePrimitiveRef(ref, owner);
    addOwner(skillOwners, ref.name, pluginName);
    if (!catalogSkillNames.has(ref.name)) {
      fail(`${owner}: skill ${ref.name} is composed but not listed as a standalone marketplace primitive`);
    }
  }
  for (const ref of manifest.agents ?? []) {
    validatePrimitiveRef(ref, owner);
    addOwner(agentOwners, ref.name, pluginName);
  }
  for (const ref of manifest.hooks ?? []) {
    validatePrimitiveRef(ref, owner);
    addOwner(hookOwners, ref.name, pluginName);
  }
  for (const ref of manifest.instructions ?? []) validatePrimitiveRef(ref, owner);
}

for (const [skillName, owners] of skillOwners) {
  if (owners.length <= 1) continue;
  const allowedOwners = allowedSharedSkills.get(skillName);
  if (!allowedOwners || !sameSet(owners, allowedOwners)) {
    fail(`skill ${skillName} is shared by plugins [${sorted(owners).join(", ")}] without an explicit allowed overlap`);
  }
}

for (const [agentName, owners] of agentOwners) {
  if (owners.length > 1) {
    fail(`agent ${agentName} is shared by plugins [${sorted(owners).join(", ")}]; agents should have one plugin owner`);
  }
}

for (const [hookName, owners] of hookOwners) {
  if (owners.length > 1) {
    fail(`hook ${hookName} is shared by plugins [${sorted(owners).join(", ")}]; hooks should have one plugin owner`);
  }
}

for (const profilePath of listFiles("source/profiles", (file) => file.endsWith(".json"))) {
  const relativePath = relativeToRepo(profilePath);
  const profile = readJson(relativePath);
  if (!profile) continue;
  const selectedPlugins = profile.plugins ?? [];
  for (const pluginName of selectedPlugins) {
    if (!pluginManifests.has(pluginName)) {
      fail(`${relativePath}: profile references missing plugin ${pluginName}`);
    }
  }
  const profileSkills = new Map();
  const profileAgents = new Map();
  const profileHooks = new Map();
  for (const pluginName of selectedPlugins) {
    const manifest = pluginManifests.get(pluginName);
    if (!manifest) continue;
    for (const ref of manifest.skills ?? []) addOwner(profileSkills, ref.name, pluginName);
    for (const ref of manifest.agents ?? []) addOwner(profileAgents, ref.name, pluginName);
    for (const ref of manifest.hooks ?? []) addOwner(profileHooks, ref.name, pluginName);
  }
  for (const [skillName, owners] of profileSkills) {
    if (owners.length > 1) {
      fail(`${relativePath}: selected plugins duplicate skill ${skillName} via [${sorted(owners).join(", ")}]`);
    }
  }
  for (const [agentName, owners] of profileAgents) {
    if (owners.length > 1) {
      fail(`${relativePath}: selected plugins duplicate agent ${agentName} via [${sorted(owners).join(", ")}]`);
    }
  }
  for (const [hookName, owners] of profileHooks) {
    if (owners.length > 1) {
      fail(`${relativePath}: selected plugins duplicate hook ${hookName} via [${sorted(owners).join(", ")}]`);
    }
  }
  for (const hook of profile.hooks ?? []) {
    const owners = profileHooks.get(hook.name) ?? [];
    if (owners.length !== 1) {
      fail(`${relativePath}: profile hook ${hook.name} must be provided by exactly one selected plugin, found [${owners.join(", ")}]`);
    }
  }
  if (!(profile.validation?.commands ?? []).includes("node source/tools/validate-source-graph.mjs")) {
    fail(`${relativePath}: validation.commands must include node source/tools/validate-source-graph.mjs`);
  }
}

for (const requirementsPath of listFiles("source/hooks", (file) => file.endsWith(".requirements.json"))) {
  validateHookRequirements(relativeToRepo(requirementsPath));
}

validatePrimitiveAuditManifest("garden/manifests/primitive-audits.json");
validateRuntimeLinkManifest("garden/manifests/runtime-links.json");

const primitiveIndex = buildPrimitiveIndex();
for (const casesPath of listFiles("source/evals", (file) => file.endsWith(".json"))) {
  validateRoutingCaseSet(relativeToRepo(casesPath), primitiveIndex);
}

for (const skillDir of readDirNames("source/skills")) {
  const skillFile = `source/skills/${skillDir}/SKILL.md`;
  const fields = parseFrontmatter(skillFile);
  if (fields.description === "Internal consolidated skill from a prior migration source." && catalogSkillNames.has(fields.name)) {
    fail(`${skillFile}: placeholder skill must not be marketplace-visible`);
  }
}

function buildPrimitiveIndex() {
  const index = {
    AGENT: new Set(),
    HOOK: new Set(),
    PLUGIN: new Set(pluginManifests.keys()),
    PROFILE: new Set(),
    SKILL: new Set(),
  };

  for (const skillDir of readDirNames("source/skills")) {
    const fields = parseFrontmatter(`source/skills/${skillDir}/SKILL.md`);
    if (fields.name) index.SKILL.add(fields.name);
  }
  for (const agentPath of listFiles("source/agents", (file) => file.endsWith(".agent.md") || file.endsWith("/AGENT.md"))) {
    const fields = parseFrontmatter(relativeToRepo(agentPath));
    if (fields.name) index.AGENT.add(fields.name);
  }
  for (const hookPath of listFiles("source/hooks", (file) => file.endsWith(".hook.json"))) {
    const hook = readJson(relativeToRepo(hookPath));
    if (hook?.name) index.HOOK.add(hook.name);
  }
  for (const profilePath of listFiles("source/profiles", (file) => file.endsWith(".json"))) {
    const profile = readJson(relativeToRepo(profilePath));
    if (profile?.name) index.PROFILE.add(profile.name);
  }

  return index;
}

function validateHookRequirements(relativePath) {
  const payload = readJson(relativePath);
  if (!payload) return;
  if (payload.type !== "HOOK_SKILL_REQUIREMENTS") {
    fail(`${relativePath}: requirements file must use type HOOK_SKILL_REQUIREMENTS`);
  }
  if (payload.schemaVersion !== 1) {
    fail(`${relativePath}: schemaVersion must be 1`);
  }
  if (!["ADVISORY", "BLOCKING"].includes(payload.mode)) {
    fail(`${relativePath}: mode must be ADVISORY or BLOCKING`);
  }
  if (!payload.$schema) {
    fail(`${relativePath}: missing $schema`);
  } else {
    const schemaPath = path.normalize(path.join(path.dirname(path.join(repoRoot, relativePath)), payload.$schema));
    if (!schemaPath.startsWith(repoRoot) || !fs.existsSync(schemaPath)) {
      fail(`${relativePath}: $schema points at missing ${payload.$schema}`);
    }
  }
  if (!Array.isArray(payload.skills)) {
    fail(`${relativePath}: skills must be an array`);
    return;
  }
  for (const [index, skill] of payload.skills.entries()) {
    const owner = `${relativePath}: skills[${index}]`;
    if (skill.type !== "REQUIRED_SKILL") fail(`${owner}: type must be REQUIRED_SKILL`);
    if (typeof skill.id !== "string" || !skill.id) fail(`${owner}: id is required`);
    if (typeof skill.skillPath !== "string" || !skill.skillPath) fail(`${owner}: skillPath is required`);
    if (typeof skill.requireRead !== "boolean") fail(`${owner}: requireRead must be boolean`);
    if (typeof skill.notes !== "string" || !skill.notes.trim()) fail(`${owner}: notes is required`);
    if (skill.skillPath) {
      const skillFile = `source/${skill.skillPath}`;
      const fields = parseFrontmatter(skillFile);
      if (fields.name !== skill.id) {
        fail(`${owner}: skillPath ${skill.skillPath} has frontmatter name ${fields.name ?? "<missing>"}`);
      }
      if (!catalogSkillNames.has(skill.id)) {
        fail(`${owner}: required skill ${skill.id} must be marketplace-visible`);
      }
    }
  }
}

function validatePrimitiveAuditManifest(relativePath) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) return;
  const payload = readJson(relativePath);
  if (!payload) return;
  if (payload.type !== "PRIMITIVE_AUDIT_MANIFEST") {
    fail(`${relativePath}: type must be PRIMITIVE_AUDIT_MANIFEST`);
  }
  if (payload.schemaVersion !== 1) {
    fail(`${relativePath}: schemaVersion must be 1`);
  }
  if (payload.marketplace !== marketplace.name) {
    fail(`${relativePath}: marketplace must match ${marketplace.name}`);
  }
  validateSchemaLink(relativePath, payload.$schema);
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    fail(`${relativePath}: entries must be a non-empty array`);
    return;
  }

  const ids = new Set();
  const decisions = new Set([
    "PROMOTE_READY",
    "SYNTHESIZE_FIRST",
    "REWRITE_FIRST",
    "DEFER",
    "ACTIVATE_READY",
    "CLEANUP_READY",
    "IGNORE",
  ]);
  const statuses = new Set(["PASS", "PARTIAL", "BLOCKED"]);
  const confidence = new Set(["LOW", "MEDIUM", "HIGH"]);
  const targetKinds = new Set(["AGENT", "EVAL_FAMILY", "HOOK", "PLUGIN", "PROFILE", "SKILL"]);
  const collisionChecks = new Set(["NOT_APPLICABLE", "CHECKED_NO_COLLISION", "BLOCKED_COLLISION_RISK"]);

  for (const [index, entry] of payload.entries.entries()) {
    const owner = `${relativePath}: entries[${index}]`;
    validateNoPrivateLocalStrings(owner, entry);
    if (entry.type !== "PRIMITIVE_AUDIT") fail(`${owner}: type must be PRIMITIVE_AUDIT`);
    if (typeof entry.id !== "string" || !entry.id.match(/^[a-z0-9][a-z0-9-]+$/)) {
      fail(`${owner}: id must be kebab-case`);
    } else if (ids.has(entry.id)) {
      fail(`${owner}: duplicate id ${entry.id}`);
    } else {
      ids.add(entry.id);
    }
    if (!decisions.has(entry.decision)) fail(`${owner}: decision is invalid`);
    if (!confidence.has(entry.confidence)) fail(`${owner}: confidence is invalid`);
    if (typeof entry.reviewedAt !== "string" || !entry.reviewedAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
      fail(`${owner}: reviewedAt must be YYYY-MM-DD`);
    }
    for (const field of ["baseline", "reviewedBy", "nextAction"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`${owner}: ${field} is required`);
    }
    validateAuditTarget(owner, entry.target, targetKinds);
    for (const block of ["capabilityBoundary", "schemaCoverage", "runtimeSafety"]) {
      validateEvidenceBlock(`${owner}: ${block}`, entry[block], statuses);
    }
    validateEvidenceBlock(`${owner}: provenance`, entry.provenance, statuses);
    if (!collisionChecks.has(entry.provenance?.firstPartyCollisionCheck)) {
      fail(`${owner}: provenance.firstPartyCollisionCheck is invalid`);
    }
    validateValidationBlock(`${owner}: validation`, entry.validation, statuses);
    validateNonEmptyStringArray(`${owner}: residualRisks`, entry.residualRisks);
    if (
      entry.decision === "PROMOTE_READY" &&
      !["capabilityBoundary", "schemaCoverage", "provenance", "validation"].every((field) => entry[field]?.status === "PASS")
    ) {
      fail(`${owner}: PROMOTE_READY requires PASS capabilityBoundary, schemaCoverage, provenance, and validation`);
    }
    if (entry.decision === "ACTIVATE_READY" && entry.runtimeSafety?.status !== "PASS") {
      fail(`${owner}: ACTIVATE_READY requires PASS runtimeSafety`);
    }
  }
}

function validateRuntimeLinkManifest(relativePath) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) return;
  const payload = readJson(relativePath);
  if (!payload) return;
  if (payload.type !== "RUNTIME_LINK_MANIFEST") {
    fail(`${relativePath}: type must be RUNTIME_LINK_MANIFEST`);
  }
  if (payload.schemaVersion !== 1) {
    fail(`${relativePath}: schemaVersion must be 1`);
  }
  if (payload.marketplace !== marketplace.name) {
    fail(`${relativePath}: marketplace must match ${marketplace.name}`);
  }
  validateSchemaLink(relativePath, payload.$schema);
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    fail(`${relativePath}: entries must be a non-empty array`);
    return;
  }

  const ids = new Set();
  const runtimes = new Set(["CODEX", "AGENTS", "CLAUDE", "COPILOT", "OTHER"]);
  const primitiveTypes = new Set(["PLUGIN", "SKILL", "AGENT", "HOOK", "PROFILE", "INSTRUCTION"]);
  const strategies = new Set(["MARKETPLACE_IMPORT", "CHILD_SYMLINKS", "FILE_SYMLINK", "TREE_SYMLINK"]);
  const statuses = new Set(["READY", "REVIEW_REQUIRED", "PLANNED"]);
  const collisionPolicies = new Set(["SKIP_EXISTING", "FAIL_IF_EXISTS", "BACKUP_THEN_LINK"]);

  for (const [index, entry] of payload.entries.entries()) {
    const owner = `${relativePath}: entries[${index}]`;
    validateNoPrivateLocalStrings(owner, entry);
    if (entry.type !== "RUNTIME_LINK") fail(`${owner}: type must be RUNTIME_LINK`);
    if (typeof entry.id !== "string" || !entry.id.match(/^[a-z0-9][a-z0-9-]+$/)) {
      fail(`${owner}: id must be kebab-case`);
    } else if (ids.has(entry.id)) {
      fail(`${owner}: duplicate id ${entry.id}`);
    } else {
      ids.add(entry.id);
    }
    if (!runtimes.has(entry.runtime)) fail(`${owner}: runtime is invalid`);
    if (!strategies.has(entry.strategy)) fail(`${owner}: strategy is invalid`);
    if (!statuses.has(entry.status)) fail(`${owner}: status is invalid`);
    if (!collisionPolicies.has(entry.collisionPolicy)) fail(`${owner}: collisionPolicy is invalid`);
    if (typeof entry.requiresApproval !== "boolean") fail(`${owner}: requiresApproval must be boolean`);
    for (const field of ["sourcePath", "targetPath", "activationCommand", "notes"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`${owner}: ${field} is required`);
    }
    validateRuntimeSourcePath(owner, entry.sourcePath);
    validateNonEmptyStringArray(`${owner}: primitiveTypes`, entry.primitiveTypes);
    for (const primitiveType of entry.primitiveTypes ?? []) {
      if (!primitiveTypes.has(primitiveType)) fail(`${owner}: primitiveTypes contains invalid value ${primitiveType}`);
    }
    validateNonEmptyStringArray(`${owner}: validationCommands`, entry.validationCommands);
    if (!(entry.validationCommands ?? []).includes("node source/tools/validate-source-graph.mjs")) {
      fail(`${owner}: validationCommands must include node source/tools/validate-source-graph.mjs`);
    }
    if (entry.runtime === "CODEX" && entry.strategy === "MARKETPLACE_IMPORT") {
      if (!entry.targetPath?.includes("@")) {
        fail(`${owner}: CODEX MARKETPLACE_IMPORT targetPath must be a plugin coordinate`);
      }
      if (!entry.activationCommand?.startsWith("codex plugin add ")) {
        fail(`${owner}: CODEX MARKETPLACE_IMPORT activationCommand must start with codex plugin add`);
      }
      if (entry.collisionPolicy !== "SKIP_EXISTING") {
        fail(`${owner}: CODEX MARKETPLACE_IMPORT should use SKIP_EXISTING collision policy`);
      }
    }
    if (entry.collisionPolicy === "BACKUP_THEN_LINK" && !entry.requiresApproval) {
      fail(`${owner}: BACKUP_THEN_LINK requires explicit approval`);
    }
  }
}

function validateRuntimeSourcePath(owner, sourcePath) {
  if (typeof sourcePath !== "string" || !sourcePath.trim()) return;
  if (sourcePath.startsWith("/") || sourcePath.includes("..")) {
    fail(`${owner}: sourcePath must be repository-relative: ${sourcePath}`);
    return;
  }
  if (!fs.existsSync(path.join(repoRoot, sourcePath))) {
    fail(`${owner}: sourcePath is missing: ${sourcePath}`);
  }
}

function validateRoutingCaseSet(relativePath, primitiveIndex) {
  const payload = readJson(relativePath);
  if (!payload) return;
  if (payload.type !== "ROUTING_CASE_SET") return;

  if (payload.schemaVersion !== 2) {
    fail(`${relativePath}: schemaVersion must be 2`);
  }
  if (!payload.$schema) {
    fail(`${relativePath}: missing $schema`);
  } else {
    const schemaPath = path.normalize(path.join(path.dirname(path.join(repoRoot, relativePath)), payload.$schema));
    if (!schemaPath.startsWith(repoRoot) || !fs.existsSync(schemaPath)) {
      fail(`${relativePath}: $schema points at missing ${payload.$schema}`);
    }
  }
  if (typeof payload.name !== "string" || !payload.name.trim()) {
    fail(`${relativePath}: name is required`);
  }
  if (typeof payload.description !== "string" || !payload.description.trim()) {
    fail(`${relativePath}: description is required`);
  }
  if (!Array.isArray(payload.cases) || payload.cases.length === 0) {
    fail(`${relativePath}: cases must be a non-empty array`);
    return;
  }

  const ids = new Set();
  for (const [index, routingCase] of payload.cases.entries()) {
    const owner = `${relativePath}: cases[${index}]`;
    validateNoPrivateLocalStrings(owner, routingCase);

    if (typeof routingCase.id !== "string" || !routingCase.id.match(/^[a-z0-9][a-z0-9-]+$/)) {
      fail(`${owner}: id must be kebab-case`);
    } else if (ids.has(routingCase.id)) {
      fail(`${owner}: duplicate id ${routingCase.id}`);
    } else {
      ids.add(routingCase.id);
    }

    if (!routingCaseTypes.has(routingCase.type)) {
      fail(`${owner}: type must be one of ${[...routingCaseTypes].join(", ")}`);
    }

    validateRoutingSource(owner, routingCase.source);
    validateExpectedPrimitive(owner, routingCase.expectedPrimitive, primitiveIndex);
    validateObservedRoute(owner, routingCase.observedRoute);

    for (const field of ["prompt", "recoveryExpectation", "productiveOutcome", "notes"]) {
      if (typeof routingCase[field] !== "string" || !routingCase[field].trim()) {
        fail(`${owner}: ${field} is required`);
      }
    }
    for (const field of ["allowedActions", "forbiddenActions", "verificationEvidence"]) {
      if (!Array.isArray(routingCase[field]) || routingCase[field].length === 0) {
        fail(`${owner}: ${field} must be a non-empty array`);
      } else {
        for (const [itemIndex, item] of routingCase[field].entries()) {
          if (typeof item !== "string" || !item.trim()) {
            fail(`${owner}: ${field}[${itemIndex}] must be a non-empty string`);
          }
        }
      }
    }
  }
}

function validateSchemaLink(relativePath, schemaRef) {
  if (typeof schemaRef !== "string" || !schemaRef.trim()) {
    fail(`${relativePath}: missing $schema`);
    return;
  }
  const schemaPath = path.normalize(path.join(path.dirname(path.join(repoRoot, relativePath)), schemaRef));
  if (!schemaPath.startsWith(repoRoot) || !fs.existsSync(schemaPath)) {
    fail(`${relativePath}: $schema points at missing ${schemaRef}`);
  }
}

function validateAuditTarget(owner, target, targetKinds) {
  if (!target || typeof target !== "object") {
    fail(`${owner}: target is required`);
    return;
  }
  if (!targetKinds.has(target.kind)) fail(`${owner}: target.kind is invalid`);
  if (typeof target.name !== "string" || !target.name.trim()) fail(`${owner}: target.name is required`);
  validateNonEmptyStringArray(`${owner}: target.paths`, target.paths);
  for (const targetPath of target.paths ?? []) {
    if (targetPath.startsWith("/") || targetPath.includes("..")) {
      fail(`${owner}: target path must be repository-relative: ${targetPath}`);
      continue;
    }
    if (!fs.existsSync(path.join(repoRoot, targetPath))) {
      fail(`${owner}: target path is missing: ${targetPath}`);
    }
  }
}

function validateEvidenceBlock(owner, block, statuses) {
  if (!block || typeof block !== "object") {
    fail(`${owner}: block is required`);
    return;
  }
  if (!statuses.has(block.status)) fail(`${owner}: status is invalid`);
  validateNonEmptyStringArray(`${owner}: evidence`, block.evidence);
}

function validateValidationBlock(owner, block, statuses) {
  if (!block || typeof block !== "object") {
    fail(`${owner}: block is required`);
    return;
  }
  if (!statuses.has(block.status)) fail(`${owner}: status is invalid`);
  validateNonEmptyStringArray(`${owner}: commands`, block.commands);
}

function validateNonEmptyStringArray(owner, value) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${owner} must be a non-empty array`);
    return;
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || !item.trim()) {
      fail(`${owner}[${index}] must be a non-empty string`);
    }
  }
}

function validateRoutingSource(owner, source) {
  if (!source || typeof source !== "object") {
    fail(`${owner}: source is required`);
    return;
  }
  if (!["CURRENT_SOURCE", "MEMORY_INDEX", "USER_CLARIFICATION", "LOCAL_VALIDATION"].includes(source.type)) {
    fail(`${owner}: source.type is invalid`);
  }
  if (typeof source.capturedAt !== "string" || !source.capturedAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
    fail(`${owner}: source.capturedAt must be YYYY-MM-DD`);
  }
  if (!Array.isArray(source.evidenceRefs) || source.evidenceRefs.length === 0) {
    fail(`${owner}: source.evidenceRefs must be a non-empty array`);
  }
}

function validateExpectedPrimitive(owner, primitive, primitiveIndex) {
  if (!primitive || typeof primitive !== "object") {
    fail(`${owner}: expectedPrimitive is required`);
    return;
  }
  const names = primitiveIndex[primitive.type];
  if (!names) {
    fail(`${owner}: expectedPrimitive.type is invalid`);
    return;
  }
  if (typeof primitive.name !== "string" || !primitive.name.trim()) {
    fail(`${owner}: expectedPrimitive.name is required`);
    return;
  }
  if (!names.has(primitive.name)) {
    fail(`${owner}: expected ${primitive.type} ${primitive.name} does not exist in source`);
  }
}

function validateObservedRoute(owner, observedRoute) {
  if (!observedRoute || typeof observedRoute !== "object") {
    fail(`${owner}: observedRoute is required`);
    return;
  }
  if (typeof observedRoute.summary !== "string" || !observedRoute.summary.trim()) {
    fail(`${owner}: observedRoute.summary is required`);
  }
  if (typeof observedRoute.risk !== "string" || !observedRoute.risk.trim()) {
    fail(`${owner}: observedRoute.risk is required`);
  }
  if (!Array.isArray(observedRoute.loadedPrimitives)) {
    fail(`${owner}: observedRoute.loadedPrimitives must be an array`);
  }
}

function validateNoPrivateLocalStrings(owner, value) {
  if (typeof value === "string") {
    if (value.includes("/Users/")) {
      fail(`${owner}: durable routing cases must not contain private absolute paths`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) validateNoPrivateLocalStrings(owner, item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) validateNoPrivateLocalStrings(owner, child);
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`ERROR ${finding}`);
  }
  process.exit(1);
}

console.log("OK source graph quality");
