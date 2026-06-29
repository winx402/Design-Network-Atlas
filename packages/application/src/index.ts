import {
  collectImpact,
  checkCompileArtifactStaleness,
  compileEntityArtifact,
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultAsset,
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  createDefaultPhenotypeVersion,
  createGenerationJob,
  detectSelfOptimizationCandidates,
  evaluateDesignReadinessPolicy,
  summarizePhenotypeUsageGuideForCompile,
  makeId,
  nowIso,
  type OutputReference,
  sanitizePhenotypeVersionFeedback,
  sanitizePlanningJson,
  sanitizePlanningText,
  StorageTypeSchema,
  PhenotypeGenerationPlanSchema,
  PhenotypeGenerationTaskSchema,
  type DesignReadinessPolicy,
  type DesignReadinessPolicyResult,
  type DesignReadinessResult,
  type EntityCompileArtifact,
  type AssetIndex,
  type ContextAttachment,
  type DesignRelationship,
  type DesignContext,
  type GenerationJob,
  type GenerationJobTarget,
  type GenerationVersionBinding,
  type Graph,
  type Phenotype,
  type PhenotypeUsageGuideCompileSnapshot,
  type PhenotypeGenerationPlan,
  type PhenotypeGenerationTask,
  type PhenotypeCompileArtifact,
  type PhenotypeVersionFeedback,
  type PhenotypeVersionFeedbackItem,
  type SpeciesNode,
  type PhenotypeVersion,
  type SelfOptimizationSuggestionReport,
  type SpeciesCompileArtifact,
  type TraceEntry
} from "@dna/core";
import type {
  AssetRepository,
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
  OutputReferenceRepository,
  PhenotypeCompileArtifactRepository,
  PhenotypeGenerationPlanRepository,
  PhenotypeGenerationTaskRepository,
  PhenotypeRepository,
  PhenotypeUsageGuideRepository,
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
  entityCompileArtifacts: Pick<EntityCompileArtifactRepository, "get" | "listByGraph" | "listByTarget">;
  facetDefinitions: Pick<FacetDefinitionRepository, "list">;
  facetSchemas: Pick<FacetSchemaRepository, "list">;
  facetAssignments: Pick<FacetAssignmentRepository, "list" | "listByTarget">;
  templates: Pick<TemplateRepository, "listTemplates">;
}

export interface PhenotypeGenerationRepositories extends LayeredCompileRepositories {
  phenotypes: Pick<PhenotypeRepository, "get">;
  phenotypeUsageGuides?: Pick<PhenotypeUsageGuideRepository, "getActiveByPhenotype">;
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

export interface ReferenceGenerationRepositories extends LayeredCompileRepositories {
  transaction<T>(fn: () => T): T;
  entityCompileArtifacts: Pick<EntityCompileArtifactRepository, "get" | "create" | "listByGraph" | "listByTarget">;
  generationJobs: Pick<GenerationJobRepository, "get" | "create" | "update">;
  assets: Pick<AssetRepository, "get" | "create" | "update" | "search">;
}

export type PlanningJsonPatch = {
  set?: Record<string, unknown>;
  remove?: string[];
  clear?: boolean;
};

export type PlanningTagsPatch = {
  add?: string[];
  remove?: string[];
  clear?: boolean;
};

export type GenerationPlanUpdatePatch = {
  description?: string;
  status?: PhenotypeGenerationPlan["status"];
  priority?: number;
  phenotypeType?: string;
  taskBrief?: string;
  modelPreference?: string;
  providerPreference?: string;
  toolPreference?: string;
  llmInstructions?: string;
  operatorNotes?: string;
  versionBinding?: GenerationVersionBinding;
  requirements?: PlanningJsonPatch;
  metadata?: PlanningJsonPatch;
  extensions?: PlanningJsonPatch;
  tags?: PlanningTagsPatch;
};

export type GenerationTaskUpdatePatch = {
  planId?: string;
  clearPlanId?: boolean;
  taskBrief?: string;
  status?: PhenotypeGenerationTask["status"];
  priority?: number;
  modelPreference?: string;
  providerPreference?: string;
  toolPreference?: string;
  llmInstructions?: string;
  operatorNotes?: string;
  versionBinding?: GenerationVersionBinding;
  blockingReason?: string;
  clearBlockingReason?: boolean;
  requirements?: PlanningJsonPatch;
  metadata?: PlanningJsonPatch;
  extensions?: PlanningJsonPatch;
  tags?: PlanningTagsPatch;
};

export type GenerationTaskUpdateSelector = {
  id?: string;
  planId?: string;
  graphId?: string;
  status?: PhenotypeGenerationTask["status"];
  tag?: string;
  phenotypeType?: string;
};

export interface PreparedReferenceGeneration {
  entityArtifact: EntityCompileArtifact;
  job: GenerationJob;
  prompt: string;
  artBrief: string;
  reviewChecklist: string[];
  createdEntityArtifact: boolean;
  persisted: boolean;
}

export interface ImpactRepositories {
  nodes: Pick<LineageRepository, "get" | "listByGraph">;
  designRelationships: Pick<DesignRelationshipRepository, "get" | "listByGraph">;
  phenotypeVersions: Pick<PhenotypeVersionRepository, "get" | "listByNode" | "updateLifecycleMetadata" | "updateStatus">;
  speciesGroups: Pick<SpeciesGroupRepository, "get">;
  speciesGroupMemberships: Pick<SpeciesGroupMembershipRepository, "listByGroup">;
  designContexts: Pick<DesignContextRepository, "get">;
  contextAttachments: Pick<ContextAttachmentRepository, "listByContext">;
}

export interface PhenotypeVersionLifecycleRepositories {
  transaction<T>(fn: () => T): T;
  phenotypes: Pick<PhenotypeRepository, "get" | "updateCurrentAcceptedVersion">;
  phenotypeVersions: Pick<PhenotypeVersionRepository, "get" | "listByPhenotype" | "updateLifecycleMetadata">;
  generationJobs: Pick<GenerationJobRepository, "listByGraph">;
  generationTasks: Pick<PhenotypeGenerationTaskRepository, "listByGraph">;
}

export interface OutputReferenceLifecycleRepositories {
  transaction<T>(fn: () => T): T;
  outputReferences: Pick<OutputReferenceRepository, "get" | "update" | "listByPhenotypeVersion">;
  phenotypeVersions: Pick<PhenotypeVersionRepository, "get">;
}

export type PhenotypeVersionLifecycleStatusChange = {
  phenotypeVersionId: string;
  from: PhenotypeVersion["status"];
  to: PhenotypeVersion["status"];
};

export type PhenotypeVersionLifecycleFeedbackChange = {
  phenotypeVersionId: string;
  summaryBefore?: string;
  summaryAfter?: string;
  addedFeedbackItemIds: string[];
};

export type PhenotypeVersionLifecycleResult = {
  action: string;
  persisted: boolean;
  phenotypeId: string;
  statusChanges: PhenotypeVersionLifecycleStatusChange[];
  currentAcceptedVersion: { before: string | null; after: string | null };
  feedbackChanges: PhenotypeVersionLifecycleFeedbackChange[];
  provenance: {
    generationJobIds: string[];
    generationTaskIds: string[];
    generationPlanIds: string[];
  };
  warnings: string[];
};

export type OutputReferenceLifecycleAction =
  | "accept"
  | "reject"
  | "archive"
  | "delete"
  | "mark-missing"
  | "mark-stale"
  | "replace"
  | "sync";

export type OutputReferenceLifecycleChange = {
  outputReferenceId: string;
  phenotypeVersionId: string;
  graphId: string;
  role: OutputReference["role"];
  from: OutputReference["status"];
  to: OutputReference["status"];
  metadataBefore: Record<string, unknown>;
  metadataAfter: Record<string, unknown>;
};

export type OutputReferenceLifecycleResult = {
  action: OutputReferenceLifecycleAction;
  persisted: boolean;
  phenotypeVersionId?: string;
  changes: OutputReferenceLifecycleChange[];
  warnings: string[];
};

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
  readinessPolicy?: DesignReadinessPolicy;
  ids?: {
    speciesArtifactId?: string;
    phenotypeArtifactId?: string;
    phenotypeId?: string;
    phenotypeVersionId?: string;
    generationJobId?: string;
  };
}

export type DesignReadinessTargetType = "atlas" | "graph" | "species-group" | "species-node" | "phenotype";

export interface AssessDesignReadinessOptions {
  targetType: DesignReadinessTargetType;
  targetId: string;
  graphId?: string;
  artifactId?: string;
  policy?: DesignReadinessPolicy;
}

export type DesignReadinessArtifact = EntityCompileArtifact | SpeciesCompileArtifact | PhenotypeCompileArtifact;

export interface DesignReadinessAssessmentResult {
  artifact: DesignReadinessArtifact;
  readiness: DesignReadinessResult;
  policyResult: DesignReadinessPolicyResult;
  persisted: boolean;
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
  usageGuideSnapshot?: PhenotypeUsageGuideCompileSnapshot;
  usageGuideWarning?: string;
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
    usageGuideSnapshot: options.usageGuideSnapshot,
    usageGuideWarning: options.usageGuideWarning,
    contextReferences: compileInput.contextReferences,
    contextReviewRubrics: compileInput.contextReviewRubrics
  });
}

