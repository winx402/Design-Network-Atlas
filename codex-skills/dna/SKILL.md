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

## Common Commands

```bash
dna --db .dna/dna.sqlite graph create --id graph-id --name "Graph Name" --purpose "Purpose"
dna --db .dna/dna.sqlite graph create --id graph-id --name "Graph Name" --purpose "Purpose" --yes
dna --db .dna/dna.sqlite template install-builtins --yes
dna --db .dna/dna.sqlite node create --graph graph-id --id node-id --name "Node" --motif broken-ring --constraint color=red --yes
dna --db .dna/dna.sqlite phenotype generate --graph graph-id --node node-id --type image-prompt --name "Prompt" --brief "Task" --tool manual --yes
```
