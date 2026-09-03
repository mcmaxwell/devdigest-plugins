#!/usr/bin/env node
// Roll back a plugin, or the site.
//
// Plugin mode - republish an earlier tag as a new, higher version:
//   node scripts/rollback.mjs <plugin-name> [--to x.y.z] [--reason "..."] [options]
//
//   Claude Code caches plugins by version and only picks up a version it has
//   not seen. Lowering the number would leave every installed copy on the bad
//   release, so the files from the chosen tag are committed as version
//   current+patch. The current CHANGELOG.md is kept and gains a rollback note.
//   Without --to, the tag just below the current version is used.
//
// Site mode - redeploy GitHub Pages from a known-good commit:
//   node scripts/rollback.mjs --site <git-ref> [--dry-run]
//
//   Tags the commit as site-rollback-<timestamp>, pushes the tag and dispatches
//   .github/workflows/deploy-pages.yml on it. main is untouched; the next push
//   to main deploys again, so fix forward after the rollback.
//
// Options:
//   --push          push the commit and the tag (plugin mode)
//   --dry-run       print what would happen, change nothing
//   --allow-dirty   skip the clean working tree check
//   --any-branch    allow rolling back from a branch other than main
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bumpVersion, compareSemver, ensureCleanTree, ensureOnMain, fail, listReleaseTags, loadPlugin, main, parseArgs, prependUnreleased, publishVersion, releaseTag, repoRoot, run, tagExists } from "./lib.mjs";

function rollbackPlugin(root, name, args) {
  ensureOnMain(root, args["any-branch"]);
  ensureCleanTree(root, args["allow-dirty"] || args["dry-run"]);
  const { paths, manifest } = loadPlugin(root, name);
  const current = manifest.version;

  const tags = listReleaseTags(root, name);
  const older = tags.filter((v) => compareSemver(v, current) < 0);
  const target = args.to ?? older.at(-1);
  if (!target) fail(`no release tag of ${name} below ${current}; nothing to roll back to (tags: ${tags.join(", ") || "none"})`);
  if (compareSemver(target, current) >= 0) fail(`--to ${target} is not below the current version ${current}`);
  const tag = releaseTag(name, target);
  if (!tagExists(root, tag)) fail(`tag ${tag} does not exist locally; run "git fetch --tags"`);

  const newVersion = bumpVersion(current, "patch");
  const reason = args.reason ? ` ${args.reason.trim().replace(/\.?$/, ".")}` : "";
  const note = `- Rolled back to ${target}: the files of tag ${tag} replace the ${current} release.${reason}`;
  console.log(`restore ${paths.rel} from ${tag}, publish as ${newVersion}`);

  if (args["dry-run"]) {
    const changed = run("git", ["diff", "--stat", `${tag}`, "HEAD", "--", paths.rel], { cwd: root, quiet: true });
    console.log(`files that differ from ${tag}:\n${changed || "  (none)"}`);
    return publishVersion({ root, name, newVersion, dryRun: true, mutateChangelog: (t) => prependUnreleased(t, note) });
  }

  // Keep today's changelog: the old tag's copy lacks every entry since then.
  const changelogNow = existsSync(paths.changelog) ? readFileSync(paths.changelog, "utf8") : null;
  run("git", ["rm", "-r", "-q", "--", paths.rel], { cwd: root, quiet: true });
  run("git", ["checkout", tag, "--", paths.rel], { cwd: root, quiet: true });
  if (changelogNow !== null) writeFileSync(paths.changelog, changelogNow);
  // The restored plugin.json carries the old version; loadPlugin() inside
  // publishVersion() must see the current one to bump from.
  const restored = JSON.parse(readFileSync(paths.manifest, "utf8"));
  restored.version = current;
  writeFileSync(paths.manifest, `${JSON.stringify(restored, null, 2)}\n`);

  return publishVersion({
    root,
    name,
    newVersion,
    commitMessage: `rollback(${name}): ${newVersion} restores ${target}`,
    tagMessage: `${name} v%s (rollback to ${target})`,
    push: args.push,
    dryRun: false,
    allowEmptyChangelog: false,
    mutateChangelog: (t) => prependUnreleased(t, note),
  });
}

function rollbackSite(root, ref, args) {
  const workflow = path.join(root, ".github", "workflows", "deploy-pages.yml");
  if (!existsSync(workflow)) fail("no .github/workflows/deploy-pages.yml in this repository");
  run("git", ["fetch", "--quiet", "origin"], { cwd: root, quiet: true });
  const sha = run("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root, quiet: true, allowFailure: true });
  if (!sha) fail(`"${ref}" is not a commit`);
  const onRemote = run("git", ["branch", "-r", "--contains", sha], { cwd: root, quiet: true, allowFailure: true });
  if (!onRemote) fail(`commit ${sha} is not on any origin branch; push it first`);
  const subject = run("git", ["log", "-1", "--format=%h %s (%cs)", sha], { cwd: root, quiet: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const tag = `site-rollback-${stamp}`;

  console.log(`redeploy site from ${subject}\ntag: ${tag}`);
  if (args["dry-run"]) {
    console.log("--dry-run: nothing tagged or dispatched");
    return;
  }
  run("git", ["tag", "-a", tag, sha, "-m", `Site rollback to ${sha}`], { cwd: root, quiet: true });
  run("git", ["push", "origin", tag], { cwd: root, quiet: true });
  console.log(`> gh workflow run deploy-pages.yml --ref ${tag}`);
  run("gh", ["workflow", "run", "deploy-pages.yml", "--ref", tag], { cwd: root });
  console.log(`dispatched. Watch it with:\n  gh run list --workflow deploy-pages.yml --limit 1\nThe next push to main deploys main again.`);
}

main(() => {
  const args = parseArgs(process.argv.slice(2), {
    flags: ["push", "dry-run", "allow-dirty", "any-branch"],
    options: ["to", "reason", "site"],
  });
  const root = repoRoot();
  if (args.site) {
    if (args._.length) fail("--site takes no plugin name");
    return rollbackSite(root, args.site, args);
  }
  const [name] = args._;
  if (!name) fail("usage: rollback.mjs <plugin-name> [--to x.y.z] [--reason text] [--push] [--dry-run]\n       rollback.mjs --site <git-ref> [--dry-run]");
  return rollbackPlugin(root, name, args);
});
