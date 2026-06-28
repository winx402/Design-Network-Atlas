import {
  collectImpact,
  checkCompileArtifactStaleness,
  compileEntityArtifact,
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  createDefaultPhenotypeVersion,
  createGenerationJob,
  makeId,
  nowIso,
  type EntityCompileArtifact,
  type ContextAttachment,
  type DesignRelationship,
  type DesignContext,
  type GenerationJob,
  type GenerationVersionBinding,
  type Graph,
  type Phenotype,
  type PhenotypeGenerationPlan,
  type PhenotypeGenerationTask,
  type PhenotypeCompileArtifact,
  type SpeciesNode,
  type PhenotypeVersion,
  type SpeciesCompileArtifact,
  type TraceEntry
} from "@dna/core";
import type {
  AtlasRepository,
  ContextAttachmentRepository,
  ContextFactRepository,
  ContextMotifRepository,
  ContextPolicyRepository,
  ContextReferenceRepository,
  ContextReviewRubricRepository,
  DesignContextRepository,
  DesignPrincipleRepository,
  DesignRelationshipRepository,
  EntityCompileArtifactRepository,
  FacetAssignmentRepository,
  FacetDefinitionRepository,
  FacetSchemaRepository,
  GenerationJobRepository,
  GraphRepository,
  LineageRepository,
  NodeVersionRepository,
  PhenotypeCompileArtifactRepository,
  PhenotypeGenerationPlanRepository,
  PhenotypeGenerationTaskRepository,
  PhenotypeRepository,
  PhenotypeVersionRepository,
  SpeciesCompileArtifactRepository,
  SpeciesGroupMembershipRepository,
  SpeciesGroupRepository,
  TemplateRepository
} from "@dna/storage";

export * from "./modeling-quality.js";

export type ApplicationImpactSummary = {
  objectType: "graph" | "node" | "species-group" | "phenotype-version";
  objectId: string;
  reason: string;
  suggestedAction: "review-or-regenerate";
};

export interface SpeciesCompileInputRepositories {
  graphs: Pick<GraphRepository, "get">;
  nodes: Pick<LineageRepository, "get">;
  nodeVersions: Pick<NodeVersionRepository, "get" | "listByNode">;
  designRelationships: Pick<DesignRelationshipRepository, "listByGraph">;
  speciesGroups: Pick<SpeciesGroupRepository, "get">;
  speciesGroupMemberships: Pick<SpeciesGroupMembershipRepository, "listByNode">;
  designContexts: Pick<DesignContextRepository, "get">;
  contextFacts: Pick<ContextFactRepository, "get">;
  designPrinciples: Pick<DesignPrincipleRepository, "get">;
  contextMotifs: Pick<ContextMotifRepository, "get">;
  contextReferences: Pick<ContextReferenceRepository, "get">;
  contextReviewRubrics: Pick<ContextReviewRubricRepository, "get">;
  contextAttachments: Pick<ContextAttachmentRepository, "listByTarget">;
  contextPolicies: Pick<ContextPolicyRepository, "listByContext">;
}

export interface LayeredCompileRepositories extends SpeciesCompileInputRepositories {
  atlases: Pick<AtlasRepository, "get" | "list">;
  entityCompileArtifacts: Pick<EntityCompileArtifactRepository, "get" | "listByGraph">;
  facetDefinitions: Pick<FacetDefinitionRepository, "list">;
  facetSchemas: Pick<FacetSchemaRepository, "list">;
  facetAssignments: Pick<FacetAssignmentRepository, "list" | "listByTarget">;
  templates: Pick<TemplateRepository, "listTemplates">;
}

export interface PhenotypeGenerationRepositories extends LayeredCompileRepositories {
  phenotypes: Pick<PhenotypeRepository, "get">;
  speciesCompileArtifacts: Pick<SpeciesCompileArtifactRepository, "get">;
  phenotypeCompileArtifacts: Pick<PhenotypeCompileArtifactRepository, "get">;
}

export interface PhenotypeGenerationPersistRepositories extends PhenotypeGenerationRepositories {
  transaction<T>(fn: () => T): T;
  phenotypes: Pick<PhenotypeRepository, "get" | "create">;
  phenotypeVersions: Pick<PhenotypeVersionRepository, "create">;
  speciesCompileArtifacts: Pick<SpeciesCompileArtifactRepository, "get" | "create">;
  phenotypeCompileArtifacts: Pick<PhenotypeCompileArtifactRepository, "get" | "create">;
  generationJobs: Pick<GenerationJobRepository, "create">;
  generationTasks: Pick<PhenotypeGenerationTaskRepository, "get" | "update">;
}

export interface GenerationPlanningRepositories extends PhenotypeGenerationRepositories {
  transaction<T>(fn: () => T): T;
  nodes: Pick<LineageRepository, "get" | "listByGraph">;
  phenotypes: Pick<PhenotypeRepository, "get" | "listByGraph">;
  speciesGroups: Pick<SpeciesGroupRepository, "get">;
  speciesGroupMemberships: Pick<SpeciesGroupMembershipRepository, "listByGroup" | "listByNode">;
  generationPlans: PhenotypeGenerationPlanRepository;
  generationTasks: PhenotypeGenerationTaskRepository;
}

export interface ImpactRepositories {
  nodes: Pick<LineageRepository, "get" | "listByGraph">;
  designRelationships: Pick<DesignRelationshipRepository, "get" | "listByGraph">;
  phenotypeVersions: Pick<PhenotypeVersionRepository, "get" | "listByNode" | "updateStatus">;
  speciesGroups: Pick<SpeciesGroupRepository, "get">;
  speciesGroupMemberships: Pick<SpeciesGroupMembershipRepository, "listByGroup">;
  designContexts: Pick<DesignContextRepository, "get">;
  contextAttachments: Pick<ContextAttachmentRepository, "listByContext">;
}

export interface BuildSpeciesCompileInputOptions {
  graphId: string;
  nodeId: string;
  nodeVersionId?: string;
}

export interface PreparePhenotypeGenerationOptions {
  graphId: string;
  nodeId: string;
  phenotypeType: string;
  name: string;
  taskBrief: string;
  phenotypeId?: string;
  speciesArtifactId?: string;
  phenotypeArtifactId?: string;
  replayHistorical?: boolean;
  generationTaskId?: string;
  generationPlanId?: string;
  versionBinding?: GenerationVersionBinding;
  tool?: string;
  ids?: {
    speciesArtifactId?: string;
    phenotypeArtifactId?: string;
    phenotypeId?: string;
    phenotypeVersionId?: string;
    generationJobId?: string;
  };
}