type DesignReadinessRepositories = LayeredCompileRepositories & {
  transaction?: <T>(fn: () => T) => T;
  entityCompileArtifacts: Pick<EntityCompileArtifactRepository, "create" | "get" | "listByGraph" | "listByTarget">;
  speciesCompileArtifacts: Pick<SpeciesCompileArtifactRepository, "create" | "get" | "listByNode">;
  phenotypeCompileArtifacts: Pick<PhenotypeCompileArtifactRepository, "create" | "get" | "listByNode">;
  phenotypes: Pick<PhenotypeRepository, "get">;
  phenotypeUsageGuides?: Pick<PhenotypeUsageGuideRepository, "getActiveByPhenotype">;
};

function artifactReadiness(artifact: DesignReadinessArtifact, targetType?: DesignReadinessTargetType): DesignReadinessResult | undefined {
  const level = targetType === "species-node" ? "species-node" : targetType === "phenotype" ? "phenotype" : targetType;
  const frame = level ? artifact.frames.find((candidate) => candidate.level === level) : artifact.frames.at(-1);
  return frame?.readiness ?? artifact.frames.at(-1)?.readiness;
}

function persistReadinessArtifact(store: DesignReadinessRepositories, artifact: DesignReadinessArtifact) {
  const create = () => {
    if (artifact.compileTarget === "entity-layer") store.entityCompileArtifacts.create(artifact);
    else if (artifact.compileTarget === "species-snapshot") store.speciesCompileArtifacts.create(artifact);
    else store.phenotypeCompileArtifacts.create(artifact);
  };
  return store.transaction ? store.transaction(create) : create();
}

function latest<T>(values: T[]): T | undefined {
  return values.at(-1);
}

function prepareReadinessArtifact(store: DesignReadinessRepositories, options: AssessDesignReadinessOptions): DesignReadinessArtifact {
  if (options.targetType === "atlas") {
    return prepareEntityCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("eca"),
      targetLevel: "atlas",
      atlasId: options.targetId
    });
  }
  if (options.targetType === "graph") {
    return prepareEntityCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("eca"),
      targetLevel: "graph",
      graphId: options.targetId
    });
  }
  if (options.targetType === "species-group") {
    return prepareEntityCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("eca"),
      targetLevel: "species-group",
      graphId: options.graphId,
      groupId: options.targetId
    });
  }
  if (options.targetType === "species-node") {
    const node = store.nodes.get(options.targetId);
    if (!node) throw new Error(`species node not found: ${options.targetId}`);
    return prepareSpeciesCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("sca"),
      graphId: node.graphId,
      nodeId: node.nodeId
    });
  }
  const phenotype = store.phenotypes.get(options.targetId);
  if (!phenotype) throw new Error(`phenotype not found: ${options.targetId}`);
  const guide = store.phenotypeUsageGuides?.getActiveByPhenotype(phenotype.phenotypeId);
  return preparePhenotypeCompileArtifact(store, {
    artifactId: options.artifactId ?? makeId("pca"),
    graphId: phenotype.graphId,
    nodeId: phenotype.nodeId,
    phenotypeType: phenotype.phenotypeType,
    taskBrief: phenotype.objectBrief,
    usageGuideSnapshot: guide ? summarizePhenotypeUsageGuideForCompile(guide) : undefined,
    usageGuideWarning: guide ? undefined : `phenotype ${phenotype.phenotypeId} is missing an active usage guide`
  });
}

export function assessDesignReadiness(
  store: DesignReadinessRepositories,
  options: AssessDesignReadinessOptions,
  writeOptions: { apply?: boolean } = {}
): DesignReadinessAssessmentResult {
  const artifact = prepareReadinessArtifact(store, options);
  const readiness = artifactReadiness(artifact, options.targetType);
  if (!readiness) throw new Error(`readiness not found for ${options.targetType}:${options.targetId}`);
  const policyResult = evaluateDesignReadinessPolicy(readiness, options.policy ?? "warn");
  if (!policyResult.allowed) {
    throw new Error(`design readiness blocked for ${options.targetType}:${options.targetId}: ${policyResult.blockingIssues.join("; ")}`);
  }
  if (writeOptions.apply) persistReadinessArtifact(store, artifact);
  return { artifact, readiness, policyResult, persisted: Boolean(writeOptions.apply) };
}

export function showDesignReadiness(
  store: DesignReadinessRepositories,
  options: Pick<AssessDesignReadinessOptions, "targetType" | "targetId">
): (DesignReadinessAssessmentResult & { artifactId: string }) | undefined {
  let artifact: DesignReadinessArtifact | undefined;
  if (options.targetType === "atlas" || options.targetType === "graph" || options.targetType === "species-group") {
    artifact = latest(store.entityCompileArtifacts.listByTarget(options.targetType, options.targetId));
  } else if (options.targetType === "species-node") {
    artifact = latest(store.speciesCompileArtifacts.listByNode(options.targetId));
  } else {
    const phenotype = store.phenotypes.get(options.targetId);
    artifact = phenotype
      ? latest(
          store.phenotypeCompileArtifacts
            .listByNode(phenotype.nodeId)
            .filter((candidate) => candidate.phenotypeType === phenotype.phenotypeType)
        )
      : undefined;
  }
  const readiness = artifact ? artifactReadiness(artifact, options.targetType) : undefined;
  if (!artifact || !readiness) return undefined;
  return {
    artifactId: artifact.artifactId,
    artifact,
    readiness,
    policyResult: evaluateDesignReadinessPolicy(readiness, "warn"),
    persisted: true
  };
}

export function explainDesignReadiness(store: DesignReadinessRepositories, artifactId: string) {
  const artifact =
    store.entityCompileArtifacts.get(artifactId) ??
    store.speciesCompileArtifacts.get(artifactId) ??
    store.phenotypeCompileArtifacts.get(artifactId);
  if (!artifact) throw new Error(`compile artifact not found: ${artifactId}`);
  return {
    artifactId: artifact.artifactId,
    compileTarget: artifact.compileTarget,
    targetLevel: artifact.compileTarget === "entity-layer" ? artifact.targetLevel : artifact.compileTarget === "species-snapshot" ? "species-node" : "phenotype",
    readiness: artifact.frames.map((frame) => frame.readiness).filter(Boolean),
    frames: artifact.frames.map((frame) => ({
      frameId: frame.frameId,
      level: frame.level,
      target: frame.target,
      readiness: frame.readiness
    }))
  };
}

export function suggestSelfOptimization(input: {
  sourceId?: string;
  sourceText: string;
  targetScope?: string;
  proposalId?: string;
}): SelfOptimizationSuggestionReport {
  return detectSelfOptimizationCandidates(input);
}

export function preparePhenotypeGeneration(
  store: PhenotypeGenerationRepositories,
  options: PreparePhenotypeGenerationOptions
): PreparedPhenotypeGeneration {
  let speciesArtifact: SpeciesCompileArtifact | undefined;
  let phenotypeArtifact: PhenotypeCompileArtifact | undefined;
  let createdSpeciesArtifact = false;
  let createdPhenotypeArtifact = false;
  const phenotypeId = options.phenotypeId ?? options.ids?.phenotypeId ?? makeId("ph");
  const existingPhenotype = store.phenotypes.get(phenotypeId);
  const usageGuideSnapshot = store.phenotypeUsageGuides?.getActiveByPhenotype(phenotypeId)
    ? summarizePhenotypeUsageGuideForCompile(store.phenotypeUsageGuides.getActiveByPhenotype(phenotypeId)!)
    : undefined;
  const usageGuideWarning =
    existingPhenotype && !usageGuideSnapshot ? `phenotype ${phenotypeId} is missing an active usage guide` : undefined;

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
    if (usageGuideSnapshot && !phenotypeArtifact.usageGuideSnapshot) phenotypeArtifact = { ...phenotypeArtifact, usageGuideSnapshot };
    if (usageGuideWarning) phenotypeArtifact = addPhenotypeUsageGuideWarning(phenotypeArtifact, usageGuideWarning);
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
      speciesArtifact,
      usageGuideSnapshot,
      usageGuideWarning
    });
    createdPhenotypeArtifact = true;
  }

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
  const readinessPolicy = options.readinessPolicy ?? "warn";
  const designReadiness =
    readinessPolicy === "off"
      ? undefined
      : {
          species: artifactReadiness(speciesArtifact, "species-node"),
          phenotype: artifactReadiness(phenotypeArtifact, "phenotype")
        };
  const readinessPolicyResults =
    readinessPolicy === "off"
      ? []
      : [designReadiness?.species, designReadiness?.phenotype].map((readiness) => evaluateDesignReadinessPolicy(readiness, readinessPolicy));
  const readinessBlockers = readinessPolicyResults.filter((result) => !result.allowed).flatMap((result) => result.blockingIssues);
  if (readinessBlockers.length) {
    throw new Error(`design readiness blocked for phenotype generation: ${readinessBlockers.join("; ")}`);
  }
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
      versionBinding: options.versionBinding,
      usageGuideId: usageGuideSnapshot?.usageGuideId,
      usageGuideRevision: usageGuideSnapshot?.usageGuideRevision,
      usageGuideSnapshot,
      usageGuideWarning,
      readinessPolicy,
      designReadiness
    },
    generationBrief: options.taskBrief,
    promptSnapshot: phenotypeArtifact.prompt,
    tool: options.tool ?? "manual",
    speciesCompileArtifactId: speciesArtifact.artifactId,
    phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
    usageGuideId: usageGuideSnapshot?.usageGuideId,
    usageGuideRevision: usageGuideSnapshot?.usageGuideRevision,
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
      usageGuideId: usageGuideSnapshot?.usageGuideId,
      usageGuideRevision: usageGuideSnapshot?.usageGuideRevision,
      usageGuideSummary: usageGuideSnapshot,
      usageGuideWarning,
      readinessPolicy,
      designReadiness,
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

