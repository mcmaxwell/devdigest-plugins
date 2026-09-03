// Shared helpers for the maintenance scripts. No dependencies beyond Node 22.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export class ScriptError extends Error {}

export function fail(message) {
  throw new ScriptError(message);
}

export function run(cmd, args, { cwd, quiet = false, allowFailure = false } = {}) {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      stdio: quiet ? ["ignore", "pipe", "pipe"] : ["inherit", "pipe", "inherit"],
    });
    return out.trimEnd();
  } catch (err) {
    if (allowFailure) return null;
    const stderr = err.stderr ? String(err.stderr).trim() : "";
    fail(`${cmd} ${args.join(" ")} failed${stderr ? `:\n${stderr}` : ""}`);
  }
}

export function repoRoot() {
  const root = run("git", ["rev-parse", "--show-toplevel"], { quiet: true, allowFailure: true });
  if (!root) fail("not inside a git repository");
  return root;
}

export function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`cannot read ${file}: ${err.message}`);
  }
}

export function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

// ---- semver -------------------------------------------------------------

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(version) {
  const m = SEMVER.exec(version ?? "");
  if (!m) fail(`"${version}" is not a plain semantic version (x.y.z)`);
  return m.slice(1, 4).map(Number);
}

export function compareSemver(a, b) {
  const [pa, pb] = [parseSemver(a), parseSemver(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function bumpVersion(current, kind) {
  const [major, minor, patch] = parseSemver(current);
  switch (kind) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default: {
      parseSemver(kind);
      if (compareSemver(kind, current) <= 0) fail(`explicit version ${kind} must be greater than current ${current}`);
      return kind;
    }
  }
}

// ---- changelog ------------------------------------------------------------

const CHANGELOG_HEADER = `# Changelog

All notable changes to this plugin are recorded here.
The format follows Keep a Changelog; versions follow semantic versioning.

## Unreleased
`;

// Moves the body of "## Unreleased" under a new "## <version> - <date>" heading
// and leaves an empty Unreleased section on top. Returns the new text and the
// released notes, so the caller can decide whether an empty body is acceptable.
export function rotateChangelog(text, version, date) {
  const source = text ?? CHANGELOG_HEADER;
  const lines = source.split("\n");
  const start = lines.findIndex((l) => /^## unreleased\s*$/i.test(l));
  if (start === -1) fail('CHANGELOG.md has no "## Unreleased" section');
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n").trim();
  const released = [`## ${version} - ${date}`, "", ...(body ? [body, ""] : [])];
  const next = [...lines.slice(0, start + 1), "", ...released, ...lines.slice(end)];
  return { text: `${next.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`, notes: body };
}

export function prependUnreleased(text, line) {
  const source = text ?? CHANGELOG_HEADER;
  const lines = source.split("\n");
  const start = lines.findIndex((l) => /^## unreleased\s*$/i.test(l));
  if (start === -1) fail('CHANGELOG.md has no "## Unreleased" section');
  lines.splice(start + 1, 0, "", line);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---- marketplace ----------------------------------------------------------

export function marketplacePath(root) {
  return path.join(root, ".claude-plugin", "marketplace.json");
}

export function pluginPaths(root, name) {
  const dir = path.join(root, "plugins", name);
  return {
    dir,
    rel: path.posix.join("plugins", name),
    manifest: path.join(dir, ".claude-plugin", "plugin.json"),
    changelog: path.join(dir, "CHANGELOG.md"),
  };
}

// Loads the plugin manifest and its marketplace entry and checks the two agree.
export function loadPlugin(root, name) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(`plugin name "${name}" is not kebab-case`);
  const paths = pluginPaths(root, name);
  if (!existsSync(paths.manifest)) fail(`no plugin at ${paths.rel} (missing .claude-plugin/plugin.json)`);
  const manifest = readJson(paths.manifest);
  const marketplace = readJson(marketplacePath(root));
  const entry = (marketplace.plugins ?? []).find((p) => p.name === name);
  if (!entry) fail(`plugin "${name}" has no entry in .claude-plugin/marketplace.json`);
  if (manifest.name !== name) fail(`plugin.json name "${manifest.name}" does not match folder "${name}"`);
  if (typeof entry.source !== "string" || entry.source !== `./${paths.rel}`) {
    fail(`marketplace entry source must be "./${paths.rel}", found ${JSON.stringify(entry.source)}`);
  }
  if (!manifest.version) fail(`plugin.json for "${name}" has no version`);
  if (entry.version !== manifest.version) {
    fail(`version mismatch: plugin.json ${manifest.version} vs marketplace entry ${entry.version ?? "(none)"}. Align them by hand before releasing.`);
  }
  return { paths, manifest, marketplace, entry };
}

export function releaseTag(name, version) {
  return `${name}--v${version}`;
}

export function listReleaseTags(root, name) {
  const out = run("git", ["tag", "--list", `${name}--v*`], { cwd: root, quiet: true }) ?? "";
  const prefix = `${name}--v`;
  return out
    .split("\n")
    .filter(Boolean)
    .map((t) => t.slice(prefix.length))
    .filter((v) => SEMVER.test(v))
    .sort(compareSemver);
}

export function tagExists(root, tag) {
  return run("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], { cwd: root, quiet: true, allowFailure: true }) !== null;
}

// ---- git state ------------------------------------------------------------

export function ensureCleanTree(root, allowDirty) {
  const status = run("git", ["status", "--porcelain"], { cwd: root, quiet: true });
  if (status && !allowDirty) {
    fail(`working tree is not clean; commit or discard first (or pass --allow-dirty):\n${status}`);
  }
}

export function currentBranch(root) {
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, quiet: true });
}

export function ensureOnMain(root, anyBranch) {
  const branch = currentBranch(root);
  if (branch !== "main" && !anyBranch) {
    fail(`releases are cut from main, you are on "${branch}" (pass --any-branch to override)`);
  }
}

// ---- validation -----------------------------------------------------------

export function runChecks(root) {
  console.log("> claude plugin validate . --strict");
  run("claude", ["plugin", "validate", ".", "--strict"], { cwd: root });
  console.log("> node scripts/check-english.mjs");
  run(process.execPath, [path.join(root, "scripts", "check-english.mjs")], { cwd: root });
}

// ---- shared release tail --------------------------------------------------

// Writes the new version everywhere, rotates the changelog, validates, commits
// and tags. Used by release.mjs and rollback.mjs so both produce identical
// history. `mutate` lets the caller edit the changelog before rotation.
export function publishVersion({ root, name, newVersion, commitMessage, tagMessage, push, dryRun, allowEmptyChangelog, bumpMarketplace = true, extraFiles = [], mutateChangelog }) {
  const { paths, manifest, marketplace, entry } = loadPlugin(root, name);
  const tag = releaseTag(name, newVersion);
  if (tagExists(root, tag)) fail(`tag ${tag} already exists`);

  const changelogText = existsSync(paths.changelog) ? readFileSync(paths.changelog, "utf8") : null;
  const mutated = mutateChangelog ? mutateChangelog(changelogText) : changelogText;
  const { text: rotated, notes } = rotateChangelog(mutated, newVersion, today());
  if (!notes && !allowEmptyChangelog) {
    fail(`${paths.rel}/CHANGELOG.md has nothing under "## Unreleased". Describe the change, or pass --allow-empty-changelog.`);
  }

  const marketplaceVersion = bumpMarketplace && marketplace.version ? bumpVersion(marketplace.version, "patch") : marketplace.version;

  console.log(`\n${name}: ${manifest.version} -> ${newVersion}`);
  if (bumpMarketplace && marketplace.version) console.log(`marketplace: ${marketplace.version} -> ${marketplaceVersion}`);
  console.log(`tag: ${tag}`);
  console.log(`changelog notes:\n${notes ? notes.replace(/^/gm, "  ") : "  (none)"}`);
  if (dryRun) {
    console.log("\n--dry-run: nothing written");
    return { newVersion, tag, dryRun: true };
  }

  manifest.version = newVersion;
  entry.version = newVersion;
  if (bumpMarketplace && marketplace.version) marketplace.version = marketplaceVersion;
  writeJson(paths.manifest, manifest);
  writeJson(marketplacePath(root), marketplace);
  writeFileSync(paths.changelog, rotated);

  runChecks(root);

  const files = [paths.manifest, marketplacePath(root), paths.changelog, ...extraFiles];
  run("git", ["add", "-A", "--", paths.dir, marketplacePath(root), ...files], { cwd: root, quiet: true });
  run("git", ["commit", "-q", "-m", commitMessage], { cwd: root, quiet: true });
  console.log(`> git commit: ${commitMessage}`);

  const tagArgs = ["plugin", "tag", paths.rel, "-m", tagMessage];
  if (push) tagArgs.push("--push");
  console.log(`> claude ${tagArgs.join(" ")}`);
  run("claude", tagArgs, { cwd: root });

  if (push) {
    console.log("> git push origin HEAD");
    run("git", ["push", "origin", "HEAD"], { cwd: root, quiet: true });
  } else {
    console.log(`\nNot pushed. When ready:\n  git push origin HEAD && git push origin ${tag}`);
  }
  return { newVersion, tag, dryRun: false };
}

// ---- argv -----------------------------------------------------------------

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      result._.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split("=", 2);
    if (flags.includes(key)) {
      result[key] = true;
    } else if (options.includes(key)) {
      const value = inline ?? argv[++i];
      if (value === undefined) fail(`--${key} needs a value`);
      result[key] = value;
    } else {
      fail(`unknown option --${key}`);
    }
  }
  return result;
}

export function main(fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      if (err instanceof ScriptError) {
        console.error(`error: ${err.message}`);
        process.exit(1);
      }
      throw err;
    });
}