export interface PrepareEntityCompileArtifactOptions {
  artifactId?: string;
  targetLevel: "atlas" | "graph" | "species-group";
  atlasId?: string;
  graphId?: string;
  groupId?: string;
  upstreamArtifacts?: EntityCompileArtifact[];
}

export interface PrepareSpeciesCompileArtifactOptions {
  artifactId?: string;
  graphId: string;
  nodeId: string;
  nodeVersionId?: string;
  upstreamArtifacts?: EntityCompileArtifact[];
}

export interface PreparePhenotypeCompileArtifactOptions {
  artifactId?: string;
  graphId: string;
  nodeId: string;
  phenotypeType: string;
  taskBrief: string;
  nodeVersionId?: string;
  speciesArtifact?: SpeciesCompileArtifact;
  speciesArtifactId?: string;
}

export interface PreparedPhenotypeGeneration {
  artifacts: {
    species: SpeciesCompileArtifact;
    phenotype: PhenotypeCompileArtifact;
  };
  speciesArtifact: SpeciesCompileArtifact;
  phenotypeArtifact: PhenotypeCompileArtifact;
  phenotype: Phenotype;
  phenotypeVersion: PhenotypeVersion;
  job: GenerationJob;
  prompt: string;
  createdSpeciesArtifact: boolean;
  createdPhenotypeArtifact: boolean;
  createdPhenotype: boolean;
}

export function buildSpeciesCompileInput(store: SpeciesCompileInputRepositories, options: BuildSpeciesCompileInputOptions) {
  const graph = store.graphs.get(options.graphId);
  const node = store.nodes.get(options.nodeId);
  if (!graph || !node) throw new Error("graph or node not found");
  const nodeVersions = store.nodeVersions.listByNode(options.nodeId);
  const pinnedNodeVersion = options.nodeVersionId ? store.nodeVersions.get(options.nodeVersionId) : undefined;
  if (options.nodeVersionId && (!pinnedNodeVersion || pinnedNodeVersion.graphId !== options.graphId || pinnedNodeVersion.nodeId !== options.nodeId)) {
    throw new Error(`node version not found for task input: ${options.nodeVersionId}`);
  }
  const nodeVersionId = pinnedNodeVersion?.nodeVersionId ?? nodeVersions.at(-1)?.nodeVersionId ?? `${node.nodeId}@${node.currentVersion}`;
  const parentSnapshots = node.parentNodes
    .map((parentNodeId) => {
      const version = store.nodeVersions.listByNode(parentNodeId).at(-1);
      if (!version) return undefined;
      return { parentNodeId, nodeVersionId: version.nodeVersionId, snapshot: version.resolvedGeneSnapshot };
    })
    .filter((value): value is { parentNodeId: string; nodeVersionId: string; snapshot: Record<string, unknown> } => Boolean(value));
  const designRelationships = store.designRelationships.listByGraph(options.graphId);
  const relationshipDeltas = designRelationships
    .filter(
      (relationship) =>
        relationship.source.type === "species-node" &&
        relationship.target.type === "species-node" &&
        relationship.target.nodeId === options.nodeId
    )
    .map((relationship) => ({
      relationshipId: relationship.relationshipId,
      delta: relationDeltaFromContract(relationship)
    }));
  const speciesGroups = store.speciesGroupMemberships
    .listByNode(options.nodeId)
    .map((membership) => store.speciesGroups.get(membership.groupId))
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
  const contextAttachments = [
    ...store.contextAttachments.listByTarget("species-node", options.nodeId),
    ...store.contextAttachments.listByTarget("graph", options.graphId),
    ...speciesGroups.flatMap((group) => store.contextAttachments.listByTarget("species-group", group.groupId))
  ];
  const contextIds = unique(contextAttachments.map((attachment) => attachment.contextId));
  const designContexts = contextIds
    .map((contextId) => store.designContexts.get(contextId))
    .filter((context): context is NonNullable<typeof context> => Boolean(context));

  return {
    graph,
    node,
    nodeVersionId,
    parentSnapshots,
    relationshipDeltas,
    speciesGroups,
    designRelationships,
    designContexts,
    contextAttachments,
    contextPolicies: contextIds.flatMap((contextId) => store.contextPolicies.listByContext(contextId)),
    contextFacts: collectContextChildren(designContexts, "factIds", (id) => store.contextFacts.get(id)),
    designPrinciples: collectContextChildren(designContexts, "principleIds", (id) => store.designPrinciples.get(id)),
    contextMotifs: collectContextChildren(designContexts, "motifIds", (id) => store.contextMotifs.get(id)),
    contextReferences: collectContextChildren(designContexts, "referenceIds", (id) => store.contextReferences.get(id)),
    contextReviewRubrics: collectContextChildren(designContexts, "reviewRubricIds", (id) => store.contextReviewRubrics.get(id))
  };
}

function collectContexts(store: SpeciesCompileInputRepositories, attachments: ContextAttachment[]) {
  const contextIds = unique(attachments.map((attachment) => attachment.contextId));
  const designContexts = contextIds
    .map((contextId) => store.designContexts.get(contextId))
    .filter((context): context is NonNullable<typeof context> => Boolean(context));
  return {
    designContexts,
    contextAttachments: attachments,
    contextPolicies: contextIds.flatMap((contextId) => store.contextPolicies.listByContext(contextId)),
    contextFacts: collectContextChildren(designContexts, "factIds", (id) => store.contextFacts.get(id)),
    designPrinciples: collectContextChildren(designContexts, "principleIds", (id) => store.designPrinciples.get(id)),
    contextMotifs: collectContextChildren(designContexts, "motifIds", (id) => store.contextMotifs.get(id)),
    contextReferences: collectContextChildren(designContexts, "referenceIds", (id) => store.contextReferences.get(id)),
    contextReviewRubrics: collectContextChildren(designContexts, "reviewRubricIds", (id) => store.contextReviewRubrics.get(id))
  };
}

function compileExtras(store: LayeredCompileRepositories) {
  return {
    facetDefinitions: store.facetDefinitions.list(),
    facetSchemas: store.facetSchemas.list(),
    facetAssignments: store.facetAssignments.list(),
    geneTemplates: store.templates.listTemplates()
  };
}

