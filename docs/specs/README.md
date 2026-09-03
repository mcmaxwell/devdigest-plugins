# Specs

One spec per feature: what the system must do, for whom, and how you would know it works.
A spec says **what** the system does and where the boundaries run.
The implementation plan, written later, says **how**.

## Naming

`S<NN>-<slug>.md`, where `<NN>` is the next free number and `<slug>` is the feature in two or three words.
The number is the spec's identity inside the file: `Spec ID: S<NN>`.

Nothing rewrites an approved spec.
A decision that replaces an earlier one gets its own file with `Supersedes:` pointing at the old ID.

## Template

```markdown
# Spec: <feature name>

Spec ID: S<NN>
Status: draft | approved | implemented
Supersedes: <spec ID, if any>

## Problem and user
## Goals and non-goals
## User stories
## Module interactions
## Acceptance criteria (EARS)
## Edge cases
## Non-functional requirements
## Inputs and provenance
## Untrusted inputs
## Design review
## Open questions
```

Every section appears, in this order.
A section with nothing to say gets one line, `None - <why>`, never `TBD`.

## Acceptance criteria in EARS

Each criterion has a stable identifier, `AC-1`, `AC-2`, and so on, never renumbered.
Five patterns:

| Pattern | Form |
| --- | --- |
| Ubiquitous | The system shall `<response>` |
| Event-driven | WHEN `<trigger>`, the system shall `<response>` |
| State-driven | WHILE `<state>`, the system shall `<response>` |
| Unwanted behaviour | IF `<condition>`, THEN the system shall `<response>` |
| Optional feature | WHERE `<feature is included>`, the system shall `<response>` |

One criterion, one requirement.
Each names where it is observed.
No vague predicates (`fast`, `robust`, `properly`, `gracefully`).
No implementation details (libraries, file paths, function names) - those belong to the plan.
