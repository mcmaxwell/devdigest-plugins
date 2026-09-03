# architecture-reviewer

Two read-only agents that answer one question about one change: did it stay inside the architecture this project has written down?
`arch-evidence` collects the facts (the output of your mechanical boundary checks plus one grep-shaped probe per written rule) and returns them as a table without an opinion.
`architecture-reviewer` judges that table, or collects its own evidence when it has none, against the boundaries your project writes down and the generic layering rules of the `onion-architecture` and `frontend-ui-architecture` skills, and returns findings that each carry `path:line` evidence, the rule they break, where that rule is written, and a fixed severity.
Neither agent writes a file, gates a merge, or does security review.

## Install

```
/plugin marketplace add mcmaxwell/devdigest-plugins
/plugin install architecture-reviewer@devdigest-plugins
```

Installing this plugin pulls in `engineering-paved-path`, see Dependencies.

## What it ships

| Agent | Model | Writes files | Use it when |
| --- | --- | --- | --- |
| `arch-evidence` | `sonnet` | no | Immediately before `architecture-reviewer`, to run the project's dependency-cruiser, lint or boundary scripts and the per-rule probes on a cheaper model and hand the reviewer a table. |
| `architecture-reviewer` | `sonnet`, preloads `onion-architecture` and `frontend-ui-architecture` | no | An implementation is finished and you want to know whether it crossed a written boundary, on a diff range, a branch, or a named set of files. |

Both agents have `Read`, `Grep`, `Glob`, `Bash` (read-only, plus the project's own boundary checks) and `TodoWrite`; the reviewer also has `Skill`.
Neither has `Write`, `Edit`, `Agent`, `WebSearch` or `WebFetch`.

## How to work with it

The Agent tool lists plugin agents under the plugin name, so in a prompt or another agent's instructions the exact subagent type is `architecture-reviewer:architecture-reviewer` and `architecture-reviewer:arch-evidence`.

The two-step shape is the intended one, because most evidence rows come back empty and collecting them is cheaper than judging them.

- Full review of a branch: first ask "use the arch-evidence agent on the diff `main...HEAD`", then paste its table into "use the architecture-reviewer agent with this evidence table on `main...HEAD`".
  The evidence report has a header naming the checks and rules it found (or "No mechanical checks configured." and "No written boundary rules found."), a Commands table with real output, a Probes table with `path:line` hits or `0` per row, a Could not run section, and a git status line.
  The review report has a Sourced rules list, a Verdict (Clean, Findings, Blocked), numbered Findings with rule, source, evidence and fix direction, a Boundaries checked table with a row per rule, a Mechanical checks table, a For other reviewers section, and Gaps.
- Quick review of a few files: ask "use the architecture-reviewer agent on `src/orders/routes.ts` and `src/orders/service.ts`".
  It collects its own evidence, says so in the header, and returns the same report shape.
- Review of an uncommitted change: ask "use the architecture-reviewer agent on the working tree".
  When an implementing agent left a `.claude/last-change.json` manifest, the reviewer uses it to keep another feature's dirty files out of scope.

Severity is fixed so two runs agree: critical for a mechanically enforced boundary, a declared duplicate copy left behind, or a do-not-touch path edited; major for a rule written in your project files without a mechanical check; minor for a skill preference with no project rule behind it.
A finding it cannot back with a quoted line is dropped, and a security-shaped observation is named in one unjudged line under For other reviewers and left there.

## What it reads and writes

Reads: `CLAUDE.md` or `AGENTS.md` at the root and in touched packages, `ARCHITECTURE.md` or `docs/architecture*`, `.dependency-cruiser.*` and ESLint boundary configs, package manifest scripts, `INSIGHTS.md` files in touched modules, `.claude/last-change.json` when present, git history and the changed files.
Runs: only the mechanical boundary checks your project names, never tests, builds, type checks or migrations.

Writes: nothing.
The reviewer never writes a verdict marker, never touches `.git/`, and never blocks a command.

## Adapting to your project

The reviewer cites what it can source, so the way to get useful findings is to write your boundaries down where it looks:

- Put layering rules, do-not-touch paths, generated paths, and files that exist in two copies in `CLAUDE.md` (root and per package).
  A rule stated there becomes a checklist row with a citation and a major severity when broken.
- Add a dependency-cruiser config or ESLint `import/no-restricted-paths` and `import/no-cycle` rules, and expose them as a script in the package manifest (`arch:check`, `lint`, `depcruise`, `boundaries`).
  Name that script in `CLAUDE.md` under a heading like Commands so `arch-evidence` finds and runs it; a rule enforced this way earns critical severity when broken.
- Keep lessons in `INSIGHTS.md` next to the code; the reviewer treats them as high-confidence rules.
- A project with none of that still gets a review, against the generic skills only, and the report says so in its header; every finding is then at most minor.

## Dependencies

`engineering-paved-path` provides the `onion-architecture` and `frontend-ui-architecture` skills the reviewer preloads through its frontmatter; without them the generic checklist rows have no source to cite.
The reviewer reads `INSIGHTS.md` files directly and never invokes `engineering-insights`, because it does not write lessons.

## Part of the family

`sdd-engineering` uses this plugin in its review loop: each round of `run-plan` invokes `arch-evidence`, then `architecture-reviewer`, and turns the findings into a fix addendum for the implementer.
The plugin installs and works on its own.

## License

MIT, see the repository `LICENSE`.