export function updateGenerationPlan(
  store: Pick<GenerationPlanningRepositories, "transaction" | "generationPlans">,
  input: { planId: string; patch: GenerationPlanUpdatePatch },
  options: { apply?: boolean } = {}
) {
  const before = store.generationPlans.get(input.planId);
  if (!before) throw new Error(`generation plan not found: ${input.planId}`);
  const patch = normalizeGenerationPlanPatch(input.patch);
  const after = PhenotypeGenerationPlanSchema.parse({
    ...before,
    ...planningTextPatch(patch, [
      "description",
      "phenotypeType",
      "taskBrief",
      "modelPreference",
      "providerPreference",
      "toolPreference",
      "llmInstructions",
      "operatorNotes"
    ]),
    status: patch.status ?? before.status,
    priority: patch.priority ?? before.priority,
    versionBinding: patch.versionBinding ?? before.versionBinding,
    requirements: applyPlanningJsonPatch(before.requirements, patch.requirements),
    metadata: applyPlanningJsonPatch(before.metadata, patch.metadata),
    extensions: applyPlanningJsonPatch(before.extensions, patch.extensions),
    tags: applyPlanningTagsPatch(before.tags, patch.tags),
    updatedAt: nowIso()
  });
  if (!options.apply) return { before, after, patch, persisted: false };
  store.transaction(() => store.generationPlans.update(after));
  return { before, after: store.generationPlans.get(before.planId) ?? after, patch, persisted: true };
}

export function updateGenerationTasks(
  store: Pick<GenerationPlanningRepositories, "transaction" | "generationTasks">,
  input: { selector: GenerationTaskUpdateSelector; patch: GenerationTaskUpdatePatch },
  options: { apply?: boolean } = {}
) {
  const selector = input.selector;
  if (!selector.id && !selector.planId && !selector.graphId && !selector.status && !selector.tag && !selector.phenotypeType) {
    throw new Error("generation task update requires at least one selector");
  }
  const patch = normalizeGenerationTaskPatch(input.patch);
  if (patch.status && ["generated", "completed", "failed"].includes(patch.status)) {
    throw new Error(`generation task update cannot write result status ${patch.status}; use execution or link-result workflows for result status`);
  }
  const candidates = selectGenerationTasks(store.generationTasks, selector);
  if (!candidates.length) throw new Error("generation task update selector matched no tasks");

  const skippedTaskIds: string[] = [];
  const selectedTasks = candidates.filter((task) => {
    if (!selector.id && taskHasExecutionLinks(task)) {
      skippedTaskIds.push(task.taskId);
      return false;
    }
    return true;
  });
  if (!selectedTasks.length) {
    throw new Error("generation task update selector matched only tasks with execution links; select an explicit task id for narrow safe updates");
  }
  const updatedTasks = selectedTasks.map((task) => updateGenerationTaskRecord(task, patch));
  const beforeTasks = selectedTasks;
  if (!options.apply) {
    return {
      selector,
      beforeTasks,
      updatedTasks,
      selectedTaskIds: selectedTasks.map((task) => task.taskId),
      skippedTaskIds,
      patch,
      persisted: false
    };
  }
  store.transaction(() => {
    for (const task of updatedTasks) store.generationTasks.update(task);
  });
  return {
    selector,
    beforeTasks,
    updatedTasks: updatedTasks.map((task) => store.generationTasks.get(task.taskId) ?? task),
    selectedTaskIds: selectedTasks.map((task) => task.taskId),
    skippedTaskIds,
    patch,
    persisted: true
  };
}

