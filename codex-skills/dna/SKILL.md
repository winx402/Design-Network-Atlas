---
name: dna
description: Guide Design Network Atlas graph edits through the local dna CLI, showing previews before durable writes.
---

# DNA Skill

Use this skill when creating, editing, reviewing, generating, importing, or exporting DNA graph data.

## Rules

- Treat the CLI as the write boundary. Do not write SQLite or Git directory files directly from the model.
- Default to preview mode first. Re-run with `--yes` only after the user accepts the preview.
- Do not invent missing graph facts. Mark uncertain fields as draft or ask for confirmation.
- Do not store API keys, passwords, complete private links, or provider credentials.
- Explain the command diff before applying it when a command changes graph, lineage, phenotype, review, impact, import, or export state.

## Preview-First Command Recipes

Show the preview command first. Only provide the matching `--yes` command after the user accepts the preview.

```bash
dna --db .dna/dna.sqlite graph create --id graph-id --name "Graph Name" --purpose "Purpose"
dna --db .dna/dna.sqlite graph create --id graph-id --name "Graph Name" --purpose "Purpose" --yes

dna --db .dna/dna.sqlite template install-builtins
dna --db .dna/dna.sqlite template install-builtins --yes

dna --db .dna/dna.sqlite node create --graph graph-id --id node-id --name "Node" --motif broken-ring --constraint color=red
dna --db .dna/dna.sqlite node create --graph graph-id --id node-id --name "Node" --motif broken-ring --constraint color=red --yes

dna --db .dna/dna.sqlite edge create --graph graph-id --id edge-id --from parent-node --to child-node --delta color=amber
dna --db .dna/dna.sqlite edge create --graph graph-id --id edge-id --from parent-node --to child-node --delta color=amber --yes

dna --db .dna/dna.sqlite phenotype generate --graph graph-id --node node-id --type image-prompt --name "Prompt" --brief "Task" --tool manual
dna --db .dna/dna.sqlite phenotype generate --graph graph-id --node node-id --type image-prompt --name "Prompt" --brief "Task" --tool manual --yes

dna --db .dna/dna.sqlite review phenotype --phenotype-version phenotype-version-id --required-motif broken-ring --required-constraint color=amber
dna --db .dna/dna.sqlite review phenotype --phenotype-version phenotype-version-id --required-motif broken-ring --required-constraint color=amber --yes

dna --db .dna/dna.sqlite impact check --graph graph-id --edge edge-id --changed-version edge-id@1.0.0
dna --db .dna/dna.sqlite impact check --graph graph-id --edge edge-id --changed-version edge-id@1.0.0 --yes

dna --db .dna/dna.sqlite import --in ./dna-export
dna --db .dna/dna.sqlite import --in ./dna-export --yes
```

## Read-Only Checks

```bash
dna --db .dna/dna.sqlite graph list
dna --db .dna/dna.sqlite node show --id node-id
dna --db .dna/dna.sqlite edge show --id edge-id
dna --db .dna/dna.sqlite review list --type phenotype-version --id phenotype-version-id
dna --db .dna/dna.sqlite impact list --type edge --id edge-id
dna --db .dna/dna.sqlite export --out ./dna-export
```
