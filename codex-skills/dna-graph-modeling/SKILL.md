---
name: dna-graph-modeling
description: Build a new Design Network Atlas graph from a design scenario. Use when a user needs to map a game art system, UI/icon system, brand family, asset taxonomy, worldbuilding context, or rough visual domain into DNA graphs, groups, species, design relationships, facets, context, phenotype types, compile artifacts, and a reviewable write strategy.
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
| How does one same-level core entity derive from, align with, reference, or constrain another? | DesignRelationship |
| Which reusable dimensions describe many objects? | FacetDefinition, FacetSchema, GeneTemplate |
| Which background facts, motifs, principles, references, or review rules support generation? | DesignContext, ContextFact, ContextMotif, DesignPrinciple, ContextReference, ContextReviewRubric |
| Which design-language relationship spans groups or graphs at the same level? | DesignRelationship |
| What planned or concrete generated/curated output is needed? | planned Phenotype, PhenotypeVersion |
| Where will generated results or files be registered? | PhenotypeLibrary, StorageMount, OutputReference, AssetIndex |
| What compiled package should generation/review consume? | CompileFrame, EntityCompileArtifact, SpeciesCompileArtifact, PhenotypeCompileArtifact |

Use "phenotype library" as the plain-language connector for `PhenotypeLibrary` when discussing generated-result storage.

## Classification Matrix

| User concept is mostly... | Map to | Avoid |
| --- | --- | --- |
| Stable design identity | SpeciesNode | Phenotype or tag |
| Same-level design relationship | DesignRelationship | Child name only |
| Shared family or collection | SpeciesGroup | Repeated local node note |
| Reusable design dimension | facet/template | One-off context fact |
| Worldview, story, rationale, reference, or rubric | context object | Hidden node gene |
| Concrete generated or curated output | Phenotype or PhenotypeVersion | SpeciesNode |
| File path or external library item | OutputReference, AssetIndex, phenotype library | Graph identity |

## Decision Gates

Run these gates in order. If a gate cannot be answered, mark it as a blocking or non-blocking uncertainty instead of inventing missing facts.

1. domain-boundary gate: decide whether this is one graph, several graphs linked by graph-level DesignRelationship, or only a one-off output that should go to phenotype-generation instead.
2. group gate: decide whether families, factions, UI systems, regions, disciplines, or asset sets need SpeciesGroup boundaries.
3. relationship gate: decide whether group-level, graph-level, or node-level relationships are meaningful enough to record as DesignRelationship.
4. context gate: separate worldbuilding, design rationale, cultural motif, brand principle, reference, and review rubric from node genes or relationship contracts.
5. species gate: create SpeciesNode only for stable design objects that can pass phenotype readiness and produce multiple outputs.
6. relationship contract gate: create DesignRelationship only when there is a meaningful design-language contract, such as derivation, translation, alignment, divergence, reference, or constraint.
7. facet gate: define facets only for reusable dimensions with a value strategy, not one-off notes.
8. compile gate: decide whether atlas, graph, group, species, and phenotype layers should compile through system rules, fixed snapshots, manual/Agent decision patches, or a hybrid policy. Compile feedback can seed review questions or proposals, but it must not rewrite upstream graph/context/facet/template facts.
9. clarity gate: separate assumptions, blockingQuestions, nonBlockingQuestions, draftFields, and confidence.
10. execution gate: choose preview-confirm, change-set review, local proposal package, draft-write, or direct audit write for generated trace/output/audit records.

## Macro Workflow

Use these nine modules before listing SpeciesNode candidates. Each module contributes one section to the final modeling proposal.

## Scenario Lens

- Module question: What design-generation domain is being modeled, and which lens should shape the rest of the graph?
- Evidence to inspect: user goal, requested output types, discipline, reviewer role, existing source names or IDs, delivery surface, and whether the scenario is a game UI / icon system, character / equipment / prop visual system, monster / environment / worldbuilding object network, VFX / signal / audio cue system, brand / product visual family, or asset taxonomy / storage-heavy scenario.
- Decision boundary: choose a lens before listing species; if the user only asks for one prompt, one generated file, or one review result, redirect to phenotype-generation or output registration instead of graph modeling.
- Positive pattern: an icon family with reusable states and production review needs can become a graph lens.
- Counterexample: a single banner prompt with no stable object family is not enough for a new graph.
- Output contribution: graphScope, assumptions, blockingQuestions, and the lens note inside reviewOutline.

