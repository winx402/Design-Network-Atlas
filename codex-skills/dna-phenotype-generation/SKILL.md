---
name: dna-phenotype-generation
description: Guide generation or registration of a DNA design output from an existing graph. Use when a user has a SpeciesNode, NodeVersion, compile artifact, phenotype type, task brief, or candidate output and needs prompt/brief generation, review planning, GenerationJob orchestration, PhenotypeVersion registration, and OutputReference routing.
---

# DNA Phenotype Generation

Use this formal MVP scenario skill when the graph already exists and the user wants a generated or curated design result. This skill does not build the graph. If the species, DesignRelationship, facet, context, or relation model is missing, output a blocking question or recommend switching to `dna-graph-modeling` or `dna-graph-editing`.

The job is to orchestrate generation, review, confirmation, and registration through DNA concepts. It is not CLI help.

Use `docs/design/concept-registry.md` as the canonical terminology boundary for compile artifacts, GenerationJob, PhenotypeVersion, OutputReference, AssetIndex, review, and impact records.
Use `docs/design/write-boundary-matrix.md` for write strategy vocabulary: compile artifacts, GenerationJob, PhenotypeVersion, OutputReference, AssetIndex, review, and impact records are generated trace/output/audit records or external pointers and may use direct audit write or draft-write through CLI/application service boundaries.

## Source Objects

- SpeciesNode and NodeVersion define the stable design target.
- PhenotypeGenerationPlan is a production orchestration record for graph, species-group, species-node, or phenotype scope. It captures priority, model/provider/tool preference, requirements, LLM-readable llmInstructions, operatorNotes, metadata, extensions, and versionBinding without storing credentials.
- PhenotypeGenerationTask is the concrete work item that may come from a plan or stand alone. It records graph, node or phenotype target, phenotype type, task brief, status, priority, versionBinding, blockingReason, linked compile artifacts, GenerationJob ids, and PhenotypeVersion ids.
- SpeciesCompileArtifact provides atlas/graph/group/species-node compile frames, resolved genes, dependency vector, traces, conflicts, feedback, and open questions.
- Phenotype type defines the output shape: image, UI icon, concept brief, model brief, animation brief, runtime export, document, dataset, or custom type.
- ContextReference and ContextReviewRubric provide examples, badcases, review questions, and acceptance criteria.
- PhenotypeCompileArtifact provides inherited species frames plus a phenotype frame, bounded prompt, negative prompt, art brief, generation constraints, dependency vector, feedback, and review checklist.
- GenerationJob records the selected model/tool workflow without storing credentials or complete private links.
- PhenotypeVersion records the generated result snapshot. New formal generation produces a `candidate`; later lifecycle actions can make it accepted, rejected, replaced, rolled-back, deprecated, archived, or deleted without changing generated content.
- OutputReference, AssetIndex, PhenotypeLibrary, StorageMount, and LibraryRoutingPolicy record where result files or external objects live.

## Decision Gates

1. planning gate: decide whether the user needs a graph/group/node/phenotype PhenotypeGenerationPlan, a standalone PhenotypeGenerationTask, or direct manual generation. Use a plan for batch production governance, a task for concrete execution tracking, and manual generation for a one-off result that does not need queue orchestration.
2. target gate: confirm graph id, SpeciesNode, NodeVersion, planned Phenotype if one exists, phenotype type, and task brief.
3. version-binding gate: default tasks to latest-at-execution. Use pinned only when the user names a NodeVersion, SpeciesCompileArtifact, or PhenotypeCompileArtifact; reject stale pinned artifacts unless historical replay is explicit.
4. artifact gate: prefer current layered SpeciesCompileArtifact and PhenotypeCompileArtifact; if there is a missing, stale, invalid, or historical artifact, plan a refresh or explicitly mark historical replay before generation.
   - Formal generation must use a layered PhenotypeCompileArtifact. It may auto-create species and phenotype artifacts, reuse a species artifact, or replay a phenotype artifact only after graph/node/type/brief/species-link/frame/dependency-vector validation.
   - Treat a missing compile artifact as a blocking artifact-readiness gap unless the workflow explicitly creates a fresh layered artifact before provider execution.
   - Review frame order and dependency-vector status before provider execution: atlas -> graph -> species-group -> species-node -> phenotype.
5. conflict gate: if compile conflicts or blocking open questions change the visual result, ask a blocking question before using a model or external tool.
6. context gate: include ContextReference and ContextReviewRubric only as traceable guidance; do not invent references.
7. prompt gate: produce prompt, negative prompt, art brief, and review checklist from existing graph facts and compile artifacts.
8. tool gate: select manual, mock, or external tool execution. Do not default to calling an external tool when conflicts are blocking.
9. lifecycle gate: decide whether the result should stay candidate, be accepted, rejected, replaced, rolled back, deprecated, archived, or deleted. Feedback belongs on `PhenotypeVersion.feedback`, not in ReviewRecord unless a separate review workflow is explicitly needed.
10. storage gate: route output references through PhenotypeLibrary and StorageMount when available, or record direct OutputReference when the user does not use a DNA result library.

## Workflow

1. Choose generation planning mode.
   - Use a PhenotypeGenerationPlan when the request covers a graph, species-group, species-node, or multiple planned Phenotypes and needs priority, model/tool preference, LLM-readable instructions, or review queue visibility.
   - Use a standalone PhenotypeGenerationTask when the user has one clear target and wants status, blockingReason, versionBinding, and generated result links without creating a plan.
   - Use direct manual generation when the user needs an immediate one-off preview or artifact-backed result and accepts that no plan/task queue record will be created.
   - Treat llmInstructions and operatorNotes as non-sensitive orchestration context. They may guide an Agent, but they must not contain API keys, provider credentials, raw provider payloads, or complete private links.