export function prepareReferenceGeneration(
  store: ReferenceGenerationRepositories,
  input: {
    scope: "graph" | "species-group";
    graphId: string;
    groupId?: string;
    brief: string;
    referenceType?: string;
    providerPreference?: string;
    modelPreference?: string;
    toolPreference?: string;
    llmInstructions?: string;
    operatorNotes?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    mock?: boolean;
    entityArtifactId?: string;
    ids?: { entityArtifactId?: string; generationJobId?: string };
  }
): PreparedReferenceGeneration {
  const group = input.groupId ? store.speciesGroups.get(input.groupId) : undefined;
  if (input.scope === "species-group") {
    if (!group) throw new Error(`species group not found: ${input.groupId}`);
    if (group.graphId !== input.graphId) throw new Error(`species group ${group.groupId} does not belong to graph ${input.graphId}`);
  }
  const graph = store.graphs.get(input.graphId);
  if (!graph) throw new Error(`graph not found: ${input.graphId}`);

  const target: GenerationJobTarget =
    input.scope === "graph"
      ? { type: "graph", id: graph.graphId, graphId: graph.graphId, label: graph.name }
      : { type: "species-group", id: group!.groupId, graphId: graph.graphId, label: group!.name };
  const requestedArtifactId = input.ids?.entityArtifactId ?? input.entityArtifactId;
  const existingArtifact = requestedArtifactId ? store.entityCompileArtifacts.get(requestedArtifactId) : undefined;
  const expectedTargetLevel = input.scope === "graph" ? "graph" : "species-group";
  const expectedObjectId = input.scope === "graph" ? graph.graphId : group!.groupId;
  if (existingArtifact) {
    if (existingArtifact.targetLevel !== expectedTargetLevel || existingArtifact.target.objectId !== expectedObjectId) {
      throw new Error(`entity compile artifact ${existingArtifact.artifactId} does not match ${input.scope} ${expectedObjectId}`);
    }
  }
  const entityArtifact =
    existingArtifact ??
    prepareEntityCompileArtifact(store, {
      artifactId: requestedArtifactId ?? makeId("eca"),
      targetLevel: expectedTargetLevel,
      graphId: graph.graphId,
      groupId: input.scope === "species-group" ? group!.groupId : undefined
    });

  const referenceType = sanitizePlanningText(input.referenceType) ?? "reference";
  const brief = sanitizePlanningText(input.brief) ?? "";
  const providerPreference = sanitizePlanningText(input.providerPreference);
  const modelPreference = sanitizePlanningText(input.modelPreference);
  const toolPreference = sanitizePlanningText(input.toolPreference);
  const llmInstructions = sanitizePlanningText(input.llmInstructions);
  const operatorNotes = sanitizePlanningText(input.operatorNotes);
  const metadata = sanitizePlanningJson(input.metadata);
  const prompt = [
    "Design Network Atlas reference generation request.",
    `Scope: ${target.type} ${target.id}.`,
    `Graph: ${graph.graphId} ${graph.name}.`,
    `Reference type: ${referenceType}.`,
    `Brief: ${brief}.`,
    `Entity compile artifact: ${entityArtifact.artifactId}.`,
    llmInstructions ? `LLM instructions: ${llmInstructions}.` : undefined,
    operatorNotes ? `Operator notes: ${operatorNotes}.` : undefined
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const artBrief = `${target.label ?? target.id}: ${brief}`;
  const reviewChecklist = [
    "Verify the reference stays within the graph/group design language.",
    "Verify reusable cues are expressed as reviewable references, not graph facts.",
    "Verify no private provider credentials or signed URLs are present."
  ];
  const job = createGenerationJob({
    generationJobId: input.ids?.generationJobId ?? makeId("job"),
    graphId: graph.graphId,
    generationKind: "reference",
    target,
    taskBrief: brief,
    compilePolicy: entityArtifact.compilePolicy,
    inputSnapshot: {
      scope: input.scope,
      graphId: graph.graphId,
      groupId: input.scope === "species-group" ? group!.groupId : undefined,
      entityCompileArtifactId: entityArtifact.artifactId,
      referenceType,
      providerPreference,
      modelPreference,
      toolPreference,
      llmInstructions,
      operatorNotes,
      metadata,
      tags: input.tags ?? []
    },
    outputSnapshot: {
      prompt,
      artBrief,
      reviewChecklist,
      mockResult: input.mock ? `mock ${referenceType} for ${target.type} ${target.id}` : undefined
    },
    tool: toolPreference ?? "manual",
    status: input.mock ? "generated" : "created"
  });
  return {
    entityArtifact,
    job,
    prompt,
    artBrief,
    reviewChecklist,
    createdEntityArtifact: !existingArtifact,
    persisted: false
  };
}

export function persistReferenceGeneration(store: ReferenceGenerationRepositories, prepared: PreparedReferenceGeneration): PreparedReferenceGeneration {
  return store.transaction(() => {
    if (prepared.createdEntityArtifact && !store.entityCompileArtifacts.get(prepared.entityArtifact.artifactId)) {
      store.entityCompileArtifacts.create(prepared.entityArtifact);
    }
    if (store.generationJobs.get(prepared.job.generationJobId)) {
      throw new Error(`generation job already exists: ${prepared.job.generationJobId}`);
    }
    store.generationJobs.create(prepared.job);
    return { ...prepared, persisted: true };
  });
}

type ReferenceCompletionInput = {
  note?: string;
  externalTool?: string;
  metadata?: Record<string, unknown>;
};

function assertReferenceGenerationJob(job: GenerationJob | undefined, generationJobId: string) {
  if (!job) throw new Error(`generation job not found: ${generationJobId}`);
  if (job.generationKind !== "reference") throw new Error(`generation job ${generationJobId} is not a reference generation job`);
  return job;
}

function referenceCompletionSummary(
  input: ReferenceCompletionInput,
  linkedAssetIds: string[]
): Record<string, unknown> {
  const note = sanitizePlanningText(input.note);
  const externalTool = sanitizePlanningText(input.externalTool);
  const metadata = sanitizePlanningJson(input.metadata);
  const summary: Record<string, unknown> = {
    completedAt: nowIso(),
    linkedAssetIds
  };
  if (note !== undefined) summary.note = note;
  if (externalTool !== undefined) summary.externalTool = externalTool;
  if (Object.keys(metadata).length) summary.metadata = metadata;
  return summary;
}

function collectReferenceCompletionEvidence(
  store: Pick<ReferenceGenerationRepositories, "assets">,
  generationJobId: string,
  requestedAssetIds: string[] | undefined,
  pendingAssets: AssetIndex[] = []
) {
  const assetsById = new Map<string, AssetIndex>();
  for (const asset of store.assets.search({ linkedObjectId: generationJobId })) {
    if (asset.linkedObjectType === "generation-job" && asset.linkedObjectId === generationJobId) assetsById.set(asset.assetId, asset);
  }
  for (const asset of pendingAssets) {
    if (asset.linkedObjectType === "generation-job" && asset.linkedObjectId === generationJobId) assetsById.set(asset.assetId, asset);
  }

  if (requestedAssetIds?.length) {
    const selected: AssetIndex[] = [];
    for (const assetId of requestedAssetIds) {
      const asset = assetsById.get(assetId) ?? store.assets.get(assetId);
      if (!asset || asset.linkedObjectType !== "generation-job" || asset.linkedObjectId !== generationJobId) {
        throw new Error(`reference generation completion requires output evidence linked to job ${generationJobId}; asset ${assetId} is not linked to that job`);
      }
      if (!isActiveReferenceAsset(asset)) {
        throw new Error(`reference generation completion asset ${assetId} is archived or deleted and cannot be current output evidence`);
      }
      selected.push(asset);
    }
    return selected;
  }

  const assets = [...assetsById.values()].filter(isActiveReferenceAsset);
  if (!assets.length) {
    throw new Error(`reference generation completion requires output evidence linked to job ${generationJobId}`);
  }
  return assets;
}

function prepareReferenceGenerationCompletion(
  store: Pick<ReferenceGenerationRepositories, "generationJobs" | "assets">,
  input: ReferenceCompletionInput & { generationJobId: string; assetIds?: string[] },
  pendingAssets: AssetIndex[] = []
) {
  const before = assertReferenceGenerationJob(store.generationJobs.get(input.generationJobId), input.generationJobId);
  if (before.status !== "created") {
    throw new Error(`reference generation job ${input.generationJobId} must be created before completion; current status is ${before.status}`);
  }
  const evidence = collectReferenceCompletionEvidence(store, input.generationJobId, input.assetIds, pendingAssets);
  const linkedAssetIds = unique(evidence.map((asset) => asset.assetId));
  const after: GenerationJob = {
    ...before,
    status: "generated",
    outputSnapshot: {
      ...before.outputSnapshot,
      referenceCompletion: referenceCompletionSummary(input, linkedAssetIds)
    },
    updatedAt: nowIso()
  };
  return { before, after, linkedAssetIds };
}

export function completeReferenceGeneration(
  store: Pick<ReferenceGenerationRepositories, "transaction" | "generationJobs" | "assets">,
  input: ReferenceCompletionInput & {
    generationJobId: string;
    assetIds?: string[];
  },
  options: { apply?: boolean } = {}
) {
  const prepared = prepareReferenceGenerationCompletion(store, input);
  if (!options.apply) {
    return { ...prepared, persisted: false };
  }
  return store.transaction(() => {
    store.generationJobs.update(prepared.after);
    return {
      before: prepared.before,
      after: store.generationJobs.get(input.generationJobId) ?? prepared.after,
      linkedAssetIds: prepared.linkedAssetIds,
      persisted: true
    };
  });
}

export function linkReferenceAsset(
  store: Pick<ReferenceGenerationRepositories, "transaction" | "generationJobs" | "assets">,
  input: {
    generationJobId: string;
    assetId: string;
    uri: string;
    storageType?: AssetIndex["storageType"];
    assetType?: AssetIndex["assetType"];
    role?: AssetIndex["role"];
    tags?: string[];
    description?: string;
  },
  options: { apply?: boolean; markGenerated?: boolean; completion?: ReferenceCompletionInput } = {}
) {
  const job = assertReferenceGenerationJob(store.generationJobs.get(input.generationJobId), input.generationJobId);
  if (store.assets.get(input.assetId)) throw new Error(`asset already exists: ${input.assetId}`);
  assertSafeReferenceAssetUri(input.uri);
  const storage = resolveReferenceAssetStorageType(input.uri, input.storageType);
  const asset = createDefaultAsset({
    assetId: input.assetId,
    uri: input.uri,
    storageType: storage.storageType,
    assetType: input.assetType ?? "image",
    role: input.role ?? "reference",
    linkedObjectType: "generation-job",
    linkedObjectId: input.generationJobId,
    tags: input.tags ?? [],
    description: sanitizePlanningText(input.description) ?? ""
  });
  if (!options.markGenerated) {
    if (!options.apply) return { job, asset, persisted: false, markedGenerated: false };
    store.transaction(() => store.assets.create(asset));
    return { job, asset: store.assets.get(asset.assetId) ?? asset, persisted: true, markedGenerated: false };
  }

  const completion = prepareReferenceGenerationCompletion(
    store,
    { generationJobId: input.generationJobId, ...(options.completion ?? {}), assetIds: [asset.assetId] },
    [asset]
  );
  if (!options.apply) {
    return {
      job,
      asset,
      completedJob: completion.after,
      linkedAssetIds: completion.linkedAssetIds,
      persisted: false,
      markedGenerated: true
    };
  }
  return store.transaction(() => {
    store.assets.create(asset);
    store.generationJobs.update(completion.after);
    return {
      job,
      asset: store.assets.get(asset.assetId) ?? asset,
      completedJob: store.generationJobs.get(input.generationJobId) ?? completion.after,
      linkedAssetIds: completion.linkedAssetIds,
      persisted: true,
      markedGenerated: true
    };
  });
}

export function replaceReferenceAsset(
  store: Pick<ReferenceGenerationRepositories, "transaction" | "generationJobs" | "assets">,
  input: {
    generationJobId: string;
    oldAssetId: string;
    newAssetId: string;
    uri: string;
    storageType?: AssetIndex["storageType"];
    assetType?: AssetIndex["assetType"];
    role?: AssetIndex["role"];
    tags?: string[];
    description?: string;
    note?: string;
  },
  options: { apply?: boolean } = {}
) {
  const job = assertReferenceGenerationJob(store.generationJobs.get(input.generationJobId), input.generationJobId);
  if (job.status !== "created" && job.status !== "generated") {
    throw new Error(`reference generation job ${input.generationJobId} must be created or generated before asset replacement; current status is ${job.status}`);
  }
  const oldAsset = store.assets.get(input.oldAssetId);
  if (!oldAsset) throw new Error(`old asset not found: ${input.oldAssetId}`);
  if (oldAsset.linkedObjectType !== "generation-job" || oldAsset.linkedObjectId !== input.generationJobId) {
    throw new Error(`old asset ${input.oldAssetId} is not linked to reference generation job ${input.generationJobId}`);
  }
  if (store.assets.get(input.newAssetId)) throw new Error(`asset already exists: ${input.newAssetId}`);
  assertSafeReferenceAssetUri(input.uri);
  const storage = resolveReferenceAssetStorageType(input.uri, input.storageType);
  const migratedAt = nowIso();
  const note = sanitizePlanningText(input.note);
  const migrationForOld: Record<string, unknown> = {
    supersededByAssetId: input.newAssetId,
    migratedAt
  };
  const migrationForNew: Record<string, unknown> = {
    supersedesAssetId: input.oldAssetId,
    migratedAt
  };
  if (note !== undefined) {
    migrationForOld.note = note;
    migrationForNew.note = note;
  }
  const oldAssetAfter: AssetIndex = {
    ...oldAsset,
    status: "archived",
    facets: {
      ...oldAsset.facets,
      referenceAssetMigration: migrationForOld
    },
    updatedAt: migratedAt
  };
  const newAsset = createDefaultAsset({
    assetId: input.newAssetId,
    uri: input.uri,
    storageType: storage.storageType,
    assetType: input.assetType ?? oldAsset.assetType,
    role: input.role ?? oldAsset.role,
    linkedObjectType: "generation-job",
    linkedObjectId: input.generationJobId,
    tags: input.tags ?? oldAsset.tags,
    description: sanitizePlanningText(input.description) ?? oldAsset.description,
    status: "active",
    facets: {
      referenceAssetMigration: migrationForNew
    },
    createdAt: migratedAt,
    updatedAt: migratedAt
  });
  const jobAfter = job.status === "generated" ? replaceReferenceCompletionEvidence(store, job, input.oldAssetId, input.newAssetId, migratedAt, note) : job;
  const result = {
    job,
    jobAfter,
    oldAssetBefore: oldAsset,
    oldAssetAfter,
    newAsset,
    storageType: storage.storageType,
    inferredStorageType: storage.inferredStorageType,
    migratedAt,
    persisted: false
  };
  if (!options.apply) return result;
  return store.transaction(() => {
    store.assets.update(oldAssetAfter);
    store.assets.create(newAsset);
    if (jobAfter !== job) store.generationJobs.update(jobAfter);
    return {
      ...result,
      jobAfter: store.generationJobs.get(input.generationJobId) ?? jobAfter,
      oldAssetAfter: store.assets.get(input.oldAssetId) ?? oldAssetAfter,
      newAsset: store.assets.get(input.newAssetId) ?? newAsset,
      persisted: true
    };
  });
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
  input: { taskId: string; tool?: string; name?: string; readinessPolicy?: DesignReadinessPolicy }
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
    readinessPolicy: input.readinessPolicy,
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

const outputReferenceLifecycleStatusByAction: Record<
  Exclude<OutputReferenceLifecycleAction, "replace" | "sync">,
  OutputReference["status"]
> = {
  accept: "active",
  reject: "rejected",
  archive: "archived",
  delete: "deleted",
  "mark-missing": "missing",
  "mark-stale": "stale"
};

const generatedOutputReferenceRoles = new Set<OutputReference["role"]>([
  "primary-output",
  "candidate",
  "preview",
  "runtime-export"
]);

export function acceptOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { outputReferenceId: string; reason?: string; apply?: boolean }
) {
  return updateOutputReferenceLifecycle(store, { ...options, action: "accept" });
}

export function rejectOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { outputReferenceId: string; reason?: string; apply?: boolean }
) {
  return updateOutputReferenceLifecycle(store, { ...options, action: "reject" });
}

