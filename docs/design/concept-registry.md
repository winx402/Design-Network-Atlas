# DNA Concept Registry

状态：active
最后审阅：2026-06-28
来源级别：product terminology registry
实现真源：`packages/core`

This registry owns public DNA product terminology. It does not create parallel domain models; implementation schemas and behavior remain in `packages/core`, while storage, CLI, server, web, and skills use this registry to avoid redefining concepts.

DNA concept classes:

- Legacy documentation grouped these as durable design facts, compiled views, runtime jobs, generated outputs, external pointers, and audit records; the current public taxonomy below keeps those meanings while clarifying relationship boundaries.
- Core Entity: `Atlas`, `Graph`, `SpeciesGroup`, and `SpeciesNode` define stable design identity and hierarchy.
- Auxiliary Semantics: Context, Facet, Rubric, and Template records provide meaning, evidence, constraints, classification, review criteria, and reusable schema.
- Organization Relationship: containment and membership keep atlases, graphs, groups, and nodes organized without adding design-language meaning.
- Auxiliary Attachment Relationship: `ContextAttachment`, `ContextPolicy`, and `FacetAssignment` attach auxiliary semantics to entities or relationships.
- Output/Provenance Relationship: `Phenotype`, `PhenotypeVersion`, `GenerationJob`, `OutputReference`, and `AssetIndex` record generation lineage, outputs, and external pointers.
- DesignRelationship: a same-level design-language relationship between two core entities.
- Governance/Audit: review, impact, change-set, and proposal records explain decisions and downstream consequences.

## Registry

