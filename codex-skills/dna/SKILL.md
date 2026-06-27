---
name: dna
description: Route Design Network Atlas work to the right DNA scenario skill. Use when the user asks how to model, edit, review, generate from, or govern a DNA design graph, especially when deciding between graph modeling, graph editing, generation guidance, phenotype libraries, preview, change-set review, or proposal workflows.
---

# DNA Skill Router

Use this as the lightweight entry point for DNA work. Do not duplicate CLI help here. Choose the workflow skill that matches the user's actual problem, then use the CLI only as the persistence boundary after the modeling or editing decision is clear.

## Route

- Use `dna-graph-modeling` when the user starts from a project, design domain, visual asset system, product surface, game art direction, UI/icon family, or other natural-language scenario and needs to create a new DNA graph or a major new branch.
- Use `dna-graph-editing` when the user already has a DNA graph and wants to add, remove, merge, split, rename, reparent, refactor, or review existing graph content.
- Use future generation guidance when the graph is already stable and the task is to produce prompt, art brief, review checklist, or generation package from a SpeciesNode.
- Use future phenotype library governance when the task is mainly about result objects, asset storage, tags, mounts, Eagle/NAS/Git adapters, search, or lifecycle states.

## Shared Rules

- Treat DNA objects as domain decisions first, commands second.
- Keep durable writes behind DNA CLI/service flows; do not write SQLite or exported JSON by hand.
- Prefer preview-confirm for small clear writes, change-set review for complex but bounded writes, and proposal for multi-node or multi-edge graph changes that need human review.
- Mark uncertain objects as draft or unresolved questions instead of inventing graph facts.
- Never store API keys, passwords, complete private links, provider credentials, or unrelated private material in graph, phenotype, asset, review, or export data.

## Expected Output

For non-trivial requests, return:

- chosen workflow skill and reason
- graph objects affected or proposed
- recommended write mode
- review or confirmation questions
- next concrete CLI/service action only after the graph decision is explicit