export function prepareEntityCompileArtifact(
  store: LayeredCompileRepositories,
  options: PrepareEntityCompileArtifactOptions
): EntityCompileArtifact {
  const artifactId = options.artifactId ?? makeId("eca");
  const atlas = options.atlasId ? store.atlases.get(options.atlasId) : undefined;
  const group = options.groupId ? store.speciesGroups.get(options.groupId) : undefined;
  const graph = options.graphId ? store.graphs.get(options.graphId) : group ? store.graphs.get(group.graphId) : undefined;
  if (options.targetLevel === "atlas" && !atlas) throw new Error(`atlas not found: ${options.atlasId}`);
  if (options.targetLevel === "graph" && !graph) throw new Error(`graph not found: ${options.graphId}`);
  if (options.targetLevel === "species-group" && (!graph || !group)) throw new Error(`species group not found: ${options.groupId}`);
  const targetAttachments =
    options.targetLevel === "atlas"
      ? store.contextAttachments.listByTarget("atlas", atlas?.atlasId ?? "")
      : options.targetLevel === "graph"
        ? store.contextAttachments.listByTarget("graph", graph?.graphId ?? "")
        : store.contextAttachments.listByTarget("species-group", group?.groupId ?? "");
  const contexts = collectContexts(store, targetAttachments);
  const upstreamArtifacts =
    options.upstreamArtifacts ??
    (options.targetLevel === "species-group" && graph
      ? [
          prepareEntityCompileArtifact(store, {
            artifactId: `${artifactId}:graph`,
            targetLevel: "graph",
            graphId: graph.graphId
          })
        ]
      : undefined);
  return compileEntityArtifact({
    artifactId,
    targetLevel: options.targetLevel,
    atlas,
    graph,
    group,
    upstreamArtifacts,
    designRelationships: graph ? store.designRelationships.listByGraph(graph.graphId) : [],
    ...contexts,
    ...compileExtras(store)
  });
}

export function prepareSpeciesCompileArtifact(
  store: LayeredCompileRepositories,
  options: PrepareSpeciesCompileArtifactOptions
): SpeciesCompileArtifact {
  return compileSpeciesSnapshot({
    artifactId: options.artifactId ?? makeId("sca"),
    ...buildSpeciesCompileInput(store, { graphId: options.graphId, nodeId: options.nodeId, nodeVersionId: options.nodeVersionId }),
    upstreamArtifacts: options.upstreamArtifacts,
    ...compileExtras(store)
  });
}

export function preparePhenotypeCompileArtifact(
  store: LayeredCompileRepositories & { speciesCompileArtifacts?: Pick<SpeciesCompileArtifactRepository, "get"> },
  options: PreparePhenotypeCompileArtifactOptions
): PhenotypeCompileArtifact {
  const compileInput = buildSpeciesCompileInput(store, {
    graphId: options.graphId,
    nodeId: options.nodeId,
    nodeVersionId: options.nodeVersionId
  });
  const speciesArtifact =
    options.speciesArtifact ??
    (options.speciesArtifactId && store.speciesCompileArtifacts ? store.speciesCompileArtifacts.get(options.speciesArtifactId) : undefined) ??
    prepareSpeciesCompileArtifact(store, { graphId: options.graphId, nodeId: options.nodeId, nodeVersionId: options.nodeVersionId });
  if (options.speciesArtifactId && speciesArtifact.artifactId !== options.speciesArtifactId) {
    throw new Error(`species compile artifact not found: ${options.speciesArtifactId}`);
  }
  return compilePhenotypeGeneration({
    artifactId: options.artifactId ?? makeId("pca"),
    graph: compileInput.graph,
    node: compileInput.node,
    nodeVersionId: compileInput.nodeVersionId,
    phenotypeType: options.phenotypeType,
    taskBrief: options.taskBrief,
    speciesArtifact,
    contextReferences: compileInput.contextReferences,
    contextReviewRubrics: compileInput.contextReviewRubrics
  });
}

