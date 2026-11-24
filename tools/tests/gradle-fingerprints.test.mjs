import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cases } from "../../source/evals/promptfoo/cases.mts";

const questions = {
  digest: "stale", manifest: "stale", raw: "stale", protocol: "waste",
  origin: "both", files: "both", abi: "stale", stamp: "both",
};

test("Gradle task outcomes and fresh output bytes reproduce the decision oracle", {
  skip: process.env.GRADLE_BIN ? false : "Set GRADLE_BIN to the pinned Gradle 9.8.2 executable",
}, (t) => {
  const version = execFileSync(process.env.GRADLE_BIN, ["--version"], { encoding: "utf8" });
  assert.match(version, /^Gradle 9\.8\.2$/mu);
  const root = mkdtempSync(join(tmpdir(), "slopsentral-fingerprints-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const fixture = new URL("../promptfoo/fixtures/classpath-probe.gradle", import.meta.url);
  const run = (phase, flags) => {
    const project = join(root, phase);
    mkdirSync(project);
    writeFileSync(join(project, "settings.gradle"), "rootProject.name = 'probe'\n");
    copyFileSync(fixture, join(project, "build.gradle"));
    const log = execFileSync(process.env.GRADLE_BIN, [
      "--offline", "--no-daemon", "--console=plain", "--gradle-user-home", join(root, "home"),
      "--project-dir", project, ...flags, "probes",
    ], { encoding: "utf8", timeout: 120_000 });
    return new Set(log.split(/\r?\n/u));
  };
  const seeded = run("seed", ["--build-cache"]);
  const consumer = run("consumer", ["--build-cache", "-Pedited"]);
  const fresh = run("fresh", ["--no-build-cache", "-Pedited"]);
  const bytes = (phase, row) => readFileSync(join(root, phase, "build", "results", row));
  const items = cases.filter((item) => item.id.startsWith("gradle-fingerprint-"));
  assert.deepEqual(items.map((item) => item.id.slice("gradle-fingerprint-".length)).sort(), Object.keys(questions).sort());
  for (const item of items) {
    const name = item.id.slice("gradle-fingerprint-".length);
    const selected = [];
    for (const letter of Object.keys(item.choices)) {
      const row = name + letter;
      const task = "> Task :" + row;
      assert.ok(seeded.has(task) && fresh.has(task), row + ": seed and fresh must execute");
      const restored = consumer.has(task + " FROM-CACHE");
      assert.notEqual(restored, consumer.has(task), row + ": unknown consumer outcome");
      const original = bytes("seed", row);
      const expected = bytes("fresh", row);
      assert.deepEqual(bytes("consumer", row), restored ? original : expected, row);
      const stale = restored && !expected.equals(original);
      const wasted = !restored && expected.equals(original);
      if ((questions[name] !== "waste" && stale) || (questions[name] !== "stale" && wasted)) selected.push(letter);
    }
    assert.deepEqual(selected, item.expected, item.id);
  }
});