| Concept | Owner | Purpose | Lifecycle | Write entrypoint | Export path | Related concepts |
| --- | --- | --- | --- | --- | --- | --- |
| `Atlas` | core entity model | Names a multi-graph workspace or map. | Durable design fact; archived by status. | Preview/change-set through CLI or application service. | `atlases/<atlas_id>/atlas.json` | `Graph`, `DesignRelationship` |
| `Graph` | core entity model | Names one design production domain and its compile defaults. | Durable design fact; archived by status. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/graph.json` | `SpeciesGroup`, `SpeciesNode`, `DesignRelationship`, `PhenotypeLibraryGraphBinding` |
| `SpeciesGroup` | core entity model | Groups species inside one graph for families, collections, systems, or layers. | Durable design fact; memberships can change by reviewable writes. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/groups/` | `SpeciesGroupMembership`, `DesignRelationship` |
| `SpeciesGroupMembership` | organization relationship | Connects one species node to one group with a role. | Durable design fact for graph organization. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/group-memberships/` | `SpeciesGroup`, `SpeciesNode` |
| `SpeciesNode` | core entity model | Represents a stable drawable or generatable design object. | Created and versioned through `NodeVersion`; archived by status. | Preview/change-set through CLI or application service. | `graphs/<graph_id>/nodes/` | `NodeVersion`, `DesignRelationship`, `Phenotype`, `ContextAttachment` |
| `NodeVersion` | core entity version model | Immutable snapshot of a species node's resolved design facts at a point in time. | Append-only after creation. | Created by node service flows; no generic content update. | `graphs/<graph_id>/nodes/` payload | `SpeciesNode`, `SpeciesCompileArtifact` |
| `DesignRelationship` | core relationship model | Describes derivation, translation, alignment, divergence, reference, or constraint between same-level core entities: graph to graph, group to group, or node to node. | Durable design fact with reviewable lifecycle. | Preview/change-set through CLI or application service. | `relationships/<relationship_id>.json` | `Graph`, `SpeciesGroup`, `SpeciesNode`, `ImpactRecord`, `ContextAttachment`, `FacetAssignment` |
| `DesignContext` | auxiliary semantics model | Holds governed background context such as worldbuilding, brand, platform, or production rationale. | Durable design fact; context child records attach evidence and policy. | Preview/change-set through CLI or application service. | `contexts/contexts/` | `ContextFact`, `ContextMotif`, `ContextReference`, `ContextReviewRubric` |
| `ContextFact` | auxiliary semantics model | Records a governed contextual statement with type, source, confidence, and default behavior. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/facts/` | `DesignContext`, `ContextAttachment` |
| `ContextMotif` | auxiliary semantics model | Records a governed narrative, cultural, symbolic, or visual motif statement with source/confidence. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/motifs/` | `SpeciesNode.motifs`, facets |
| `DesignPrinciple` | auxiliary semantics model | Records a reusable design principle or direction. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/principles/` | `DesignContext`, `PhenotypeCompileArtifact` |
| `ContextReference` | auxiliary semantics model | Records source references, examples, badcases, evidence, and decisions. | Durable design fact or governed reference. | Preview/change-set through CLI or application service. | `contexts/references/` | `ContextReviewRubric`, `OutputReference` |
| `ContextReviewRubric` | rubric model | Defines review criteria. It is not an evaluation result. | Durable review criterion. | Preview/change-set through CLI or application service. | `contexts/review-rubrics/` | `ReviewRecord` |
| `ContextAttachment` | auxiliary attachment relationship | Attaches context records to graph, group, node, design relationship, template, phenotype type, phenotype, or phenotype version targets. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/attachments/` | `DesignContext`, compile artifacts |
| `ContextPolicy` | auxiliary attachment relationship | Controls compile, review, impact, priority, and resolution participation for context. | Durable design fact. | Preview/change-set through CLI or application service. | `contexts/policies/` | `SpeciesCompileArtifact`, `ImpactRecord` |
| `FacetDefinition` | facet taxonomy | Names reusable cross-object classification dimensions. | Durable taxonomy fact. | Preview/change-set for user-authored taxonomy; direct only for trusted imports. | `facets/definitions/` | `FacetSchema`, `FacetAssignment`, `GeneTemplate.dimensionSchema` |
| `FacetSchema` | facet taxonomy | Defines allowed values and shape for a facet. | Durable taxonomy fact. | Preview/change-set for user-authored taxonomy; direct only for trusted imports. | `facets/schemas/` | `FacetDefinition` |
| `FacetAssignment` | auxiliary attachment relationship | Assigns facet values to atlas, graph, group, node, design relationship, phenotype type, phenotype, or phenotype version targets. | Durable classification fact. | Preview/change-set for user-authored assignments; direct only for trusted imports. | `facets/assignments/` | `SpeciesNode.constraints`, `GeneTemplate.dimensionSchema` |
| `TemplatePack` | template model | Packages reusable template content. `TemplatePack.version` is the pack content version. | Direct admin write after compatibility validation. | Template/application service or CLI template install. | `templates/` | `GeneTemplate` |
| `GeneTemplate` | template model | Defines reusable design dimensions, required/recommended data, and review questions. `GeneTemplate.version` is the template definition version. | Direct admin write after compatibility validation. | Template/application service or CLI template install. | `templates/` | `FacetDefinition`, `SpeciesNode.constraints` |
| `CompileFrame` | compiled view model | Explains one deterministic compile layer: atlas, graph, species group, species node, or phenotype. It contains inherited, local, relationship, context, facet, template, resolved, conflict, question, and feedback snapshots. | Generated trace inside compile artifacts; never a durable graph fact. | Core/application compile service. | inside compile artifact JSON | `EntityCompileArtifact`, `SpeciesCompileArtifact`, `PhenotypeCompileArtifact` |
| `EntityCompileArtifact` | compiled view model | Stores layered compile output for atlas, graph, or species-group targets, including frames, dependency vector, validity metadata, feedback, and decision traces. | Compiled view; preview for standalone compile, direct audit write only when explicitly persisted. | Application service or CLI compile flows. | `atlases/<atlas_id>/compile/`, `graphs/<graph_id>/compile/graph/`, `graphs/<graph_id>/compile/groups/` | `CompileFrame`, `SpeciesCompileArtifact` |
| `SpeciesCompileArtifact` | compiled view model | Compiles a species target through atlas/graph/group/species-node frames into resolved genes, dependency vector, trace, conflicts, feedback, and open questions. | Compiled view; preview for standalone compile, direct audit write during formal generation apply. | Application service or CLI compile/generate flows. | `graphs/<graph_id>/compile/species/` | `EntityCompileArtifact`, `PhenotypeCompileArtifact`, `NodeVersion`, `DesignRelationship` |
| `PhenotypeCompileArtifact` | compiled view model | Compiles inherited species frames plus a phenotype frame into prompt, negative prompt, brief, generation constraints, review checklist, dependency vector, decisions, and feedback. | Compiled view; preview for standalone compile, direct audit write during formal generation apply. | Application service or CLI compile/generate flows. | `graphs/<graph_id>/compile/phenotypes/` | `SpeciesCompileArtifact`, `PhenotypeVersion` |
| `Phenotype` | output provenance model | Stable generated or curated result object for a species and phenotype type. | Generated output container; archived by status. | Application service or CLI generated-output flows. | `graphs/<graph_id>/phenotypes/` | `PhenotypeVersion`, `OutputReference` |
| `PhenotypeVersion` | output provenance model | Immutable generated output snapshot. Formal generation records `speciesCompileArtifactId`, `phenotypeCompileArtifactId`, `compileArtifactSnapshot`, `generationRecipe`, and `promptSnapshot` as captured provenance, not a runtime attempt. | Content immutable after creation; lifecycle metadata is limited to `status + feedback`, while `Phenotype.currentAcceptedVersion` points at the one accepted version when one exists. | Application service or CLI generated-output lifecycle flows. | `graphs/<graph_id>/phenotypes/` payload | `PhenotypeCompileArtifact`, `GenerationJob`, `ReviewRecord`, `AssetIndex` |
| `GenerationJob` | output provenance model | Records one execution attempt, provider/tool summary, sanitized inputs, outputs, failure category, and artifact IDs. Phenotype jobs bind to node/phenotype provenance; reference jobs bind to graph or species-group targets without synthetic phenotype records. | Runtime job/audit record. | Application service or CLI provider/generation flows. | `graphs/<graph_id>/generation-jobs/` | `PhenotypeVersion.generationRecipe`, `EntityCompileArtifact`, provider contracts |
| `AssetIndex` | external-pointer model | Indexes a physical or external asset pointer, such as file, library item, preview, source, runtime export, variant, or scoped reference asset. Reference assets may migrate by creating a new pointer and archiving the old pointer as history. | External pointer; no binary ownership. Pointer identity is stable; storage location changes create new records rather than mutating ids. | Direct audit/admin write through CLI/application service. | `graphs/<graph_id>/assets/` | `OutputReference`, `PhenotypeVersion`, `GenerationJob` |
| `OutputReference` | output provenance model | Records the semantic generated deliverable relationship to phenotype version, library, output role, and review flow. | External pointer/governance record. | Direct audit/admin write through CLI/application service. | `graphs/<graph_id>/output-references/` | `AssetIndex`, `PhenotypeLibrary`, `StorageMount` |
| `PhenotypeLibrary` | library model | Optional generated-result catalog. `graphIds` is compatibility/summary metadata, not the canonical binding record. | Direct admin write; status controls lifecycle. | CLI/application service library flows. | `libraries/<library_id>/library.json` | `PhenotypeLibraryGraphBinding`, `StorageMount` |
| `PhenotypeLibraryGraphBinding` | library model | Canonical graph/library binding with role, status, and sync policy. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/bindings/` | `PhenotypeLibrary.graphIds` |
| `StorageMount` | library model | Describes one external storage target and capabilities. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/mounts/` | `LibraryRoutingPolicy`, `OutputReference` |
| `ExternalLibraryMapping` | library model | Maps external system metadata fields to DNA metadata. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/mappings/` | `StorageMount`, `AssetIndex` |
| `LibraryRoutingPolicy` | library model | Chooses default output storage mount by generated-result type, role, reference type, tags, and metadata requirements. | Direct admin write. | CLI/application service library flows. | `libraries/<library_id>/routing-policies/` | `OutputReference`, `StorageMount` |
| `ReviewRecord` | governance/audit model | Stores an evaluation result. It is not the rubric definition. | Direct audit write. | CLI/application service review flows. | `graphs/<graph_id>/reviews/` | `ContextReviewRubric`, `PhenotypeVersion` |
| `ImpactRecord` | governance/audit model | Records downstream consequences after an upstream change; it does not rewrite affected objects. | Direct audit write. | CLI/application service impact flows. | `graphs/<graph_id>/impacts/` | `SpeciesNode`, `DesignRelationship`, `PhenotypeVersion` |
| `ChangeSet` | governance/write review model | Reviewable preview of formal durable changes. | Preview, review, apply, discard. | CLI/application service change-set flows. | `change-sets/` | formal graph/context/facet facts |