export function preparePhenotypeGeneration(
  store: PhenotypeGenerationRepositories,
  options: PreparePhenotypeGenerationOptions
): PreparedPhenotypeGeneration {
  let speciesArtifact: SpeciesCompileArtifact | undefined;
  let phenotypeArtifact: PhenotypeCompileArtifact | undefined;
  let createdSpeciesArtifact = false;
  let createdPhenotypeArtifact = false;

  if (options.phenotypeArtifactId) {
    phenotypeArtifact = store.phenotypeCompileArtifacts.get(options.phenotypeArtifactId);
    if (!phenotypeArtifact) throw new Error(`phenotype compile artifact not found: ${options.phenotypeArtifactId}`);
    validatePhenotypeArtifact(phenotypeArtifact, options);
    if (!phenotypeArtifact.speciesCompileArtifactId) {
      throw new Error(`phenotype compile artifact ${phenotypeArtifact.artifactId} is missing speciesCompileArtifactId`);
    }
    if (options.speciesArtifactId && options.speciesArtifactId !== phenotypeArtifact.speciesCompileArtifactId) {
      throw new Error(
        `phenotype compile artifact ${phenotypeArtifact.artifactId} uses species artifact ${phenotypeArtifact.speciesCompileArtifactId}, not ${options.speciesArtifactId}`
      );
    }
    speciesArtifact = store.speciesCompileArtifacts.get(phenotypeArtifact.speciesCompileArtifactId);
    if (!speciesArtifact) throw new Error(`species compile artifact not found: ${phenotypeArtifact.speciesCompileArtifactId}`);
    validateSpeciesArtifact(speciesArtifact, options);
    validateSuppliedCompileArtifactsCurrent(store, options, speciesArtifact, phenotypeArtifact);
  } else {
    if (options.speciesArtifactId) {
      speciesArtifact = store.speciesCompileArtifacts.get(options.speciesArtifactId);
      if (!speciesArtifact) throw new Error(`species compile artifact not found: ${options.speciesArtifactId}`);
      validateSpeciesArtifact(speciesArtifact, options);
      validateSuppliedSpeciesArtifactCurrent(store, options, speciesArtifact);
    } else {
      speciesArtifact = prepareSpeciesCompileArtifact(store, {
        artifactId: options.ids?.speciesArtifactId ?? makeId("sca"),
        graphId: options.graphId,
        nodeId: options.nodeId,
        nodeVersionId: options.versionBinding?.nodeVersionId
      });
      createdSpeciesArtifact = true;
    }
    phenotypeArtifact = preparePhenotypeCompileArtifact(store, {
      artifactId: options.ids?.phenotypeArtifactId ?? makeId("pca"),
      graphId: options.graphId,
      nodeId: options.nodeId,
      nodeVersionId: options.versionBinding?.nodeVersionId,
      phenotypeType: options.phenotypeType,
      taskBrief: options.taskBrief,
      speciesArtifact
    });
    createdPhenotypeArtifact = true;
  }

  const phenotypeId = options.phenotypeId ?? options.ids?.phenotypeId ?? makeId("ph");
  const existingPhenotype = store.phenotypes.get(phenotypeId);
  if (
    existingPhenotype &&
    (existingPhenotype.graphId !== options.graphId ||
      existingPhenotype.nodeId !== options.nodeId ||
      existingPhenotype.phenotypeType !== options.phenotypeType)
  ) {
    throw new Error(`phenotype ${phenotypeId} belongs to a different graph, node, or type`);
  }
  const phenotype =
    existingPhenotype ??
    createDefaultPhenotype({
      graphId: options.graphId,
      nodeId: options.nodeId,
      phenotypeId,
      name: options.name,
      phenotypeType: options.phenotypeType,
      objectBrief: options.taskBrief
    });
  const phenotypeVersionId = options.ids?.phenotypeVersionId ?? makeId("pv");
  const generationJobId = options.ids?.generationJobId ?? makeId("job");
  const compileValidity = options.replayHistorical
    ? { state: "historical" as const, reasons: ["historical replay explicitly requested"] }
    : { state: "current" as const, reasons: [] };
  const phenotypeVersion = createDefaultPhenotypeVersion({
    graphId: options.graphId,
    nodeId: options.nodeId,
    phenotypeId,
    phenotypeVersionId,
    nodeVersionId: phenotypeArtifact.nodeVersionId,
    relationshipTrace: relationshipTraceFromArtifact(phenotypeArtifact),
    resolvedGeneSnapshot: phenotypeArtifact.resolvedGeneSnapshot,
    generationRecipe: {
      compilePolicy: phenotypeArtifact.compilePolicy,
      conflictReport: phenotypeArtifact.conflictReport,
      speciesCompileArtifactId: speciesArtifact.artifactId,
      phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
      jobId: generationJobId,
      generationTaskId: options.generationTaskId,
      generationPlanId: options.generationPlanId,
      versionBinding: options.versionBinding
    },
    generationBrief: options.taskBrief,
    promptSnapshot: phenotypeArtifact.prompt,
    tool: options.tool ?? "manual",
    speciesCompileArtifactId: speciesArtifact.artifactId,
    phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
    compileArtifactSnapshot: createCompileArtifactSnapshot(speciesArtifact, phenotypeArtifact, compileValidity)
  });
  const job = createGenerationJob({
    generationJobId,
    graphId: options.graphId,
    nodeId: options.nodeId,
    phenotypeId,
    phenotypeVersionId,
    phenotypeType: options.phenotypeType,
    taskBrief: options.taskBrief,
    compilePolicy: phenotypeArtifact.compilePolicy,
    inputSnapshot: {
      graphId: options.graphId,
      nodeId: options.nodeId,
      nodeVersionId: phenotypeArtifact.nodeVersionId,
      taskBrief: options.taskBrief,
      phenotypeType: options.phenotypeType,
      compileMode: options.replayHistorical ? "historical-replay" : "current",
      speciesCompileArtifactId: speciesArtifact.artifactId,
      phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
      generationTaskId: options.generationTaskId,
      generationPlanId: options.generationPlanId,
      versionBinding: options.versionBinding
    },
    outputSnapshot: {
      prompt: phenotypeArtifact.prompt,
      negativePrompt: phenotypeArtifact.negativePrompt,
      artBrief: phenotypeArtifact.artBrief,
      reviewChecklist: phenotypeArtifact.reviewChecklist
    },
    tool: options.tool ?? "manual",
    status: "generated"
  });

  return {
    artifacts: { species: speciesArtifact, phenotype: phenotypeArtifact },
    speciesArtifact,
    phenotypeArtifact,
    phenotype,
    phenotypeVersion,
    job,
    prompt: phenotypeArtifact.prompt,
    createdSpeciesArtifact,
    createdPhenotypeArtifact,
    createdPhenotype: !existingPhenotype
  };
}

export function createGenerationPlan(
  store: GenerationPlanningRepositories,
  input: Partial<PhenotypeGenerationPlan> &
    Pick<PhenotypeGenerationPlan, "planId" | "scopeType" | "scopeId" | "priority" | "description">,
  options: { apply?: boolean } = {}
) {
  if (store.generationPlans.get(input.planId)) throw new Error(`generation plan already exists: ${input.planId}`);
  const graphId = resolvePlanGraphId(store, input);
  const plan = createDefaultPhenotypeGenerationPlan({ ...input, graphId });
  if (!options.apply) return { plan, persisted: false };
  store.transaction(() => store.generationPlans.create(plan));
  return { plan, persisted: true };
}

export function createGenerationTask(
  store: GenerationPlanningRepositories,
  input: Partial<PhenotypeGenerationTask> &
    Pick<PhenotypeGenerationTask, "taskId" | "graphId" | "phenotypeType" | "taskBrief" | "priority">,
  options: { apply?: boolean } = {}
) {
  if (store.generationTasks.get(input.taskId)) throw new Error(`generation task already exists: ${input.taskId}`);
  const task = normalizeGenerationTaskInput(store, input);
  if (!options.apply) return { task, persisted: false };
  store.transaction(() => store.generationTasks.create(task));
  return { task, persisted: true };
}

export function expandGenerationPlan(
  store: GenerationPlanningRepositories,
  input: { planId: string; taskOverrides?: Partial<PhenotypeGenerationTask> },
  options: { apply?: boolean } = {}
) {
  const plan = store.generationPlans.get(input.planId);
  if (!plan) throw new Error(`generation plan not found: ${input.planId}`);
  const warnings: string[] = [];
  const targets = generationPlanTargets(store, plan);
  const existing = store.generationTasks.listByPlan(plan.planId);
  const createdTasks: PhenotypeGenerationTask[] = [];
  const skippedExistingTaskIds: string[] = [];

  for (const target of targets) {
    const taskBrief = input.taskOverrides?.taskBrief ?? target.taskBrief;
    const duplicate = existing.find((task) => task.phenotypeId === target.phenotypeId && task.taskBrief === taskBrief);
    if (duplicate) {
      skippedExistingTaskIds.push(duplicate.taskId);
      continue;
    }
    createdTasks.push(
      createDefaultPhenotypeGenerationTask({
        taskId: input.taskOverrides?.taskId ?? makeGenerationTaskId(plan.planId, target.phenotypeId ?? target.nodeId ?? target.phenotypeType),
        graphId: target.graphId,
        planId: plan.planId,
        nodeId: target.nodeId,
        phenotypeId: target.phenotypeId,
        phenotypeType: input.taskOverrides?.phenotypeType ?? target.phenotypeType,
        taskBrief,
        priority: input.taskOverrides?.priority ?? plan.priority,
        versionBinding: input.taskOverrides?.versionBinding ?? plan.versionBinding,
        modelPreference: input.taskOverrides?.modelPreference ?? plan.modelPreference,
        providerPreference: input.taskOverrides?.providerPreference ?? plan.providerPreference,
        toolPreference: input.taskOverrides?.toolPreference ?? plan.toolPreference,
        requirements: input.taskOverrides?.requirements ?? plan.requirements,
        llmInstructions: input.taskOverrides?.llmInstructions ?? plan.llmInstructions,
        operatorNotes: input.taskOverrides?.operatorNotes ?? plan.operatorNotes,
        tags: input.taskOverrides?.tags ?? plan.tags,
        metadata: input.taskOverrides?.metadata ?? plan.metadata,
        extensions: input.taskOverrides?.extensions ?? plan.extensions
      })
    );
  }

  if (targets.length === 0) {
    warnings.push(`generation plan ${plan.planId} has no planned phenotype targets`);
  }

  if (!options.apply) return { plan, createdTasks, skippedExistingTaskIds, warnings, persisted: false };
  store.transaction(() => {
    for (const task of createdTasks) store.generationTasks.create(task);
    if (createdTasks.length > 0 && plan.status !== "expanded") {
      store.generationPlans.update({ ...plan, status: "expanded", updatedAt: nowIso() });
    }
  });
  return { plan: store.generationPlans.get(plan.planId) ?? plan, createdTasks, skippedExistingTaskIds, warnings, persisted: true };
}

