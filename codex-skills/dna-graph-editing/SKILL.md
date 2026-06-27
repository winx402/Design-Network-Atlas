---
name: dna-graph-editing
description: Safely edit an existing Design Network Atlas graph. Use when a user wants to add, remove, merge, split, rename, reparent, refactor, review, extend, or repair existing DNA graph objects and needs reasonableness checks, impact scope, risk grading, compile implications, storage-routing implications, and a reviewable write strategy.
---

# DNA Graph Editing

Use this skill when a DNA graph already exists and the user wants to change it. The skill's job is to protect graph meaning and downstream generation quality while still proposing a practical edit. Use `dna --help` only when command syntax is explicitly needed.

Use `docs/design/concept-registry.md` as the canonical terminology boundary when deciding whether an edit belongs to graph identity, context, facets, compile artifacts, generated outputs, external pointers, or governance records.
Use `docs/design/write-boundary-matrix.md` for write strategy vocabulary: formal graph/context/facet edits stay reviewable, while generated trace/output/audit records use direct audit write or draft-write through CLI/application service boundaries.

For Chinese responses, keep these review anchors when useful: `当前图谱`, `合理性`, `影响分析`, `风险等级`, and `替代方案`.

## Required Context

Read or ask for the current graph context before durable recommendations:

- Graph purpose, roots, SpeciesGroup boundaries, SpeciesNode entries, EvolutionEdge links, and parent roles.
- Existing facets, templates, context records, ContextReference entries, and ContextReviewRubric entries.
- Existing Phenotype, PhenotypeVersion, SpeciesCompileArtifact, PhenotypeCompileArtifact, OutputReference, PhenotypeLibrary, and routing policy records when the change may affect generated results or storage.
- Known review records and impact records.

If context is partial, state what cannot be assessed and keep high-risk changes in proposal or change-set review.

## Edit Scope Levels

Classify the edit before designing the patch:

- single-node: one SpeciesNode label, description, local genes, motifs, status, or tags.
- single-edge: one EvolutionEdge delta, preservation rule, value resolution, or badcase.
- single-group: one SpeciesGroup membership, shared fact, or local group relation.
- multi-group: several groups, cross-group relations, shared template revisions, or broad motif changes.
- cross-graph: GraphBridge, atlas-level relationship, shared library, or synchronized visual family across graphs.
- context: DesignContext, ContextFact, ContextMotif, DesignPrinciple, ContextReference, or ContextReviewRubric.
- compile-policy: CompilePolicy, compileMode, fixed snapshot, resolution rule, Agent-assisted conflict handling, or artifact trace behavior.
- storage-routing: PhenotypeLibrary binding, StorageMount, ExternalLibraryMapping, LibraryRoutingPolicy, OutputReference, or AssetIndex metadata.

## Edit Classification Matrix

| User asks to... | First consider | Watch for |
| --- | --- | --- |
| Add a concept | SpeciesNode, Phenotype, context, or tag | Creating species for one file |
| Add a style that affects many objects | parent, facet, context, template, or group | Repeated edge deltas |
| Move a node | reparent, add parent role, or create relation | Making old outputs misleading |
| Split or merge nodes | archive, supersede, alias, or proposal | Destroying version history |
| Change storage | LibraryRoutingPolicy or OutputReference | Coupling graph identity to storage |
| Change review criteria | ContextReviewRubric or compile artifact refresh | Accepting stale results |

## Decision Gates

1. object gate: decide whether the request belongs to graph identity, generated result, output reference, tag, context, review, template, compile policy, or routing.
2. reasonableness gate: reject or redirect edits that would make a file, prompt, tag, or one-off output into a species.
3. history gate: preserve understandable history; prefer archive, supersede, alias, or add over destructive rewrite when versions exist.
4. impact gate: identify downstream nodes, edges, PhenotypeVersion outdated risk, review records, compile artifact staleness, and storage-routing effects.
5. risk gate: assign low, medium, high, or structural risk using the scope levels above.
6. execution gate: choose no-write diagnosis, preview-confirm, change-set review, proposal, draft-write, or direct audit write for generated trace/output/audit records.

## Impact Rules

- Parent, edge, root, shared facet, template, compile-policy, group, bridge, and context changes can invalidate SpeciesCompileArtifact and PhenotypeCompileArtifact records.
- Upstream visual constraint changes should mark downstream PhenotypeVersion outdated instead of silently regenerating results.
- ContextReference and ContextReviewRubric changes may alter prompts, negative prompts, review checklists, or acceptance criteria.
- storage-routing changes may affect where new OutputReference records go, but they should not alter species identity.
- Metadata-only rename can be low risk if identity, inheritance, facets, and output references remain valid.

## Risk Escalation

- Low: additive single-node or single-edge change with no downstream generation impact.
- Medium: branch-local visual change, review checklist change, context revision, or bounded routing change.
- High: root, template, shared facet, compile-policy, group, or multi-parent change that may affect many descendants.
- Structural: split, merge, reparent, multi-group, cross-graph, bridge, or atlas-level change.

Escalate one level if current graph data is missing, existing outputs are accepted, or the change affects production library routing.

## Workflow

1. Normalize the user request into DNA object changes.
2. Compare the requested edit against current graph meaning.
3. Identify affected descendants, related context, compile artifacts, PhenotypeVersion records, output references, libraries, and routing policies.
4. Produce alternatives when the direct edit is risky.
5. Recommend the smallest reviewable write path.
6. Specify validation: impact check, review node/phenotype, compile artifact refresh, result regeneration decision, and storage routing check.

## Output Contract

Return an edit proposal with these fields:

- currentState: graph objects inspected and missing context.
- requestedChange: normalized edit intent and affected object types.
- scopeLevel: single-node, single-edge, single-group, multi-group, cross-graph, context, compile-policy, storage-routing, or mixed.
- reasonableness: pass, concern, or reject with rationale.
- impactAnalysis: downstream SpeciesNode, EvolutionEdge, context, compile artifact, PhenotypeVersion outdated, OutputReference, review, and routing implications.
- riskLevel: low, medium, high, or structural with concrete reason.
- alternatives: safer or more expressive options when risk is not low.
- compilePlan: whether SpeciesCompileArtifact or PhenotypeCompileArtifact should be refreshed, fixed, reviewed, or left unchanged.
- writeStrategy: no-write diagnosis, preview-confirm, change-set review, proposal, draft-write, or direct audit write.
- reviewChecklist: what the user should confirm before apply.
- assumptions: assumptions used.
- blockingQuestions: questions that block a safe edit.
- nonBlockingQuestions: questions that can remain unresolved.
- confidence: high, medium, or low with one concrete reason.

## Quality Bar

- The proposal states which 当前图谱 context was inspected and what is missing.
- The 合理性 check explains pass, concern, or rejection.
- 影响分析 names downstream graph, context, compile artifact, result, review, and storage-routing consequences.
- 风险等级 is tied to scope and downstream impact, not a generic label.
- 替代方案 is provided for medium, high, or structural changes.
- The write strategy stays reviewable through preview-confirm, change-set review, proposal, draft-write, or uses direct audit write only for generated trace/output/audit records.

## Guardrails

- Do not write directly to SQLite internals, exported JSON, or external asset storage by hand.
- Do not force a user request into graph identity when it belongs to Phenotype, OutputReference, AssetIndex, tag, context, review, or routing.
- Do not make existing reviews, compile artifacts, or PhenotypeVersion records misleading without marking impact.
- Do not treat regeneration as automatic; recommend it after version and impact review.
- Do not store API keys, credentials, complete private links, raw Agent host responses, or unrelated private project material.