## Domain Split

- Module question: Is this one Graph, multiple Graph objects in an Atlas, or a one-off generated output?
- Evidence to inspect: production output type, reviewer or discipline, downstream consumption path, source boundaries, and whether relationships are inheritance or only reference, drive, consume, or review relationships.
- Decision boundary: split into multiple Graph objects when disciplines, output pipelines, or review ownership differ; connect them with graph-level DesignRelationship only when the relation spans graph boundaries without pretending to be inheritance.
- Positive pattern: UI icon assets and character equipment can be separate graphs connected by a graph-level DesignRelationship when they share a brand principle but have different reviewers and phenotype outputs.
- Counterexample: putting every department, storage folder, or page framework into one graph hides review ownership and downstream impact.
- Output contribution: graphScope, relationshipPlan, reviewOutline, and nonBlockingQuestions for unresolved graph boundaries.

## Group Organization

- Module question: Which SpeciesGroup boundaries are needed before species are proposed?
- Evidence to inspect: families, factions, components, disciplines, release slices, source batches, review units, shared context facts, and production ownership.
- Decision boundary: groups are review and production units, not decorative categories. Use SpeciesGroup for shared constraints or review ownership, DesignRelationship for meaningful group-level design relations, and avoid groups when only a tag or file folder is present.
- Positive pattern: a set of button states or monster roles sharing review criteria can be a group before individual drawable species are chosen.
- Counterexample: "all exported PNGs" is storage organization and belongs to phenotype library/routing, not a SpeciesGroup by itself.
- Output contribution: groupPlan, group-level relationships in reviewOutline, and firstSliceStrategy grouping.

## Phenotype Readiness

- Module question: Does each SpeciesNode candidate represent a drawable, reviewable stable object with explicit planned phenotype coverage?
- Evidence to inspect: source document, object ID or asset ID when available, expected first phenotype type, first visual deliverable, planned phenotype surfaces, drawable visual signal, negative boundary, and group membership.
- Decision boundary: SpeciesNode is a hard gate. Before creating a species candidate, answer: Can an artist or generator start drawing this object immediately? What planned phenotype surfaces should exist first? What is the expected first phenotype type? What source document, object ID, or asset ID confirms identity? Would this remain the same species if storage path, file format, prompt, provider, crop, size, seed, or output file changed? What negative boundary prevents over-broad interpretation?
- Positive pattern: "primary attack button icon, first phenotype type icon-prompt, source UI spec ID, negative boundary excludes page layout" can be a species candidate.
- Counterexample: visual language, UI system, ecosystem, production workflow, review standard, material library, storage directory, page framework, or counter relationship fails phenotype readiness and must use abstract system downgrade.
- Output contribution: strengthened speciesPlan with source evidence, object ID or asset ID, expected first phenotype type, planned phenotype surfaces, drawable visual signal, negative boundary, group membership, confidence, and draft fields; phenotypePlan entries for planned `Phenotype(status: planned)` containers.

## Relationship Semantics

- Module question: Which relationships are true inheritance and which are reference, driver, consumer, review, or shared context links?
- Evidence to inspect: parent roles, transformation deltas, preservation rules, source-to-target identity, production variants, cross-graph dependencies, and whether a child becomes an independent stable object.
- Decision boundary: prohibit fake inheritance. DesignRelationship is valid only when two same-level core entities have a real design-language contract. References, drivers, consumers, review rules, and shared semantics that are not between same-level core entities use context, facets, templates, or output provenance.
- Positive pattern: a battle-sprite species derived from a character-base species with preserved silhouette and altered pose can be a node-level DesignRelationship.
- Counterexample: "danger cue reminds reviewers of monster ecology" is context or review rationale, not a fake inheritance link.
- Output contribution: relationshipPlan and reviewOutline notes for multi-root graphs where no inheritance should be invented.

## Review Shape

- Module question: How should the graph be inspected by a human reviewer before writes are applied?
- Evidence to inspect: atlas, graph boundaries, group boundaries, roots, independent nodes, DesignRelationship endpoints, and unresolved assumptions.
- Decision boundary: reviewability is part of the model. If the graph tree is flat because nodes are independent roots, say that explicitly. If there are multiple roots with no real derivation, do not invent a relationship to make the tree look tidy.
- Positive pattern: a reviewOutline lists atlas -> graphs -> groups -> species nodes, DesignRelationship endpoints, and a note that independent roots are intentionally flat.
- Counterexample: a lineage tree that hides groups or makes fake parent relationships for readability is misleading.
- Output contribution: reviewOutline.

