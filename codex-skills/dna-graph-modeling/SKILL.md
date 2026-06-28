---
name: dna-graph-modeling
description: Build a new Design Network Atlas graph from a design scenario. Use when a user needs to map a game art system, UI/icon system, brand family, asset taxonomy, worldbuilding context, or rough visual domain into DNA graphs, groups, species, evolution edges, facets, context, phenotype types, compile artifacts, and a reviewable write strategy.
---

# DNA Graph Modeling

Use this skill when the user has a design domain but not yet a reliable DNA graph. The skill's job is scenario mapping and graph modeling, not CLI documentation. Use `dna --help` only when command syntax is explicitly needed.

Use `docs/design/concept-registry.md` as the canonical terminology boundary when a user concept could map to several DNA objects.
Use `docs/design/write-boundary-matrix.md` for write strategy vocabulary: formal graph/context/facet facts use preview-confirm or change-set review; generated trace/output/audit records use direct audit write or draft-write only through CLI/application service boundaries.

## Core Principle

Model stable design meaning first, then decide how it should be written. A good result separates design identity, inheritance, reusable dimensions, background context, generated outputs, and storage routing.

For Chinese responses, keep these review anchors when useful: `直接生效`, `待确认问题`, `表型库`, and `素材/生成结果`.

## Concept Map

| Design question | DNA object |
| --- | --- |
| What domain or product visual system is being modeled? | Graph |
| Which stable families or systems need shared context? | SpeciesGroup |
| What stable design object can generate many outputs? | SpeciesNode |
| How does a child object evolve from parent constraints? | EvolutionEdge |
| Which reusable dimensions describe many objects? | FacetDefinition, FacetSchema, GeneTemplate |
| Which background facts, motifs, principles, references, or review rules support generation? | DesignContext, ContextFact, ContextMotif, DesignPrinciple, ContextReference, ContextReviewRubric |
| Which relationship spans groups or graphs? | SpeciesGroupRelation, GraphBridge |
| What concrete generated or curated output is needed? | Phenotype, PhenotypeVersion |
| Where will generated results or files be registered? | PhenotypeLibrary, StorageMount, OutputReference, AssetIndex |
| What compiled package should generation/review consume? | SpeciesCompileArtifact, PhenotypeCompileArtifact |

Use "phenotype library" as the plain-language bridge for `PhenotypeLibrary` when discussing generated-result storage.

## Classification Matrix

| User concept is mostly... | Map to | Avoid |
| --- | --- | --- |
| Stable design identity | SpeciesNode | Phenotype or tag |
| Parent-to-child transformation | EvolutionEdge | Child name only |
| Shared family or collection | SpeciesGroup | Repeated local node note |
| Reusable design dimension | facet/template | One-off context fact |
| Worldview, story, rationale, reference, or rubric | context object | Hidden node gene |
| Concrete generated or curated output | Phenotype or PhenotypeVersion | SpeciesNode |
| File path or external library item | OutputReference, AssetIndex, phenotype library | Graph identity |

## Decision Gates

Run these gates in order. If a gate cannot be answered, mark it as a blocking or non-blocking uncertainty instead of inventing missing facts.

1. domain-boundary gate: decide whether this is one graph, several graphs linked by GraphBridge, or only a one-off output that should go to phenotype-generation instead.
2. group gate: decide whether families, factions, UI systems, regions, disciplines, or asset sets need SpeciesGroup boundaries.
3. bridge gate: decide whether cross-group or cross-graph relationships are meaningful enough to record as SpeciesGroupRelation or GraphBridge.
4. context gate: separate worldbuilding, design rationale, cultural motif, brand principle, reference, and review rubric from node or edge genes.
5. species gate: create SpeciesNode only for stable design objects that can inherit constraints and produce multiple outputs.
6. evolution gate: create EvolutionEdge only when there is a parent-to-child transformation with meaningful deltas or preservation rules.
7. facet gate: define facets only for reusable dimensions with a value strategy, not one-off notes.
8. compile gate: decide whether species should compile through system rules, fixed snapshots, Agent-assisted conflict review, or a hybrid policy.
9. clarity gate: separate assumptions, blockingQuestions, nonBlockingQuestions, draftFields, and confidence.
10. execution gate: choose preview-confirm, change-set review, local proposal package, draft-write, or direct audit write for generated trace/output/audit records.

## Modeling Workflow

1. Extract the design scenario.
   - Identify domain, user goal, target outputs, existing libraries, and whether generation, curation, or both are expected.
   - Split confirmed facts from assumptions.

2. Classify candidate concepts.
   - Stable identity becomes SpeciesNode.
   - Transformation becomes EvolutionEdge.
   - Shared collection or family boundary becomes SpeciesGroup.
   - Reusable descriptive dimension becomes facet or template.
   - Worldview, story, culture, rationale, or source reference becomes context.
   - Concrete output becomes Phenotype or PhenotypeVersion.
   - File or external library location becomes OutputReference or AssetIndex.

