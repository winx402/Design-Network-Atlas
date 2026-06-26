# DNA: Design Network Atlas

DNA is a local-first TypeScript system for design genome graphs. It models reusable gene templates, species nodes, evolution edges, phenotypes, asset pointers, review records, and impact analysis.

## Current Scope

- TypeScript workspace with reusable core, storage, SQLite, CLI, server, template-pack, and web packages.
- SQLite local storage adapter with import/export, review, impact, generation job, and asset pointer repositories.
- `dna` CLI for graph, template, node, edge, phenotype, asset, review, impact, import, export, and version-history workflows.
- Built-in starter template packs for game art visual assets and UI/icon assets.
- Codex Skill wrapper guidance with preview-first command recipes.
- Mock generation provider adapter with sensitive-parameter scrubbing.
- Asset workbench UI for search, version switching, review details, status transitions, asset groups, and outdated signals.
- Local/server collaboration adapters with permission checks and sync-conflict change-sets.

The current implementation covers the v0.1 local-first system path. Longer-term hosted collaboration and production model providers should extend the same ports rather than bypassing the core model.

## Design and Development Plan

- [System technical design](docs/design/system-architecture.md)
- [Phase-by-phase development roadmap](docs/implementation/development-roadmap.md)
- [Test strategy](docs/testing/test-strategy.md)

## Quick Start

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
pnpm dna -- --help
```

Create a minimal graph:

```bash
pnpm dna -- --db .dna/dna.sqlite graph create --id graph-demo --name "Demo Graph" --purpose "Local test" --yes
pnpm dna -- --db .dna/dna.sqlite node create --graph graph-demo --id node-root --name "Root Icon" --motif broken-ring --constraint color=red --yes
pnpm dna -- --db .dna/dna.sqlite phenotype generate --graph graph-demo --node node-root --type image-prompt --name "Warning Icon Prompt" --brief "toolbar warning icon" --tool manual --yes
pnpm dna -- --db .dna/dna.sqlite asset search --graph graph-demo --tag ui
```

## Exchange Format

`dna export --out <dir>` writes a Git-friendly directory:

- `dna.project.json`
- `templates/`
- `graphs/<graph_id>/graph.json`
- `graphs/<graph_id>/nodes/`
- `graphs/<graph_id>/edges/`
- `graphs/<graph_id>/phenotypes/`
- `graphs/<graph_id>/assets/`
- `graphs/<graph_id>/reviews/`
- `graphs/<graph_id>/impacts/`