export function archiveOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { outputReferenceId: string; reason?: string; apply?: boolean }
) {
  return updateOutputReferenceLifecycle(store, { ...options, action: "archive" });
}

export function deleteOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { outputReferenceId: string; reason?: string; apply?: boolean }
) {
  return updateOutputReferenceLifecycle(store, { ...options, action: "delete" });
}

export function markMissingOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { outputReferenceId: string; reason?: string; apply?: boolean }
) {
  return updateOutputReferenceLifecycle(store, { ...options, action: "mark-missing" });
}

export function markStaleOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { outputReferenceId: string; reason?: string; apply?: boolean }
) {
  return updateOutputReferenceLifecycle(store, { ...options, action: "mark-stale" });
}

export function updateOutputReferenceLifecycle(
  store: OutputReferenceLifecycleRepositories,
  options: {
    action: Exclude<OutputReferenceLifecycleAction, "replace" | "sync">;
    outputReferenceId: string;
    reason?: string;
    apply?: boolean;
  }
): OutputReferenceLifecycleResult {
  const reference = requireOutputReference(store, options.outputReferenceId);
  const next = withOutputReferenceLifecycle(reference, {
    action: options.action,
    to: outputReferenceLifecycleStatusByAction[options.action],
    reason: options.reason
  });
  return maybeApplyOutputReferenceChanges(store, {
    action: options.action,
    persisted: Boolean(options.apply),
    changes: [toOutputReferenceLifecycleChange(reference, next)]
  });
}

export function replaceOutputReference(
  store: OutputReferenceLifecycleRepositories,
  options: { oldOutputReferenceId: string; newOutputReferenceId: string; reason?: string; apply?: boolean }
): OutputReferenceLifecycleResult {
  const oldReference = requireOutputReference(store, options.oldOutputReferenceId);
  const newReference = requireOutputReference(store, options.newOutputReferenceId);
  if (oldReference.outputReferenceId === newReference.outputReferenceId) throw new Error("replace output references must be different ids");
  if (oldReference.phenotypeVersionId !== newReference.phenotypeVersionId) {
    throw new Error("replace output references must belong to the same phenotype version");
  }
  if (oldReference.graphId !== newReference.graphId) {
    throw new Error("replace output references must belong to the same graph");
  }
  if (oldReference.phenotypeId && newReference.phenotypeId && oldReference.phenotypeId !== newReference.phenotypeId) {
    throw new Error("replace output references must belong to the same phenotype when phenotype ids are present");
  }
  const oldNext = withOutputReferenceLifecycle(oldReference, {
    action: "replace",
    to: "archived",
    reason: options.reason,
    links: { replacedBy: newReference.outputReferenceId }
  });
  const newNext = withOutputReferenceLifecycle(newReference, {
    action: "replace",
    to: "active",
    reason: options.reason,
    links: { replaces: oldReference.outputReferenceId }
  });
  return maybeApplyOutputReferenceChanges(store, {
    action: "replace",
    persisted: Boolean(options.apply),
    phenotypeVersionId: oldReference.phenotypeVersionId,
    changes: [toOutputReferenceLifecycleChange(oldReference, oldNext), toOutputReferenceLifecycleChange(newReference, newNext)]
  });
}

export function syncOutputReferencesForPhenotypeVersion(
  store: OutputReferenceLifecycleRepositories,
  options: { phenotypeVersionId: string; reason?: string; apply?: boolean }
): OutputReferenceLifecycleResult {
  const version = store.phenotypeVersions.get(options.phenotypeVersionId);
  if (!version) throw new Error(`phenotype version not found: ${options.phenotypeVersionId}`);
  const references = store.outputReferences.listByPhenotypeVersion(options.phenotypeVersionId);
  const nextReferences: OutputReference[] = [];
  for (const reference of references) {
    if (!generatedOutputReferenceRoles.has(reference.role)) continue;
    if (reference.status === "rejected" || reference.status === "archived" || reference.status === "deleted") continue;
    const syncedStatus = syncedOutputReferenceStatus(version.status, reference.status);
    if (!syncedStatus || syncedStatus === reference.status) continue;
    nextReferences.push(
      withOutputReferenceLifecycle(reference, {
        action: "sync",
        to: syncedStatus,
        reason: options.reason ?? `sync from phenotype version status ${version.status}`
      })
    );
  }
  const currentById = new Map(references.map((reference) => [reference.outputReferenceId, reference]));
  return maybeApplyOutputReferenceChanges(store, {
    action: "sync",
    persisted: Boolean(options.apply),
    phenotypeVersionId: options.phenotypeVersionId,
    changes: nextReferences.map((nextReference) => toOutputReferenceLifecycleChange(currentById.get(nextReference.outputReferenceId)!, nextReference))
  });
}

export function submitPhenotypeVersionCandidate(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  const version = requirePhenotypeVersion(store, options.phenotypeVersionId);
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "submit-candidate",
    phenotypeId: version.phenotypeId,
    targetVersionId: version.phenotypeVersionId,
    statusChanges: [{ phenotypeVersionId: version.phenotypeVersionId, from: version.status, to: "candidate" }],
    currentAcceptedAfter: currentAcceptedBefore(store, version.phenotypeId),
    feedbackInput: options.feedback ? { message: options.feedback, source: "human" } : undefined,
    apply: options.apply
  });
}

export function acceptPhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  const version = requirePhenotypeVersion(store, options.phenotypeVersionId);
  const phenotype = requirePhenotype(store, version.phenotypeId);
  const currentAccepted = currentAcceptedBefore(store, phenotype.phenotypeId);
  const accepted = acceptedVersions(store, phenotype.phenotypeId);
  if (accepted.length > 1) throw new Error(`phenotype ${phenotype.phenotypeId} has multiple accepted versions`);
  if (currentAccepted && currentAccepted !== version.phenotypeVersionId) {
    throw new Error(`phenotype ${phenotype.phenotypeId} already has accepted version ${currentAccepted}; use replace or rollback`);
  }
  if (!["candidate", "replaced", "deprecated", "rolled-back", "accepted"].includes(version.status)) {
    throw new Error(`cannot accept phenotype version ${version.phenotypeVersionId} from status ${version.status}`);
  }
  const statusChanges =
    version.status === "accepted"
      ? []
      : [{ phenotypeVersionId: version.phenotypeVersionId, from: version.status, to: "accepted" as const }];
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "accept",
    phenotypeId: phenotype.phenotypeId,
    targetVersionId: version.phenotypeVersionId,
    statusChanges,
    currentAcceptedAfter: version.phenotypeVersionId,
    feedbackInput: options.feedback ? { message: options.feedback, source: "human" } : undefined,
    apply: options.apply
  });
}

