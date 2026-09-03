# engineering-paved-path

The paved path: the engineering conventions every agent in this plugin family follows, packaged as five Claude Code skills.
Install it once and every coding session gets the same answers to the questions that otherwise get re-decided on every task: which backend layer a file belongs to and what it may import, where a React component or hook lives, how a lesson learned is written down so the next session finds it, how to draw a diagram that explains a design, and what a security review must check.
The skills are project-agnostic; they read the host project's `CLAUDE.md` for package names and boundary rules and apply the conventions on top.

## Install

```
/plugin marketplace add mcmaxwell/devdigest-plugins
/plugin install engineering-paved-path@devdigest-plugins
```

## Skills

| Skill | Use it when | What it gives you |
|---|---|---|
| `onion-architecture` | adding or changing a backend module, adapter or port; integrating an external tool; touching the DI container; deciding which layer new backend code belongs to | the dependency rule, a layer map, seven hard rules (routes are transport only, drizzle only in repositories, ports not vendors, five-part atomic ports, parse at the boundary, service-owned transactions, a pure domain package), a new-module checklist and dependency-cruiser enforcement |
| `frontend-ui-architecture` | deciding where components, hooks, business logic, constants, utils or types live; structuring a React or Next.js App Router app; splitting a component; setting up import boundaries | colocation and promotion rules, feature-based folders, view to hook to service to domain layering, App Router organisation, ESLint boundary config |
| `engineering-insights` | at the start of every task, whenever a gotcha or dead end surfaces, and as the wrap-up check before finishing; also on "wrap up", "retro", "lessons learned", "TIL" | an append-only `INSIGHTS.md` per package or module with fixed sections, an entry format and four quality gates that keep it free of noise |
| `mermaid-diagram` | a workflow, architecture, API flow, data model, state machine or system design needs a picture in Markdown | a diagram-type decision guide, syntax quick reference per type, styling rules, ready-to-use templates and a validation routine |
| `security` | reviewing code for vulnerabilities; implementing auth or authorization; handling user input, file uploads, secrets or new API endpoints | OWASP Top 10:2025 guidance with a confidence-based review process, severity classification, checklists and unsafe/safe code pairs |

## Working with each skill

### onion-architecture

Triggers on backend structure questions: a new module, a new external client, "where does this go", a pre-PR review of routes, services and repositories.
It reads the host `CLAUDE.md` (and the backend package's `AGENTS.md` if present) for the real package names and the canonical example module, then applies its layer map and hard rules.
It writes nothing on its own; when it finds a violation it names the rule, the file and the fix, and it asks you to run the project's dependency-cruiser command after structural changes.
`references/` holds the detail per topic (layers, DI and ports, Drizzle persistence, Fastify routes, testing per layer); `evals/` holds the fixture-based review cases and trigger queries the skill was tuned on.

### frontend-ui-architecture

Triggers when the question is where frontend code lives or how it is layered, not how React behaves.
It reads the existing folder layout and the host `CLAUDE.md`, then answers with the colocation and promotion rules, the feature-based structure for the app's size, and the view to hook to service split.
Hook correctness, performance and Next.js runtime patterns are out of its scope; if the host project has skills such as `react-best-practices` or `next-best-practices`, those take over there.
Its `references/` cover folder structure, business logic placement, App Router organisation and shared-code conventions including the ESLint zones that enforce the boundaries.

### engineering-insights

Runs at three moments: task start (read the touched module's `INSIGHTS.md` and the root one), mid-task (capture a non-obvious lesson as soon as it surfaces), and wrap-up (a last check before finishing).
It writes to the `INSIGHTS.md` next to the code the task touched, one dated bullet per lesson under a fixed section, creating the file when it does not exist.
Every entry has to pass the anti-banality, five-minute, not-derivable and stable gates, and duplicates extend the existing entry instead of adding a new one.
Trivial tasks with no problem, solution or discovery write nothing.

### mermaid-diagram

Triggers on any request to visualise a flow, architecture, data model or state machine.
It picks the diagram type from the decision guide, writes a fenced `mermaid` block into the Markdown you are working on, and keeps diagrams under about twenty nodes with labelled edges.
`examples.md` has a template per diagram type to start from; the skill asks you to validate the syntax in the Mermaid live editor or with `mmdc` before sharing.

### security

Triggers on security review requests and on code that touches auth, input handling, uploads, secrets or new endpoints.
It traces the data flow before flagging anything and reports only high-confidence findings with file, line, exploit scenario and fix.
`checklists.md` gives the quick per-topic checklists, `examples.md` the unsafe/safe code pairs, `references.md` the OWASP and framework sources.

## How the family uses it

This plugin is the shared base of the plugin family in this marketplace.
The `architecture-reviewer` plugin depends on it: its review agents judge changes against the `onion-architecture` and `frontend-ui-architecture` rules and name the rule each finding breaks.
The `sdd-engineering` plugin depends on it: its planning and implementation agents cite these skills as the constraints a plan must respect, and its wrap-up step is the `engineering-insights` loop.
Installing either of them installs this plugin as a dependency; install it alone when you only want the skills.

## Adapting to your project

The skills carry the conventions; your project carries the facts.
Put these in the host project's `CLAUDE.md` and the skills read them:

- the package names and what each one is (the backend, the web app, a pure domain package, the e2e suite);
- the canonical example module a new backend module should copy;
- boundary rules of your own (for example, where shared contracts live and whether they are vendored into more than one package);
- the dependency-cruiser and test commands per package;
- where `INSIGHTS.md` files live, if you want a layout other than one per package plus one at the root.

Nothing in the plugin needs to be edited for a new project.

## License

MIT
