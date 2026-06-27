# DNA Codex Agent Role Templates

These templates define project-specific Codex roles for DNA work. They are prompt templates, not runtime code and not DNA graph objects.

## Roles

- `product-manager.md`: turns raw user needs and problem statements into a formal PRD grounded in DNA product boundaries.
- `developer.md`: implements accepted PRDs while preserving the `packages/core` domain source of truth and service/change-set boundaries.
- `tester.md`: runs as an on-demand sub-agent to test PRD implementation work and report concrete defects.

## Routing

Use these roles in this order for feature work:

1. Product Manager: clarify the problem and produce or update the PRD.
2. Developer: implement only from an accepted PRD or explicit development task.
3. Tester: independently verify the implementation against the PRD, tests, docs, and project guardrails.

## Shared Project Facts

- DNA is a local-first Design Network Atlas for structured design graph governance.
- DNA is not a binary asset store by default. It records graph meaning, generated result metadata, output references, review records, impact records, and storage routing.
- `packages/core` is the domain source of truth. CLI, storage, server, web, and skills must not redefine core domain concepts.
- Durable graph writes must go through CLI/service boundaries. Default graph writes stay in preview or change-set review mode.
- Secrets, credentials, complete private links, and raw provider credentials must never be stored in fixtures, logs, exports, or generation jobs.

## Source Hierarchy

Read these files before role-specific work:

1. `AGENTS.md`
2. `README.md`
3. `docs/index.md`
4. `docs/design/system-architecture.md`
5. `docs/implementation/development-roadmap.md`
6. `docs/testing/test-strategy.md`
7. `docs/implementation/versioning-policy.md` when preparing changes that may be pushed.

## Handoff Contract

Each role should leave a concise handoff:

- Product Manager: PRD path or PRD text, accepted scope, open questions, acceptance criteria.
- Developer: implemented scope, changed files, tests run, remaining risk, PRD gaps found.
- Tester: test scope, commands run, pass/fail summary, issue list with reproduction steps.
