---
name: dna-graph-modeling
description: Build a new Design Network Atlas graph from a user scenario. Use when the user has a project, design domain, game art system, UI/icon system, asset taxonomy, brand visual system, or rough concept and needs help mapping it into Graph, SpeciesNode, EvolutionEdge, facets, facts, Phenotype types, phenotype library routing, and a preview, change-set review, or proposal write strategy.
---

# DNA Graph Modeling

Use this skill to turn an ambiguous design scenario into a DNA graph plan. The job is not to explain CLI syntax; the job is to decide what the graph should mean.

Use `dna --help` and subcommand help such as `dna node create --help` for CLI syntax. Do not turn this skill into command documentation.

## Decision Gates

Run these gates before proposing objects:

1. Scope gate: decide whether the user is modeling a design graph, a phenotype library, or only a one-off generation task. If it is only a one-off output, do not force a graph.
2. Identity gate: decide what remains stable across many outputs. Only stable identities become SpeciesNode entries.
3. Inheritance gate: decide which constraints should be inherited through parentage, which should be stored as facts/motifs, and which are local Phenotype requirements.
4. Variation gate: decide whether differences are EvolutionEdge deltas, facets values, Phenotype variants, or asset storage metadata.
5. Governance gate: decide whether the proposal can be preview-confirmed, needs change-set review, or is large enough to require proposal semantics.

If a gate cannot be answered from the user input, ask one focused question or mark the field as unresolved. Do not fill the graph with plausible but unconfirmed domain facts.

## Classification Matrix

Use this matrix to avoid shallow or wrong mappings:

| User concept is mostly... | Map to | Do not map to |
| --- | --- | --- |
| Stable design identity that can inherit and generate many results | SpeciesNode | Phenotype or tag |
| Transformation from one stable identity to another | EvolutionEdge | Child name or facet |
| Reusable descriptive dimension such as silhouette, material, palette, role, state, rarity, density, mood, affordance | facet | SpeciesNode |
| Cross-cutting lore, brand rule, motif, setting fact, or constraint reused by multiple objects | fact/motif | facet value hidden in one node |
| Concrete output for a task, prompt, brief, generated image group, concept sheet, icon set, model brief, animation brief | Phenotype | SpeciesNode |
| File path, external library item, Eagle item, NAS object, Git blob, runtime export copy | AssetIndex or phenotype library mount | graph identity |
| Search term, workflow state, review label, owner label | tag/metadata | EvolutionEdge |

Escalate to multiple root SpeciesNode entries when the domain has separate starting identities. Use multiple parents only when the child genuinely merges inherited constraints from parent roles; otherwise prefer facets or facts.

## Workflow

1. Understand the scenario.
   - Identify project/domain, intended production outputs, team workflow, existing asset libraries, and whether this is one graph or multiple graphs.
   - Separate confirmed facts from assumptions. Put uncertain points into `待确认问题`.

2. Inventory design objects.
   - Extract candidate stable design objects, reusable motifs/facts, visual constraints, output needs, and storage needs.
   - Classify each candidate as Graph, SpeciesNode, EvolutionEdge, facet, fact/motif, Phenotype, AssetIndex, phenotype library, tag, or unresolved.

3. Divide SpeciesNode boundaries.
   - Make a SpeciesNode only for a stable design object that can inherit constraints and produce multiple results.
   - Do not create a SpeciesNode for a single generated image, a size variant, an angle, a file format, a transient prompt, or a pure tag.
   - Allow multiple root SpeciesNode entries when the domain has independent starting species.
   - Allow multiple parents when the child genuinely combines inherited constraints from distinct parent roles.

4. Design EvolutionEdge relationships.
   - Use EvolutionEdge for the meaningful transformation from parent to child: style overlay, structure change, material change, faction change, rarity change, function constraint, platform adaptation, or composition fusion.
   - Name the edge by the transformation, not by the child object.
   - Record edge deltas as structured constraints when possible; keep narrative notes only when the design decision is not yet structured.

5. Define facets and templates.
   - Use facets for design dimensions that matter repeatedly in the domain.
   - Prefer a small first template with required, recommended, and optional facets.
   - Keep facts/motifs separate from facets: facts can apply across many concepts; facets define the dimensions used to describe a concept.

6. Design Phenotype outputs.
   - For each important SpeciesNode, list expected Phenotype types: image prompt, concept art brief, UI icon, model brief, animation brief, sound brief, runtime export, document, dataset, or custom type.
   - Record when one Phenotype version may contain multiple assets, such as size variants, crop variants, angles, layers, or storage mirrors.
   - Decide whether the graph needs a phenotype library and whether it should route to one logical library with multiple storage mounts.

7. Choose write strategy.
   - Use `直接生效` only for small, explicit, low-risk graph seeds the user has already confirmed.
   - Use `preview-confirm` for normal single-object writes.
   - Use `change-set review` for a bounded set of SpeciesNode or EvolutionEdge changes that should be reviewed before application.
   - Use `proposal` for multi-node trees, multi-parent fusion, template design, or initial graph construction that needs human review as a batch.
   - Use draft status for unclear concepts that should be visible but not treated as final graph truth.

## Modeling Heuristics

- If a concept answers "what stable thing can produce many generated or collected results?", it is likely a SpeciesNode.
- If a concept answers "how did this child differ from its parent?", it is likely an EvolutionEdge.
- If a concept answers "which dimension should every similar object carry?", it is likely a facet.
- If a concept answers "what concrete generated or curated result exists for this task?", it is likely a Phenotype.
- If a concept answers "where is the actual file or external object?", it is likely AssetIndex or phenotype library storage metadata.

## Quality Bar

A useful graph modeling result must satisfy all of these:

- Every proposed SpeciesNode has a stable identity, a reason it is not just a Phenotype, and either a root reason or parent candidates.
- Every proposed EvolutionEdge states the transformation delta and the parent role; it is not just a relationship label.
- Every facet is reusable across multiple objects and has a clear value strategy: enum, free text, number, boolean, reference, or custom.
- Facts/motifs are separated from facets and can apply to more than one object.
- Phenotype types explain what will be generated or curated, and whether one Phenotype version can own multiple assets.
- The phenotype library recommendation keeps graph identity decoupled from storage, with one logical library and multiple mounts unless governance boundaries require otherwise.
- The write strategy explains why it is directly applied, preview-confirmed, change-set reviewed, proposal-based, or draft-only.
- The proposal lists only material unresolved questions, not generic discovery questions.

## Required Output

Return a modeling proposal with these sections:

- Graph scope: graph id suggestion, purpose, root SpeciesNode candidates, and whether multiple graphs are needed.
- Object classification: table of user concepts mapped to DNA object types.
- Species plan: SpeciesNode list with parent candidates, level, category, status, and rationale.
- Evolution plan: EvolutionEdge list with source, target, parent role, direction, delta, and conflict notes.
- Facets/template plan: required, recommended, optional facets, plus reusable facts/motifs.
- Phenotype plan: Phenotype types, expected asset variants, and phenotype library routing.
- Write strategy: directly apply, preview-confirm, change-set review, proposal, or draft-write with reason.
- 待确认问题: only questions that materially change the graph model.

## Guardrails

- Do not pretend unknown domain facts are confirmed.
- Do not flatten everything into a tree if multiple roots or multiple parents better represent the design relationship.
- Do not put storage concerns into graph identity; connect graph and phenotype library through bindings and routing.
- Do not bypass DNA service/CLI write flows. After the model is accepted, express persistence as preview, change-set review, or proposal operations.
- Do not include secrets, provider credentials, complete private links, or unrelated private project material in the graph proposal.