3. Build the initial graph structure.
   - Allow multiple root SpeciesNode entries when the domain has independent starting points.
   - Allow multiple parents only when the child genuinely merges constraints from distinct parent roles.
   - Use SpeciesGroupRelation and GraphBridge for important non-inheritance relationships.

4. Define genes and facets conservatively.
   - Start with required and recommended facets only.
   - Keep facts and motifs outside facets when they may apply to multiple concept objects.
   - Note where a custom facet value or custom relation type should be handled by Agent-assisted compile instead of fixed rules.

5. Plan compile artifacts.
   - SpeciesCompileArtifact should explain resolved genes, trace, conflicts, open questions, and why Agent host suggestions are advisory.
   - PhenotypeCompileArtifact should turn accepted species/context constraints into a prompt, brief, negative prompt, generation constraints, and review checklist.
   - Do not create a standalone artifact skill. Artifacts are persisted compile outputs; skills are scenario workflows.

6. Pick the write strategy.
   - Use preview-confirm for normal single-object writes.
   - Use change-set review for several related node/edge/template edits.
   - Use a local proposal package for initial multi-node trees, group systems, bridges, or high-uncertainty modeling that should review several preview change-sets together.
   - For large initial modeling drafts, prepare a `dna.modeling-batch.v1` JSON file for `dna proposal import-batch --in <file>` instead of listing dozens of one-off commands. The batch format may include graphs, atlases, species groups, group memberships, group relations, graph bridges, species nodes, evolution edges, phenotype libraries, library graph bindings, storage mounts, external library mappings, and library routing policies.
   - Use draft-write only when the user wants visible but non-final graph objects or explicitly draft generated trace/output records.
   - Use direct audit write only for generated trace/output/audit records and external pointers through CLI/application service boundaries.

## Output Contract

Return a structured modeling proposal with these fields:

- graphScope: graph id suggestion, purpose, boundaries, root candidates, and whether multiple graphs are required.
- objectClassification: user concepts mapped to Graph, SpeciesGroup, SpeciesNode, EvolutionEdge, facet, context, Phenotype, OutputReference, or unresolved.
- groupPlan: SpeciesGroup and SpeciesGroupRelation candidates with rationale.
- bridgePlan: GraphBridge candidates, compile relevance, and why a simple parent edge is not enough.
- speciesPlan: SpeciesNode candidates with parent candidates, role, level, category, status, and rationale.
- evolutionPlan: EvolutionEdge candidates with source, target, parent role, direction, delta genes, must preserve, must avoid, and conflict notes.
- contextPlan: DesignContext, ContextFact, ContextMotif, DesignPrinciple, ContextReference, and ContextReviewRubric candidates.
- facetTemplatePlan: required, recommended, and optional facets with value strategy.
- phenotypePlan: generated result types, expected variants, review needs, and output/library routing.
- compilePlan: suggested CompilePolicy, compileMode, conflict strategy, expected SpeciesCompileArtifact and PhenotypeCompileArtifact contents.
- writeStrategy: preview-confirm, change-set review, local proposal package, draft-write, or direct audit write with reason.
- modelingBatchPlan: when a local proposal package is appropriate, state whether to produce `dna.modeling-batch.v1`, list included object sections, and note references that must resolve before import.
- assumptions: facts treated as assumptions.
- blockingQuestions: questions that materially change graph structure or write safety.
- nonBlockingQuestions: questions that can remain unresolved for a draft or preview.
- draftFields: fields that should stay draft until confirmed.
- confidence: high, medium, or low with one concrete reason.

## Quality Bar

- Every SpeciesNode has a stable identity and a reason it is not just one generated result.
- Every EvolutionEdge describes the transformation, not only the child label.
- Facets are reusable dimensions with a value strategy.
- Context facts and motifs stay separate from reusable facets.
- Phenotype and phenotype library decisions stay decoupled from graph identity.
- The write strategy explains why it is preview-confirm, change-set review, local proposal package, draft-write, or direct audit write.
- `待确认问题` contains only questions that materially change the graph model or write safety.

## Guardrails

- Do not invent domain facts, lore, style history, storage locations, or user decisions.
- Do not turn a single generated image, prompt, file variant, size, or angle into a SpeciesNode.
- Do not hide storage concerns inside graph identity; bind graphs and result libraries explicitly.
- Do not treat custom relation types as fixed compile rules. They can be included as trace/context for Agent-assisted compile.
- Do not bypass DNA service, CLI, change-set, or local proposal package write flows.
- Do not include API keys, provider credentials, passwords, complete private links, generation jobs, phenotype versions, assets, output references, review records, or impact records in `dna.modeling-batch.v1`; those records use their own service boundaries.
- Do not store API keys, credentials, complete private links, raw Agent host responses, or unrelated private project material.
