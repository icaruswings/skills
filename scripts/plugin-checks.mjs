// Checks for the plugin manifests and marketplace files. check-skills.mjs
// calls these; plugin-checks.test.mjs covers them. Node built-ins only.
//
// The repo root is the plugin root for both Claude Code and Codex, so both
// manifests must describe the same plugin, and both marketplaces must list it
// with the root ("./") as its source.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PLUGIN_NAME = "icaruswings";

export const PATHS = {
  claudePlugin: ".claude-plugin/plugin.json",
  codexPlugin: ".codex-plugin/plugin.json",
  claudeMarketplace: ".claude-plugin/marketplace.json",
  codexMarketplace: ".agents/plugins/marketplace.json",
};

const SEMVER = /^\d+\.\d+\.\d+$/;

export const loadPluginFiles = (repoRoot) => {
  const files = {};
  for (const [key, rel] of Object.entries(PATHS)) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) {
      files[key] = null;
      continue;
    }
    try {
      files[key] = JSON.parse(readFileSync(abs, "utf8"));
    } catch (err) {
      throw new Error(`${rel}: invalid JSON (${err.message})`);
    }
  }
  return files;
};

const listsRootPlugin = (marketplace, sourcePath) =>
  Array.isArray(marketplace?.plugins) &&
  marketplace.plugins.some((p) => p?.name === PLUGIN_NAME && sourcePath(p) === "./");

export const checkPluginFiles = (files) => {
  const errors = [];

  for (const [key, rel] of Object.entries(PATHS)) {
    if (!files[key]) errors.push(`${rel} is missing`);
  }
  if (errors.length) return errors;

  const { claudePlugin: claude, codexPlugin: codex } = files;

  for (const field of ["name", "version", "description"]) {
    if (claude[field] !== codex[field]) {
      errors.push(
        `${field} differs: ${PATHS.claudePlugin} has "${claude[field]}", ${PATHS.codexPlugin} has "${codex[field]}" — keep both manifests identical`,
      );
    }
  }

  if (claude.name !== PLUGIN_NAME) errors.push(`${PATHS.claudePlugin}: name must be "${PLUGIN_NAME}", not "${claude.name}"`);

  for (const key of ["claudePlugin", "codexPlugin"]) {
    const version = files[key].version;
    if (!SEMVER.test(version ?? "")) errors.push(`${PATHS[key]}: version "${version}" is not semver (MAJOR.MINOR.PATCH)`);
  }

  if (!listsRootPlugin(files.claudeMarketplace, (p) => p.source)) {
    errors.push(`${PATHS.claudeMarketplace}: must list plugin "${PLUGIN_NAME}" with source "./"`);
  }
  if (!listsRootPlugin(files.codexMarketplace, (p) => p.source?.path)) {
    errors.push(`${PATHS.codexMarketplace}: must list plugin "${PLUGIN_NAME}" with source.path "./"`);
  }

  return errors;
};

// --- version bump ---
//
// Every change under skills/ ships a new plugin version, so installed copies
// update. The base is the branch the change merges into.


const parseSemver = (v) => v.split(".").map(Number);

const compareSemver = (a, b) => {
  const [pa, pb] = [parseSemver(a), parseSemver(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

export const checkVersionBump = ({ changedFiles, baseVersion, headVersion }) => {
  if (baseVersion === null) return [];
  const order = compareSemver(headVersion, baseVersion);
  if (order < 0) {
    return [`version went down: base has ${baseVersion}, this change has ${headVersion}`];
  }
  const skillsChanged = changedFiles.some((f) => f.startsWith("skills/"));
  if (skillsChanged && order === 0) {
    return [
      `files under skills/ changed but version is still ${headVersion} — bump "version" in ${PATHS.claudePlugin} and ${PATHS.codexPlugin}`,
    ];
  }
  return [];
};

export const gatherVersionInputs = (repoRoot, baseRef) => {
  const git = (...args) =>
    execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

  try {
    git("rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`);
  } catch {
    return { skipped: `base ref "${baseRef}" not found (set CHECK_BASE_REF, or fetch it)` };
  }

  try {
    git("merge-base", baseRef, "HEAD");
  } catch {
    return { skipped: `no merge base between "${baseRef}" and HEAD (shallow clone? fetch more history)` };
  }

  const lines = (out) => out.split("\n").filter(Boolean);
  const changed = new Set([
    ...lines(git("diff", "--name-only", `${baseRef}...HEAD`)),
    ...lines(git("diff", "--name-only", "HEAD")),
    ...lines(git("ls-files", "--others", "--exclude-standard")),
  ]);

  let baseVersion = null;
  try {
    baseVersion = JSON.parse(git("show", `${baseRef}:${PATHS.claudePlugin}`)).version ?? null;
  } catch {
    baseVersion = null; // the base predates the plugin
  }

  return { changedFiles: [...changed], baseVersion };
};