export function rejectPhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  const version = requirePhenotypeVersion(store, options.phenotypeVersionId);
  const currentAccepted = currentAcceptedBefore(store, version.phenotypeId);
  if (currentAccepted === version.phenotypeVersionId) {
    throw new Error(`cannot reject current accepted phenotype version ${version.phenotypeVersionId}; use deprecate, replace, or rollback`);
  }
  if (!["draft", "candidate", "rejected"].includes(version.status)) {
    throw new Error(`cannot reject phenotype version ${version.phenotypeVersionId} from status ${version.status}`);
  }
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "reject",
    phenotypeId: version.phenotypeId,
    targetVersionId: version.phenotypeVersionId,
    statusChanges:
      version.status === "rejected"
        ? []
        : [{ phenotypeVersionId: version.phenotypeVersionId, from: version.status, to: "rejected" }],
    currentAcceptedAfter: currentAccepted,
    feedbackInput: options.feedback ? { message: options.feedback, source: "human" } : undefined,
    apply: options.apply
  });
}

export function replacePhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { oldPhenotypeVersionId: string; newPhenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  const oldVersion = requirePhenotypeVersion(store, options.oldPhenotypeVersionId);
  const newVersion = requirePhenotypeVersion(store, options.newPhenotypeVersionId);
  if (oldVersion.phenotypeId !== newVersion.phenotypeId) throw new Error("replace versions must belong to the same phenotype");
  const currentAccepted = currentAcceptedBefore(store, oldVersion.phenotypeId);
  if (currentAccepted !== oldVersion.phenotypeVersionId || oldVersion.status !== "accepted") {
    throw new Error(`replace old version must be the current accepted version: ${oldVersion.phenotypeVersionId}`);
  }
  if (newVersion.status !== "candidate") {
    throw new Error(`replace new version must be candidate: ${newVersion.phenotypeVersionId}`);
  }
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "replace",
    phenotypeId: oldVersion.phenotypeId,
    targetVersionId: newVersion.phenotypeVersionId,
    statusChanges: [
      { phenotypeVersionId: oldVersion.phenotypeVersionId, from: oldVersion.status, to: "replaced" },
      { phenotypeVersionId: newVersion.phenotypeVersionId, from: newVersion.status, to: "accepted" }
    ],
    currentAcceptedAfter: newVersion.phenotypeVersionId,
    feedbackInput: options.feedback ? { message: options.feedback, source: "human" } : undefined,
    apply: options.apply
  });
}

export function deprecatePhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  return singleTargetLifecycleAction(store, {
    action: "deprecate",
    phenotypeVersionId: options.phenotypeVersionId,
    to: "deprecated",
    feedback: options.feedback,
    apply: options.apply
  });
}

export function archivePhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  return singleTargetLifecycleAction(store, {
    action: "archive",
    phenotypeVersionId: options.phenotypeVersionId,
    to: "archived",
    feedback: options.feedback,
    apply: options.apply
  });
}

export function deletePhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  return singleTargetLifecycleAction(store, {
    action: "delete",
    phenotypeVersionId: options.phenotypeVersionId,
    to: "deleted",
    feedback: options.feedback,
    apply: options.apply
  });
}

export function rollbackPhenotypeVersion(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeId: string; toPhenotypeVersionId: string; feedback?: string; apply?: boolean }
) {
  const phenotype = requirePhenotype(store, options.phenotypeId);
  const currentAccepted = currentAcceptedBefore(store, phenotype.phenotypeId);
  if (!currentAccepted) throw new Error(`phenotype ${phenotype.phenotypeId} has no current accepted version to roll back`);
  if (currentAccepted === options.toPhenotypeVersionId) throw new Error("rollback target is already current accepted version");
  const currentVersion = requirePhenotypeVersion(store, currentAccepted);
  const target = requirePhenotypeVersion(store, options.toPhenotypeVersionId);
  if (target.phenotypeId !== phenotype.phenotypeId) throw new Error(`rollback target ${target.phenotypeVersionId} belongs to a different phenotype`);
  if (!["replaced", "deprecated", "rolled-back"].includes(target.status)) {
    throw new Error(`rollback target ${target.phenotypeVersionId} must be replaced, deprecated, or rolled-back`);
  }
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "rollback",
    phenotypeId: phenotype.phenotypeId,
    targetVersionId: target.phenotypeVersionId,
    statusChanges: [
      { phenotypeVersionId: currentVersion.phenotypeVersionId, from: currentVersion.status, to: "rolled-back" },
      { phenotypeVersionId: target.phenotypeVersionId, from: target.status, to: "accepted" }
    ],
    currentAcceptedAfter: target.phenotypeVersionId,
    feedbackInput: options.feedback ? { message: options.feedback, source: "human" } : undefined,
    apply: options.apply
  });
}

export function addPhenotypeVersionFeedback(
  store: PhenotypeVersionLifecycleRepositories,
  options: {
    phenotypeVersionId: string;
    message: string;
    severity?: PhenotypeVersionFeedbackItem["severity"];
    source?: PhenotypeVersionFeedbackItem["source"];
    suggestedAction?: string;
    apply?: boolean;
  }
) {
  const version = requirePhenotypeVersion(store, options.phenotypeVersionId);
  if (version.status === "deleted") throw new Error(`cannot add feedback to deleted phenotype version ${version.phenotypeVersionId}`);
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "feedback-add",
    phenotypeId: version.phenotypeId,
    targetVersionId: version.phenotypeVersionId,
    statusChanges: [],
    currentAcceptedAfter: currentAcceptedBefore(store, version.phenotypeId),
    feedbackInput: {
      message: options.message,
      source: options.source ?? "human",
      severity: options.severity ?? "info",
      suggestedAction: options.suggestedAction
    },
    apply: options.apply
  });
}

export function updatePhenotypeVersionFeedbackSummary(
  store: PhenotypeVersionLifecycleRepositories,
  options: { phenotypeVersionId: string; summary: string; apply?: boolean }
) {
  const version = requirePhenotypeVersion(store, options.phenotypeVersionId);
  if (version.status === "deleted") throw new Error(`cannot update feedback summary for deleted phenotype version ${version.phenotypeVersionId}`);
  return buildAndMaybeApplyLifecycleResult(store, {
    action: "feedback-summary",
    phenotypeId: version.phenotypeId,
    targetVersionId: version.phenotypeVersionId,
    statusChanges: [],
    currentAcceptedAfter: currentAcceptedBefore(store, version.phenotypeId),
    summaryInput: options.summary,
    apply: options.apply
  });
}

function singleTargetLifecycleAction(
  store: PhenotypeVersionLifecycleRepositories,
  options: {
    action: string;
    phenotypeVersionId: string;
    to: PhenotypeVersion["status"];
    feedback?: string;
    apply?: boolean;
  }
) {
  const version = requirePhenotypeVersion(store, options.phenotypeVersionId);
  const currentAccepted = currentAcceptedBefore(store, version.phenotypeId);
  return buildAndMaybeApplyLifecycleResult(store, {
    action: options.action,
    phenotypeId: version.phenotypeId,
    targetVersionId: version.phenotypeVersionId,
    statusChanges:
      version.status === options.to
        ? []
        : [{ phenotypeVersionId: version.phenotypeVersionId, from: version.status, to: options.to }],
    currentAcceptedAfter: currentAccepted === version.phenotypeVersionId ? null : currentAccepted,
    feedbackInput: options.feedback ? { message: options.feedback, source: "human" } : undefined,
    apply: options.apply
  });
}

function buildAndMaybeApplyLifecycleResult(
  store: PhenotypeVersionLifecycleRepositories,
  input: {
    action: string;
    phenotypeId: string;
    targetVersionId: string;
    statusChanges: PhenotypeVersionLifecycleStatusChange[];
    currentAcceptedAfter: string | null;
    feedbackInput?: {
      message: string;
      severity?: PhenotypeVersionFeedbackItem["severity"];
      source: PhenotypeVersionFeedbackItem["source"];
      suggestedAction?: string;
    };
    summaryInput?: string;
    apply?: boolean;
  }
): PhenotypeVersionLifecycleResult {
  const target = requirePhenotypeVersion(store, input.targetVersionId);
  const currentFeedback = normalizeFeedback(target.feedback);
  let nextFeedback = currentFeedback;
  const addedFeedbackItemIds: string[] = [];
  if (input.feedbackInput) {
    const feedbackId = makeId("feedback");
    addedFeedbackItemIds.push(feedbackId);
    nextFeedback = sanitizePhenotypeVersionFeedback({
      summary: nextFeedback.summary,
      items: [
        ...nextFeedback.items,
        {
          feedbackId,
          severity: input.feedbackInput.severity ?? "info",
          source: input.feedbackInput.source,
          message: input.feedbackInput.message,
          suggestedAction: input.feedbackInput.suggestedAction,
          createdAt: nowIso()
        }
      ]
    });
  }
  if (input.summaryInput !== undefined) {
    nextFeedback = sanitizePhenotypeVersionFeedback({ summary: input.summaryInput, items: nextFeedback.items });
  }
  const feedbackChanged =
    input.feedbackInput !== undefined ||
    input.summaryInput !== undefined;
  const feedbackChanges = feedbackChanged
    ? [
        {
          phenotypeVersionId: target.phenotypeVersionId,
          summaryBefore: currentFeedback.summary,
          summaryAfter: nextFeedback.summary,
          addedFeedbackItemIds
        }
      ]
    : [];
  const currentAccepted = currentAcceptedBefore(store, input.phenotypeId);
  const versionIds = unique([...input.statusChanges.map((change) => change.phenotypeVersionId), input.targetVersionId]);
  const result: PhenotypeVersionLifecycleResult = {
    action: input.action,
    persisted: Boolean(input.apply),
    phenotypeId: input.phenotypeId,
    statusChanges: input.statusChanges,
    currentAcceptedVersion: { before: currentAccepted, after: input.currentAcceptedAfter },
    feedbackChanges,
    provenance: inferLifecycleProvenance(store, target.graphId, input.phenotypeId, versionIds),
    warnings: []
  };

  if (!input.apply) return { ...result, persisted: false };
  store.transaction(() => {
    for (const change of input.statusChanges) {
      store.phenotypeVersions.updateLifecycleMetadata(change.phenotypeVersionId, { status: change.to });
    }
    if (feedbackChanged) {
      store.phenotypeVersions.updateLifecycleMetadata(target.phenotypeVersionId, { feedback: nextFeedback });
    }
    if (currentAccepted !== input.currentAcceptedAfter) {
      store.phenotypes.updateCurrentAcceptedVersion(input.phenotypeId, input.currentAcceptedAfter);
    }
  });
  return result;
}

