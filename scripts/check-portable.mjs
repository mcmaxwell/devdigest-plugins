#!/usr/bin/env node
// Fails when a plugin still refers to the project the agents and skills were
// ported from, or when two plugins ship a skill with the same name.
// Plugins are installed into projects that have none of the origin's folders,
// packages or paths, so any such mention is a bug.
//
//   node scripts/check-portable.mjs [plugins/<name> ...] [--json]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { main, repoRoot, run } from "./lib.mjs";

// Tokens that name the origin project, its packages, its scripts or a machine.
// Matched case-insensitively after ALLOWED substrings are removed from the line.
export const FORBIDDEN = ["devdigest", "dev-digest", "reviewer-core", "repo-intel", "emdash", "/users/", "vendor/shared", "pr-gate", "pr-self-review", "acme/payments-api"];
// The marketplace's own name and URLs are not a reference to the origin project.
export const ALLOWED = ["devdigest-plugins"];

export function findForbidden(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    let probe = line.toLowerCase();
    for (const ok of ALLOWED) probe = probe.split(ok).join(" ");
    for (const token of FORBIDDEN) {
      const col = probe.indexOf(token);
      if (col !== -1) hits.push({ line: i + 1, col: col + 1, token, excerpt: line.slice(Math.max(0, col - 20), col + 40).trim() });
    }
  });
  return hits;
}

export function skillName(skillMd) {
  const m = /^---\n([\s\S]*?)\n---/.exec(skillMd);
  const fm = m ? m[1] : "";
  const name = /^name:\s*(.+)$/m.exec(fm);
  return name ? name[1].trim() : null;
}

export function checkPlugins(root, only = []) {
  const pluginsDir = path.join(root, "plugins");
  const targets = only.length ? only.map((p) => path.resolve(root, p)) : readdirSync(pluginsDir).map((d) => path.join(pluginsDir, d)).filter((d) => statSync(d).isDirectory());
  const listed = run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...targets], { cwd: root, quiet: true }) ?? "";
  const files = listed.split("\0").filter(Boolean);
  const findings = [];
  const skills = new Map();
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf8");
    for (const hit of findForbidden(text)) findings.push({ kind: "origin-reference", file: rel, ...hit });
    if (path.basename(rel) === "SKILL.md") {
      const name = skillName(text);
      if (!name) findings.push({ kind: "skill-without-name", file: rel, line: 1, col: 1, excerpt: "" });
      else if (skills.has(name)) findings.push({ kind: "duplicate-skill", file: rel, line: 1, col: 1, token: name, excerpt: `also in ${skills.get(name)}` });
      else skills.set(name, rel);
    }
  }
  return { checked: files.length, findings };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  main(() => {
    const argv = process.argv.slice(2);
    const json = argv.includes("--json");
    const only = argv.filter((a) => !a.startsWith("--"));
    const { checked, findings } = checkPlugins(repoRoot(), only);
    if (json) console.log(JSON.stringify({ checked, findings }, null, 2));
    else {
      for (const f of findings) console.log(`${f.file}:${f.line}:${f.col}: ${f.kind}${f.token ? ` "${f.token}"` : ""}${f.excerpt ? `: ${f.excerpt}` : ""}`);
      console.log(findings.length ? `\n${findings.length} finding(s) in ${checked} file(s). Plugins must not name the project they were ported from, and a skill name may appear in one plugin only.` : `Portability check passed (${checked} files).`);
    }
    if (findings.length) process.exit(1);
  });
}
