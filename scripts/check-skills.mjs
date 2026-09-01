#!/usr/bin/env node
// Checks the wiring rules in AGENTS.md. Exits 1 on any failure.
//
// For every skill dir (a dir holding a SKILL.md) under skills/:
//   - the dir sits directly under skills/ — no category folders, no nesting
//   - SKILL.md has frontmatter with a name matching the directory, plus a description
//   - agents/openai.yaml exists, has interface.display_name, and its
//     policy.allow_implicit_invocation agrees with SKILL.md's disable-model-invocation
//   - the top-level README.md links to the SKILL.md
//
// Discovery matches link-skills.sh (which finds SKILL.md at any depth), so a
// skill the linker would install can never slip past this checker unvalidated.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];
const fail = (msg) => errors.push(msg);

// A BOM before `---` would otherwise read as "no frontmatter".
const read = (p) => readFileSync(join(repo, p), "utf8").replace(/^﻿/, "");
const isDir = (p) => statSync(join(repo, p)).isDirectory();

const unquote = (raw) => {
  const v = raw.trim();
  if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  // In a plain scalar, whitespace followed by # begins a comment.
  const comment = v.match(/\s+#.*$/);
  return comment ? v.slice(0, comment.index).trim() : v;
};

const isTrue = (v) => /^(true|yes|on)$/i.test((v ?? "").trim());

// Minimal YAML reader for the shapes these files actually use: top-level
// scalars, block scalars (| and >), and one level of nested mapping. It is
// indentation-aware, so a key inside a nested block or inside a block scalar is
// never mistaken for a top-level field, and a block scalar's value is the text
// it holds rather than its `>-` indicator.
const parseYaml = (text) => {
  const lines = text.split(/\r?\n/);
  const fields = {};
  const nested = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const top = line.match(/^([A-Za-z0-9_.-]+):[ \t]*(.*)$/);
    if (!top) continue; // indented line — its parent consumes it below

    const key = top[1];
    const rest = top[2].trim();

    if (/^[|>][+-]?\d*$/.test(rest)) {
      const block = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.trim() && !/^[ \t]/.test(next)) break;
        block.push(next.trim());
        i++;
      }
      fields[key] = block.join(" ").trim();
      continue;
    }

    if (rest === "") {
      const children = {};
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.trim() && !/^[ \t]/.test(next)) break;
        const kv = next.match(/^[ \t]+([A-Za-z0-9_.-]+):[ \t]*(.*)$/);
        if (kv) children[kv[1]] = unquote(kv[2]);
        i++;
      }
      fields[key] = "";
      nested[key] = children;
      continue;
    }

    fields[key] = unquote(rest);
  }

  return { fields, nested };
};

const frontmatter = (source) => {
  const match = source.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/);
  return match ? parseYaml(match[1]) : null;
};

// Every SKILL.md at any depth, so nesting is caught rather than skipped.
const findSkillMds = (rel) => {
  if (!existsSync(join(repo, rel))) return [];
  const found = [];
  for (const entry of readdirSync(join(repo, rel))) {
    const child = `${rel}/${entry}`;
    if (isDir(child)) found.push(...findSkillMds(child));
    else if (entry === "SKILL.md") found.push(child);
  }
  return found;
};

const readme = read("README.md");
const skillMds = findSkillMds("skills");
const names = [];
const byName = new Map();
let count = 0;

for (const skillPath of skillMds) {
  const parts = skillPath.split("/"); // want exactly skills/<name>/SKILL.md
  if (parts.length !== 3) {
    fail(`${skillPath}: skills live at skills/<name>/SKILL.md — no category folders (AGENTS.md)`);
    continue;
  }

  const name = parts[1];
  if (byName.has(name)) {
    fail(`${skillPath}: duplicate skill name "${name}" (also ${byName.get(name)}) — link-skills.sh would install only one`);
    continue;
  }
  byName.set(name, skillPath);
  names.push(name);
  count++;

  const fm = frontmatter(read(skillPath));
  if (!fm) {
    fail(`${skillPath}: no YAML frontmatter`);
    continue;
  }
  if (fm.fields.name !== name) fail(`${skillPath}: frontmatter name "${fm.fields.name}" != directory "${name}"`);
  if (!fm.fields.description) fail(`${skillPath}: frontmatter has no description`);

  const userInvoked = isTrue(fm.fields["disable-model-invocation"]);
  const yamlPath = `skills/${name}/agents/openai.yaml`;
  if (!existsSync(join(repo, yamlPath))) {
    fail(`${yamlPath} is missing`);
  } else {
    const doc = parseYaml(read(yamlPath));

    // The key only takes effect under policy:. Anywhere else Codex ignores it,
    // so a misplaced key must fail rather than satisfy the pairing check.
    if ("allow_implicit_invocation" in doc.fields)
      fail(`${yamlPath}: allow_implicit_invocation sits at the top level — it must be nested under policy:`);
    for (const [parent, children] of Object.entries(doc.nested)) {
      if (parent !== "policy" && "allow_implicit_invocation" in children)
        fail(`${yamlPath}: allow_implicit_invocation is nested under "${parent}:" — it must sit under policy:`);
    }

    const blocksImplicit = /^false$/i.test((doc.nested.policy?.allow_implicit_invocation ?? "").trim());
    if (userInvoked && !blocksImplicit)
      fail(`${yamlPath}: skill is user-invoked, so it needs policy.allow_implicit_invocation: false`);
    if (!userInvoked && blocksImplicit)
      fail(`${yamlPath}: sets policy.allow_implicit_invocation: false, but ${skillPath} has no disable-model-invocation: true`);
    if (!doc.nested.interface?.display_name) fail(`${yamlPath}: no interface.display_name`);
  }

  if (!readme.includes(`${skillPath}`)) fail(`README.md: no link to ${skillPath}`);
}

// A stray dir under skills/ is either a category folder or an unfinished skill.
// Either way the linker ignores it and a reader is misled, so say so.
for (const entry of existsSync(join(repo, "skills")) ? readdirSync(join(repo, "skills")) : []) {
  if (!isDir(`skills/${entry}`)) continue;
  const hasOwn = existsSync(join(repo, `skills/${entry}/SKILL.md`));
  const hasNested = skillMds.some((p) => p.startsWith(`skills/${entry}/`));
  if (!hasOwn && !hasNested) fail(`skills/${entry}/: no SKILL.md — every dir under skills/ is a skill dir (AGENTS.md)`);
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} problem(s) in ${count} skill(s).`);
  process.exit(1);
}

console.log(`✓ ${count} skill(s) wired correctly.`);