export function preparePhenotypeGenerationForTask(
  store: GenerationPlanningRepositories,
  input: { taskId: string; tool?: string; name?: string }
): PreparedPhenotypeGeneration {
  const task = store.generationTasks.get(input.taskId);
  if (!task) throw new Error(`generation task not found: ${input.taskId}`);
  if (!task.nodeId && !task.phenotypeId) throw new Error(`generation task ${task.taskId} is missing nodeId or phenotypeId`);
  const phenotype = task.phenotypeId ? store.phenotypes.get(task.phenotypeId) : undefined;
  const nodeId = task.nodeId ?? phenotype?.nodeId;
  if (!nodeId) throw new Error(`generation task ${task.taskId} cannot resolve nodeId`);
  const planId = task.planId;
  const speciesArtifactId = task.versionBinding.mode === "pinned" ? task.versionBinding.speciesCompileArtifactId : undefined;
  const phenotypeArtifactId = task.versionBinding.mode === "pinned" ? task.versionBinding.phenotypeCompileArtifactId : undefined;
  return preparePhenotypeGeneration(store, {
    graphId: task.graphId,
    nodeId,
    phenotypeId: task.phenotypeId,
    phenotypeType: task.phenotypeType,
    name: input.name ?? phenotype?.name ?? task.phenotypeType,
    taskBrief: task.taskBrief,
    speciesArtifactId,
    phenotypeArtifactId,
    replayHistorical: task.versionBinding.replayHistorical,
    generationTaskId: task.taskId,
    generationPlanId: planId,
    versionBinding: task.versionBinding,
    tool: input.tool ?? task.toolPreference ?? "manual"
  });
}

export function persistPhenotypeGeneration(
  store: PhenotypeGenerationPersistRepositories,
  prepared: PreparedPhenotypeGeneration,
  options: { taskId?: string } = {}
) {
  return store.transaction(() => {
    if (prepared.createdSpeciesArtifact && !store.speciesCompileArtifacts.get(prepared.speciesArtifact.artifactId)) {
      store.speciesCompileArtifacts.create(prepared.speciesArtifact);
    }
    if (prepared.createdPhenotypeArtifact && !store.phenotypeCompileArtifacts.get(prepared.phenotypeArtifact.artifactId)) {
      store.phenotypeCompileArtifacts.create(prepared.phenotypeArtifact);
    }
    if (prepared.createdPhenotype && !store.phenotypes.get(prepared.phenotype.phenotypeId)) {
      store.phenotypes.create(prepared.phenotype);
    }
    store.phenotypeVersions.create(prepared.phenotypeVersion);
    store.generationJobs.create(prepared.job);
    if (options.taskId) {
      const task = store.generationTasks.get(options.taskId);
      if (!task) throw new Error(`generation task not found: ${options.taskId}`);
      store.generationTasks.update({
        ...task,
        status: "generated",
        speciesCompileArtifactId: prepared.speciesArtifact.artifactId,
        phenotypeCompileArtifactId: prepared.phenotypeArtifact.artifactId,
        generationJobIds: unique([...task.generationJobIds, prepared.job.generationJobId]),
        phenotypeVersionIds: unique([...task.phenotypeVersionIds, prepared.phenotypeVersion.phenotypeVersionId]),
        updatedAt: nowIso()
      });
    }
    return prepared;
  });
}

function resolvePlanGraphId(
  store: GenerationPlanningRepositories,
  input: Pick<PhenotypeGenerationPlan, "scopeType" | "scopeId"> & Partial<PhenotypeGenerationPlan>
) {
  if (input.scopeType === "graph") {
    const graph = store.graphs.get(input.scopeId);
    if (!graph) throw new Error(`graph not found: ${input.scopeId}`);
    return input.scopeId;
  }
  if (input.scopeType === "species-group") {
    const group = store.speciesGroups.get(input.scopeId);
    if (!group) throw new Error(`species group not found: ${input.scopeId}`);
    if (input.graphId && group.graphId !== input.graphId) throw new Error(`species group ${input.scopeId} does not belong to graph ${input.graphId}`);
    return group.graphId;
  }
  if (input.scopeType === "species-node") {
    const node = store.nodes.get(input.scopeId);
    if (!node) throw new Error(`species node not found: ${input.scopeId}`);
    if (input.graphId && node.graphId !== input.graphId) throw new Error(`species node ${input.scopeId} does not belong to graph ${input.graphId}`);
    return node.graphId;
  }
  const phenotype = store.phenotypes.get(input.scopeId);
  if (!phenotype) throw new Error(`phenotype not found: ${input.scopeId}`);
  if (input.graphId && phenotype.graphId !== input.graphId) throw new Error(`phenotype ${input.scopeId} does not belong to graph ${input.graphId}`);
  return phenotype.graphId;
}

