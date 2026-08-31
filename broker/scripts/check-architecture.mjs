import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const roots = [join(packageRoot, "src"), join(packageRoot, "test")];
const files = (await Promise.all(roots.map(typescriptFiles))).flat().sort();
const issues = [];

for (const artifact of await prohibitedJvmArtifacts(packageRoot)) {
  issues.push(
    `${relative(packageRoot, artifact)}: server-local JVM/Gradle artifact is forbidden`,
  );
}

for (const file of files) {
  const text = await readFile(file, "utf8");
  const owner = architecturalArea(file);

  for (const match of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    const imported = match[1];
    if (imported === undefined) continue;
    if (!imported.startsWith(".")) continue;
    const target = resolve(dirname(file), imported);
    const targetOwner = architecturalArea(target);
    if (!allowedDependency(owner, targetOwner)) {
      report(match.index, `forbidden dependency: ${owner} -> ${targetOwner}`);
    }
  }

  for (const match of text.matchAll(/(?:[:<,|]|\bextends\s+)\s*any\b/g)) {
    report(match.index, "explicit any is forbidden");
  }
  if (owner !== "protocol") {
    for (const match of text.matchAll(/\bas\s+(?!const\b)[A-Za-z_{[]/g)) {
      report(
        match.index,
        "unchecked assertion is restricted to protocol boundary adapters",
      );
    }
  }

  function report(index, message) {
    const before = text.slice(0, index);
    const line = before.split("\n").length;
    const column = index - before.lastIndexOf("\n");
    issues.push(`${relative(packageRoot, file)}:${line}:${column}: ${message}`);
  }
}

const composition = await readFile(
  join(packageRoot, "src/runtime/composition.ts"),
  "utf8",
);
for (const registration of [
  "createGradleRegistration",
  "qualifyKastRegistration",
]) {
  const occurrences = files
    .filter((file) => file.includes(`${sep}src${sep}`))
    .map(async (file) => ({ file, text: await readFile(file, "utf8") }));
  const matches = (await Promise.all(occurrences)).filter(({ text }) =>
    text.includes(`${registration}(`),
  );
  if (matches.length !== 1 || !composition.includes(`${registration}(`)) {
    issues.push(
      `${registration} must appear exactly once in src/runtime/composition.ts`,
    );
  }
}

if (issues.length > 0) {
  process.stderr.write(`${issues.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `architecture verified for ${files.length} TypeScript files\n`,
  );
}

async function typescriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? typescriptFiles(path)
        : Promise.resolve(entry.name.endsWith(".ts") ? [path] : []);
    }),
  );
  return nested.flat();
}

async function prohibitedJvmArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const prohibitedNames = new Set([
    ".gradle",
    ".kotlin",
    "build.gradle",
    "build.gradle.kts",
    "gradle.properties",
    "gradlew",
    "gradlew.bat",
    "settings.gradle",
    "settings.gradle.kts",
  ]);
  const skippedDirectories = new Set([".agent-turn", "dist", "node_modules"]);
  const results = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (
        prohibitedNames.has(entry.name) ||
        /\.(?:jar|kt|kts)$/.test(entry.name)
      ) {
        return Promise.resolve([path]);
      }
      return entry.isDirectory() && !skippedDirectories.has(entry.name)
        ? prohibitedJvmArtifacts(path)
        : Promise.resolve([]);
    }),
  );
  return results.flat();
}

function architecturalArea(file) {
  const path = relative(packageRoot, file).split(sep);
  if (path[0] === "test") return "test";
  if (path[0] !== "src") return "external";
  return path[1] ?? "external";
}

function allowedDependency(owner, target) {
  if (owner === "test" || owner === "runtime") return true;
  if (owner === "broker") return target === "broker";
  if (owner === "protocol")
    return (
      target === "protocol" || target === "broker" || target === "external"
    );
  if (owner === "providers")
    return target === "providers" || target === "broker";
  return true;
}
