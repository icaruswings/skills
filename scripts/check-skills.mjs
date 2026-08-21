#!/usr/bin/env node
// Checks the wiring rules in AGENTS.md. Exits 1 on any failure.
//
// For every skill dir (a dir holding a SKILL.md) under skills/:
//   - SKILL.md has frontmatter with a name matching the directory, plus a description
//   - agents/openai.yaml exists, has a display_name, and its allow_implicit_invocation
//     agrees with SKILL.md's disable-model-invocation
//   - the top-level README.md links to the SKILL.md

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];
const fail = (msg) => errors.push(msg);

const read = (p) => readFileSync(join(repo, p), "utf8");
const dirs = (p) =>
  existsSync(join(repo, p))
    ? readdirSync(join(repo, p)).filter((n) => statSync(join(repo, p, n)).isDirectory())
    : [];

const frontmatter = (source) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return fields;
};

const readme = read("README.md");
let count = 0;

for (const name of dirs("skills")) {
  const skillPath = `skills/${name}/SKILL.md`;
  if (!existsSync(join(repo, skillPath))) continue; // not a skill dir
  count++;

  const fm = frontmatter(read(skillPath));
  if (!fm) {
    fail(`${skillPath}: no YAML frontmatter`);
    continue;
  }
  if (fm.name !== name) fail(`${skillPath}: frontmatter name "${fm.name}" != directory "${name}"`);
  if (!fm.description) fail(`${skillPath}: frontmatter has no description`);

  const userInvoked = fm["disable-model-invocation"] === "true";
  const yamlPath = `skills/${name}/agents/openai.yaml`;
  if (!existsSync(join(repo, yamlPath))) {
    fail(`${yamlPath} is missing`);
  } else {
    // Drop comment lines, so a commented-out policy block reads as absent.
    const yaml = read(yamlPath)
      .split(/\r?\n/)
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    const blocksImplicit = /allow_implicit_invocation:\s*false/.test(yaml);
    if (userInvoked && !blocksImplicit)
      fail(`${yamlPath}: skill is user-invoked, so it needs policy.allow_implicit_invocation: false`);
    if (!userInvoked && blocksImplicit)
      fail(`${yamlPath}: sets allow_implicit_invocation: false, but ${skillPath} has no disable-model-invocation: true`);
    if (!/display_name:/.test(yaml)) fail(`${yamlPath}: no interface.display_name`);
  }

  if (!readme.includes(`${skillPath}`)) fail(`README.md: no link to ${skillPath}`);
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} problem(s) in ${count} skill(s).`);
  process.exit(1);
}

console.log(`✓ ${count} skill(s) wired correctly.`);