2. Validate the generation target.
   - Confirm the graph, species, node version or latest-at-execution strategy, planned Phenotype if supplied, phenotype type, and task brief.
   - If the user supplies only a broad scenario, stop and recommend graph modeling.

3. Prepare compile artifacts.
   - Use or create a layered SpeciesCompileArtifact for resolved genes, frame trace, dependency vector, feedback, and open questions.
   - Use or create a layered PhenotypeCompileArtifact for prompt, negative prompt, art brief, generation constraints, review checklist, dependency vector, and phenotype frame.
   - Registration must carry speciesCompileArtifactId, phenotypeCompileArtifactId, and compileArtifactSnapshot into PhenotypeVersion, and artifact IDs plus current/historical compile mode into GenerationJob.inputSnapshot.
   - Record compileMode, compiledBy, assistantContributionSummary, inputSummary, frame counts, conflict counts, decision counts, feedback counts, dependency-vector validity, and trace priority/overridability where relevant.
   - LLM/Agent-assisted compile is allowed only as bounded decision requests and replayable decision patches; do not call providers or store credentials during compile.
   - If execution is task-based, GenerationJob.inputSnapshot should include generationTaskId, generationPlanId when present, versionBinding, speciesCompileArtifactId, and phenotypeCompileArtifactId.

4. Decide generation execution.
   - manual: user or artist creates the result from brief/checklist.
   - mock: test provider or placeholder workflow for validation.
   - external tool: image model, design tool, renderer, script, database, Git repository, or custom provider adapter.
   - Never store API keys, provider credentials, complete private links, or raw Agent host responses in GenerationJob, compile artifacts, or exports.

5. Review the result.
   - Compare result against resolved genes, context traces, badcases, and review checklist.
   - If the result conflicts with accepted species constraints, recommend reject, revise, or graph edit rather than silently accepting it.

6. Register output.
   - Register the Phenotype identity and a new PhenotypeVersion.
   - Treat the new version as `candidate` by default. Acceptance, replacement, rollback, deprecation, archive, and deletion are lifecycle metadata changes on the version plus the Phenotype.currentAcceptedVersion pointer.
   - Keep lightweight review comments, acceptance reasons, rollback notes, or revision suggestions in PhenotypeVersion.feedback; do not put provider credentials, raw provider payloads, complete private links, or large binary/text payloads there.
   - One PhenotypeVersion may own multiple OutputReference or AssetIndex records for size variants, angle variants, crop variants, layered files, source files, previews, mirrors, or runtime exports.
   - If no PhenotypeLibrary is used, record direct OutputReference/AssetIndex pointers without forcing the user into a library.
   - If a library is used, route by LibraryRoutingPolicy and preserve adapter-specific metadata mapping.
   - When generation came from a task, link the PhenotypeGenerationTask to speciesCompileArtifactId, phenotypeCompileArtifactId, generationJobIds, phenotypeVersionIds, and generated or blocked status.

## Output Contract

Return a generationPlan with these fields:

- planningMode: plan, task, or manual-generation, with one reason.
- planOrTaskProposal: PhenotypeGenerationPlan or PhenotypeGenerationTask fields when orchestration should be created, including priority, scope, requirements, llmInstructions, operatorNotes, metadata, extensions, and non-sensitive model/provider/tool preference.
- selectedTarget: graph id, species node id, node version id, phenotype type, and task brief.
- versionBinding: latest-at-execution or pinned, including stale/historical replay decision.
- artifactReadiness: existing or required layered SpeciesCompileArtifact and PhenotypeCompileArtifact, with current/stale/historical/invalid status, frame coverage, dependency-vector status, conflicts, feedback, and blocking open questions.
- blockingQuestions: questions that must be answered before generation or registration.
- nonBlockingQuestions: questions that can be resolved after a draft output exists.
- promptPackage: prompt, negative prompt, art brief, generation constraints, and review checklist.
- toolPlan: manual, mock, or external tool, plus what will and will not be recorded in GenerationJob.
- reviewPlan: checklist, expected failure cases, and acceptance decision path.
- registrationPlan: Phenotype identity, candidate PhenotypeVersion, compileArtifactSnapshot, OutputReference or AssetIndex records, and library/mount routing.
- lifecyclePlan: candidate/accepted/rejected/replaced/rolled-back/deprecated/archive decision, currentAcceptedVersion effect, and non-sensitive feedback summary/items when applicable.
- writeStrategy: preview-confirm, change-set review, draft-write, direct audit write, or no-write diagnosis.
- assumptions: assumptions used.
- confidence: high, medium, or low with one concrete reason.

## Guardrails

- do not invent SpeciesNode, DesignRelationship, facet, context, reference, or rubric facts to make generation easier.
- Do not call an external tool when a blocking question, conflict, missing target, or missing storage decision would make the result misleading.
- Do not treat generated output as accepted by default; use candidate unless the user has explicitly approved acceptance through the version lifecycle path.
- Do not bypass DNA compile artifacts when prompt or brief generation depends on graph constraints.
- Do not recommend registering a generated PhenotypeVersion without a PhenotypeCompileArtifact-backed provenance path.
- Do not store provider credentials, complete private links, raw Agent host responses, or sensitive provider parameters.
- Do not store API keys, provider credentials, complete private links, raw provider payloads, or signed URLs in PhenotypeGenerationPlan, PhenotypeGenerationTask, llmInstructions, operatorNotes, toolPreference, metadata, or extensions.
