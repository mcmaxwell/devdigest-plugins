# research-tools

A read-only research agent for Claude Code.
It answers two kinds of questions with cited evidence: internal ones about the repository you are working in (how something works, where a behaviour lives, what the code actually does today) and external ones about libraries, APIs, protocols and tooling (what a version supports, what a spec says, what changed in a release).
Every claim in its report carries a `path:line` citation or a URL it actually fetched, and every gap is named instead of guessed over, so the report can be acted on by a person or by another agent without re-checking it.

## Install

```
/plugin marketplace add mcmaxwell/devdigest-plugins
/plugin install research-tools@devdigest-plugins
```

## What it ships

| Agent | Model | Writes files | Use it when |
| --- | --- | --- | --- |
| `researcher` | `sonnet` | no | A question needs investigation before code is written, a claim about the codebase needs verifying, or an external technical decision (a library, an API, a protocol) needs grounding in primary sources. |

The agent has `Read`, `Grep`, `Glob`, `Bash` (read-only commands only), `WebSearch`, `WebFetch` and `TodoWrite`.
It has no `Write`, no `Edit` and no `Agent` tool, and its prompt forbids every shell command that would change the working tree.

## How to work with it

The Agent tool lists plugin agents under the plugin name, so in a prompt or another agent's instructions the exact subagent type is `research-tools:researcher`.

Give it a concrete question: a subject plus what you want to know about it.
"Look into caching" is a topic and gets clarifying questions back; "which layer decides the cache key for repository lookups, and is it covered by a test" is a question and gets a report.

- Internal question: ask "use the researcher agent to find out where the retry limit for outbound webhooks is decided and whether it is configurable".
  The report comes back with an Answer, numbered Findings each backed by `path/to/file.ts:120-134` and a one-line description of what that code does, a short "How it fits together" walkthrough, a table of relevant files, and a Gaps section.
- External question: ask "use the researcher agent to check whether library X at the version we install supports streaming responses, with sources".
  The report pins the version it applies to (read from the package manifest and lockfile), lists each source with its type and date, gives a confidence per finding, adds Version notes, and closes with what it could not corroborate.
- Comparison: ask "use the researcher agent to compare how our rate limiter behaves with what the upstream API documents".
  You get the internal format plus an External evidence section and a Divergence section naming every place the code and the documentation disagree.

When the question is ambiguous it asks at most three questions, each with the default it would assume, so a one-line reply unblocks it.
When a task is clear it starts immediately.

## What it reads and writes

Reads: any file in the repository, git history (`git log`, `git blame`, `git show`), the package manifest and lockfile for version pinning, and the module's `INSIGHTS.md`, `AGENTS.md` or `CLAUDE.md` when one exists for the area under investigation.
Fetches: web pages it cites; search snippets are never used as sources.

Writes: nothing.
It is designed so its report can be pasted into a plan or handed to an implementing agent.

## Adapting to your project

Nothing is required.
Two things make its answers better:

- Keep gotchas in `INSIGHTS.md` files next to the code and project rules in `CLAUDE.md`; the agent reads them and they often hold exactly the fact being asked about.
- If your project keeps two physical copies of a contract or config (a client copy and a server copy, a vendored file), say so in `CLAUDE.md`; the agent checks both copies and reports drift when it knows they exist.

## Part of the family

`research-tools` is a dependency of `sdd-engineering`, whose spec writer and implementation planner spawn `researcher` by name when they hit a fact they cannot read from the repository.
It installs and works on its own.

## License

MIT, see the repository `LICENSE`.
