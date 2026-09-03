#!/usr/bin/env node
// Fails when any tracked text file contains letters outside the Latin script,
// or an em dash (this repository writes a plain "-").
// The marketplace, its plugins and its docs are English-only; this is the
// mechanical half of that rule.
//
//   node scripts/check-english.mjs [path ...] [--json]
//
// Files are taken from `git ls-files` (so .gitignore applies) and filtered by
// extension. `.englishcheckignore` at the repository root lists exceptions:
// an exact path, a directory prefix ending in "/", or a "*.ext" suffix.
// A single line is exempted with the marker "english-check: ignore" on it.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { main, repoRoot, run } from "./lib.mjs";

const TEXT_EXTENSIONS = new Set([".md", ".json", ".yml", ".yaml", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".jsx", ".astro", ".css", ".html", ".sh", ".txt", ".toml", ".xml", ".svg", ".py"]);
const TEXT_BASENAMES = new Set(["LICENSE", "CLAUDE.md", ".englishcheckignore"]);
const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u;
const LINE_MARKER = "english-check: ignore";
const EM_DASH = "\u2014";

export function findNonEnglish(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    if (line.includes(LINE_MARKER)) return;
    const m = NON_LATIN_LETTER.exec(line);
    const dash = line.indexOf(EM_DASH);
    if (!m && dash === -1) return;
    const col = m ? m.index : dash;
    const from = Math.max(0, col - 20);
    hits.push({ line: i + 1, col: col + 1, kind: m ? "non-Latin text" : "em dash", excerpt: line.slice(from, col + 40).trim() });
  });
  return hits;
}

export function loadIgnoreRules(root) {
  const file = path.join(root, ".englishcheckignore");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function isIgnored(rel, rules) {
  return rules.some((rule) => {
    if (rule.endsWith("/")) return rel.startsWith(rule);
    if (rule.startsWith("*.")) return rel.endsWith(rule.slice(1));
    return rel === rule;
  });
}

function isTextFile(rel) {
  return TEXT_EXTENSIONS.has(path.extname(rel)) || TEXT_BASENAMES.has(path.basename(rel));
}

export function checkRepository(root, only = []) {
  const rules = loadIgnoreRules(root);
  const listed = run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...only], { cwd: root, quiet: true });
  const files = (listed ?? "").split("\0").filter(Boolean).filter(isTextFile).filter((f) => !isIgnored(f, rules));
  const findings = [];
  for (const rel of files) {
    const text = readFileSync(path.join(root, rel), "utf8");
    for (const hit of findNonEnglish(text)) findings.push({ file: rel, ...hit });
  }
  return { checked: files.length, findings };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  main(() => {
    const argv = process.argv.slice(2);
    const json = argv.includes("--json");
    const only = argv.filter((a) => !a.startsWith("--"));
    const root = repoRoot();
    const { checked, findings } = checkRepository(root, only);
    if (json) {
      console.log(JSON.stringify({ checked, findings }, null, 2));
    } else {
      for (const f of findings) console.log(`${f.file}:${f.line}:${f.col}: ${f.kind}: "${f.excerpt}"`);
      console.log(findings.length ? `\n${findings.length} finding(s) in ${checked} file(s). Everything in this repository is written in English with plain dashes; translate the text, replace the em dash, or list a deliberate exception in .englishcheckignore.` : `English-only check passed (${checked} files).`);
    }
    if (findings.length) process.exit(1);
  });
}