function normalizeGenerationTaskInput(
  store: GenerationPlanningRepositories,
  input: Partial<PhenotypeGenerationTask> &
    Pick<PhenotypeGenerationTask, "taskId" | "graphId" | "phenotypeType" | "taskBrief" | "priority">
) {
  const graph = store.graphs.get(input.graphId);
  if (!graph) throw new Error(`graph not found: ${input.graphId}`);
  if (!input.nodeId && !input.phenotypeId) throw new Error("generation task requires nodeId or phenotypeId");
  const phenotype = input.phenotypeId ? store.phenotypes.get(input.phenotypeId) : undefined;
  if (input.phenotypeId && !phenotype) throw new Error(`phenotype not found: ${input.phenotypeId}`);
  const nodeId = input.nodeId ?? phenotype?.nodeId;
  const node = nodeId ? store.nodes.get(nodeId) : undefined;
  if (nodeId && (!node || node.graphId !== input.graphId)) throw new Error(`species node not found in graph ${input.graphId}: ${nodeId}`);
  if (phenotype && phenotype.graphId !== input.graphId) throw new Error(`phenotype ${phenotype.phenotypeId} does not belong to graph ${input.graphId}`);
  return createDefaultPhenotypeGenerationTask({
    ...input,
    nodeId,
    phenotypeType: input.phenotypeType ?? phenotype?.phenotypeType ?? "image-prompt",
    taskBrief: input.taskBrief ?? phenotype?.objectBrief ?? "",
    generationJobIds: input.generationJobIds ?? [],
    phenotypeVersionIds: input.phenotypeVersionIds ?? []
  });
}

function generationPlanTargets(store: GenerationPlanningRepositories, plan: PhenotypeGenerationPlan) {
  const plannedByGraph = (graphId: string) =>
    store.phenotypes
      .listByGraph(graphId)
      .filter((phenotype) => phenotype.status === "planned")
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.phenotypeId.localeCompare(right.phenotypeId))
      .map(phenotypeTarget);

  if (plan.scopeType === "graph") {
    const targets = plannedByGraph(plan.scopeId);
    return targets.length > 0 ? targets : explicitPlanTarget(store, plan);
  }
  if (plan.scopeType === "species-group") {
    const membershipNodeIds = new Set(store.speciesGroupMemberships.listByGroup(plan.scopeId).map((membership) => membership.nodeId));
    const graphId = plan.graphId ?? resolvePlanGraphId(store, plan);
    const targets = plannedByGraph(graphId).filter((target) => target.nodeId && membershipNodeIds.has(target.nodeId));
    return targets.length > 0 ? targets : explicitPlanTarget(store, plan);
  }
  if (plan.scopeType === "species-node") {
    const graphId = plan.graphId ?? resolvePlanGraphId(store, plan);
    const targets = plannedByGraph(graphId).filter((target) => target.nodeId === plan.scopeId);
    return targets.length > 0 ? targets : explicitPlanTarget(store, plan);
  }
  const phenotype = store.phenotypes.get(plan.scopeId);
  return phenotype ? [phenotypeTarget(phenotype)] : explicitPlanTarget(store, plan);
}

function phenotypeTarget(phenotype: Phenotype) {
  return {
    graphId: phenotype.graphId,
    nodeId: phenotype.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeType: phenotype.phenotypeType,
    taskBrief: phenotype.objectBrief || phenotype.name
  };
}

function explicitPlanTarget(store: GenerationPlanningRepositories, plan: PhenotypeGenerationPlan) {
  if (!plan.phenotypeType || !plan.taskBrief) return [];
  if (plan.scopeType !== "species-node") return [];
  const graphId = plan.graphId ?? resolvePlanGraphId(store, plan);
  return [
    {
      graphId,
      nodeId: plan.scopeId,
      phenotypeId: undefined,
      phenotypeType: plan.phenotypeType,
      taskBrief: plan.taskBrief
    }
  ];
}

function makeGenerationTaskId(planId: string, targetId: string) {
  return `task-${sanitizeIdPart(planId)}-${sanitizeIdPart(targetId)}`.slice(0, 120);
}

function sanitizeIdPart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "target";
}

export function collectLineageImpact(
  store: ImpactRepositories,
  options: { graphId: string; nodeId?: string; relationshipId?: string; changedVersionId: string }
) {
  const nodes = store.nodes.listByGraph(options.graphId).map((nodeValue) => ({
    nodeId: nodeValue.nodeId,
    phenotypeVersionIds: store.phenotypeVersions.listByNode(nodeValue.nodeId).map((version) => version.phenotypeVersionId)
  }));
  const relationships = store.designRelationships
    .listByGraph(options.graphId)
    .filter((relationship) => relationship.source.type === "species-node" && relationship.target.type === "species-node")
    .map((relationship) => ({
      relationshipId: relationship.relationshipId,
      fromNodeId: relationship.source.type === "species-node" ? relationship.source.nodeId : "",
      toNodeId: relationship.target.type === "species-node" ? relationship.target.nodeId : ""
    }));
  const changedRelationship = options.relationshipId ? store.designRelationships.get(options.relationshipId) : undefined;
  if (
    options.relationshipId &&
    (!changedRelationship || changedRelationship.source.type !== "species-node" || changedRelationship.target.type !== "species-node")
  ) {
    return undefined;
  }
  const changed = options.relationshipId
    ? ({ type: "design-relationship", id: options.relationshipId, versionId: options.changedVersionId } as const)
    : options.nodeId
      ? ({ type: "node", id: options.nodeId, versionId: options.changedVersionId } as const)
      : undefined;
  return changed ? collectImpact({ changed, nodes, relationships }) : undefined;
}

