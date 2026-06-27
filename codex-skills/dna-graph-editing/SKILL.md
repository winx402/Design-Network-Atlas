---
name: dna-graph-editing
description: Safely edit an existing Design Network Atlas graph. Use when the user wants to add, remove, merge, split, rename, reparent, refactor, review, or extend existing Graph, SpeciesNode, EvolutionEdge, facets, facts, Phenotype types, phenotype library bindings, or routing policies, and needs impact analysis, risk grading, alternatives, preview, change-set review, or proposal guidance.
---

# DNA Graph Editing

Use this skill when a DNA graph already exists and the user wants to change it. The main work is to protect graph meaning while still moving the design forward.

## Workflow

1. Read the 当前图谱 context.
   - Inspect graph purpose, root SpeciesNode entries, parent/child links, multi-parent roles, facets, template bindings, Phenotype types, phenotype library bindings, reviews, and impact records.
   - If only partial data is available, say what is missing before proposing durable changes.

2. Classify the edit intent.
   - Add SpeciesNode, add EvolutionEdge, adjust facets, change template, change parentage, merge duplicates, split overloaded node, rename concept, archive concept, change Phenotype type, change library routing, or repair graph structure.
   - Identify whether the request is a semantic change, a naming cleanup, a storage/routing change, or a generation-output change.

3. Check 合理性.
   - Verify that a proposed SpeciesNode is a stable design object, not a single Phenotype, tag, file variant, prompt, or fact.
   - Verify that a proposed EvolutionEdge expresses a transformation from parent to child.
   - Verify that facets describe reusable dimensions rather than one-off values.
   - Verify that phenotype library changes stay decoupled from graph identity.

4. Run 影响分析.
   - Identify downstream SpeciesNode entries, EvolutionEdge versions, Phenotype versions, AssetIndex references, reviews, and routing policies affected by the change.
   - Mark likely outdated Phenotype versions when upstream constraints, parentage, facets, or edge deltas change.
   - Distinguish visual-impacting changes from metadata-only changes.

5. Grade risk and change size.
   - Low risk: additive, local, no downstream generated result changes.
   - Medium risk: changes one branch, affects a small set of Phenotype versions, or changes review criteria.
   - High risk: changes root nodes, shared facets, template semantics, multi-parent rules, or many downstream results.
   - Structural risk: requires split/merge/reparenting across multiple branches or changes graph interpretation.

6. Offer 替代方案.
   - Prefer additive extension when deletion would break history.
   - Prefer archive over hard delete when Phenotype versions or reviews already reference the object.
   - Prefer split when a SpeciesNode mixes multiple stable objects.
   - Prefer merge when two nodes differ only by name or tag but share identity.
   - Prefer edge adjustment when the child identity is sound but inheritance is wrong.

7. Choose write strategy.
   - Use preview-confirm for low-risk single edits.
   - Use change-set review for medium-risk edits or edits needing user approval before persistence.
   - Use proposal for high-risk, multi-node, multi-edge, root-level, or structural edits.
   - Require `impact check` before applying parent, edge, root, template, or shared facet changes.
   - Keep unresolved edits as draft or pending proposal; do not silently apply uncertain graph facts.

## Editing Heuristics

- If the user says "add this asset", check whether it is actually a Phenotype or AssetIndex before creating a SpeciesNode.
- If the user says "this style should affect many objects", consider a facet, fact/motif, template revision, or parent SpeciesNode instead of repeated edge deltas.
- If the user says "move this under that parent", check whether old Phenotype versions become outdated.
- If the user says "delete", check archive, deprecate, or replace first.
- If a change affects generation guidance, revise review checklist expectations along with the graph.

## Required Output

Return an edit proposal with these sections:

- Current state: summarized 当前图谱 objects and missing context.
- Requested change: normalized edit intent and affected DNA object types.
- Reasonableness check: pass, concerns, or reject with rationale.
- Impact analysis: downstream objects, outdated risk, visual impact, storage impact, and review impact.
- 风险等级 / Risk level: low, medium, high, or structural, with reason.
- Alternatives: at least one safer or more expressive option when risk is not low.
- Recommended write path: preview-confirm, change-set review, proposal, draft-write, or no-write diagnosis.
- Review checklist: what the user should confirm before apply.

## Guardrails

- Do not write directly to database internals, exported JSON, or asset storage by hand.
- Do not force a user request into a graph edit when it belongs to Phenotype, AssetIndex, tag, or library routing.
- Do not apply edits that make existing reviews or Phenotype versions misleading without marking the impact.
- Do not treat generated output regeneration as automatic; recommend it only after version and impact review.
- Do not include secrets, provider credentials, complete private links, or unrelated private project material in the edit proposal.
