#!/usr/bin/env node
// Cut a plugin release: bump plugin.json and the marketplace entry together,
// rotate "## Unreleased" in the plugin changelog, validate, commit, tag.
//
//   node scripts/release.mjs <plugin-name> <patch|minor|major|x.y.z> [options]
//
// Options:
//   --push                   push the commit and the tag to origin
//   --dry-run                print what would change, write nothing
//   --allow-dirty            skip the clean working tree check
//   --any-branch             allow releasing from a branch other than main
//   --allow-empty-changelog  release even if "## Unreleased" has no notes
//   --no-marketplace-bump    leave the top-level marketplace version alone
import { bumpVersion, ensureCleanTree, ensureOnMain, fail, loadPlugin, main, parseArgs, publishVersion, repoRoot } from "./lib.mjs";

main(() => {
  const args = parseArgs(process.argv.slice(2), {
    flags: ["push", "dry-run", "allow-dirty", "any-branch", "allow-empty-changelog", "no-marketplace-bump"],
  });
  const [name, kind] = args._;
  if (!name || !kind) fail("usage: release.mjs <plugin-name> <patch|minor|major|x.y.z> [--push] [--dry-run]");

  const root = repoRoot();
  ensureOnMain(root, args["any-branch"]);
  ensureCleanTree(root, args["allow-dirty"] || args["dry-run"]);

  const { manifest } = loadPlugin(root, name);
  const newVersion = bumpVersion(manifest.version, kind);

  publishVersion({
    root,
    name,
    newVersion,
    commitMessage: `release(${name}): ${newVersion}`,
    tagMessage: `${name} v%s`,
    push: args.push,
    dryRun: args["dry-run"],
    allowEmptyChangelog: args["allow-empty-changelog"],
    bumpMarketplace: !args["no-marketplace-bump"],
  });
});
