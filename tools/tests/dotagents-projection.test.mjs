import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCatalog, pluginClosure } from "../catalog.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const suppliedProjection = process.env.SLOPSENTRAL_DOTAGENTS_PROJECTION;
const targets = ["claude", "cursor", "codex", "copilot", "grok", "opencode", "pi"];
const native = { skip: !process.env.PKL_BIN && !suppliedProjection };
const packageSpec = "@sentry/dotagents@3.4.0";
const pluginRoot = ".agents/plugins";
const schema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 120_000 });
  if (result.error) throw result.error;
  return result;
}

function requireSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function dotagents(cwd, env, ...args) {
  return run("npx", ["--yes", packageSpec, "--project", ...args], cwd, env);
}

test("dotagents discovers the whole catalog, translates it for seven targets, and rejects invalid bundles", native, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-dotagents-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const projection = suppliedProjection ?? path.join(root, "projection");
  if (!suppliedProjection) {
    requireSuccess(run(process.execPath, [
      "tools/project-marketplaces.mjs", "--source", repo, "--harness", "dotagents", "--out", projection,
    ], repo));
  }
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_CACHE_HOME: path.join(home, ".cache"),
    CODEX_HOME: path.join(home, ".codex"),
    GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
  };
  function git(cwd, ...args) {
    const result = run("git", args, cwd, env);
    requireSuccess(result);
    return result.stdout.trim();
  }

  const publisher = path.join(root, "publisher");
  const remote = path.join(root, "remote.git");
  fs.mkdirSync(publisher);
  git(root, "init", "--quiet", "--bare", "--initial-branch=main", remote);
  git(publisher, "init", "--quiet", "--initial-branch=main");
  git(publisher, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
    "commit", "--quiet", "--allow-empty", "-m", "Source revision");
  git(publisher, "remote", "add", "origin", remote);
  git(publisher, "push", "--quiet", "origin", "main");
  const revision = git(publisher, "rev-parse", "HEAD");
  requireSuccess(run("python3", [
    path.join(repo, "tools/publish.py"), "harness", projection, "harness/dotagents", "main", revision,
  ], publisher, env));
  assert.equal(
    git(root, "--git-dir", remote, "log", "-1", "--format=%(trailers:key=Source-Commit,valueonly)", "harness/dotagents"),
    revision,
  );
  git(root, "config", "--global", `url.${pathToFileURL(remote).href}.insteadOf`, "https://github.com/amichne/slopsentral");

  function consumer(name) {
    const cwd = path.join(root, name);
    fs.mkdirSync(cwd);
    git(cwd, "init", "--quiet");
    fs.writeFileSync(path.join(cwd, "agents.toml"), `version = 1\nagents = ${JSON.stringify(targets)}\n`);
    return cwd;
  }

  const cwd = consumer("consumer");
  requireSuccess(dotagents(cwd, env, "add", "amichne/slopsentral", "--ref", "harness/dotagents", "--all"));

  const catalog = loadCatalog(repo);
  const names = catalog.plugins.map(plugin => plugin.name).sort();
  const lock = dotagents(cwd, env, "list", "--json");
  requireSuccess(lock);
  const installed = JSON.parse(lock.stdout).plugins;
  assert.deepEqual(installed.map(plugin => plugin.name).sort(), names);

  for (const manifest of [
    ".claude-plugin/marketplace.json",
    ".cursor-plugin/marketplace.json",
    ".agents/plugins/marketplace.json",
    ".github/plugin/marketplace.json",
  ]) {
    assert.deepEqual(readJson(cwd, manifest).plugins.map(plugin => plugin.name).sort(), names, manifest);
  }

  const allSkills = new Map();
  for (const plugin of catalog.plugins) {
    const bundle = path.join(cwd, pluginRoot, plugin.name);
    const portable = readJson(bundle, "plugin.json");
    assert.equal(portable.$schema, schema);
    assert.equal(portable.name, plugin.name);
    const grok = path.join(cwd, ".grok/plugins", plugin.name);
    assert.equal(readJson(grok, "plugin.json").name, plugin.name);
    assert.equal(fs.existsSync(path.join(grok, ".codex-plugin/plugin.json")), false);

    for (const ref of pluginClosure(catalog, plugin).refs.values()) {
      if (ref.type !== "SKILL") continue;
      const source = fs.readFileSync(path.join(repo, "source", ref.path, "SKILL.md"));
      const skill = path.join("skills", ref.name, "SKILL.md");
      assert.deepEqual(fs.readFileSync(path.join(bundle, skill)), source);
      assert.deepEqual(fs.readFileSync(path.join(grok, skill)), source);
      allSkills.set(ref.name, source);
    }
  }
  for (const [name, source] of allSkills) {
    for (const target of [".opencode/skills", ".agents/skills"]) {
      assert.deepEqual(fs.readFileSync(path.join(cwd, target, name, "SKILL.md")), source);
    }
  }

  const bundle = path.join(cwd, pluginRoot, "software-engineering");
  const codex = ".codex-plugin/plugin.json";
  const fallback = readJson(bundle, codex);
  assert.equal(fallback.hooks, "./hooks.json");
  assert.deepEqual(
    readJson(bundle, fallback.hooks),
    readJson(bundle, "hooks/software-engineering-context.hooks.json"),
  );
  assert.equal(fs.existsSync(path.join(bundle, "hooks/agents-md-scope.hooks.json")), true);
  assert.equal(Object.hasOwn(
    readJson(path.join(cwd, pluginRoot, "repository-knowledge"), codex), "hooks",
  ), false);
  for (const other of [".claude-plugin/plugin.json", ".cursor-plugin/plugin.json"]) {
    assert.equal(Object.hasOwn(readJson(bundle, other), "hooks"), false);
  }

  const invalid = consumer("invalid");
  fs.cpSync(projection, path.join(invalid, "input"), { recursive: true });
  const invalidManifest = path.join(invalid, "input", pluginRoot, names[0], "plugin.json");
  const manifest = JSON.parse(fs.readFileSync(invalidManifest, "utf8"));
  fs.writeFileSync(invalidManifest, JSON.stringify({ ...manifest, name: 42 }));
  const rejected = dotagents(invalid, env, "add", "path:./input", names[0]);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr + rejected.stdout, /manifest|plugin\.json/i);
  assert.equal(fs.existsSync(path.join(invalid, "agents.lock")), false);
  assert.equal(fs.existsSync(path.join(invalid, pluginRoot, names[0])), false);
});