## Boundary Decisions

### `SpeciesNode.motifs` vs `ContextMotif` vs facets

`SpeciesNode.motifs` are lightweight node-level motif labels. `ContextMotif` is a governed design-context statement with source, confidence, and participation policy. Facets are structured tagging or classification taxonomy, not narrative motif facts.

### `DesignRelationship` endpoint levels

`DesignRelationship` connects same-level core entities only: graph to graph, group to group, or node to node. If a scenario appears to need cross-level endpoints, first resolve the corresponding same-level entities through containment or membership, then model the relationship at that level.

### `AssetIndex` vs `OutputReference`

`AssetIndex` indexes physical or external asset pointers. `OutputReference` records the semantic generated deliverable relationship to a phenotype version, library, output role, and review flow. A single phenotype version may have both.

### `PhenotypeLibrary.graphIds` vs `PhenotypeLibraryGraphBinding`

`PhenotypeLibraryGraphBinding` is canonical for graph/library role, status, and sync policy. `PhenotypeLibrary.graphIds` is summary metadata for import/export and simpler readers.

### `GenerationJob` vs `PhenotypeVersion.generationRecipe/promptSnapshot`

`GenerationJob` is an execution attempt and may fail. Phenotype jobs can produce `PhenotypeVersion` records, while reference jobs stay scoped to graph or species-group targets and may only link safe `AssetIndex` pointers. External reference completion can move a reference job from `created` to `generated` only when active safe linked asset evidence exists; it does not create phenotype lifecycle records. Reference asset migration updates current completion evidence to the new active pointer and keeps archived local pointers as historical evidence without changing the job prompt, target, input snapshot, or compile provenance. `PhenotypeVersion` is an immutable generated output snapshot; `generationRecipe` and `promptSnapshot` are provenance captured on that version.

### `ReviewRecord` vs `ContextReviewRubric`

`ContextReviewRubric` defines review criteria. `ReviewRecord` stores a review result, including conclusion, missing dimensions, constraint violations, and confirmation state.

### facet/template/node constraints

`FacetDefinition`, `FacetSchema`, and `FacetAssignment` define cross-object classification taxonomy. `GeneTemplate.dimensionSchema` guides required, recommended, optional, or forbidden design data. `SpeciesNode.constraints` are object-specific requirements and limits.

### compile frames and staleness

Layered compile is a generated view, not a write to graph truth. `CompileFrame` records how atlas, graph, group, species-node, and phenotype layers contributed to an artifact. Persisted compile artifacts carry a dependency version vector; later graph, group, node, relationship, context, facet, template, phenotype-plan, or task-brief changes make artifacts stale or historical instead of mutating them in place.

### template compatibility

Template compatibility is not root project version compatibility. `TemplatePack.version` is the pack content version, `GeneTemplate.version` is the template definition version, `compatibility.dnaSchema` declares supported DNA schema compatibility, and `compatibility.capabilities` declares required product capabilities.
