import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { resourcePath, type Capability, type Effective, type EffectiveCapability, type ResourceIdentity } from "./settings.ts";

export type Plan = Extract<Effective, { type: "effective" }>;
export type SkillRejection = { readonly type: "rejected"; readonly code:
  "UNKNOWN_SKILL" | "DISABLED" | "UNAVAILABLE" | "FORBIDDEN" | "STALE_GENERATION" | "STALE_RESOURCE" | "INVALID_REQUEST" | "INVALID_PLAN" | "ABORTED" | "LEGACY_SKILL_ROUTE" };
export const digest = (bytes: Uint8Array): string => crypto.createHash("sha256").update(bytes).digest("hex");
const resourceLimit = 1024 * 1024;

function readResource(file: string): { readonly type: "read"; readonly bytes: Buffer } | { readonly type: "rejected" } {
  try {
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    try {
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || stat.size > resourceLimit) return { type: "rejected" };
      const buffer = Buffer.alloc(resourceLimit + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const count = fs.readSync(descriptor, buffer, offset, buffer.length - offset, offset);
        if (!count) return { type: "read", bytes: buffer.subarray(0, offset) };
        offset += count;
      }
      return { type: "rejected" };
    } finally { fs.closeSync(descriptor); }
  } catch { return { type: "rejected" }; }
}

export function captureResources(root: string, capabilities: readonly Capability[]) {
  const resources = new Map<string, ResourceIdentity>();
  const unavailable = new Map<string, string>();
  const instructions = new Map<string, string>();
  const files = new Map<string, string>();
  for (const cap of capabilities) {
    if (cap.type === "HOOK") continue;
    const file = resourcePath(root, cap);
    try {
      const canonical = fs.realpathSync(file);
      const previous = files.get(canonical);
      if (previous !== undefined) { unavailable.set(cap.id, "DUPLICATE_RESOURCE"); unavailable.set(previous, "DUPLICATE_RESOURCE"); }
      files.set(canonical, cap.id);
      const read = readResource(canonical);
      if (read.type === "rejected") throw new Error("INVALID_RESOURCE");
      const bytes = read.bytes;
      let description = "";
      if (cap.type === "SKILL") {
        const metadata = parseFrontmatter(bytes.toString("utf8")).frontmatter;
        if (metadata.name !== cap.name || typeof metadata.description !== "string" || !metadata.description.trim()
          || metadata.description.length > 1024) throw new Error("INVALID_SKILL");
        description = metadata.description;
      }
      const identity: ResourceIdentity = { type: "captured", path: canonical, digest: digest(bytes), description };
      resources.set(cap.id, identity);
      if (cap.type === "INSTRUCTION") {
        if (bytes.length > 65536) throw new Error("INSTRUCTION_TOO_LARGE");
        instructions.set(cap.id, bytes.toString("utf8"));
      }
    } catch {
      unavailable.set(cap.id, "RESOURCE_FAILED");
      resources.set(cap.id, { type: "unavailable", reason: "RESOURCE_FAILED" });
    }
  }
  return { resources, unavailable, instructions };
}

/** Only admission creates this value. Loading accepts the captured binding, never a new lookup. */
export class AdmittedSkill {
  private readonly admitted = true;
  readonly binding: EffectiveCapability;
  readonly generation: string;
  readonly resource: Extract<ResourceIdentity, { type: "captured" }>;
  private constructor(binding: EffectiveCapability, generation: string, resource: Extract<ResourceIdentity, { type: "captured" }>) {
    this.binding = binding; this.generation = generation; this.resource = resource;
    Object.freeze(this);
  }

  static admit(plan: Plan, name: string, surface: "human" | "model", generation: string): AdmittedSkill | SkillRejection {
    if (generation !== plan.generation) return { type: "rejected", code: "STALE_GENERATION" };
    const item = plan.capabilities.find(item => item.capability.id === `skill:${name}`);
    if (!item || item.binding.type !== "skill") return { type: "rejected", code: "UNKNOWN_SKILL" };
    if (!plan.enabled || item.state === "disabled") return { type: "rejected", code: "DISABLED" };
    if (item.state === "unavailable" || item.resource.type !== "captured") return { type: "rejected", code: "UNAVAILABLE" };
    if (item.binding.invocation !== "either" && item.binding.invocation !== surface) return { type: "rejected", code: "FORBIDDEN" };
    return new AdmittedSkill(item, plan.generation, item.resource);
  }
}

export interface LoadedSkill {
  readonly type: "loaded";
  readonly name: string;
  readonly generation: string;
  readonly resource: Extract<ResourceIdentity, { type: "captured" }>;
  readonly baseDir: string;
  readonly content: string;
}
export function loadSkill(admitted: AdmittedSkill, signal?: AbortSignal): LoadedSkill | SkillRejection {
  if (signal?.aborted) return { type: "rejected", code: "ABORTED" };
  const { resource, binding, generation } = admitted;
  try {
    const read = readResource(resource.path);
    if (read.type === "rejected") return { type: "rejected", code: "STALE_RESOURCE" };
    const bytes = read.bytes;
    if (digest(bytes) !== resource.digest) return { type: "rejected", code: "STALE_RESOURCE" };
    const baseDir = path.dirname(resource.path);
    return { type: "loaded", name: binding.capability.name, generation, resource, baseDir,
      content: `Skill: ${binding.capability.name}\nReference base directory: ${baseDir}\n\n${parseFrontmatter(bytes.toString("utf8")).body}` };
  } catch { return { type: "rejected", code: "STALE_RESOURCE" }; }
}

export function skillCatalog(plan: Effective, surface: "human" | "model") {
  if (plan.type !== "effective" || !plan.enabled) return [];
  return plan.capabilities.flatMap(item => item.state === "enabled" && item.binding.type === "skill"
    && item.resource.type === "captured" && (item.binding.invocation === "either" || item.binding.invocation === surface)
    ? [{ name: item.capability.name, description: item.resource.description, invocation: item.binding.invocation }] : []);
}

export function immutable<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
