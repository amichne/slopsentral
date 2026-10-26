import { homedir } from "node:os";
import { join } from "node:path";
import { prepareRuntime } from "./tools/promptfoo/runtime.mts";
import { createConfig } from "./tools/promptfoo/suite.mts";

const authPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json");
const runtime = prepareRuntime(authPath);
process.once("exit", runtime.dispose);

export default createConfig(runtime);
