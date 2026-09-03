---
name: onion-architecture
description: Onion Architecture rules for a TypeScript backend. Use when adding or changing a backend module (routes, service, repository), adding an adapter or port, integrating an external tool (API, CLI, LLM, queue), touching the DI container, or deciding which layer new backend code belongs to. Covers the dependency rule, layer map, ports and adapters, transaction boundaries and dependency-cruiser enforcement.
version: 1.1.0
---

# Onion Architecture (backend)

Layering and dependency rules for a TypeScript backend made of an HTTP package and, optionally, a pure domain package.
Every rule is sourced; the full source list is in `README.md`, details per topic in `references/`.

**Scope boundary:** this skill answers "which layer does this code belong to and what may it import."
For route and plugin mechanics use `fastify-best-practices`; for query syntax use `drizzle-orm-patterns`; for table design use `postgresql-table-design`.

**Host project first:** read the host project's `CLAUDE.md` (and the backend package's `AGENTS.md` if it has one) for the actual package names, the canonical example module and the boundary rules it already writes down.
This skill uses `<backend>/` for the HTTP package and `<core>/` for the pure domain package; substitute the host's names.

## The Dependency Rule

All source-code dependencies point **inward**.
Outer layers know about inner layers; inner layers know nothing about outer ones.
Infrastructure (DB, HTTP, VCS hosts, LLM vendors) is externalized behind interfaces owned by the inside.
(Palermo, Graça)

```
        ┌──────────────────────────────────────────────┐
 edge   │ routes.ts · SSE · polling      (driving)     │
        │  ┌────────────────────────────────────────┐  │
 app    │  │ modules/*/service.ts   (use cases, tx) │  │
        │  │  ┌──────────────────────────────────┐  │  │
 domain │  │  │ <core> · shared contracts        │  │  │
        │  │  │ (pure TS + Zod contracts/ports)  │  │  │
        │  │  └──────────────────────────────────┘  │  │
        │  └────────────────────────────────────────┘  │
        │ adapters/* · repository.ts · db/  (driven)   │
        └──────────────────────────────────────────────┘
```

## Layer map for a typical layout

| Layer | Lives in | May import |
|---|---|---|
| **Domain core** | `<core>/` and the shared Zod contracts package (the host CLAUDE.md names where it lives) | only itself + zod |
| **Application** | `modules/*/service.ts`, `helpers.ts`, `constants.ts` | domain, ports (interfaces), own repository, `platform/` types |
| **Infrastructure (driven)** | `adapters/*`, `modules/*/repository*.ts`, `db/` | domain, vendor SDKs, drizzle |
| **Edge (driving)** | `modules/*/routes.ts`, SSE, `polling` | service + zod schemas only |
| **Composition root** | `platform/container.ts`, `app.ts`, `modules/index.ts` | everything (the ONLY place that may) |

Paths are relative to `<backend>/src/`.
Details and how to handle legacy debt: `references/layers.md`

## Hard rules

1. **Routes are transport only.**
   `routes.ts` declares zod schemas, resolves context, calls ONE service method, maps the status code.
   It never imports `drizzle-orm` or `src/db`, never contains business logic.
   (Palermo; bulletproof layering) → `references/fastify-http.md`
2. **Only repositories and `db/` import drizzle.**
   A table has exactly one owning repository; every query is tenant-scoped (for example by workspace id).
   (Repository pattern - Fowler via Stemmler, Sentry) → `references/drizzle-persistence.md`
3. **Services depend on ports, not vendors.**
   A service reaches I/O only through `Container` getters typed as interfaces (`GitClient`, `LLMProvider`, ...).
   Never `new OctokitGitHubClient()` outside the container.
   (DIP - Palermo, Jansen) → `references/di-ports-adapters.md`
4. **New external tool = a full port, atomically.**
   Interface in the shared contracts (or `adapters/<x>/index.ts`) + real adapter in `adapters/<x>/` + mock in `adapters/mocks.ts` + field in `ContainerOverrides` + lazy getter in `Container`.
   All five in one change - reject partial ports. → `references/di-ports-adapters.md`
5. **Parse at the boundary, trust inside.**
   Zod runs once, at the edge (the Fastify zod type provider; adapter responses for external APIs).
   Inner layers receive typed data - no re-`parse`, no hand-parsing `req.body`.
   ("Parse, don't validate" - Nygren)
6. **Transactions belong to the service, with one named exception.**
   The service owns the business operation's scope and passes `tx` down; repositories accept it and do not open one.
   The exception is an *indivisible persistence primitive*: two or more writes with no business decision between them, where a half-applied state would break the tables' own invariants.
   The typical precedent is a `deleteAllForRepo` that removes indexed symbols and their references together - they must die together, and no caller ever wants one without the other.

   **Decision test - is there a decision between the writes?**
   A branch, a port call, a value the next write depends on, or a caller who might reasonably want only one of them: the service owns the boundary.
   None of those, and the writes are meaningless apart: the repository may own it, and must carry a comment saying why.
   When in doubt the service owns it - that direction is always composable.
   (Silva) → `references/drizzle-persistence.md`
7. **The domain package stays pure.**
   No DB, no fs, no VCS host, no backend imports; LLM only via an injected `LLMProvider`.
   It is the domain - everything else plugs into it.

## New module checklist

1. `modules/<name>/routes.ts` - zod schemas + delegation.
   Copy the shape of the host project's canonical module (its `CLAUDE.md` or `AGENTS.md` usually names one).
2. `modules/<name>/service.ts` - class taking `Container`; owns use cases and transactions.
3. `modules/<name>/repository.ts` - class taking `Db`; the only file with drizzle imports; every query tenant-scoped.
4. `helpers.ts` (pure transforms) + `constants.ts` (literals) as needed.
5. Register in `src/modules/index.ts` (one import + one register).
6. Tests per layer: service and helpers hermetic with `ContainerOverrides` mocks; repository as an integration test against a real database.
   → `references/testing.md`

## Enforcement

Architecture that isn't mechanically checked erodes.
After any structural change in the backend package, run the project's dependency-cruiser command (see its package scripts; commonly `arch:check` or `depcruise`).

The rules live in the backend package's `.dependency-cruiser.cjs`: routes must not import drizzle or `db/`, modules must not import concrete adapter clients or mocks.
If the project has no such config yet, add one with exactly those two rules; they are the cheapest guard against the two most common violations.
Legacy violations are explicitly allowlisted there - when you touch one of those files, migrate it to the layering above and shrink the allowlist; never add new entries.
