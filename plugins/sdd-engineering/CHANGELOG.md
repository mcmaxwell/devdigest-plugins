# Changelog

All notable changes to this plugin are recorded here.
The format follows Keep a Changelog; versions follow semantic versioning.

## Unreleased

## 0.1.0 - 2026-09-02

### Added

- `specreator`, `implementation-planner`, `implementer` and `plan-verifier` agents, made portable: they discover the host project through its `CLAUDE.md`, `AGENTS.md`, `INSIGHTS.md` and skill catalogue instead of naming packages.
- `run-plan` skill: implement an approved plan, then loop `arch-evidence`, `architecture-reviewer` and `plan-verifier` until the blocking findings are gone.
- `workflow-retro` skill with its transcript collector, which reads agent definitions from the host project's `.claude/agents/` and from this plugin.
- `specs-gate` PreToolUse hook confining the specreator to creating `docs/specs/<ID>-<slug>.md`, with the id pattern widened to one to three uppercase letters plus two digits.
