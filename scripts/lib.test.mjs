import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpVersion, compareSemver, rotateChangelog, prependUnreleased, parseArgs, ScriptError } from "./lib.mjs";
import { findNonEnglish, isIgnored } from "./check-english.mjs";

test("bumpVersion handles the three kinds and explicit versions", () => {
  assert.equal(bumpVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(bumpVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(bumpVersion("1.2.3", "major"), "2.0.0");
  assert.equal(bumpVersion("1.2.3", "1.2.10"), "1.2.10");
  assert.throws(() => bumpVersion("1.2.3", "1.2.3"), ScriptError);
  assert.throws(() => bumpVersion("1.2.3", "v2"), ScriptError);
  assert.throws(() => bumpVersion("1.2", "patch"), ScriptError);
});

test("compareSemver orders numerically, not lexically", () => {
  assert.ok(compareSemver("1.10.0", "1.9.0") > 0);
  assert.ok(compareSemver("0.1.0", "0.1.1") < 0);
  assert.equal(compareSemver("2.0.0", "2.0.0"), 0);
});

const CHANGELOG = `# Changelog

## Unreleased

### Added

- A thing.

## 0.1.0 - 2026-01-01

### Added

- First.
`;

test("rotateChangelog moves Unreleased under the new version and keeps history", () => {
  const { text, notes } = rotateChangelog(CHANGELOG, "0.2.0", "2026-09-02");
  assert.equal(notes, "### Added\n\n- A thing.");
  assert.match(text, /## Unreleased\n\n## 0\.2\.0 - 2026-09-02\n\n### Added\n\n- A thing\.\n\n## 0\.1\.0 - 2026-01-01/);
  assert.ok(text.endsWith("- First.\n"));
});

test("rotateChangelog reports an empty Unreleased section", () => {
  const { notes } = rotateChangelog("# Changelog\n\n## Unreleased\n\n## 0.1.0 - 2026-01-01\n", "0.1.1", "2026-09-02");
  assert.equal(notes, "");
});

test("rotateChangelog creates a changelog when none exists", () => {
  const { text } = rotateChangelog(null, "0.1.0", "2026-09-02");
  assert.match(text, /## Unreleased\n\n## 0\.1\.0 - 2026-09-02\n$/);
});

test("rotateChangelog rejects a file without an Unreleased section", () => {
  assert.throws(() => rotateChangelog("# Changelog\n\n## 0.1.0\n", "0.2.0", "2026-09-02"), ScriptError);
});

test("prependUnreleased inserts a note at the top of Unreleased", () => {
  const text = prependUnreleased(CHANGELOG, "- Rolled back to 0.1.0.");
  assert.match(text, /## Unreleased\n\n- Rolled back to 0\.1\.0\.\n\n### Added/);
});

test("parseArgs separates positionals, flags and options", () => {
  const args = parseArgs(["example", "patch", "--push", "--to", "1.0.0", "--reason=why"], { flags: ["push"], options: ["to", "reason"] });
  assert.deepEqual(args._, ["example", "patch"]);
  assert.equal(args.push, true);
  assert.equal(args.to, "1.0.0");
  assert.equal(args.reason, "why");
  assert.throws(() => parseArgs(["--nope"], {}), ScriptError);
  assert.throws(() => parseArgs(["--to"], { options: ["to"] }), ScriptError);
});

test("findNonEnglish flags non-Latin letters and honours the line marker", () => {
  const hits = findNonEnglish("ok\nnot ok: \"\u043f\u0435\u0440\u0435\u0432\u0456\u0440\"\nskip: \"\u043f\u0435\u0440\u0435\u0432\u0456\u0440\" english-check: ignore\nna\u00efve caf\u00e9 is fine\n\u6f22\u5b57\n");
  assert.deepEqual(hits.map((h) => h.line), [2, 5]);
  assert.equal(hits[0].col, 10);
  assert.match(hits[0].excerpt, /\u043f\u0435\u0440\u0435\u0432\u0456\u0440/);
});

test("findNonEnglish flags an em dash", () => {
  const hits = findNonEnglish("plain - dash\nlong \u2014 dash\n");
  assert.deepEqual(hits.map((h) => [h.line, h.kind]), [[2, "em dash"]]);
});

test("isIgnored supports exact paths, directory prefixes and extensions", () => {
  const rules = ["LICENSE", "docs/temp/", "*.svg"];
  assert.ok(isIgnored("LICENSE", rules));
  assert.ok(isIgnored("docs/temp/notes.md", rules));
  assert.ok(isIgnored("site/public/logo.svg", rules));
  assert.ok(!isIgnored("docs/specs/site.md", rules));
});

import { findForbidden, skillName } from "./check-portable.mjs";

test("findForbidden flags origin-project tokens but allows the marketplace name", () => {
  const hits = findForbidden("see mcmaxwell/devdigest-plugins\nthe DevDigest server\nreviewer-core/src\n/Users/x/y\nfine line\n");
  assert.deepEqual(hits.map((h) => [h.line, h.token]), [[2, "devdigest"], [3, "reviewer-core"], [4, "/users/"]]);
});

test("skillName reads the frontmatter name", () => {
  assert.equal(skillName("---\nname: my-skill\ndescription: x\n---\nbody"), "my-skill");
  assert.equal(skillName("no frontmatter"), null);
});
