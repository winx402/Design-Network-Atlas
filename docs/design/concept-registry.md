# DNA Concept Registry

状态：active
最后审阅：2026-06-27
来源级别：product terminology registry
实现真源：`packages/core`

This registry owns public DNA product terminology. It does not create parallel domain models; implementation schemas and behavior remain in `packages/core`, while storage, CLI, server, web, and skills use this registry to avoid redefining concepts.

DNA concept classes:

- durable design facts: graph, species, edge, group, atlas, design context, facet, and template facts that describe design meaning.
- compiled views: species and phenotype compile artifacts that turn durable facts into prompt, brief, trace, and review packages.
- runtime jobs: generation or orchestration attempts such as `GenerationJob`.
- generated outputs: `Phenotype` and immutable `PhenotypeVersion` records.
- external pointers: `OutputReference` and `AssetIndex` records that point to files, tools, or external libraries without storing binaries.
- audit records: review, impact, and change-set records that explain decisions and downstream consequences.

## Registry

| Concept | Owner | Purpose | Lifecycle | Write entrypoint | Export path | Related concepts |
| --- | --- | --- | --- | --- | --- | --- |
| `Graph` | core graph model | Names one design universe and its compile defaults. | Created as a durable design fact; archived by status. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/graph.json` | `SpeciesNode`, `EvolutionEdge`, `SpeciesGroup`, `PhenotypeLibraryGraphBinding` |
| `SpeciesNode` | core species model | Represents a stable design object that can inherit constraints and generate many outputs. | Created and versioned through `NodeVersion`; archived by status. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/nodes/` | `NodeVersion`, `EvolutionEdge`, `Phenotype`, `ContextAttachment` |
| `NodeVersion` | core species version model | Immutable snapshot of a species node's resolved design facts at a point in time. | Append-only after creation. | Created by node service flows; no generic content update. | `graphs/<graph_id>/nodes/` payload | `SpeciesNode`, `SpeciesCompileArtifact` |
| `EvolutionEdge` | core lineage model | Describes parent-to-child design transformation, preservation rules, deltas, and badcases. | Created and versioned through `EdgeVersion`; archived by status. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/edges/` | `EdgeVersion`, `SpeciesNode`, `ImpactRecord` |
| `EdgeVersion` | core lineage version model | Immutable snapshot of an evolution edge's transformation rules. | Append-only after creation. | Created by edge service flows; no generic content update. | `graphs/<graph_id>/edges/` payload | `EvolutionEdge`, `SpeciesCompileArtifact` |
| `SpeciesGroup` | core grouping model | Groups species inside one graph for families, collections, systems, or layers. | Durable design fact; memberships and relations can change by reviewable writes. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/groups/` | `SpeciesGroupMembership`, `SpeciesGroupRelation` |
| `SpeciesGroupMembership` | core grouping model | Connects one species node to one group with a role. | Durable design fact for graph organization. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/group-memberships/` | `SpeciesGroup`, `SpeciesNode` |
| `SpeciesGroupRelation` | core grouping model | Connects groups inside one graph. Use it for same-graph group relationships, not cross-graph atlas links. | Durable design fact. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/group-relations/` | `SpeciesGroup`, `GraphBridge` |
| `Atlas` | core atlas model | Groups several graphs into one higher-level map. | Durable design fact. | Preview/change-set through CLI or application service. | `atlases/<atlas_id>/atlas.json` | `GraphBridge` |
| `GraphBridge` | core atlas model | Connects graphs inside an atlas. Use it for cross-graph relationships, not same-graph group relations. | Durable design fact. | Preview/change-set through CLI or application service. | `atlases/<atlas_id>/bridges/` | `Atlas`, `SpeciesGroupRelation` |
| `DesignContext` | core context model | Holds governed background context such as worldbuilding, brand, platform, or production rationale. | Durable design fact; context child records attach evidence and policy. | Preview/change-set through CLI or application service. | `contexts/contexts/` | `ContextFact`, `ContextMotif`, `ContextReference`, `ContextReviewRubric` |
| `ContextFact` | core context model | Records a governed contextual statement with type, source, confidence, and default behavior. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/facts/` | `DesignContext`, `ContextAttachment` |
| `ContextMotif` | core context model | Records a governed narrative, cultural, symbolic, or visual motif statement with source/confidence. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/motifs/` | `SpeciesNode.motifs`, facets |
| `DesignPrinciple` | core context model | Records a reusable design principle or direction. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/principles/` | `DesignContext`, `PhenotypeCompileArtifact` |
| `ContextReference` | core context model | Records source references, examples, badcases, evidence, and decisions. | Durable design fact or governed reference. | Preview/change-set through CLI or application service. | `contexts/references/` | `ContextReviewRubric`, `OutputReference` |
| `ContextReviewRubric` | core context model | Defines review criteria. It is not an evaluation result. | Durable review criterion. | Preview/change-set through CLI or application service. | `contexts/review-rubrics/` | `ReviewRecord` |
| `ContextAttachment` | core context model | Attaches context records to graph, node, edge, group, bridge, or phenotype targets. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/attachments/` | `DesignContext`, compile artifacts |
| `ContextPolicy` | core context model | Controls compile, review, impact, priority, and resolution participation for context. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/policies/` | `SpeciesCompileArtifact`, `ImpactRecord` |
| `FacetDefinition` | core facet taxonomy | Names reusable cross-object classification dimensions. | Durable taxonomy fact. | Preview/change-set for user-authored taxonomy; direct only for trusted imports. | `facets/definitions/` | `FacetSchema`, `FacetAssignment`, `GeneTemplate.dimensionSchema` |
| `FacetSchema` | core facet taxonomy | Defines allowed values and shape for a facet. | Durable taxonomy fact. | Preview/change-set for user-authored taxonomy; direct only for trusted imports. | `facets/schemas/` | `FacetDefinition` |
| `FacetAssignment` | core facet taxonomy | Assigns facet values to graph, species, phenotype, context, library, or other targets. | Durable classification fact. | Preview/change-set for user-authored assignments; direct only for trusted imports. | `facets/assignments/` | `SpeciesNode.constraints`, `GeneTemplate.dimensionSchema` |
| `TemplatePack` | core template model | Packages reusable template content. `TemplatePack.version` is the pack content version. | Direct admin write after compatibility validation. | Template/application service or CLI template install. | `templates/` | `GeneTemplate` |
| `GeneTemplate` | core template model | Defines reusable design dimensions, required/recommended data, and review questions. `GeneTemplate.version` is the template definition version. | Direct admin write after compatibility validation. | Template/application service or CLI template install. | `templates/` | `FacetDefinition`, `SpeciesNode.constraints` |
| `SpeciesCompileArtifact` | core compile model | Compiles a species target into resolved genes, trace, conflicts, and open questions. | Compiled view; preview for standalone compile, direct audit write during formal generation apply. | Application service or CLI compile/generate flows. | `graphs/<graph_id>/compile/species/` | `PhenotypeCompileArtifact`, `NodeVersion` |
| `PhenotypeCompileArtifact` | core compile model | Compiles generation prompt, negative prompt, brief, generation constraints, and review checklist from a species artifact. | Compiled view; preview for standalone compile, direct audit write during formal generation apply. | Application service or CLI compile/generate flows. | `graphs/<graph_id>/compile/phenotypes/` | `SpeciesCompileArtifact`, `PhenotypeVersion` |
| `Phenotype` | core generated-output model | Stable generated or curated result object for a species and phenotype type. | Generated output container; archived by status. | Application service or CLI generated-output flows. | `graphs/<graph_id>/phenotypes/` | `PhenotypeVersion`, `OutputReference` |
| `PhenotypeVersion` | core generated-output model | Immutable generated output snapshot. Formal generation records `speciesCompileArtifactId`, `phenotypeCompileArtifactId`, `compileArtifactSnapshot`, `generationRecipe`, and `promptSnapshot` as captured provenance, not a runtime attempt. | content immutable after creation; only lifecycle status can change through the status-only repository path and `assertCanTransitionStatus`. | Application service or CLI generated-output/status flows. | `graphs/<graph_id>/phenotypes/` payload | `PhenotypeCompileArtifact`, `GenerationJob`, `ReviewRecord`, `AssetIndex` |
| `GenerationJob` | core generation model | Records one execution attempt, provider/tool summary, sanitized inputs, outputs, failure category, and formal generation artifact IDs. | Runtime job/audit record. | Application service or CLI provider/generation flows. | `graphs/<graph_id>/generation-jobs/` | `PhenotypeVersion.generationRecipe`, provider contracts |
| `AssetIndex` | core external-pointer model | Indexes a physical or external asset pointer, such as file, library item, preview, source, runtime export, or variant. | External pointer; no binary ownership. | Direct audit/admin write through CLI/application service. | `graphs/<graph_id>/assets/` | `OutputReference`, `PhenotypeVersion` |
| `OutputReference` | core external-pointer model | Records the semantic generated deliverable relationship to phenotype version, library, role, and review flow. | External pointer/governance record. | Direct audit/admin write through CLI/application service. | `graphs/<graph_id>/output-references/` | `AssetIndex`, `PhenotypeLibrary`, `StorageMount` |
| `PhenotypeLibrary` | core library model | Optional generated-result catalog. `graphIds` is compatibility/summary metadata, not the canonical binding record. | Direct admin write; status controls lifecycle. | CLI/application service library flows. | `libraries/<library_id>/library.json` | `PhenotypeLibraryGraphBinding`, `StorageMount` |
| `PhenotypeLibraryGraphBinding` | core library model | Canonical graph/library binding with role, status, and sync policy. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/bindings/` | `PhenotypeLibrary.graphIds` |
| `StorageMount` | core library model | Describes one external storage target and capabilities. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/mounts/` | `LibraryRoutingPolicy`, `OutputReference` |
| `ExternalLibraryMapping` | core library model | Maps external system metadata fields to DNA metadata. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/mappings/` | `StorageMount`, `AssetIndex` |
| `LibraryRoutingPolicy` | core library model | Chooses default output storage mount by generated-result type, role, reference type, tags, and metadata requirements. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/routing-policies/` | `OutputReference`, `StorageMount` |
| `ReviewRecord` | core governance model | Stores an evaluation result. It is not the rubric definition. | Direct audit write. | CLI/application service review flows. | `graphs/<graph_id>/reviews/` | `ContextReviewRubric`, `PhenotypeVersion` |
| `ImpactRecord` | core governance model | Records downstream consequences after an upstream change; it does not rewrite affected objects. | Direct audit write. | CLI/application service impact flows. | `graphs/<graph_id>/impacts/` | `SpeciesNode`, `EvolutionEdge`, `PhenotypeVersion` |
| `ChangeSet` | core governance model | Reviewable preview of formal durable changes. | Preview, review, apply, discard. | CLI/application service change-set flows. | `change-sets/` | formal graph/context/facet facts |

## Boundary Decisions

### `SpeciesNode.motifs` vs `ContextMotif` vs facets

`SpeciesNode.motifs` are lightweight node-level motif labels. `ContextMotif` is a governed design-context statement with source, confidence, and participation policy. Facets are structured tagging or classification taxonomy, not narrative motif facts.

### `AssetIndex` vs `OutputReference`

`AssetIndex` indexes physical or external asset pointers. `OutputReference` records the semantic generated deliverable relationship to a phenotype version, library, output role, and review flow. A single phenotype version may have both.

### `PhenotypeLibrary.graphIds` vs `PhenotypeLibraryGraphBinding`

`PhenotypeLibraryGraphBinding` is canonical for graph/library role, status, and sync policy. `PhenotypeLibrary.graphIds` is retained as compatibility and summary metadata for import/export and simpler readers.

### `SpeciesGroupRelation` vs `GraphBridge`

`SpeciesGroupRelation` connects groups inside one graph. `GraphBridge` connects graphs inside an atlas. Cross-graph meaning should not be squeezed into a same-graph group relation.

### `GenerationJob` vs `PhenotypeVersion.generationRecipe/promptSnapshot`

`GenerationJob` is an execution attempt and may fail. `PhenotypeVersion` is an immutable generated output snapshot; `generationRecipe` and `promptSnapshot` are provenance captured on that version.

### `ReviewRecord` vs `ContextReviewRubric`

`ContextReviewRubric` defines review criteria. `ReviewRecord` stores a review result, including conclusion, missing dimensions, constraint violations, and confirmation state.

### facet/template/node constraints

`FacetDefinition`, `FacetSchema`, and `FacetAssignment` define cross-object classification taxonomy. `GeneTemplate.dimensionSchema` guides required, recommended, optional, or forbidden design data. `SpeciesNode.constraints` are object-specific requirements and limits.

### template compatibility

Template compatibility is not root project version compatibility. `TemplatePack.version` is the pack content version, `GeneTemplate.version` is the template definition version, `compatibility.dnaSchema` declares supported DNA schema compatibility, and `compatibility.capabilities` declares required product capabilities.