function requireOutputReference(store: Pick<OutputReferenceLifecycleRepositories, "outputReferences">, outputReferenceId: string) {
  const reference = store.outputReferences.get(outputReferenceId);
  if (!reference) throw new Error(`output reference not found: ${outputReferenceId}`);
  return reference;
}

function withOutputReferenceLifecycle(
  reference: OutputReference,
  input: {
    action: OutputReferenceLifecycleAction;
    to: OutputReference["status"];
    reason?: string;
    links?: Record<string, string>;
  }
): OutputReference {
  const timestamp = nowIso();
  const sanitizedReason = sanitizePlanningText(input.reason);
  const lifecycle = sanitizePlanningJson({
    ...recordFromUnknown(reference.metadata.lifecycle),
    action: input.action,
    statusFrom: reference.status,
    statusTo: input.to,
    updatedAt: timestamp,
    source: "cli",
    ...(sanitizedReason ? { reason: sanitizedReason } : {}),
    ...(input.links ?? {})
  });
  return {
    ...reference,
    status: input.to,
    metadata: sanitizePlanningJson({
      ...reference.metadata,
      lifecycle
    }),
    updatedAt: timestamp
  };
}

function toOutputReferenceLifecycleChange(before: OutputReference, after: OutputReference): OutputReferenceLifecycleChange {
  return {
    outputReferenceId: before.outputReferenceId,
    phenotypeVersionId: before.phenotypeVersionId,
    graphId: before.graphId,
    role: before.role,
    from: before.status,
    to: after.status,
    metadataBefore: before.metadata,
    metadataAfter: after.metadata
  };
}

function maybeApplyOutputReferenceChanges(
  store: OutputReferenceLifecycleRepositories,
  input: {
    action: OutputReferenceLifecycleAction;
    persisted: boolean;
    phenotypeVersionId?: string;
    changes: OutputReferenceLifecycleChange[];
  }
): OutputReferenceLifecycleResult {
  const result: OutputReferenceLifecycleResult = {
    action: input.action,
    persisted: input.persisted,
    phenotypeVersionId: input.phenotypeVersionId,
    changes: input.changes,
    warnings: []
  };
  if (!input.persisted || input.changes.length === 0) return result;
  store.transaction(() => {
    for (const change of input.changes) {
      const current = requireOutputReference(store, change.outputReferenceId);
      store.outputReferences.update({
        ...current,
        status: change.to,
        metadata: change.metadataAfter,
        updatedAt: nowIso()
      });
    }
  });
  return result;
}

function syncedOutputReferenceStatus(
  phenotypeVersionStatus: PhenotypeVersion["status"],
  outputReferenceStatus: OutputReference["status"]
): OutputReference["status"] | undefined {
  if (phenotypeVersionStatus === "accepted") {
    if (outputReferenceStatus === "pending" || outputReferenceStatus === "stale") return "active";
    return undefined;
  }
  if (phenotypeVersionStatus === "rejected" || phenotypeVersionStatus === "deleted") {
    if (outputReferenceStatus === "pending" || outputReferenceStatus === "active" || outputReferenceStatus === "stale" || outputReferenceStatus === "missing") {
      return "rejected";
    }
    return undefined;
  }
  if (phenotypeVersionStatus === "replaced" || phenotypeVersionStatus === "rolled-back" || phenotypeVersionStatus === "deprecated") {
    if (outputReferenceStatus === "pending" || outputReferenceStatus === "active" || outputReferenceStatus === "stale" || outputReferenceStatus === "missing") {
      return "archived";
    }
  }
  return undefined;
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeFeedback(feedback: PhenotypeVersionFeedback | undefined): PhenotypeVersionFeedback {
  return { summary: feedback?.summary, items: feedback?.items ?? [] };
}

function requirePhenotypeVersion(store: Pick<PhenotypeVersionLifecycleRepositories, "phenotypeVersions">, phenotypeVersionId: string) {
  const version = store.phenotypeVersions.get(phenotypeVersionId);
  if (!version) throw new Error(`phenotype version not found: ${phenotypeVersionId}`);
  return version;
}

function requirePhenotype(store: Pick<PhenotypeVersionLifecycleRepositories, "phenotypes">, phenotypeId: string) {
  const phenotype = store.phenotypes.get(phenotypeId);
  if (!phenotype) throw new Error(`phenotype not found: ${phenotypeId}`);
  return phenotype;
}

function acceptedVersions(store: Pick<PhenotypeVersionLifecycleRepositories, "phenotypeVersions">, phenotypeId: string) {
  return store.phenotypeVersions.listByPhenotype(phenotypeId).filter((version) => version.status === "accepted");
}

function currentAcceptedBefore(store: Pick<PhenotypeVersionLifecycleRepositories, "phenotypes" | "phenotypeVersions">, phenotypeId: string) {
  const phenotype = requirePhenotype(store, phenotypeId);
  if (phenotype.currentAcceptedVersion) return phenotype.currentAcceptedVersion;
  const accepted = acceptedVersions(store, phenotypeId);
  return accepted[0]?.phenotypeVersionId ?? null;
}

function inferLifecycleProvenance(
  store: Pick<PhenotypeVersionLifecycleRepositories, "generationJobs" | "generationTasks">,
  graphId: string,
  phenotypeId: string,
  phenotypeVersionIds: string[]
) {
  const versionIds = new Set(phenotypeVersionIds);
  const jobs = store.generationJobs
    .listByGraph(graphId)
    .filter((job) => job.phenotypeId === phenotypeId && job.phenotypeVersionId && versionIds.has(job.phenotypeVersionId));
  const tasks = store.generationTasks
    .listByGraph(graphId)
    .filter((task) => task.phenotypeId === phenotypeId || task.phenotypeVersionIds.some((versionId) => versionIds.has(versionId)));
  return {
    generationJobIds: unique(jobs.map((job) => job.generationJobId)),
    generationTaskIds: unique([
      ...tasks.map((task) => task.taskId),
      ...jobs.map((job) => stringFromRecord(job.inputSnapshot, "generationTaskId")).filter((value): value is string => Boolean(value))
    ]),
    generationPlanIds: unique([
      ...tasks.map((task) => task.planId).filter((value): value is string => Boolean(value)),
      ...jobs.map((job) => stringFromRecord(job.inputSnapshot, "generationPlanId")).filter((value): value is string => Boolean(value))
    ])
  };
}

function stringFromRecord(value: Record<string, unknown>, key: string) {
  const entry = value[key];
  return typeof entry === "string" ? entry : undefined;
}

function normalizeGenerationPlanPatch(patch: GenerationPlanUpdatePatch): GenerationPlanUpdatePatch {
  return {
    ...patch,
    description: sanitizePlanningText(patch.description),
    phenotypeType: sanitizePlanningText(patch.phenotypeType),
    taskBrief: sanitizePlanningText(patch.taskBrief),
    modelPreference: sanitizePlanningText(patch.modelPreference),
    providerPreference: sanitizePlanningText(patch.providerPreference),
    toolPreference: sanitizePlanningText(patch.toolPreference),
    llmInstructions: sanitizePlanningText(patch.llmInstructions),
    operatorNotes: sanitizePlanningText(patch.operatorNotes),
    requirements: normalizePlanningJsonPatch(patch.requirements),
    metadata: normalizePlanningJsonPatch(patch.metadata),
    extensions: normalizePlanningJsonPatch(patch.extensions),
    tags: normalizePlanningTagsPatch(patch.tags)
  };
}

function normalizeGenerationTaskPatch(patch: GenerationTaskUpdatePatch): GenerationTaskUpdatePatch {
  return {
    ...patch,
    taskBrief: sanitizePlanningText(patch.taskBrief),
    modelPreference: sanitizePlanningText(patch.modelPreference),
    providerPreference: sanitizePlanningText(patch.providerPreference),
    toolPreference: sanitizePlanningText(patch.toolPreference),
    llmInstructions: sanitizePlanningText(patch.llmInstructions),
    operatorNotes: sanitizePlanningText(patch.operatorNotes),
    blockingReason: sanitizePlanningText(patch.blockingReason),
    requirements: normalizePlanningJsonPatch(patch.requirements),
    metadata: normalizePlanningJsonPatch(patch.metadata),
    extensions: normalizePlanningJsonPatch(patch.extensions),
    tags: normalizePlanningTagsPatch(patch.tags)
  };
}

function normalizePlanningJsonPatch(patch: PlanningJsonPatch | undefined): PlanningJsonPatch | undefined {
  if (!patch) return undefined;
  return {
    clear: patch.clear,
    remove: patch.remove,
    set: sanitizePlanningJson(patch.set)
  };
}

function normalizePlanningTagsPatch(patch: PlanningTagsPatch | undefined): PlanningTagsPatch | undefined {
  if (!patch) return undefined;
  return {
    clear: patch.clear,
    add: patch.add?.filter(Boolean),
    remove: patch.remove?.filter(Boolean)
  };
}

function planningTextPatch<T extends GenerationPlanUpdatePatch | GenerationTaskUpdatePatch>(patch: T, keys: (keyof T)[]) {
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = patch[key];
    if (typeof value === "string") result[String(key)] = value;
  }
  return result;
}