### Layered Compile Shape Check

- Check question: Will the proposed model produce meaningful atlas -> graph -> species-group -> species-node -> phenotype compile frames?
- Evidence to inspect: graph boundaries, group shared facts, same-level DesignRelationship contracts, context attachments and policies, facet assignments, template dimensions, planned phenotype surfaces, and task briefs.
- Decision boundary: if a lower layer reveals a missing upper-layer rule, record compile feedback or proposal seed instead of silently mutating the upper layer. LLM/Agent help may only enter as bounded decision requests and replayable decision patches.
- Positive pattern: a graph frame owns global visual rules, group frames own shared family constraints, species frames own drawable object constraints, and phenotype frames own task-specific prompt/review output.
- Counterexample: a prompt-only note with no graph/group/species evidence should not become a fake species just to satisfy compile.
- Output contribution: compilePlan, feedbackQuestions, and reviewOutline sections that say which frames should exist and which dependencies can become stale.

## First Slice Strategy

- Module question: What is the smallest useful first modeling slice that can be reviewed and expanded later?
- Evidence to inspect: first-release outputs, priority, available source evidence, stable object confidence, group coverage, and downstream compile/generation needs.
- Decision boundary: include only objects with enough evidence and immediate phenotype value. Exclude but name expandable objects when source is missing, priority is low, the item is not a stable object, not a first-release phenotype, or is only an abstract rule.
- Positive pattern: firstSliceStrategy includes one graph, two groups, three drawable species, one design relationship, and the minimum context/rubric needed for first generation.
- Counterexample: importing a full taxonomy of unverified names creates review debt and weakens confidence.
- Output contribution: firstSliceStrategy with included first-slice objects, excluded but expandable objects, and exclusion reasons.

## Write Strategy

- Module question: Which write boundary preserves reviewability and provenance?
- Evidence to inspect: uncertainty, number of objects, whether formal graph facts are inferred, whether generated trace/output/audit records are involved, and whether a local proposal package is needed.
- Decision boundary: formal graph/context/facet facts use preview-confirm, change-set review, or local proposal package. Generated trace/output/audit records and external pointers may use direct audit write or draft-write only through CLI/application service boundaries.
- Positive pattern: a large initial draft uses a local proposal package and a `dna.modeling-batch.v1` plan so several preview change-sets can be reviewed together. The batch may include facetDefinitions, facetSchemas, facetAssignments, and phenotypePlans when those concepts are evidence-backed.
- Counterexample: writing inferred graph facts directly because the batch is large bypasses the graph truth boundary.
- Output contribution: writeStrategy, modelingBatchPlan, expected review stage, modeling quality checks to run, blockingQuestions, and confidence.

## Case Patterns

- Module question: Which concise examples or counterexamples help apply the framework to this domain?
- Evidence to inspect: scenario lens, likely ambiguous nouns, expected output formats, storage/routing mentions, and review ownership.
- Decision boundary: use patterns to guide classification, not to force every scenario into a game-only model.
- Positive pattern: game UI: page framework as context/group fact; cards, buttons, tags, and states as species or phenotypes depending on stability.
- Counterexample: treating "Eagle folder path" as graph identity in a storage-heavy scenario; Eagle/NAS/Cocos/export paths are phenotype library/routing, not graph identity.
- Output contribution: objectClassification notes, assumptions, and reviewChecklist.

Required patterns:

- character / weapon: character, weapon, and equipment can be species; portrait, icon, and battle sprite are phenotypes unless each becomes its own stable design object.
- monster / ecology: ecology rules are context/group facts; concrete monsters, backgrounds, or areas can be species when drawable and reviewable.
- VFX / signal / audio: signal family is usually group/context; concrete cast, hit, danger, or settlement cues can be species or phenotype targets depending on stability.
- brand / product visual family: brand principle is context/facet; concrete logo, icon, package, or product variants can be species candidates.
- storage-heavy scenario: external library, export path, and routing policy stay in PhenotypeLibrary, StorageMount, ExternalLibraryMapping, LibraryRoutingPolicy, OutputReference, or AssetIndex.

## Output Contract

Return a structured modeling proposal with these fields:

- graphScope: graph id suggestion, purpose, boundaries, root candidates, and whether multiple graphs are required.
- objectClassification: user concepts mapped to Graph, SpeciesGroup, SpeciesNode, DesignRelationship, facet, context, Phenotype, OutputReference, or unresolved.
- groupPlan: SpeciesGroup candidates with rationale.
- relationshipPlan: DesignRelationship candidates with source endpoint, target endpoint, endpoint level, type, direction, transfer rule, must preserve, must avoid, review questions, and why the relationship is not only context or output provenance.
- reviewOutline: atlas -> graphs -> groups -> species nodes, DesignRelationship endpoints, explicit note when graph tree is flat because nodes are independent roots, and explicit note for multi-root graphs where no inheritance should be invented.
- speciesPlan: SpeciesNode candidates with parent candidates, role, level, category, status, source evidence, object ID or asset ID when available, expected first phenotype type, drawable visual signal, negative boundary, group membership, confidence, draft fields, and rationale.
- contextPlan: DesignContext, ContextFact, ContextMotif, DesignPrinciple, ContextReference, and ContextReviewRubric candidates.
- facetTemplatePlan: required, recommended, and optional facets with value strategy.
- phenotypePlan: planned phenotype containers with phenotypeId, graphId, nodeId, phenotypeType, name, objectBrief, expectedAssetTypes, review needs, and output/library routing; generated versions/jobs remain out of the modeling batch.
- compilePlan: suggested CompilePolicy, compileMode, conflict strategy, expected SpeciesCompileArtifact and PhenotypeCompileArtifact contents.
- firstSliceStrategy: included first-slice objects, excluded but expandable objects, and exclusion reasons such as source missing, low priority, not stable object, not first-release phenotype, or abstract rule.
- writeStrategy: preview-confirm, change-set review, local proposal package, draft-write, or direct audit write with reason.
- modelingBatchPlan: when a local proposal package is appropriate, state whether to produce `dna.modeling-batch.v1`, list included object sections including facets and phenotypePlans when relevant, note references that must resolve before import, and identify quality-check risks such as broad nodes, fake output species, weak relationships, or missing facet/context coverage.
- assumptions: facts treated as assumptions.
- blockingQuestions: questions that materially change graph structure or write safety.
- nonBlockingQuestions: questions that can remain unresolved for a draft or preview.
- draftFields: fields that should stay draft until confirmed.
- confidence: high, medium, or low with one concrete reason.

## Quality Bar

- Every SpeciesNode has a stable identity and a reason it is not just one generated result.
- Every SpeciesNode passes phenotype readiness and has planned phenotype coverage when generation/review outputs are expected; unclear candidates become context, group facts, facets, planned phenotype surfaces, or unresolved items instead of species.
- Abstract system downgrade is explicit when visual language, UI system, ecosystem, workflow, review standard, material library, storage directory, page framework, or counter relationship appears.
- Every DesignRelationship describes the design-language contract, not only the target label.
- Fake inheritance is rejected even when it would make the graph tree easier to read.
- Facets are reusable dimensions with a value strategy.
- Context facts and motifs stay separate from reusable facets.
- Phenotype and phenotype library decisions stay decoupled from graph identity.
- Planned phenotype containers are allowed in modeling batches; concrete PhenotypeVersion, GenerationJob, AssetIndex, and OutputReference records stay in their own generation/output boundaries.
- The write strategy explains why it is preview-confirm, change-set review, local proposal package, draft-write, or direct audit write.
- `待确认问题` contains only questions that materially change the graph model or write safety.

## Guardrails

- Do not invent domain facts, lore, style history, storage locations, or user decisions.
- Do not turn a single generated image, prompt, file variant, size, or angle into a SpeciesNode.
- Do not hide storage concerns inside graph identity; bind graphs and result libraries explicitly.
- Do not treat custom relation types as fixed compile rules. They can be included as trace/context for Agent-assisted compile.
- Do not bypass DNA service, CLI, change-set, or local proposal package write flows.
- Do not include API keys, provider credentials, passwords, complete private links, generation jobs, phenotype versions, assets, output references, review records, or impact records in `dna.modeling-batch.v1`; those records use their own service boundaries. Use `phenotypePlans` only for planned result containers, not completed generation attempts.
- Do not store API keys, credentials, complete private links, raw Agent host responses, or unrelated private project material.
