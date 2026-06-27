---
name: dna-phenotype-generation
description: Guide generation or registration of a DNA design output from an existing graph. Use when a user has a SpeciesNode, NodeVersion, compile artifact, phenotype type, task brief, or candidate output and needs prompt/brief generation, review planning, GenerationJob orchestration, PhenotypeVersion registration, and OutputReference routing.
---

# DNA Phenotype Generation

Use this skill when the graph already exists and the user wants a generated or curated design result. This skill does not build the graph. If the species, edge, facet, context, or relation model is missing, output a blocking question or recommend switching to `dna-graph-modeling` or `dna-graph-editing`.

The job is to orchestrate generation, review, confirmation, and registration through DNA concepts. It is not CLI help.

## Source Objects

- SpeciesNode and NodeVersion define the stable design target.
- SpeciesCompileArtifact provides resolved genes, traces, conflicts, and open questions.
- Phenotype type defines the output shape: image, UI icon, concept brief, model brief, animation brief, runtime export, document, dataset, or custom type.
- ContextReference and ContextReviewRubric provide examples, badcases, review questions, and acceptance criteria.
- PhenotypeCompileArtifact provides the bounded prompt, negative prompt, art brief, generation constraints, and review checklist.
- GenerationJob records the selected model/tool workflow without storing credentials or complete private links.
- PhenotypeVersion records the accepted or pending generated result snapshot.
- OutputReference, AssetIndex, PhenotypeLibrary, StorageMount, and LibraryRoutingPolicy record where result files or external objects live.

## Decision Gates

1. target gate: confirm graph id, SpeciesNode, NodeVersion, and phenotype type.
2. artifact gate: prefer existing SpeciesCompileArtifact; if missing or outdated, plan a refresh before generation.
3. conflict gate: if compile conflicts or open questions change the visual result, ask a blocking question before using a model or external tool.
4. context gate: include ContextReference and ContextReviewRubric only as traceable guidance; do not invent references.
5. prompt gate: produce prompt, negative prompt, art brief, and review checklist from existing graph facts and compile artifacts.
6. tool gate: select manual, mock, or external tool execution. Do not default to calling an external tool when conflicts are blocking.
7. registration gate: decide whether the result becomes draft, pending-confirmation, accepted, rejected, or archived.
8. storage gate: route output references through PhenotypeLibrary and StorageMount when available, or record direct OutputReference when the user does not use a DNA result library.

## Workflow

1. Validate the generation target.
   - Confirm the graph, species, node version, phenotype type, and task brief.
   - If the user supplies only a broad scenario, stop and recommend graph modeling.

2. Prepare compile artifacts.
   - Use or create a SpeciesCompileArtifact for resolved genes and trace.
   - Use or create a PhenotypeCompileArtifact for prompt, negative prompt, art brief, generation constraints, and review checklist.
   - Record compileMode, compiledBy, assistantContributionSummary, inputSummary, and trace priority/overridability where relevant.

3. Decide generation execution.
   - manual: user or artist creates the result from brief/checklist.
   - mock: test provider or placeholder workflow for validation.
   - external tool: image model, design tool, renderer, script, database, Git repository, or custom provider adapter.
   - Never store API keys, complete private links, or raw Agent host responses in GenerationJob, compile artifacts, or exports.

4. Review the result.
   - Compare result against resolved genes, context traces, badcases, and review checklist.
   - If the result conflicts with accepted species constraints, recommend reject, revise, or graph edit rather than silently accepting it.

5. Register output.
   - Create or update Phenotype and PhenotypeVersion.
   - One PhenotypeVersion may own multiple OutputReference or AssetIndex records for size variants, angle variants, crop variants, layered files, source files, previews, mirrors, or runtime exports.
   - If no PhenotypeLibrary is used, record direct OutputReference/AssetIndex pointers without forcing the user into a library.
   - If a library is used, route by LibraryRoutingPolicy and preserve adapter-specific metadata mapping.

## Output Contract

Return a generation plan with these fields:

- selectedTarget: graph id, species node id, node version id, phenotype type, and task brief.
- artifactReadiness: existing or required SpeciesCompileArtifact and PhenotypeCompileArtifact, with outdated/conflict status.
- blockingQuestions: questions that must be answered before generation or registration.
- nonBlockingQuestions: questions that can be resolved after a draft output exists.
- promptPackage: prompt, negative prompt, art brief, generation constraints, and review checklist.
- toolPlan: manual, mock, or external tool, plus what will and will not be recorded in GenerationJob.
- reviewPlan: checklist, expected failure cases, and acceptance decision path.
- registrationPlan: Phenotype, PhenotypeVersion status, compileArtifactSnapshot, OutputReference or AssetIndex records, and library/mount routing.
- writeStrategy: preview-confirm, change-set review, draft-write, or no-write diagnosis.
- assumptions: assumptions used.
- confidence: high, medium, or low with one concrete reason.

## Guardrails

- do not invent SpeciesNode, EvolutionEdge, facet, context, reference, or rubric facts to make generation easier.
- Do not call an external tool when a blocking question, conflict, missing target, or missing storage decision would make the result misleading.
- Do not treat generated output as accepted by default; use pending-confirmation unless the user has explicitly approved acceptance.
- Do not bypass DNA compile artifacts when prompt or brief generation depends on graph constraints.
- Do not store credentials, complete private links, raw Agent host responses, or sensitive provider parameters.
