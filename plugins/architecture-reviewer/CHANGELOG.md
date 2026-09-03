# Changelog

All notable changes to this plugin are recorded here.
The format follows Keep a Changelog; versions follow semantic versioning.

## Unreleased

## 0.1.0 - 2026-09-02

### Added

- `architecture-reviewer` agent: read-only review of a change set against the boundaries the host project writes down (`CLAUDE.md`, `ARCHITECTURE.md`, dependency-cruiser or lint boundary configs, `INSIGHTS.md`) plus the generic rules of the `onion-architecture` and `frontend-ui-architecture` skills, with `path:line` evidence, a cited source and a fixed severity per finding.
- `arch-evidence` agent: runs the mechanical boundary checks the host project defines plus one grep-shaped probe per written rule, and returns the raw observations as a table without judging them.
