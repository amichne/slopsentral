import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface EvalRuntime {
  readonly codexHome: string;
  readonly workspace: string;
  dispose(): void;
}

// This adapter owns the disposable runtime. It never copies the user's config or auth bytes.
export function prepareRuntime(authPath: string): EvalRuntime {
  const directory = mkdtempSync(join(tmpdir(), "slopsentral-promptfoo-"));
  const dispose = () => rmSync(directory, { recursive: true, force: true });
  try {
    const codexHome = join(directory, "codex");
    const workspace = join(directory, "workspace");
    mkdirSync(codexHome);
    mkdirSync(workspace);
    if (existsSync(authPath)) symlinkSync(authPath, join(codexHome, "auth.json"));
    return { codexHome, workspace, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