export function collectGroupImpact(store: ImpactRepositories, options: { graphId: string; groupId: string }): ApplicationImpactSummary[] {
  const impacts: ApplicationImpactSummary[] = [];
  for (const membership of store.speciesGroupMemberships.listByGroup(options.groupId)) {
    impacts.push({
      objectType: "node",
      objectId: membership.nodeId,
      reason: `${membership.nodeId} belongs to changed species group ${options.groupId}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const version of store.phenotypeVersions.listByNode(membership.nodeId)) {
      impacts.push({
        objectType: "phenotype-version",
        objectId: version.phenotypeVersionId,
        reason: `${version.phenotypeVersionId} was generated from node ${membership.nodeId} in changed species group ${options.groupId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
  }
  for (const relation of store.designRelationships.listByGraph(options.graphId)) {
    if (relation.source.type !== "species-group" || relation.target.type !== "species-group") continue;
    if (relation.source.groupId !== options.groupId && relation.target.groupId !== options.groupId) continue;
    const otherGroupId = relation.source.groupId === options.groupId ? relation.target.groupId : relation.source.groupId;
    impacts.push({
      objectType: "species-group",
      objectId: otherGroupId,
      reason: `${otherGroupId} is connected to changed species group ${options.groupId} by ${relation.relationshipType}`,
      suggestedAction: "review-or-regenerate"
    });
  }
  return impacts;
}

export function collectDesignRelationshipImpact(store: ImpactRepositories, options: { relationshipId: string }): ApplicationImpactSummary[] {
  const relationship = store.designRelationships.get(options.relationshipId);
  if (!relationship) throw new Error(`design relationship not found: ${options.relationshipId}`);
  const impacts: ApplicationImpactSummary[] = [];
  if (relationship.target.type === "graph") {
    impacts.push({
      objectType: "graph",
      objectId: relationship.target.graphId,
      reason: `${relationship.target.graphId} is the target graph of changed design relationship ${options.relationshipId}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const node of store.nodes.listByGraph(relationship.target.graphId)) {
      impacts.push({
        objectType: "node",
        objectId: node.nodeId,
        reason: `${node.nodeId} belongs to target graph ${relationship.target.graphId} of changed design relationship ${options.relationshipId}`,
        suggestedAction: "review-or-regenerate"
      });
      for (const version of store.phenotypeVersions.listByNode(node.nodeId)) {
        impacts.push({
          objectType: "phenotype-version",
          objectId: version.phenotypeVersionId,
          reason: `${version.phenotypeVersionId} was generated from node ${node.nodeId} in target graph ${relationship.target.graphId}`,
          suggestedAction: "review-or-regenerate"
        });
      }
    }
    return impacts;
  }
  if (relationship.target.type === "species-group") {
    return collectGroupImpact(store, { graphId: relationship.target.graphId, groupId: relationship.target.groupId });
  }
  if (relationship.target.type !== "species-node") return impacts;
  const node = store.nodes.get(relationship.target.nodeId);
  if (!node) return impacts;
  impacts.push({
    objectType: "node",
    objectId: node.nodeId,
    reason: `${node.nodeId} is the target node of changed design relationship ${options.relationshipId}`,
    suggestedAction: "review-or-regenerate"
  });
  for (const version of store.phenotypeVersions.listByNode(node.nodeId)) {
    impacts.push({
      objectType: "phenotype-version",
      objectId: version.phenotypeVersionId,
      reason: `${version.phenotypeVersionId} was generated from target node ${node.nodeId} of changed design relationship ${options.relationshipId}`,
      suggestedAction: "review-or-regenerate"
    });
  }
  return impacts;
}

export function collectContextImpact(store: ImpactRepositories, options: { graphId: string; contextId: string }): ApplicationImpactSummary[] {
  const context = store.designContexts.get(options.contextId);
  if (!context) throw new Error(`design context not found: ${options.contextId}`);
  const impacts: ApplicationImpactSummary[] = [];
  const seen = new Set<string>();
  const pushImpact = (impact: ApplicationImpactSummary) => {
    const key = `${impact.objectType}:${impact.objectId}:${impact.reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    impacts.push(impact);
  };
  const pushNodeImpact = (nodeId: string, reason: string) => {
    const node = store.nodes.get(nodeId);
    if (!node || node.graphId !== options.graphId) return;
    pushImpact({ objectType: "node", objectId: nodeId, reason, suggestedAction: "review-or-regenerate" });
    for (const version of store.phenotypeVersions.listByNode(nodeId)) {
      pushImpact({
        objectType: "phenotype-version",
        objectId: version.phenotypeVersionId,
        reason: `${version.phenotypeVersionId} was generated from node ${nodeId} attached to changed design context ${options.contextId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
  };

  for (const attachment of store.contextAttachments.listByContext(options.contextId)) {
    collectContextAttachmentImpact(store, options, attachment, pushImpact, pushNodeImpact);
  }
  return impacts;
}

export function updatePhenotypeVersionStatus(
  store: Pick<ImpactRepositories, "phenotypeVersions">,
  options: { phenotypeVersionId: string; status: PhenotypeVersion["status"] }
) {
  store.phenotypeVersions.updateStatus(options.phenotypeVersionId, options.status);
}

function validateSpeciesArtifact(artifact: SpeciesCompileArtifact, options: Pick<PreparePhenotypeGenerationOptions, "graphId" | "nodeId">) {
  if (artifact.graphId !== options.graphId) {
    throw new Error(`species compile artifact ${artifact.artifactId} does not match graph ${options.graphId}`);
  }
  if (artifact.speciesNodeId !== options.nodeId) {
    throw new Error(`species compile artifact ${artifact.artifactId} does not match node ${options.nodeId}`);
  }
}

function validatePhenotypeArtifact(
  artifact: PhenotypeCompileArtifact,
  options: Pick<PreparePhenotypeGenerationOptions, "graphId" | "nodeId" | "phenotypeType" | "taskBrief">
) {
  if (artifact.graphId !== options.graphId) {
    throw new Error(`phenotype compile artifact ${artifact.artifactId} does not match graph ${options.graphId}`);
  }
  if (artifact.speciesNodeId !== options.nodeId) {
    throw new Error(`phenotype compile artifact ${artifact.artifactId} does not match node ${options.nodeId}`);
  }
  if (artifact.phenotypeType !== options.phenotypeType) {
    throw new Error(`phenotype compile artifact ${artifact.artifactId} does not match phenotype type ${options.phenotypeType}`);
  }
  if (artifact.taskBrief !== options.taskBrief) {
    throw new Error(`phenotype compile artifact ${artifact.artifactId} does not match task brief ${options.taskBrief}`);
  }
}

function validateSuppliedSpeciesArtifactCurrent(
  store: PhenotypeGenerationRepositories,
  options: PreparePhenotypeGenerationOptions,
  artifact: SpeciesCompileArtifact
) {
  if (options.replayHistorical) return;
  const current = prepareSpeciesCompileArtifact(store, {
    artifactId: artifact.artifactId,
    graphId: options.graphId,
    nodeId: options.nodeId
  });
  const staleness = checkCompileArtifactStaleness(artifact, current.dependencyVector);
  if (staleness.stale) {
    throw new Error(`stale compile artifact ${artifact.artifactId}: ${staleness.reasons.join("; ")}`);
  }
}

function validateSuppliedCompileArtifactsCurrent(
  store: PhenotypeGenerationRepositories,
  options: PreparePhenotypeGenerationOptions,
  speciesArtifact: SpeciesCompileArtifact,
  phenotypeArtifact: PhenotypeCompileArtifact
) {
  if (options.replayHistorical) return;
  const currentSpecies = prepareSpeciesCompileArtifact(store, {
    artifactId: speciesArtifact.artifactId,
    graphId: options.graphId,
    nodeId: options.nodeId
  });
  const speciesStaleness = checkCompileArtifactStaleness(speciesArtifact, currentSpecies.dependencyVector);
  if (speciesStaleness.stale) {
    throw new Error(`stale compile artifact ${speciesArtifact.artifactId}: ${speciesStaleness.reasons.join("; ")}`);
  }
  const currentPhenotype = preparePhenotypeCompileArtifact(store, {
    artifactId: phenotypeArtifact.artifactId,
    graphId: options.graphId,
    nodeId: options.nodeId,
    phenotypeType: options.phenotypeType,
    taskBrief: options.taskBrief,
    speciesArtifact
  });
  const phenotypeStaleness = checkCompileArtifactStaleness(phenotypeArtifact, currentPhenotype.dependencyVector);
  if (phenotypeStaleness.stale) {
    throw new Error(`stale compile artifact ${phenotypeArtifact.artifactId}: ${phenotypeStaleness.reasons.join("; ")}`);
  }
}

function relationshipTraceFromArtifact(artifact: PhenotypeCompileArtifact) {
  return unique(
    artifact.sourceTrace
      .filter((entry) => entry.objectType === "design-relationship")
      .map((entry) => entry.objectId)
  );
}

function relationDeltaFromContract(relationship: DesignRelationship) {
  const metadataDelta = relationship.metadata.deltaGenes;
  return typeof metadataDelta === "object" && metadataDelta !== null && !Array.isArray(metadataDelta)
    ? (metadataDelta as Record<string, unknown>)
    : {
        transferRule: relationship.designContract.transferRule,
        divergenceRule: relationship.designContract.divergenceRule,
        mustPreserve: relationship.designContract.mustPreserve,
        mustAvoid: relationship.designContract.mustAvoid
      };
}

function countTraceEntries(traceEntries: TraceEntry[]) {
  return traceEntries.length;
}

function createCompileArtifactSnapshot(
  speciesArtifact: SpeciesCompileArtifact,
  phenotypeArtifact: PhenotypeCompileArtifact,
  validity: { state: "current" | "stale" | "historical" | "invalid"; reasons: string[] } = { state: "current", reasons: [] }
) {
  return {
    speciesCompileArtifactId: speciesArtifact.artifactId,
    phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
    validity,
    species: {
      artifactId: speciesArtifact.artifactId,
      nodeVersionId: speciesArtifact.nodeVersionId,
      compileMode: speciesArtifact.compileMode,
      compilePolicy: speciesArtifact.compilePolicy,
      frameCount: speciesArtifact.frames.length,
      conflictCount: speciesArtifact.conflictReport.length,
      feedbackCount: speciesArtifact.feedback.length,
      sourceTraceCount: countTraceEntries(speciesArtifact.sourceTrace),
      contextTraceCount: countTraceEntries(speciesArtifact.contextTrace),
      referenceTraceCount: countTraceEntries(speciesArtifact.referenceTrace),
      decisionTraceCount: countTraceEntries(speciesArtifact.decisionTrace),
      decisionCount: speciesArtifact.decisionRequests.length + speciesArtifact.decisionPatches.length,
      openQuestions: speciesArtifact.openQuestions
    },
    phenotype: {
      artifactId: phenotypeArtifact.artifactId,
      nodeVersionId: phenotypeArtifact.nodeVersionId,
      phenotypeType: phenotypeArtifact.phenotypeType,
      taskBrief: phenotypeArtifact.taskBrief,
      compileMode: phenotypeArtifact.compileMode,
      frameCount: phenotypeArtifact.frames.length,
      promptDigest: phenotypeArtifact.prompt,
      negativePrompt: phenotypeArtifact.negativePrompt,
      artBrief: phenotypeArtifact.artBrief,
      reviewChecklist: phenotypeArtifact.reviewChecklist,
      generationConstraints: phenotypeArtifact.generationConstraints,
      conflictCount: phenotypeArtifact.conflictReport.length,
      feedbackCount: phenotypeArtifact.feedback.length,
      sourceTraceCount: countTraceEntries(phenotypeArtifact.sourceTrace),
      contextTraceCount: countTraceEntries(phenotypeArtifact.contextTrace),
      referenceTraceCount: countTraceEntries(phenotypeArtifact.referenceTrace),
      rubricTraceCount: countTraceEntries(phenotypeArtifact.rubricTrace),
      decisionTraceCount: countTraceEntries(phenotypeArtifact.decisionTrace),
      decisionCount: phenotypeArtifact.decisionRequests.length + phenotypeArtifact.decisionPatches.length,
      openQuestions: phenotypeArtifact.openQuestions
    }
  };
}

function collectContextAttachmentImpact(
  store: ImpactRepositories,
  options: { graphId: string; contextId: string },
  attachment: ContextAttachment,
  pushImpact: (impact: ApplicationImpactSummary) => void,
  pushNodeImpact: (nodeId: string, reason: string) => void
) {
  if (attachment.targetType === "graph") {
    if (attachment.targetId !== options.graphId) return;
    pushImpact({
      objectType: "graph",
      objectId: options.graphId,
      reason: `${options.graphId} is attached to changed design context ${options.contextId}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const node of store.nodes.listByGraph(options.graphId)) {
      pushNodeImpact(node.nodeId, `${node.nodeId} belongs to graph ${options.graphId} attached to changed design context ${options.contextId}`);
    }
  } else if (attachment.targetType === "species-node") {
    pushNodeImpact(attachment.targetId, `${attachment.targetId} is attached to changed design context ${options.contextId}`);
  } else if (attachment.targetType === "species-group") {
    const group = store.speciesGroups.get(attachment.targetId);
    if (!group || group.graphId !== options.graphId) return;
    pushImpact({
      objectType: "species-group",
      objectId: attachment.targetId,
      reason: `${attachment.targetId} is attached to changed design context ${options.contextId}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const membership of store.speciesGroupMemberships.listByGroup(attachment.targetId)) {
      pushNodeImpact(
        membership.nodeId,
        `${membership.nodeId} belongs to species group ${attachment.targetId} attached to changed design context ${options.contextId}`
      );
    }
  } else if (attachment.targetType === "phenotype-version") {
    const version = store.phenotypeVersions.get(attachment.targetId);
    if (!version || version.graphId !== options.graphId) return;
    pushImpact({
      objectType: "phenotype-version",
      objectId: attachment.targetId,
      reason: `${attachment.targetId} is attached to changed design context ${options.contextId}`,
      suggestedAction: "review-or-regenerate"
    });
  }
}

function collectContextChildren<T extends keyof Pick<DesignContext, "factIds" | "principleIds" | "motifIds" | "referenceIds" | "reviewRubricIds">, R>(
  contexts: DesignContext[],
  key: T,
  get: (id: string) => R | undefined
) {
  return contexts
    .flatMap((context) => context[key])
    .map((id) => get(id))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}

function unique(values: string[]) {
  return [...new Set(values)];
}
