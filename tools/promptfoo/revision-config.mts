import { homedir } from "node:os";
import { join } from "node:path";
import { resolveExecutable } from "./cli-providers.mts";
import { createRevisionConfig } from "./revision-suite.mts";
import { prepareRuntime } from "./runtime.mts";

const path = process.env.PATH ?? "";
const codex = resolveExecutable("codex", path);
const claude = resolveExecutable("claude", path);
if (codex === undefined || claude === undefined) {
  throw new Error(`Writing revisions need the installed CLIs on PATH: codex=${codex ?? "missing"}, claude=${claude ?? "missing"}`);
}

const authPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json");
const runtime = prepareRuntime(authPath);
process.once("exit", runtime.dispose);

export default createRevisionConfig(runtime, { codex, claude });
