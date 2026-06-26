# DNA: Design Network Atlas

DNA is a local-first TypeScript system for design genome graphs. It models reusable gene templates, species nodes, evolution edges, phenotypes, asset pointers, review records, and impact analysis.

## Current Scope

- TypeScript workspace with reusable core packages.
- SQLite local storage adapter.
- `dna` CLI for graph, template, node, edge, phenotype, asset, review, impact, import, and export workflows.
- Built-in starter template packs for game art visual assets and UI/icon assets.
- Codex Skill wrapper guidance and an initial asset workbench UI skeleton.

## Quick Start

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm dna -- --help
```

Create a minimal graph:

```bash
pnpm dna -- --db .dna/dna.sqlite graph create --id graph-demo --name "Demo Graph" --purpose "Local test" --yes
pnpm dna -- --db .dna/dna.sqlite node create --graph graph-demo --id node-root --name "Root Icon" --motif broken-ring --constraint color=red --yes
pnpm dna -- --db .dna/dna.sqlite phenotype generate --graph graph-demo --node node-root --type image-prompt --name "Warning Icon Prompt" --brief "toolbar warning icon" --tool manual --yes
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
