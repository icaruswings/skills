import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPluginFiles } from "./plugin-checks.mjs";

const description = "Workflow skills for coding agents.";

const validSet = () => ({
  claudePlugin: { name: "icaruswings", version: "0.1.0", description },
  codexPlugin: { name: "icaruswings", version: "0.1.0", description, skills: "./skills/" },
  claudeMarketplace: {
    name: "icaruswings",
    plugins: [{ name: "icaruswings", source: "./" }],
  },
  codexMarketplace: {
    name: "icaruswings",
    plugins: [{ name: "icaruswings", source: { source: "local", path: "./" } }],
  },
});

test("passes a matching set", () => {
  assert.deepEqual(checkPluginFiles(validSet()), []);
});

test("fails when a file is missing", () => {
  const files = validSet();
  files.codexPlugin = null;
  const errors = checkPluginFiles(files);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\.codex-plugin\/plugin\.json/);
});

test("fails when names differ", () => {
  const files = validSet();
  files.codexPlugin.name = "other";
  const errors = checkPluginFiles(files);
  assert.ok(errors.some((e) => /name/.test(e) && e.includes("icaruswings") && e.includes("other")), errors.join("\n"));
});

test("fails when versions differ", () => {
  const files = validSet();
  files.codexPlugin.version = "0.2.0";
  const errors = checkPluginFiles(files);
  assert.ok(errors.some((e) => /version/.test(e) && e.includes("0.1.0") && e.includes("0.2.0")), errors.join("\n"));
});

test("fails when descriptions differ", () => {
  const files = validSet();
  files.claudePlugin.description = "Something else.";
  const errors = checkPluginFiles(files);
  assert.ok(errors.some((e) => /description/.test(e)), errors.join("\n"));
});

test("fails when version is not semver", () => {
  const files = validSet();
  files.claudePlugin.version = "1.0";
  files.codexPlugin.version = "1.0";
  const errors = checkPluginFiles(files);
  assert.ok(errors.some((e) => /semver/.test(e) && e.includes("1.0")), errors.join("\n"));
});

test('fails when the Claude marketplace does not list icaruswings with source "./"', () => {
  const files = validSet();
  files.claudeMarketplace.plugins[0].source = "./plugins/icaruswings";
  const errors = checkPluginFiles(files);
  assert.ok(errors.some((e) => e.includes(".claude-plugin/marketplace.json")), errors.join("\n"));
});

test('fails when the Codex marketplace does not list icaruswings with source.path "./"', () => {
  const files = validSet();
  files.codexMarketplace.plugins = [];
  const errors = checkPluginFiles(files);
  assert.ok(errors.some((e) => e.includes(".agents/plugins/marketplace.json")), errors.join("\n"));
});

// --- version bump ---

import { checkVersionBump, gatherVersionInputs } from "./plugin-checks.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("passes when nothing under skills/ changed", () => {
  assert.deepEqual(
    checkVersionBump({ changedFiles: ["README.md", "scripts/x.mjs"], baseVersion: "0.1.0", headVersion: "0.1.0" }),
    [],
  );
});

test("passes when skills/ changed and version went up", () => {
  assert.deepEqual(
    checkVersionBump({ changedFiles: ["skills/a/SKILL.md"], baseVersion: "0.1.0", headVersion: "0.2.0" }),
    [],
  );
});

test("fails when skills/ changed and version did not", () => {
  const errors = checkVersionBump({ changedFiles: ["skills/a/SKILL.md"], baseVersion: "0.1.0", headVersion: "0.1.0" });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /bump/);
  assert.match(errors[0], /plugin\.json/);
});

test("fails when the version went down", () => {
  const errors = checkVersionBump({ changedFiles: ["README.md"], baseVersion: "0.2.0", headVersion: "0.1.0" });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /0\.2\.0/);
});

test("compares versions numerically, not as text", () => {
  assert.deepEqual(
    checkVersionBump({ changedFiles: ["skills/a/SKILL.md"], baseVersion: "0.9.0", headVersion: "0.10.0" }),
    [],
  );
});

test("passes when the base has no manifest", () => {
  assert.deepEqual(
    checkVersionBump({ changedFiles: ["skills/a/SKILL.md"], baseVersion: null, headVersion: "0.1.0" }),
    [],
  );
});

test("gatherVersionInputs returns skipped with a reason when baseRef does not exist", () => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-checks-"));
  try {
    const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init");
    const result = gatherVersionInputs(dir, "origin/nope");
    assert.match(result.skipped ?? "", /origin\/nope/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gatherVersionInputs lists committed and uncommitted changes since the base", () => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-checks-"));
  try {
    const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    execFileSync("mkdir", ["-p", ".claude-plugin", "skills/a"], { cwd: dir });
    execFileSync("sh", ["-c", `echo '{"version":"0.1.0"}' > .claude-plugin/plugin.json`], { cwd: dir });
    git("add", ".");
    git("commit", "-q", "-m", "base");
    git("tag", "base");
    execFileSync("sh", ["-c", "echo x > skills/a/SKILL.md && git add skills/a/SKILL.md"], { cwd: dir });
    const result = gatherVersionInputs(dir, "base");
    assert.equal(result.baseVersion, "0.1.0");
    assert.ok(result.changedFiles.includes("skills/a/SKILL.md"), JSON.stringify(result));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gatherVersionInputs counts new untracked files under skills/", () => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-checks-"));
  try {
    const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("commit", "-q", "--allow-empty", "-m", "base");
    git("tag", "base");
    execFileSync("sh", ["-c", "mkdir -p skills/new && echo x > skills/new/SKILL.md"], { cwd: dir });
    const result = gatherVersionInputs(dir, "base");
    assert.equal(result.baseVersion, null);
    assert.ok(result.changedFiles.includes("skills/new/SKILL.md"), JSON.stringify(result));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gatherVersionInputs skips with a reason when there is no merge base", () => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-checks-"));
  try {
    const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("commit", "-q", "--allow-empty", "-m", "main line");
    git("tag", "mainline");
    git("checkout", "-q", "--orphan", "unrelated");
    git("commit", "-q", "--allow-empty", "-m", "unrelated root");
    git("tag", "other");
    git("checkout", "-q", "mainline");
    const result = gatherVersionInputs(dir, "other");
    assert.match(result.skipped ?? "", /merge base/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
