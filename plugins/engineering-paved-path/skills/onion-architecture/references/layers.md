# Layers - mapping the onion to a typical layout

## The model

Onion Architecture (Palermo, 2008) puts the domain model at the center, wraps it in application services, and pushes infrastructure and UI to the outermost ring.
The only rule that matters: **dependencies point inward**.
The center never knows how it is stored, transported, or rendered.

Clean Architecture, Hexagonal (Ports & Adapters), and Onion are the same idea with different vocabulary (Stemmler, Graça).
This skill uses the hexagonal vocabulary for the edges - *driving* adapters call us (HTTP, SSE, polling schedulers), *driven* adapters are called by us (DB, VCS host API, git, LLM, secrets).

## Mapping to the host project

The layout below is the one the skill's rules and fixtures assume: an HTTP package (`<backend>/`, paths below are under its `src/`) and an optional pure domain package (`<core>/`).
Read the host project's `CLAUDE.md` for the actual package names and for any boundary it adds; where the host names a canonical module, copy that module's shape.

## Ring by ring

### Domain core

- `<core>/` - the pure domain package, when the project has one: the business engine as pure TS.
  No DB, no fs, no VCS host imports; any LLM is an injected `LLMProvider`.
  Typically consumed by the backend as TS source through a path alias rather than as a built package.
- The shared contracts package (wherever the host CLAUDE.md says it lives) - Zod contracts AND port interfaces (`GitClient`, `GitHubClient`, `LLMProvider`, `SecretsProvider`, ...).
  When the contracts are vendored into more than one package (a backend copy and a web app copy), changing a contract means updating every copy; the host `CLAUDE.md` should say which copy is canonical.

The domain owns the interfaces.
That is what makes the dependency arrow point inward: `adapters/github/octokit.ts` imports `GitHubClient` from the shared contracts - never the reverse.

### Application (use cases)

- `modules/<name>/service.ts` - one class per domain feature, constructed with `Container`.
  Orchestrates: loads via repository, calls ports, applies domain logic, owns transaction boundaries, throws `AppError` subclasses.
- `modules/<name>/helpers.ts` - pure transforms (URL parsing, DTO mapping).
- `modules/<name>/constants.ts` - literals (job kinds, secret names).

Services know *interfaces and rows*, never wire formats (HTTP req/reply) or SQL.

### Infrastructure (driven adapters)

- `adapters/<x>/` - one folder per external capability, for example github (octokit), git (simple-git), llm (openai, anthropic), secrets, auth, code search (ripgrep), embedder, AST tooling, dependency graph, tokenizer.
  Each implements a port interface.
- `adapters/mocks.ts` - in-memory fakes for every port; tests inject them via `ContainerOverrides`.
- `modules/<name>/repository*.ts` - persistence adapter per feature; the only non-`db/` code importing `drizzle-orm`.
- `db/` - drizzle schema, client, generated migrations.

Pure functions colocated in `adapters/` (e.g. `git/diff-parser.ts`, a symbol extractor, AST parse helpers) are domain-grade utilities, not I/O - modules MAY import those directly.
Modules may NOT import concrete clients (`octokit.ts`, `simple-git.ts`, `llm/openai.ts`, `secrets/local.ts`, `mocks.ts`, ...).

### Edge (driving adapters)

- `modules/<name>/routes.ts` - Fastify plugin: zod schemas, context resolution, one service call, status mapping.
- `platform/sse.ts` (an event bus) and `modules/polling/` - non-HTTP drivers.

### Composition root

- `platform/container.ts` - constructs every adapter lazily, resolves secrets, caches clients, exposes ports as typed getters.
  The ONE place where interfaces meet implementations (Palermo's "outermost ring wires the onion"; Synapse "composition root").
- `app.ts` + `modules/index.ts` - plugin order and module registration.

## Legacy debt (allowlisted in `.dependency-cruiser.cjs`)

Most codebases carry a few `routes.ts` files that import drizzle directly because they predate the layering.
Treat them as **frozen exceptions**, not precedent, and keep them listed by name in the dependency-cruiser allowlist so the list is visible and shrinks over time.

Rule: when a task touches one of these files beyond a trivial edit, extract its queries into a `repository.ts` (+ `service.ts` if logic warrants), remove the file from the allowlist, and rerun the dependency-cruiser check.
Never add a new file to the allowlist.