function applyPlanningJsonPatch(current: Record<string, unknown>, patch: PlanningJsonPatch | undefined) {
  if (!patch) return current;
  const next: Record<string, unknown> = patch.clear ? {} : { ...current };
  for (const key of patch.remove ?? []) delete next[key];
  Object.assign(next, sanitizePlanningJson(patch.set));
  return next;
}

function applyPlanningTagsPatch(current: string[], patch: PlanningTagsPatch | undefined) {
  if (!patch) return current;
  const removed = new Set(patch.remove ?? []);
  const next = patch.clear ? [] : current.filter((tag) => !removed.has(tag));
  for (const tag of patch.add ?? []) {
    if (!next.includes(tag)) next.push(tag);
  }
  return next;
}

function selectGenerationTasks(
  repository: Pick<PhenotypeGenerationTaskRepository, "get" | "list" | "listByPlan" | "listByGraph">,
  selector: GenerationTaskUpdateSelector
) {
  let tasks: PhenotypeGenerationTask[] = [];
  if (selector.id) {
    const task = repository.get(selector.id);
    tasks = task ? [task] : [];
  } else if (selector.planId) {
    tasks = repository.listByPlan(selector.planId);
  } else if (selector.graphId) {
    tasks = repository.listByGraph(selector.graphId);
  } else {
    tasks = repository.list();
  }
  return tasks
    .filter((task) => !selector.planId || task.planId === selector.planId)
    .filter((task) => !selector.graphId || task.graphId === selector.graphId)
    .filter((task) => !selector.status || task.status === selector.status)
    .filter((task) => !selector.tag || task.tags.includes(selector.tag))
    .filter((task) => !selector.phenotypeType || task.phenotypeType === selector.phenotypeType)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.taskId.localeCompare(right.taskId));
}

function updateGenerationTaskRecord(task: PhenotypeGenerationTask, patch: GenerationTaskUpdatePatch) {
  if ((patch.clearPlanId || patch.planId !== undefined) && taskHasExecutionLinks(task)) {
    throw new Error(`cannot change planId after execution links exist for generation task ${task.taskId}`);
  }
  const nextPlanId = patch.clearPlanId ? undefined : patch.planId !== undefined ? patch.planId : task.planId;
  const status = patch.status ?? task.status;
  const blockingReason = patch.clearBlockingReason ? undefined : patch.blockingReason ?? task.blockingReason;
  if (blockingReason && status !== "blocked") throw new Error("blockingReason requires status blocked");
  return PhenotypeGenerationTaskSchema.parse({
    ...task,
    ...planningTextPatch(patch, [
      "taskBrief",
      "modelPreference",
      "providerPreference",
      "toolPreference",
      "llmInstructions",
      "operatorNotes",
      "blockingReason"
    ]),
    planId: nextPlanId,
    status,
    priority: patch.priority ?? task.priority,
    versionBinding: patch.versionBinding ?? task.versionBinding,
    blockingReason,
    requirements: applyPlanningJsonPatch(task.requirements, patch.requirements),
    metadata: applyPlanningJsonPatch(task.metadata, patch.metadata),
    extensions: applyPlanningJsonPatch(task.extensions, patch.extensions),
    tags: applyPlanningTagsPatch(task.tags, patch.tags),
    updatedAt: nowIso()
  });
}

function taskHasExecutionLinks(task: PhenotypeGenerationTask) {
  return Boolean(task.generationJobIds.length || task.phenotypeVersionIds.length || task.speciesCompileArtifactId || task.phenotypeCompileArtifactId);
}

function assertSafeReferenceAssetUri(uri: string) {
  if (
    /(?:[?&](?:token|signature|sig|X-Amz-Signature|se|sp|sv)=)/i.test(uri) ||
    /https?:\/\/private\./i.test(uri) ||
    /(?:api[_-]?key|credential|password|private[_-]?key|secret|bearer)/i.test(uri) ||
    /^\/Users\//.test(uri) ||
    /^file:\/\//i.test(uri) ||
    /^~\//.test(uri) ||
    /^\/(?!\/)/.test(uri)
  ) {
    throw new Error("private or credential-bearing asset uri is not allowed");
  }
}

function isActiveReferenceAsset(asset: AssetIndex) {
  return asset.status !== "archived" && asset.status !== "deleted";
}

function resolveReferenceAssetStorageType(uri: string, explicitStorageType?: AssetIndex["storageType"]) {
  const parsed = explicitStorageType ? StorageTypeSchema.safeParse(explicitStorageType) : undefined;
  if (parsed && !parsed.success) throw new Error(`invalid storage type: ${explicitStorageType}`);
  const scheme = uri.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
  const knownSchemeStorage: Record<string, AssetIndex["storageType"]> = {
    eagle: "eagle",
    local: "local",
    http: "url",
    https: "url",
    nas: "nas",
    git: "git",
    "git+ssh": "git",
    s3: "object-storage",
    oss: "object-storage",
    gs: "object-storage",
    r2: "object-storage"
  };
  const inferredStorageType = scheme ? knownSchemeStorage[scheme] ?? "other" : "local";
  if (scheme && knownSchemeStorage[scheme] && explicitStorageType && explicitStorageType !== inferredStorageType) {
    throw new Error(`storage type ${explicitStorageType} conflicts with inferred storage type ${inferredStorageType} for ${scheme} URI`);
  }
  return {
    storageType: explicitStorageType ?? inferredStorageType,
    inferredStorageType
  };
}

function replaceReferenceCompletionEvidence(
  store: Pick<ReferenceGenerationRepositories, "assets">,
  job: GenerationJob,
  oldAssetId: string,
  newAssetId: string,
  migratedAt: string,
  note: string | undefined
): GenerationJob {
  const completion = isRecord(job.outputSnapshot.referenceCompletion) ? job.outputSnapshot.referenceCompletion : {};
  const currentIds = Array.isArray(completion.linkedAssetIds)
    ? completion.linkedAssetIds.filter((value): value is string => typeof value === "string")
    : [];
  const migratedIds = currentIds.map((assetId) => (assetId === oldAssetId ? newAssetId : assetId)).filter((assetId) => assetId !== oldAssetId);
  const activeIds = migratedIds.filter((assetId) => {
    if (assetId === newAssetId) return true;
    const asset = store.assets.get(assetId);
    return asset ? isActiveReferenceAsset(asset) : true;
  });
  const linkedAssetIds = unique([...activeIds, newAssetId]);
  const migration: Record<string, unknown> = { oldAssetId, newAssetId, migratedAt };
  if (note !== undefined) migration.note = note;
  const priorMigrations = Array.isArray(completion.referenceAssetMigrations) ? completion.referenceAssetMigrations : [];
  return {
    ...job,
    outputSnapshot: {
      ...job.outputSnapshot,
      referenceCompletion: {
        ...completion,
        linkedAssetIds,
        referenceAssetMigrations: [...priorMigrations, migration]
      }
    },
    updatedAt: migratedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
  store.phenotypeVersions.updateLifecycleMetadata(options.phenotypeVersionId, { status: options.status });
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
      readiness: artifactReadiness(speciesArtifact, "species-node"),
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
      readiness: artifactReadiness(phenotypeArtifact, "phenotype"),
      promptDigest: phenotypeArtifact.prompt,
      negativePrompt: phenotypeArtifact.negativePrompt,
      artBrief: phenotypeArtifact.artBrief,
      usageGuideSnapshot: phenotypeArtifact.usageGuideSnapshot,
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

function addPhenotypeUsageGuideWarning(artifact: PhenotypeCompileArtifact, reason: string): PhenotypeCompileArtifact {
  if (artifact.feedback.some((item) => item.reason === reason)) return artifact;
  const feedback = [
    ...artifact.feedback,
    {
      feedbackId: `${artifact.artifactId}:usage-guide-warning`,
      severity: "warning" as const,
      targetLevel: "phenotype" as const,
      target: { objectType: "phenotype" as const, objectId: `${artifact.speciesNodeId}:${artifact.phenotypeType}`, graphId: artifact.graphId },
      reason,
      suggestedAction: "create or attach a phenotype usage guide before production generation",
      sourceObjectIds: []
    }
  ];
  return {
    ...artifact,
    feedback,
    frames: artifact.frames.map((frame) =>
      frame.level === "phenotype" && !frame.feedback.some((item) => item.reason === reason) ? { ...frame, feedback: [...frame.feedback, feedback.at(-1)!] } : frame
    )
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
