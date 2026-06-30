import {
  Atlas,
  CompileConflict,
  CompileDecisionRequest,
  CompileDecisionPatch,
  CompileDependencyRef,
  CompileEntityRef,
  CompileFeedback,
  CompileFrame,
  CompileFrameLevel,
  CompileScope,
  CompileSnapshotEntry,
  ContextAttachment,
  ContextFact,
  ContextPolicy,
  ContextReference,
  ContextReviewRubric,
  DesignContext,
  DesignPrinciple,
  DesignRelationship,
  ContextMotif,
  Graph,
  GeneTemplate,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  EntityCompileArtifact,
  PhenotypeCompileArtifact,
  ProductionIntent,
  PhenotypeUsageGuideCompileSnapshot,
  SpeciesGroup,
  SpeciesCompileArtifact,
  TraceEntry,
  SpeciesNode
} from "./schemas.js";
import { isFixedRuleEligibleRelation } from "./populations.js";

export interface GeneConflict {
  key: string;
  previousValue: unknown;
  nextValue: unknown;
  source: string;
  resolution: "override" | "same-value";
}

export interface CompileSpeciesInput {
  graph: Graph;
  node: SpeciesNode;
  parentSnapshots?: Array<{ nodeVersionId: string; parentNodeId?: string; role?: string; snapshot: Record<string, unknown> }>;
  relationshipDeltas?: Array<{ relationshipId: string; delta: Record<string, unknown> }>;
  speciesGroups?: SpeciesGroup[];
  designRelationships?: DesignRelationship[];
  designContexts?: DesignContext[];
  contextAttachments?: ContextAttachment[];
  contextPolicies?: ContextPolicy[];
  fixedSnapshot?: Record<string, unknown>;
  taskBrief: string;
  phenotypeType: string;
}

export interface CompileContextTraceItem {
  sourceType: "species-group" | "design-relationship" | "design-context";
  sourceId: string;
  relationType?: string;
  compileLayer?: string;
  role?: string;
  strength?: string;
  summary: string;
  fixedRuleEligible: boolean;
}

export interface CompileSpeciesResult {
  compilePolicy: string;
  candidateGenes: Record<string, unknown>;
  conflicts: GeneConflict[];
  resolvedGeneSnapshot: Record<string, unknown>;
  contextTrace: CompileContextTraceItem[];
  prompt: string;
  brief: string;
  relationshipTrace: string[];
}

export interface CompileSpeciesSnapshotInput {
  artifactId: string;
  graph: Graph;
  node: SpeciesNode;
  nodeVersionId: string;
  compileMode?: SpeciesCompileArtifact["compileMode"];
  compiledBy?: string;
  assistantContributionSummary?: string;
  inputSummary?: Record<string, unknown>;
  compileScope?: Partial<CompileScope>;
  parentSnapshots?: Array<{ nodeVersionId: string; parentNodeId?: string; role?: string; snapshot: Record<string, unknown> }>;
  relationshipDeltas?: Array<{ relationshipId: string; delta: Record<string, unknown> }>;
  speciesGroups?: SpeciesGroup[];
  designRelationships?: DesignRelationship[];
  designContexts?: DesignContext[];
  contextAttachments?: ContextAttachment[];
  contextPolicies?: ContextPolicy[];
  contextFacts?: ContextFact[];
  designPrinciples?: DesignPrinciple[];
  contextMotifs?: ContextMotif[];
  contextReferences?: ContextReference[];
  contextReviewRubrics?: ContextReviewRubric[];
  geneTemplates?: GeneTemplate[];
  facetDefinitions?: FacetDefinition[];
  facetSchemas?: FacetSchema[];
  facetAssignments?: FacetAssignment[];
  upstreamArtifacts?: EntityCompileArtifact[];
  decisionPatches?: CompileDecisionPatch[];
  assistantSuggestions?: Array<{ fieldPath: string; valueSummary: string }>;
  llmSuggestions?: Array<{ fieldPath: string; valueSummary: string }>;
}

export interface CompilePhenotypeGenerationInput {
  artifactId: string;
  graph: Graph;
  node: SpeciesNode;
  nodeVersionId: string;
  phenotypeType: string;
  taskBrief: string;
  compileMode?: PhenotypeCompileArtifact["compileMode"];
  compiledBy?: string;
  assistantContributionSummary?: string;
  inputSummary?: Record<string, unknown>;
  compileScope?: Partial<CompileScope>;
  speciesArtifact?: SpeciesCompileArtifact;
  resolvedGeneSnapshot?: Record<string, unknown>;
  contextReferences?: ContextReference[];
  contextReviewRubrics?: ContextReviewRubric[];
  usageGuideSnapshot?: PhenotypeUsageGuideCompileSnapshot;
  usageGuideWarning?: string;
  productionIntent?: ProductionIntent;
  generationConstraints?: Record<string, unknown>;
  decisionPatches?: CompileDecisionPatch[];
}

export interface CompileOutdatedCheckInput {
  objectType: string;
  objectId: string;
  versionId?: string;
}

export interface CompileOutdatedCheckResult {
  outdated: boolean;
  reasons: string[];
  matchedTrace: TraceEntry[];
}

export interface CompileArtifactStalenessResult {
  stale: boolean;
  state: "current" | "stale" | "historical" | "invalid";
  reasons: string[];
}

export interface CompileEntityArtifactInput {
  artifactId: string;
  targetLevel: "atlas" | "graph" | "species-group";
  atlas?: Atlas;
  graph?: Graph;
  group?: SpeciesGroup;
  compileMode?: EntityCompileArtifact["compileMode"];
  compiledBy?: string;
  assistantContributionSummary?: string;
  inputSummary?: Record<string, unknown>;
  compileScope?: Partial<CompileScope>;
  upstreamArtifacts?: EntityCompileArtifact[];
  designRelationships?: DesignRelationship[];
  designContexts?: DesignContext[];
  contextAttachments?: ContextAttachment[];
  facetDefinitions?: FacetDefinition[];
  facetSchemas?: FacetSchema[];
  facetAssignments?: FacetAssignment[];
  geneTemplates?: GeneTemplate[];
  decisionPatches?: CompileDecisionPatch[];
}

function mergeWithConflicts(
  target: Record<string, unknown>,
  next: Record<string, unknown>,
  source: string,
  conflicts: GeneConflict[]
) {
  for (const [key, value] of Object.entries(next)) {
    if (key in target && JSON.stringify(target[key]) !== JSON.stringify(value)) {
      conflicts.push({
        key,
        previousValue: target[key],
        nextValue: value,
        source,
        resolution: "override"
      });
    }
    target[key] = value;
  }
}

function defaultCompileScope(input?: Partial<CompileScope>): CompileScope {
  return {
    includeDirectAttachments: input?.includeDirectAttachments ?? true,
    includeInheritedContext: input?.includeInheritedContext ?? true,
    includeDesignRelationships: input?.includeDesignRelationships ?? true,
    includeReferencedPhenotypes: input?.includeReferencedPhenotypes ?? false,
    atlasScope: input?.atlasScope ?? "none",
    maxReferenceDepth: input?.maxReferenceDepth ?? 1,
    reasons: input?.reasons ?? ["default scoped compile"]
  };
}

function summarizeValue(value: unknown): string {
  if (typeof value === "string") return value;
  const json = JSON.stringify(value);
  return json.length > 160 ? `${json.slice(0, 157)}...` : json;
}

function trace(
  input: Omit<TraceEntry, "metadata" | "priority" | "overridable" | "resolutionRule"> &
    Partial<Pick<TraceEntry, "priority" | "overridable" | "resolutionRule">> & { metadata?: Record<string, unknown> }
): TraceEntry {
  return {
    objectType: input.objectType,
    objectId: input.objectId,
    versionId: input.versionId,
    layer: input.layer,
    fieldPath: input.fieldPath,
    valueSummary: input.valueSummary,
    decision: input.decision,
    priority: input.priority ?? 0,
    overridable: input.overridable ?? true,
    resolutionRule: input.resolutionRule ?? "merge",
    metadata: input.metadata ?? {}
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`).join(",")}}`;
}

function contentHash(value: unknown): string {
  const source = stableStringify(value);
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) hash = (hash * 33) ^ source.charCodeAt(index);
  return `h${(hash >>> 0).toString(36)}`;
}

function dependencyKey(ref: Pick<CompileDependencyRef, "objectType" | "objectId">) {
  return `${ref.objectType}:${ref.objectId}`;
}

function uniqueDependencies(refs: CompileDependencyRef[]) {
  const byKey = new Map<string, CompileDependencyRef>();
  for (const ref of refs) byKey.set(dependencyKey(ref), ref);
  return [...byKey.values()].sort((left, right) => dependencyKey(left).localeCompare(dependencyKey(right)));
}

function targetRefFor(input: { atlas?: Atlas; graph?: Graph; group?: SpeciesGroup; node?: SpeciesNode; phenotypeType?: string }): CompileEntityRef {
  if (input.group) return { objectType: "species-group", objectId: input.group.groupId, graphId: input.group.graphId, label: input.group.name };
  if (input.node) return { objectType: "species-node", objectId: input.node.nodeId, graphId: input.node.graphId, label: input.node.name };
  if (input.graph) return { objectType: "graph", objectId: input.graph.graphId, graphId: input.graph.graphId, label: input.graph.name };
  if (input.atlas) return { objectType: "atlas", objectId: input.atlas.atlasId, label: input.atlas.name };
  return { objectType: "phenotype", objectId: input.phenotypeType ?? "phenotype", label: input.phenotypeType };
}

function snapshotEntry(input: {
  objectType: string;
  objectId: string;
  fieldPath?: string;
  summary?: string;
  value?: unknown;
  role?: string;
}): CompileSnapshotEntry {
  return {
    objectType: input.objectType,
    objectId: input.objectId,
    fieldPath: input.fieldPath ?? "",
    summary: input.summary ?? summarizeValue(input.value),
    value: input.value,
    role: input.role ?? "source"
  };
}

function entityDependency(input: {
  objectType: string;
  objectId: string;
  role: CompileDependencyRef["role"];
  versionId?: string;
  updatedAt?: string;
  contentHash?: string;
  value?: unknown;
}): CompileDependencyRef {
  return {
    objectType: input.objectType,
    objectId: input.objectId,
    versionId: input.versionId,
    updatedAt: input.updatedAt,
    contentHash: input.contentHash ?? (input.value === undefined ? undefined : contentHash(input.value)),
    role: input.role
  };
}

function relationshipMatchesLevel(relationship: DesignRelationship, level: CompileFrameLevel, targetObjectId?: string) {
  if (!targetObjectId) return true;
  if (level === "graph") {
    if (relationship.source.type !== "graph" || relationship.target.type !== "graph") return false;
    return relationship.source.graphId === targetObjectId || relationship.target.graphId === targetObjectId;
  }
  if (level === "species-group") {
    if (relationship.source.type !== "species-group" || relationship.target.type !== "species-group") return false;
    return relationship.source.groupId === targetObjectId || relationship.target.groupId === targetObjectId;
  }
  if (level !== "species-node") return false;
  if (relationship.source.type !== "species-node" || relationship.target.type !== "species-node") return false;
  return relationship.source.nodeId === targetObjectId || relationship.target.nodeId === targetObjectId;
}

function contextMatchesTarget(attachment: ContextAttachment, target: CompileEntityRef) {
  if (target.objectType === "phenotype") return attachment.targetType === "phenotype-type" || attachment.compileLayer === "phenotype-context";
  return attachment.targetType === target.objectType && attachment.targetId === target.objectId;
}

function facetMatchesTarget(assignment: FacetAssignment, target: CompileEntityRef) {
  return assignment.targetType === target.objectType && assignment.targetId === target.objectId;
}

function relationshipSnapshot(relationships: DesignRelationship[] | undefined, level: CompileFrameLevel, targetObjectId?: string) {
  return (relationships ?? [])
    .filter((relationship) => relationshipMatchesLevel(relationship, level, targetObjectId))
    .sort((left, right) => left.relationshipId.localeCompare(right.relationshipId))
    .map((relationship) =>
      snapshotEntry({
        objectType: "design-relationship",
        objectId: relationship.relationshipId,
        fieldPath: "designContract",
        summary: `[${relationship.relationshipType}] ${relationship.description}`.trim(),
        value: {
          relationshipType: relationship.relationshipType,
          description: relationship.description,
          designContract: relationship.designContract
        },
        role: "relationship"
      })
    );
}

function contextSnapshot(contexts: DesignContext[] | undefined, attachments: ContextAttachment[] | undefined, target: CompileEntityRef) {
  const matchedAttachments = (attachments ?? []).filter((attachment) => contextMatchesTarget(attachment, target));
  const matchedIds = new Set(matchedAttachments.map((attachment) => attachment.contextId));
  return (contexts ?? [])
    .filter((context) => matchedIds.has(context.contextId))
    .sort((left, right) => left.contextId.localeCompare(right.contextId))
    .map((context) =>
      snapshotEntry({
        objectType: "design-context",
        objectId: context.contextId,
        fieldPath: "summary",
        summary: context.summary,
        value: { version: context.version, summary: context.summary, type: context.contextType },
        role: "context"
      })
    );
}

function facetSnapshot(definitions: FacetDefinition[] | undefined, schemas: FacetSchema[] | undefined, assignments: FacetAssignment[] | undefined, target: CompileEntityRef) {
  const entries: CompileSnapshotEntry[] = [];
  const facetIds = new Set<string>();
  for (const assignment of (assignments ?? []).filter((candidate) => facetMatchesTarget(candidate, target)).sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))) {
    for (const facetId of Object.keys(assignment.values)) facetIds.add(facetId);
    entries.push(
      snapshotEntry({
        objectType: "facet-assignment",
        objectId: assignment.assignmentId,
        fieldPath: "values",
        summary: stableStringify(assignment.values),
        value: assignment.values,
        role: "facet"
      })
    );
  }
  for (const schema of (schemas ?? []).filter((candidate) => candidate.facetIds.some((facetId) => facetIds.has(facetId))).sort((left, right) => left.facetSchemaId.localeCompare(right.facetSchemaId))) {
    entries.push(
      snapshotEntry({
        objectType: "facet-schema",
        objectId: schema.facetSchemaId,
        fieldPath: "facetIds",
        summary: schema.facetIds.join(", "),
        value: schema,
        role: "facet"
      })
    );
  }
  for (const definition of (definitions ?? []).filter((candidate) => facetIds.has(candidate.facetId)).sort((left, right) => left.facetId.localeCompare(right.facetId))) {
    entries.push(
      snapshotEntry({
        objectType: "facet-definition",
        objectId: definition.facetId,
        fieldPath: "valueType",
        summary: `${definition.name}:${definition.valueType}`,
        value: definition,
        role: "facet"
      })
    );
  }
  return entries;
}

function templateSnapshot(templates: GeneTemplate[] | undefined) {
  return (templates ?? [])
    .sort((left, right) => left.templateId.localeCompare(right.templateId))
    .map((template) =>
      snapshotEntry({
        objectType: "gene-template",
        objectId: template.templateId,
        fieldPath: "dimensions",
        summary: [...template.requiredDimensions, ...template.recommendedDimensions].join(", "),
        value: { version: template.version, requiredDimensions: template.requiredDimensions, recommendedDimensions: template.recommendedDimensions },
        role: "template"
      })
    );
}

function feedbackFromConflicts(conflicts: CompileConflict[], targetLevel: CompileFrameLevel, target: CompileEntityRef): CompileFeedback[] {
  return conflicts.map((conflict, index) => ({
    feedbackId: `${target.objectId}:conflict:${index}:${conflict.key}`,
    severity: "warning",
    targetLevel,
    target,
    reason: `${conflict.key} conflicts between ${summarizeValue(conflict.previousValue)} and ${summarizeValue(conflict.nextValue)}`,
    suggestedAction: "review conflict or provide a decision patch",
    sourceObjectIds: [conflict.source]
  }));
}

function createFrame(input: {
  artifactId: string;
  level: CompileFrameLevel;
  target: CompileEntityRef;
  inheritedSnapshot?: CompileSnapshotEntry[];
  localSnapshot?: CompileSnapshotEntry[];
  relationshipSnapshot?: CompileSnapshotEntry[];
  contextSnapshot?: CompileSnapshotEntry[];
  facetSnapshot?: CompileSnapshotEntry[];
  templateSnapshot?: CompileSnapshotEntry[];
  resolvedSnapshot: Record<string, unknown>;
  traces?: TraceEntry[];
  conflictReport?: CompileConflict[];
  openQuestions?: string[];
  feedback?: CompileFeedback[];
}): CompileFrame {
  return {
    frameId: `${input.artifactId}:${input.level}:${input.target.objectId}`,
    level: input.level,
    target: input.target,
    inheritedSnapshot: input.inheritedSnapshot ?? [],
    localSnapshot: input.localSnapshot ?? [],
    relationshipSnapshot: input.relationshipSnapshot ?? [],
    contextSnapshot: input.contextSnapshot ?? [],
    facetSnapshot: input.facetSnapshot ?? [],
    templateSnapshot: input.templateSnapshot ?? [],
    resolvedSnapshot: input.resolvedSnapshot,
    traces: input.traces ?? [],
    conflictReport: input.conflictReport ?? [],
    openQuestions: input.openQuestions ?? [],
    feedback: input.feedback ?? []
  };
}

function inheritedEntriesFromFrames(frames: CompileFrame[]): CompileSnapshotEntry[] {
  return frames.map((frame) =>
    snapshotEntry({
      objectType: "compile-frame",
      objectId: frame.frameId,
      fieldPath: "resolvedSnapshot",
      summary: `${frame.level}:${frame.target.objectId}`,
      value: frame.resolvedSnapshot,
      role: "inherited"
    })
  );
}

function uniqueFrames(frames: CompileFrame[]) {
  const seen = new Set<string>();
  const result: CompileFrame[] = [];
  for (const frame of frames) {
    const key = `${frame.level}:${frame.target.objectType}:${frame.target.objectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(frame);
  }
  return result;
}

function compileMetadata(input: {
  compileMode?: SpeciesCompileArtifact["compileMode"];
  compiledBy?: string;
  assistantContributionSummary?: string;
  hasAssistantWork?: boolean;
  fallbackMode?: SpeciesCompileArtifact["compileMode"];
}): Pick<SpeciesCompileArtifact, "compileMode" | "compiledBy" | "assistantContributionSummary"> {
  const hasAssistantWork = input.hasAssistantWork || Boolean(input.assistantContributionSummary);
  const compileMode = input.compileMode ?? (hasAssistantWork ? "agent-assisted" : input.fallbackMode ?? "system");
  return {
    compileMode,
    compiledBy: input.compiledBy ?? (compileMode === "agent-assisted" ? "agent-skill" : "system"),
    assistantContributionSummary: input.assistantContributionSummary ?? ""
  };
}

function artifactDependency(artifact: EntityCompileArtifact | SpeciesCompileArtifact | PhenotypeCompileArtifact): CompileDependencyRef {
  const objectType =
    artifact.compileTarget === "entity-layer"
      ? "entity-compile-artifact"
      : artifact.compileTarget === "species-snapshot"
        ? "species-compile-artifact"
        : "phenotype-compile-artifact";
  return entityDependency({
    objectType,
    objectId: artifact.artifactId,
    role: "inherited",
    updatedAt: artifact.createdAt,
    value: artifact.dependencyVector
  });
}

function dependencyVectorForEntity(input: CompileEntityArtifactInput, target: CompileEntityRef): CompileDependencyRef[] {
  const refs: CompileDependencyRef[] = [];
  for (const artifact of input.upstreamArtifacts ?? []) refs.push(artifactDependency(artifact));
  if (input.atlas) {
    refs.push(entityDependency({ objectType: "atlas", objectId: input.atlas.atlasId, role: "source", updatedAt: input.atlas.updatedAt, value: input.atlas }));
  }
  if (input.graph) {
    refs.push(
      entityDependency({
        objectType: "graph",
        objectId: input.graph.graphId,
        role: "source",
        versionId: input.graph.currentVersion,
        updatedAt: input.graph.updatedAt,
        value: input.graph
      })
    );
  }
  if (input.group) {
    refs.push(
      entityDependency({
        objectType: "species-group",
        objectId: input.group.groupId,
        role: "source",
        updatedAt: input.group.updatedAt,
        value: input.group
      })
    );
  }
  for (const relationship of input.designRelationships ?? []) {
    if (relationshipMatchesLevel(relationship, input.targetLevel, target.objectId)) {
      refs.push(entityDependency({ objectType: "design-relationship", objectId: relationship.relationshipId, role: "relationship", updatedAt: relationship.updatedAt, value: relationship }));
    }
  }
  const matchedContextIds = new Set(
    (input.contextAttachments ?? []).filter((attachment) => contextMatchesTarget(attachment, target)).map((attachment) => attachment.contextId)
  );
  for (const context of input.designContexts ?? []) {
    if (matchedContextIds.has(context.contextId)) {
      refs.push(entityDependency({ objectType: "design-context", objectId: context.contextId, role: "context", versionId: context.version, updatedAt: context.updatedAt, value: context }));
    }
  }
  for (const attachment of input.contextAttachments ?? []) {
    if (contextMatchesTarget(attachment, target)) {
      refs.push(entityDependency({ objectType: "context-attachment", objectId: attachment.attachmentId, role: "context", updatedAt: attachment.updatedAt, value: attachment }));
    }
  }
  for (const assignment of input.facetAssignments ?? []) {
    if (facetMatchesTarget(assignment, target)) {
      refs.push(entityDependency({ objectType: "facet-assignment", objectId: assignment.assignmentId, role: "facet", updatedAt: assignment.updatedAt, value: assignment }));
    }
  }
  for (const schema of input.facetSchemas ?? []) {
    refs.push(entityDependency({ objectType: "facet-schema", objectId: schema.facetSchemaId, role: "facet", updatedAt: schema.updatedAt, value: schema }));
  }
  for (const definition of input.facetDefinitions ?? []) {
    refs.push(entityDependency({ objectType: "facet-definition", objectId: definition.facetId, role: "facet", updatedAt: definition.updatedAt, value: definition }));
  }
  for (const template of input.geneTemplates ?? []) {
    refs.push(entityDependency({ objectType: "gene-template", objectId: template.templateId, role: "template", versionId: template.version, updatedAt: template.updatedAt, value: template }));
  }
  return uniqueDependencies(refs);
}

export function compileEntityArtifact(input: CompileEntityArtifactInput): EntityCompileArtifact {
  const compileScope = defaultCompileScope(input.compileScope);
  const target = targetRefFor({ atlas: input.atlas, graph: input.graph, group: input.group });
  if (input.targetLevel === "atlas" && !input.atlas) throw new Error("atlas compile requires atlas");
  if (input.targetLevel === "graph" && !input.graph) throw new Error("graph compile requires graph");
  if (input.targetLevel === "species-group" && (!input.graph || !input.group)) throw new Error("species-group compile requires graph and group");

  const upstreamFrames = uniqueFrames((input.upstreamArtifacts ?? []).flatMap((artifact) => artifact.frames));
  const localSnapshot: CompileSnapshotEntry[] = [];
  if (input.atlas) {
    localSnapshot.push(
      snapshotEntry({
        objectType: "atlas",
        objectId: input.atlas.atlasId,
        fieldPath: "graphIds",
        summary: input.atlas.graphIds.join(", "),
        value: { purpose: input.atlas.purpose, graphIds: input.atlas.graphIds }
      })
    );
  }
  if (input.graph) {
    localSnapshot.push(
      snapshotEntry({
        objectType: "graph",
        objectId: input.graph.graphId,
        fieldPath: "purpose",
        summary: input.graph.purpose,
        value: { purpose: input.graph.purpose, facets: input.graph.facets, templateIds: input.graph.templateIds }
      })
    );
  }
  if (input.group) {
    localSnapshot.push(
      snapshotEntry({
        objectType: "species-group",
        objectId: input.group.groupId,
        fieldPath: "sharedFacts",
        summary: input.group.sharedFacts.join(", "),
        value: {
          groupType: input.group.groupType,
          sharedFacts: input.group.sharedFacts,
          facetSchemaIds: input.group.facetSchemaIds,
          phenotypeTypeSuggestions: input.group.phenotypeTypeSuggestions
        }
      })
    );
  }
  const frameRelationshipSnapshot = relationshipSnapshot(input.designRelationships, input.targetLevel, target.objectId);
  const frameContextSnapshot = contextSnapshot(input.designContexts, input.contextAttachments, target);
  const frameFacetSnapshot = facetSnapshot(input.facetDefinitions, input.facetSchemas, input.facetAssignments, target);
  const frameTemplateSnapshot = templateSnapshot(input.geneTemplates);
  const resolvedSnapshot = {
    target,
    inheritedFrameIds: upstreamFrames.map((frame) => frame.frameId),
    local: Object.fromEntries(localSnapshot.map((entry) => [entry.fieldPath || entry.objectType, entry.value ?? entry.summary])),
    relationships: frameRelationshipSnapshot.map((entry) => entry.objectId),
    contexts: frameContextSnapshot.map((entry) => entry.objectId),
    facets: frameFacetSnapshot.map((entry) => entry.objectId),
    templates: frameTemplateSnapshot.map((entry) => entry.objectId)
  };
  const frame = createFrame({
    artifactId: input.artifactId,
    level: input.targetLevel,
    target,
    inheritedSnapshot: inheritedEntriesFromFrames(upstreamFrames),
    localSnapshot,
    relationshipSnapshot: frameRelationshipSnapshot,
    contextSnapshot: frameContextSnapshot,
    facetSnapshot: frameFacetSnapshot,
    templateSnapshot: frameTemplateSnapshot,
    resolvedSnapshot
  });
  const metadata = compileMetadata({
    compileMode: input.compileMode,
    compiledBy: input.compiledBy,
    assistantContributionSummary: input.assistantContributionSummary
  });
  return {
    artifactId: input.artifactId,
    compileTarget: "entity-layer",
    targetLevel: input.targetLevel,
    target,
    graphId: input.graph?.graphId ?? input.group?.graphId,
    ...metadata,
    inputSummary: input.inputSummary ?? { targetLevel: input.targetLevel, target },
    compilePolicy: input.group?.compilePolicy ?? input.graph?.compilePolicy,
    compileScope,
    dependencyVector: dependencyVectorForEntity(input, target),
    validity: { state: "current", reasons: [] },
    frames: [...upstreamFrames, frame],
    resolvedSnapshot,
    conflictReport: [],
    decisionRequests: [],
    decisionPatches: input.decisionPatches ?? [],
    feedback: [],
    createdAt: new Date().toISOString()
  };
}

function compileLayerFromContextAttachment(attachment?: ContextAttachment): TraceEntry["layer"] {
  if (!attachment) return "graph-context";
  if (attachment.compileLayer === "atlas-context") return "atlas-context";
  if (attachment.compileLayer === "graph-context") return "graph-context";
  if (attachment.compileLayer === "group-context") return "group-context";
  if (attachment.compileLayer === "relationship-context") return "design-relationship-facts";
  return "phenotype-context";
}

function dependencyVectorForSpecies(input: CompileSpeciesSnapshotInput): CompileDependencyRef[] {
  const target = targetRefFor({ node: input.node });
  const refs: CompileDependencyRef[] = [
    entityDependency({
      objectType: "graph",
      objectId: input.graph.graphId,
      role: "source",
      versionId: input.graph.currentVersion,
      updatedAt: input.graph.updatedAt,
      value: input.graph
    }),
    entityDependency({
      objectType: "species-node",
      objectId: input.node.nodeId,
      role: "source",
      versionId: input.node.currentVersion,
      updatedAt: input.node.updatedAt,
      value: input.node
    }),
    entityDependency({ objectType: "node-version", objectId: input.nodeVersionId, versionId: input.nodeVersionId, role: "source" })
  ];
  for (const artifact of input.upstreamArtifacts ?? []) refs.push(artifactDependency(artifact));
  for (const parent of input.parentSnapshots ?? []) {
    refs.push(entityDependency({ objectType: "node-version", objectId: parent.nodeVersionId, role: "inherited", versionId: parent.nodeVersionId, value: parent.snapshot }));
  }
  for (const group of input.speciesGroups ?? []) {
    refs.push(entityDependency({ objectType: "species-group", objectId: group.groupId, role: "inherited", updatedAt: group.updatedAt, value: group }));
  }
  for (const relationship of input.designRelationships ?? []) {
    if (relationshipMatchesLevel(relationship, "species-node", target.objectId)) {
      refs.push(entityDependency({ objectType: "design-relationship", objectId: relationship.relationshipId, role: "relationship", updatedAt: relationship.updatedAt, value: relationship }));
    }
  }
  for (const context of input.designContexts ?? []) {
    refs.push(entityDependency({ objectType: "design-context", objectId: context.contextId, role: "context", versionId: context.version, updatedAt: context.updatedAt, value: context }));
  }
  for (const attachment of input.contextAttachments ?? []) {
    refs.push(entityDependency({ objectType: "context-attachment", objectId: attachment.attachmentId, role: "context", updatedAt: attachment.updatedAt, value: attachment }));
  }
  for (const policy of input.contextPolicies ?? []) {
    refs.push(entityDependency({ objectType: "context-policy", objectId: policy.policyId, role: "context", updatedAt: policy.updatedAt, value: policy }));
  }
  for (const fact of input.contextFacts ?? []) refs.push(entityDependency({ objectType: "context-fact", objectId: fact.factId, role: "context", updatedAt: fact.updatedAt, value: fact }));
  for (const principle of input.designPrinciples ?? []) {
    refs.push(entityDependency({ objectType: "design-principle", objectId: principle.principleId, role: "context", updatedAt: principle.updatedAt, value: principle }));
  }
  for (const motif of input.contextMotifs ?? []) refs.push(entityDependency({ objectType: "context-motif", objectId: motif.motifId, role: "context", updatedAt: motif.updatedAt, value: motif }));
  for (const reference of input.contextReferences ?? []) {
    refs.push(entityDependency({ objectType: "context-reference", objectId: reference.referenceId, role: "reference", updatedAt: reference.updatedAt, value: reference }));
  }
  for (const rubric of input.contextReviewRubrics ?? []) {
    refs.push(entityDependency({ objectType: "context-review-rubric", objectId: rubric.rubricId, role: "rubric", updatedAt: rubric.updatedAt, value: rubric }));
  }
  for (const assignment of input.facetAssignments ?? []) {
    if (facetMatchesTarget(assignment, target)) {
      refs.push(entityDependency({ objectType: "facet-assignment", objectId: assignment.assignmentId, role: "facet", updatedAt: assignment.updatedAt, value: assignment }));
    }
  }
  for (const schema of input.facetSchemas ?? []) refs.push(entityDependency({ objectType: "facet-schema", objectId: schema.facetSchemaId, role: "facet", updatedAt: schema.updatedAt, value: schema }));
  for (const definition of input.facetDefinitions ?? []) refs.push(entityDependency({ objectType: "facet-definition", objectId: definition.facetId, role: "facet", updatedAt: definition.updatedAt, value: definition }));
  for (const template of input.geneTemplates ?? []) {
    refs.push(entityDependency({ objectType: "gene-template", objectId: template.templateId, role: "template", versionId: template.version, updatedAt: template.updatedAt, value: template }));
  }
  return uniqueDependencies(refs);
}

function buildSpeciesFrames(input: CompileSpeciesSnapshotInput, artifact: Omit<SpeciesCompileArtifact, "frames" | "dependencyVector" | "validity" | "feedback" | "decisionRequests" | "decisionPatches">) {
  const upstreamFrames = uniqueFrames((input.upstreamArtifacts ?? []).flatMap((upstream) => upstream.frames));
  const frames: CompileFrame[] = [...upstreamFrames];
  if (!frames.some((frame) => frame.level === "graph" && frame.target.objectId === input.graph.graphId)) {
    const graphTarget = targetRefFor({ graph: input.graph });
    frames.push(
      createFrame({
        artifactId: input.artifactId,
        level: "graph",
        target: graphTarget,
        localSnapshot: [
          snapshotEntry({
            objectType: "graph",
            objectId: input.graph.graphId,
            fieldPath: "purpose",
            summary: input.graph.purpose,
            value: { purpose: input.graph.purpose, facets: input.graph.facets }
          })
        ],
        relationshipSnapshot: relationshipSnapshot(input.designRelationships, "graph", input.graph.graphId),
        contextSnapshot: contextSnapshot(input.designContexts, input.contextAttachments, graphTarget),
        facetSnapshot: facetSnapshot(input.facetDefinitions, input.facetSchemas, input.facetAssignments, graphTarget),
        templateSnapshot: templateSnapshot(input.geneTemplates),
        resolvedSnapshot: { graphId: input.graph.graphId, purpose: input.graph.purpose }
      })
    );
  }
  for (const group of [...(input.speciesGroups ?? [])].sort((left, right) => left.groupId.localeCompare(right.groupId))) {
    if (frames.some((frame) => frame.level === "species-group" && frame.target.objectId === group.groupId)) continue;
    const groupTarget = targetRefFor({ group });
    frames.push(
      createFrame({
        artifactId: input.artifactId,
        level: "species-group",
        target: groupTarget,
        inheritedSnapshot: inheritedEntriesFromFrames(frames),
        localSnapshot: [
          snapshotEntry({
            objectType: "species-group",
            objectId: group.groupId,
            fieldPath: "sharedFacts",
            summary: group.sharedFacts.join(", "),
            value: {
              sharedFacts: group.sharedFacts,
              facetSchemaIds: group.facetSchemaIds,
              phenotypeTypeSuggestions: group.phenotypeTypeSuggestions
            }
          })
        ],
        relationshipSnapshot: relationshipSnapshot(input.designRelationships, "species-group", group.groupId),
        contextSnapshot: contextSnapshot(input.designContexts, input.contextAttachments, groupTarget),
        facetSnapshot: facetSnapshot(input.facetDefinitions, input.facetSchemas, input.facetAssignments, groupTarget),
        templateSnapshot: templateSnapshot(input.geneTemplates),
        resolvedSnapshot: { groupId: group.groupId, sharedFacts: group.sharedFacts }
      })
    );
  }
  const nodeTarget = targetRefFor({ node: input.node });
  const feedback = feedbackFromConflicts(artifact.conflictReport, "species-node", nodeTarget);
  frames.push(
    createFrame({
      artifactId: input.artifactId,
      level: "species-node",
      target: nodeTarget,
      inheritedSnapshot: inheritedEntriesFromFrames(frames),
      localSnapshot: [
        snapshotEntry({
          objectType: "species-node",
          objectId: input.node.nodeId,
          fieldPath: "constraints",
          summary: summarizeValue(input.node.constraints),
          value: {
            constraints: input.node.constraints,
            motifs: input.node.motifs,
            badcases: input.node.badcases
          }
        })
      ],
      relationshipSnapshot: relationshipSnapshot(input.designRelationships, "species-node", input.node.nodeId),
      contextSnapshot: contextSnapshot(input.designContexts, input.contextAttachments, nodeTarget),
      facetSnapshot: facetSnapshot(input.facetDefinitions, input.facetSchemas, input.facetAssignments, nodeTarget),
      templateSnapshot: templateSnapshot(input.geneTemplates),
      resolvedSnapshot: artifact.resolvedGeneSnapshot,
      traces: [...artifact.sourceTrace, ...artifact.contextTrace, ...artifact.referenceTrace],
      conflictReport: artifact.conflictReport,
      openQuestions: artifact.openQuestions,
      feedback
    })
  );
  return { frames, feedback };
}

function dependencyVectorForPhenotype(input: CompilePhenotypeGenerationInput, artifactId: string): CompileDependencyRef[] {
  const refs: CompileDependencyRef[] = [];
  if (input.speciesArtifact) {
    refs.push(...input.speciesArtifact.dependencyVector, artifactDependency(input.speciesArtifact));
  } else {
    refs.push(
      entityDependency({
        objectType: "graph",
        objectId: input.graph.graphId,
        role: "source",
        versionId: input.graph.currentVersion,
        updatedAt: input.graph.updatedAt,
        value: input.graph
      }),
      entityDependency({
        objectType: "species-node",
        objectId: input.node.nodeId,
        role: "source",
        versionId: input.node.currentVersion,
        updatedAt: input.node.updatedAt,
        value: input.node
      })
    );
  }
  refs.push(entityDependency({ objectType: "task-brief", objectId: artifactId, role: "source", contentHash: contentHash(input.taskBrief) }));
  return uniqueDependencies(refs);
}

function phenotypeDecisionRequests(input: CompilePhenotypeGenerationInput, resolvedGeneSnapshot: Record<string, unknown>): CompileDecisionRequest[] {
  const taskBrief = input.taskBrief.toLowerCase();
  const requests: CompileDecisionRequest[] = [];
  const color = typeof resolvedGeneSnapshot.color === "string" ? resolvedGeneSnapshot.color.toLowerCase() : "";
  if ((taskBrief.includes(" but ") || taskBrief.includes("但是") || taskBrief.includes("blue")) && color && !taskBrief.includes(color)) {
    requests.push({
      requestId: `${input.artifactId}:decision:phenotype-task`,
      fieldPath: "phenotype.taskBrief",
      reason: `Task brief may conflict with resolved ${color} design semantics.`,
      allowedActions: ["preserve", "weaken", "translate", "exclude", "manual"],
      sourceObjectIds: [input.node.nodeId],
      status: "open" as const
    });
  }
  return requests;
}

function mergeArtifactGenes(input: {
  target: Record<string, unknown>;
  next: Record<string, unknown>;
  source: string;
  layer: TraceEntry["layer"];
  conflicts: CompileConflict[];
  sourceTrace: TraceEntry[];
  objectType: string;
  objectId: string;
  versionId?: string;
  parentRole?: SpeciesNode["parentRoles"][string] | string;
}) {
  for (const [key, value] of Object.entries(input.next)) {
    if (key in input.target && JSON.stringify(input.target[key]) !== JSON.stringify(value)) {
      input.conflicts.push({
        key,
        previousValue: input.target[key],
        nextValue: value,
        source: input.source,
        layer: input.layer,
        resolutionRule: "override",
        parentRole: input.parentRole as CompileConflict["parentRole"],
        decision: "included"
      });
    }
    input.target[key] = value;
    input.sourceTrace.push(
      trace({
        objectType: input.objectType,
        objectId: input.objectId,
        versionId: input.versionId,
        layer: input.layer,
        fieldPath: key,
        valueSummary: summarizeValue(value),
        decision: "merged",
        metadata: input.parentRole ? { parentRole: input.parentRole } : {}
      })
    );
  }
}

export function compileSpeciesSnapshot(input: CompileSpeciesSnapshotInput): SpeciesCompileArtifact {
  const compileScope = defaultCompileScope(input.compileScope);
  const resolvedGeneSnapshot: Record<string, unknown> = {};
  const candidateGenes: Record<string, unknown> = {};
  const conflictReport: CompileConflict[] = [];
  const sourceTrace: TraceEntry[] = [];
  const contextTrace: TraceEntry[] = [];
  const referenceTrace: TraceEntry[] = [];
  const decisionTrace: TraceEntry[] = [];
  const openQuestions: string[] = [];
  const compilePolicy = input.node.compilePolicy ?? input.graph.compilePolicy;

  for (const group of input.speciesGroups ?? []) {
    if (group.sharedFacts.length) {
      const existing = Array.isArray(candidateGenes.sharedFacts) ? candidateGenes.sharedFacts : [];
      candidateGenes.sharedFacts = [...existing, ...group.sharedFacts];
      sourceTrace.push(
        trace({
          objectType: "species-group",
          objectId: group.groupId,
          layer: "species-group-rules",
          fieldPath: "sharedFacts",
          valueSummary: group.sharedFacts.join(", "),
          decision: "included",
          metadata: { groupType: group.groupType }
        })
      );
    }
    if (group.phenotypeTypeSuggestions.length) {
      sourceTrace.push(
        trace({
          objectType: "species-group",
          objectId: group.groupId,
          layer: "species-group-rules",
          fieldPath: "phenotypeTypeSuggestions",
          valueSummary: group.phenotypeTypeSuggestions.join(", "),
          decision: "included"
        })
      );
    }
  }

  if (compileScope.includeDesignRelationships) {
    for (const relationship of input.designRelationships ?? []) {
      sourceTrace.push(
        trace({
          objectType: "design-relationship",
          objectId: relationship.relationshipId,
          layer: relationship.source.type === "species-node" ? "design-relationship-contracts" : "design-relationship-facts",
          fieldPath: "description",
          valueSummary: `[${relationship.relationshipType}] ${relationship.description}`,
          decision: isFixedRuleEligibleRelation(relationship.relationshipType) ? "included" : "llm-suggested",
          metadata: {
            relationshipType: relationship.relationshipType,
            source: relationship.source,
            target: relationship.target,
            fixedRuleEligible: isFixedRuleEligibleRelation(relationship.relationshipType)
          }
        })
      );
    }
  }

  for (const parent of input.parentSnapshots ?? []) {
    const parentNodeId = parent.parentNodeId ?? parent.nodeVersionId.split("@")[0] ?? parent.nodeVersionId;
    const parentRole = parent.role ?? input.node.parentRoles[parentNodeId] ?? (parentNodeId === input.node.primaryParent ? "primary" : "reference");
    mergeArtifactGenes({
      target: resolvedGeneSnapshot,
      next: parent.snapshot,
      source: `parent:${parent.nodeVersionId}`,
      layer: "parent-snapshots",
      conflicts: conflictReport,
      sourceTrace,
      objectType: "node-version",
      objectId: parent.nodeVersionId,
      versionId: parent.nodeVersionId,
      parentRole
    });
  }

  for (const relationship of input.relationshipDeltas ?? []) {
    mergeArtifactGenes({
      target: resolvedGeneSnapshot,
      next: relationship.delta,
      source: `relationship:${relationship.relationshipId}`,
      layer: "design-relationship-contracts",
      conflicts: conflictReport,
      sourceTrace,
      objectType: "design-relationship",
      objectId: relationship.relationshipId
    });
  }

  for (const relationship of input.relationshipDeltas ?? []) {
    for (const [key, value] of Object.entries(relationship.delta)) {
      if (key in input.node.constraints && JSON.stringify(input.node.constraints[key]) !== JSON.stringify(value)) {
        conflictReport.push({
          key,
          previousValue: value,
          nextValue: input.node.constraints[key],
          source: `relationship:${relationship.relationshipId}`,
          layer: "design-relationship-contracts",
          resolutionRule: "manual",
          decision: "manual"
        });
      }
    }
  }

  mergeArtifactGenes({
    target: resolvedGeneSnapshot,
    next: input.node.constraints,
    source: `node:${input.node.nodeId}`,
    layer: "node-own-genes",
    conflicts: conflictReport,
    sourceTrace,
    objectType: "species-node",
    objectId: input.node.nodeId,
    versionId: input.nodeVersionId
  });
  if (input.node.motifs.length) {
    resolvedGeneSnapshot.motifs = input.node.motifs;
    sourceTrace.push(
      trace({
        objectType: "species-node",
        objectId: input.node.nodeId,
        versionId: input.nodeVersionId,
        layer: "node-own-genes",
        fieldPath: "motifs",
        valueSummary: input.node.motifs.join(", "),
        decision: "included"
      })
    );
  }
  if (input.node.badcases.length) {
    resolvedGeneSnapshot.badcases = input.node.badcases;
    sourceTrace.push(
      trace({
        objectType: "species-node",
        objectId: input.node.nodeId,
        versionId: input.nodeVersionId,
        layer: "node-own-genes",
        fieldPath: "badcases",
        valueSummary: input.node.badcases.join(", "),
        decision: "included"
      })
    );
  }
  Object.assign(candidateGenes, resolvedGeneSnapshot);

  for (const context of input.designContexts ?? []) {
    const attachment = (input.contextAttachments ?? []).find((candidate) => candidate.contextId === context.contextId);
    contextTrace.push(
      trace({
        objectType: "design-context",
        objectId: context.contextId,
        versionId: context.version,
        layer: compileLayerFromContextAttachment(attachment),
        fieldPath: "summary",
        valueSummary: context.summary,
        decision: "included",
        metadata: { contextType: context.contextType, role: attachment?.role, strength: attachment?.strength }
      })
    );
  }
  for (const fact of input.contextFacts ?? []) {
    contextTrace.push(
      trace({
        objectType: "context-fact",
        objectId: fact.factId,
        layer: "graph-context",
        fieldPath: "statement",
        valueSummary: fact.statement,
        decision: fact.defaultBehaviorHint === "exclude" ? "excluded" : "included",
        metadata: { factType: fact.factType, strength: fact.defaultStrength }
      })
    );
  }
  for (const principle of input.designPrinciples ?? []) {
    contextTrace.push(
      trace({
        objectType: "design-principle",
        objectId: principle.principleId,
        layer: "graph-context",
        fieldPath: "statement",
        valueSummary: principle.statement,
        decision: "included",
        metadata: { priority: principle.priority }
      })
    );
  }
  for (const motif of input.contextMotifs ?? []) {
    contextTrace.push(
      trace({
        objectType: "context-motif",
        objectId: motif.motifId,
        layer: "graph-context",
        fieldPath: "statement",
        valueSummary: motif.statement,
        decision: "included",
        metadata: { motifType: motif.motifType }
      })
    );
  }
  for (const reference of input.contextReferences ?? []) {
    referenceTrace.push(
      trace({
        objectType: "context-reference",
        objectId: reference.referenceId,
        layer: "context-references",
        fieldPath: "sourceRef",
        valueSummary: `${reference.referenceType}:${reference.sourceRef.type}:${reference.sourceRef.id}`,
        decision: reference.referenceRole === "negative" ? "excluded" : "included",
        metadata: { referenceRole: reference.referenceRole, useFor: reference.useFor, doNotUseFor: reference.doNotUseFor }
      })
    );
  }
  for (const rubric of input.contextReviewRubrics ?? []) {
    contextTrace.push(
      trace({
        objectType: "context-review-rubric",
        objectId: rubric.rubricId,
        layer: "phenotype-context",
        fieldPath: "question",
        valueSummary: rubric.question,
        decision: "included",
        metadata: { dimension: rubric.dimension, severity: rubric.severity }
      })
    );
  }
  const assistantSuggestions = [
    ...(input.assistantSuggestions ?? []).map((suggestion) => ({ ...suggestion, source: "assistant" as const })),
    ...(input.llmSuggestions ?? []).map((suggestion) => ({ ...suggestion, source: "legacy-llm" as const }))
  ];
  for (const suggestion of assistantSuggestions) {
    decisionTrace.push(
      trace({
        objectType: suggestion.source === "legacy-llm" ? "llm-suggestion" : "agent-suggestion",
        objectId: `${input.artifactId}:${suggestion.fieldPath}`,
        layer: "graph-context",
        fieldPath: suggestion.fieldPath,
        valueSummary: suggestion.valueSummary,
        decision: "llm-suggested",
        resolutionRule: "llm-review"
      })
    );
    openQuestions.push(
      suggestion.source === "legacy-llm"
        ? `Review LLM suggestion before writing ${suggestion.fieldPath}.`
        : `Review Agent host suggestion before writing ${suggestion.fieldPath}.`
    );
  }
  const metadata = compileMetadata({
    compileMode: input.compileMode,
    compiledBy: input.compiledBy,
    assistantContributionSummary: input.assistantContributionSummary,
    hasAssistantWork: assistantSuggestions.length > 0
  });

  const baseArtifact = {
    artifactId: input.artifactId,
    compileTarget: "species-snapshot",
    graphId: input.graph.graphId,
    speciesNodeId: input.node.nodeId,
    nodeVersionId: input.nodeVersionId,
    ...metadata,
    inputSummary: input.inputSummary ?? {
      graphId: input.graph.graphId,
      speciesNodeId: input.node.nodeId,
      nodeVersionId: input.nodeVersionId
    },
    compilePolicy,
    compileScope,
    resolvedGeneSnapshot,
    candidateGenes,
    conflictReport,
    sourceTrace,
    contextTrace,
    referenceTrace,
    decisionTrace,
    openQuestions,
    createdAt: new Date().toISOString()
  } satisfies Omit<
    SpeciesCompileArtifact,
    "dependencyVector" | "validity" | "frames" | "decisionRequests" | "decisionPatches" | "feedback"
  >;
  const { frames, feedback } = buildSpeciesFrames(input, baseArtifact);
  return {
    ...baseArtifact,
    dependencyVector: dependencyVectorForSpecies(input),
    validity: { state: "current", reasons: [] },
    frames,
    decisionRequests: [],
    decisionPatches: input.decisionPatches ?? [],
    feedback
  };
}

function phenotypeTypeGuidance(phenotypeType: string): string {
  if (phenotypeType === "ui-icon") return "Prioritize small-size readability, clear silhouette, state clarity, and background adaptability.";
  if (phenotypeType === "concept-art") return "Prioritize composition and mood exploration, material culture, and visual direction.";
  if (phenotypeType === "model-brief") return "Prioritize structure, proportions, modular parts, and modeling feasibility.";
  if (phenotypeType === "animation-brief") return "Prioritize motion rhythm, key poses, timing, and readable transitions.";
  if (phenotypeType === "runtime-asset") return "Prioritize export specifications, engine constraints, size, format, and runtime naming.";
  return `Adapt output for phenotype type ${phenotypeType}.`;
}

function summarizeProductionIntent(intent: ProductionIntent | undefined): string {
  if (!intent) return "";
  const parts = [
    intent.productionSliceRole ? `slice ${intent.productionSliceRole}` : "",
    intent.intendedUse ? `use ${intent.intendedUse}` : "",
    intent.outputShape.expectedAssetTypes.length ? `assets ${intent.outputShape.expectedAssetTypes.join(", ")}` : "",
    intent.outputShape.transparency ? `transparency ${intent.outputShape.transparency}` : "",
    intent.outputShape.runtimeConstraints.length ? `runtime ${intent.outputShape.runtimeConstraints.join(", ")}` : "",
    intent.mustPreserve.length ? `preserve ${intent.mustPreserve.join(", ")}` : "",
    intent.mustAvoid.length ? `avoid ${intent.mustAvoid.join(", ")}` : "",
    intent.unknowns.length ? `unknowns ${intent.unknowns.join(", ")}` : ""
  ].filter(Boolean);
  return parts.join("; ");
}

export function compilePhenotypeGeneration(input: CompilePhenotypeGenerationInput): PhenotypeCompileArtifact {
  const compileScope = defaultCompileScope(input.compileScope);
  const resolvedGeneSnapshot = input.speciesArtifact?.resolvedGeneSnapshot ?? input.resolvedGeneSnapshot ?? {};
  const sourceTrace = [
    ...(input.speciesArtifact?.sourceTrace ?? []),
    trace({
      objectType: "task-brief",
      objectId: input.artifactId,
      layer: "task-brief",
      fieldPath: "taskBrief",
      valueSummary: input.taskBrief,
      decision: "included"
    })
  ];
  const contextTrace = [...(input.speciesArtifact?.contextTrace ?? [])];
  const referenceTrace = [...(input.speciesArtifact?.referenceTrace ?? [])];
  const rubricTrace: TraceEntry[] = [];
  const decisionTrace = [...(input.speciesArtifact?.decisionTrace ?? [])];
  const negativeParts: string[] = [];
  const reviewChecklist = (input.contextReviewRubrics ?? []).map((rubric) => {
    rubricTrace.push(
      trace({
        objectType: "context-review-rubric",
        objectId: rubric.rubricId,
        layer: "phenotype-context",
        fieldPath: "question",
        valueSummary: rubric.question,
        decision: "included",
        metadata: { dimension: rubric.dimension, severity: rubric.severity }
      })
    );
    return {
      rubricId: rubric.rubricId,
      dimension: rubric.dimension,
      question: rubric.question,
      severity: rubric.severity
    };
  });

  for (const reference of input.contextReferences ?? []) {
    const isNegative = reference.referenceRole === "negative" || reference.referenceType === "badcase";
    if (isNegative) negativeParts.push(...reference.doNotUseFor);
    referenceTrace.push(
      trace({
        objectType: "context-reference",
        objectId: reference.referenceId,
        layer: "context-references",
        fieldPath: "sourceRef",
        valueSummary: `${reference.referenceType}:${reference.sourceRef.type}:${reference.sourceRef.id}`,
        decision: isNegative ? "excluded" : "included",
        metadata: { referenceRole: reference.referenceRole, useFor: reference.useFor, doNotUseFor: reference.doNotUseFor }
      })
    );
  }

  const geneSummary = Object.entries(resolvedGeneSnapshot)
    .map(([key, value]) => `${key}=${summarizeValue(value)}`)
    .join("; ");
  const typeGuidance = phenotypeTypeGuidance(input.phenotypeType);
  const usageGuidePromptParts = input.usageGuideSnapshot
    ? [
        `Usage guide: ${input.usageGuideSnapshot.summary}.`,
        input.usageGuideSnapshot.primaryUsageScenario ? `Primary usage scenario: ${input.usageGuideSnapshot.primaryUsageScenario}.` : "",
        input.usageGuideSnapshot.mustPreserve.length ? `Usage must preserve: ${input.usageGuideSnapshot.mustPreserve.join(", ")}.` : "",
        input.usageGuideSnapshot.mustAvoid.length ? `Usage must avoid: ${input.usageGuideSnapshot.mustAvoid.join(", ")}.` : ""
      ].filter(Boolean)
    : input.usageGuideWarning
      ? [`Usage guide warning: ${input.usageGuideWarning}.`]
      : [];
  const productionIntentSummary = summarizeProductionIntent(input.productionIntent);
  const prompt = [
    "Design Network Atlas phenotype generation.",
    `Phenotype type: ${input.phenotypeType}.`,
    `Species: ${input.node.name}.`,
    `Task: ${input.taskBrief}.`,
    typeGuidance,
    ...usageGuidePromptParts,
    productionIntentSummary ? `Production intent: ${productionIntentSummary}.` : "",
    geneSummary ? `Resolved genes: ${geneSummary}.` : "Resolved genes: none.",
    contextTrace.length ? `Context trace: ${contextTrace.map((entry) => `${entry.objectType}:${entry.objectId}`).join(", ")}.` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const metadata = compileMetadata({
    compileMode: input.compileMode,
    compiledBy: input.compiledBy,
    assistantContributionSummary: input.assistantContributionSummary,
    hasAssistantWork: Boolean(input.assistantContributionSummary),
    fallbackMode: input.speciesArtifact?.compileMode
  });

  const inheritedFrames = uniqueFrames(input.speciesArtifact?.frames ?? []);
  const phenotypeTarget: CompileEntityRef = {
    objectType: "phenotype",
    objectId: `${input.node.nodeId}:${input.phenotypeType}`,
    graphId: input.graph.graphId,
    label: input.phenotypeType
  };
  const decisionRequests = phenotypeDecisionRequests(input, resolvedGeneSnapshot);
  const usageGuideFeedback: CompileFeedback[] = input.usageGuideWarning
    ? [
        {
          feedbackId: `${input.artifactId}:usage-guide-warning`,
          severity: "warning",
          targetLevel: "phenotype",
          target: phenotypeTarget,
          reason: input.usageGuideWarning,
          suggestedAction: "create or attach a phenotype usage guide before production generation",
          sourceObjectIds: []
        }
      ]
    : [];
  const phenotypeFeedback: CompileFeedback[] = decisionRequests.map((request, index) => ({
    feedbackId: `${input.artifactId}:decision-feedback:${index}`,
    severity: "warning",
    targetLevel: "phenotype",
    target: phenotypeTarget,
    reason: request.reason,
    suggestedAction: "provide a compile decision patch or adjust the task brief",
    sourceObjectIds: request.sourceObjectIds
  }));
  const phenotypeFrame = createFrame({
    artifactId: input.artifactId,
    level: "phenotype",
    target: phenotypeTarget,
    inheritedSnapshot: inheritedEntriesFromFrames(inheritedFrames),
    localSnapshot: [
      snapshotEntry({
        objectType: "phenotype-task",
        objectId: input.artifactId,
        fieldPath: "taskBrief",
        summary: input.taskBrief,
        value: { phenotypeType: input.phenotypeType, taskBrief: input.taskBrief, productionIntent: input.productionIntent }
      })
    ],
    contextSnapshot: [],
    resolvedSnapshot: {
      phenotypeType: input.phenotypeType,
      taskBrief: input.taskBrief,
      prompt,
      negativePrompt: [...new Set(negativeParts)].join(", ")
    },
    traces: [...sourceTrace, ...contextTrace, ...referenceTrace, ...rubricTrace],
    conflictReport: input.speciesArtifact?.conflictReport ?? [],
    openQuestions: [...(input.speciesArtifact?.openQuestions ?? []), ...decisionRequests.map((request) => request.reason)],
    feedback: [...(input.speciesArtifact?.feedback ?? []), ...usageGuideFeedback, ...phenotypeFeedback]
  });

  return {
    artifactId: input.artifactId,
    compileTarget: "phenotype-generation",
    graphId: input.graph.graphId,
    speciesNodeId: input.node.nodeId,
    nodeVersionId: input.nodeVersionId,
    phenotypeType: input.phenotypeType,
    taskBrief: input.taskBrief,
    speciesCompileArtifactId: input.speciesArtifact?.artifactId,
    ...metadata,
    inputSummary: input.inputSummary ?? {
      graphId: input.graph.graphId,
      speciesNodeId: input.node.nodeId,
      nodeVersionId: input.nodeVersionId,
      phenotypeType: input.phenotypeType,
      taskBrief: input.taskBrief,
      productionIntent: input.productionIntent,
      speciesCompileArtifactId: input.speciesArtifact?.artifactId
    },
    compilePolicy: input.node.compilePolicy ?? input.graph.compilePolicy,
    compileScope,
    resolvedGeneSnapshot,
    conflictReport: input.speciesArtifact?.conflictReport ?? [],
    dependencyVector: dependencyVectorForPhenotype(input, input.artifactId),
    validity: { state: "current", reasons: [] },
    frames: [...inheritedFrames, phenotypeFrame],
    sourceTrace,
    contextTrace,
    referenceTrace,
    rubricTrace,
    decisionTrace,
    decisionRequests,
    decisionPatches: input.decisionPatches ?? [],
    feedback: [...(input.speciesArtifact?.feedback ?? []), ...usageGuideFeedback, ...phenotypeFeedback],
    usageGuideSnapshot: input.usageGuideSnapshot,
    prompt,
    negativePrompt: [...new Set(negativeParts)].join(", "),
    artBrief: `Produce ${input.phenotypeType} for ${input.node.name}. ${typeGuidance} ${input.taskBrief}`.trim(),
    reviewChecklist,
    generationConstraints: input.productionIntent ? { ...(input.generationConstraints ?? {}), productionIntent: input.productionIntent } : input.generationConstraints ?? {},
    openQuestions: [...(input.speciesArtifact?.openQuestions ?? []), ...decisionRequests.map((request) => request.reason)],
    createdAt: new Date().toISOString()
  };
}

export function checkCompileArtifactOutdated(
  artifact: SpeciesCompileArtifact | PhenotypeCompileArtifact,
  changed: CompileOutdatedCheckInput
): CompileOutdatedCheckResult {
  const traces = [
    ...artifact.sourceTrace,
    ...artifact.contextTrace,
    ...artifact.referenceTrace,
    ...("rubricTrace" in artifact ? artifact.rubricTrace : []),
    ...artifact.decisionTrace
  ];
  const matchedTrace = traces.filter((entry) => {
    if (entry.objectType !== changed.objectType || entry.objectId !== changed.objectId) return false;
    if (!changed.versionId) return true;
    return !entry.versionId || entry.versionId !== changed.versionId;
  });
  return {
    outdated: matchedTrace.length > 0,
    reasons: matchedTrace.map((entry) => `${entry.objectType}:${entry.objectId} changed after compile trace ${entry.fieldPath}`),
    matchedTrace
  };
}

export function checkCompileArtifactStaleness(
  artifact: EntityCompileArtifact | SpeciesCompileArtifact | PhenotypeCompileArtifact,
  currentDependencyVector: CompileDependencyRef[],
  options: { historical?: boolean } = {}
): CompileArtifactStalenessResult {
  if (options.historical) return { stale: true, state: "historical", reasons: ["historical replay explicitly requested"] };
  const artifactRefs = new Map(artifact.dependencyVector.map((ref) => [dependencyKey(ref), ref]));
  const currentRefs = new Map(currentDependencyVector.map((ref) => [dependencyKey(ref), ref]));
  const reasons: string[] = [];
  for (const [key, artifactRef] of artifactRefs.entries()) {
    const currentRef = currentRefs.get(key);
    if (!currentRef) {
      reasons.push(`${key} missing from current dependency vector`);
      continue;
    }
    if (artifactRef.versionId && currentRef.versionId && artifactRef.versionId !== currentRef.versionId) {
      reasons.push(`${key} version changed from ${artifactRef.versionId} to ${currentRef.versionId}`);
      continue;
    }
    if (artifactRef.updatedAt && currentRef.updatedAt && artifactRef.updatedAt !== currentRef.updatedAt) {
      reasons.push(`${key} updatedAt changed from ${artifactRef.updatedAt} to ${currentRef.updatedAt}`);
      continue;
    }
    if (artifactRef.contentHash && currentRef.contentHash && artifactRef.contentHash !== currentRef.contentHash) {
      reasons.push(`${key} content hash changed`);
    }
  }
  if (reasons.some((reason) => reason.includes("missing from current dependency vector"))) {
    return { stale: true, state: "invalid", reasons };
  }
  if (reasons.length > 0) return { stale: true, state: "stale", reasons };
  return { stale: false, state: "current", reasons: [] };
}

export function applyCompileDecisionPatches<T extends EntityCompileArtifact | SpeciesCompileArtifact | PhenotypeCompileArtifact>(
  artifact: T,
  patches: CompileDecisionPatch[]
): T {
  const requests = new Map(artifact.decisionRequests.map((request) => [request.requestId, request]));
  const decisionTrace = "decisionTrace" in artifact ? [...artifact.decisionTrace] : [];
  const appliedPatches: CompileDecisionPatch[] = [];
  for (const patch of patches) {
    const request = requests.get(patch.requestId);
    if (!request) throw new Error(`compile decision request not found: ${patch.requestId}`);
    if (!request.allowedActions.includes(patch.action)) {
      throw new Error(`compile decision action ${patch.action} is not allowed for ${patch.requestId}`);
    }
    appliedPatches.push(patch);
    decisionTrace.push(
      trace({
        objectType: "compile-decision-patch",
        objectId: patch.requestId,
        layer: "task-brief",
        fieldPath: patch.fieldPath,
        valueSummary: patch.valueSummary,
        decision: patch.action === "suggest-upstream-change" ? "llm-suggested" : "manual",
        resolutionRule:
          patch.action === "suggest-upstream-change" ? "llm-review" : patch.action === "manual" ? "manual" : patch.action
      })
    );
  }
  const frames = artifact.frames.map((frame) => {
    if (!patches.some((patch) => patch.fieldPath.startsWith(frame.level) || patch.fieldPath.startsWith("phenotype"))) return frame;
    return {
      ...frame,
      traces: [...frame.traces, ...decisionTrace.slice(-patches.length)],
      openQuestions: frame.openQuestions.filter((question) => !patches.some((patch) => question.includes(patch.fieldPath))),
      resolvedSnapshot: {
        ...frame.resolvedSnapshot,
        decisionPatches: [...((frame.resolvedSnapshot.decisionPatches as unknown[]) ?? []), ...patches]
      }
    };
  });
  return {
    ...artifact,
    frames,
    decisionPatches: [...artifact.decisionPatches, ...appliedPatches],
    decisionTrace: "decisionTrace" in artifact ? decisionTrace : undefined
  } as T;
}

export function compileSpecies(input: CompileSpeciesInput): CompileSpeciesResult {
  const conflicts: GeneConflict[] = [];
  const resolved: Record<string, unknown> = {};
  const policy = input.node.compilePolicy?.type ?? input.graph.compilePolicy.type;
  const contextTrace = buildCompileContextTrace(input);

  if (policy === "snapshot-fixed" && input.fixedSnapshot) {
    Object.assign(resolved, input.fixedSnapshot);
  } else {
    for (const parent of input.parentSnapshots ?? []) {
      mergeWithConflicts(resolved, parent.snapshot, `parent:${parent.nodeVersionId}`, conflicts);
    }
    for (const relationship of input.relationshipDeltas ?? []) {
      mergeWithConflicts(resolved, relationship.delta, `relationship:${relationship.relationshipId}`, conflicts);
    }
    mergeWithConflicts(resolved, input.node.constraints, `node:${input.node.nodeId}`, conflicts);
    if (input.node.motifs.length > 0) {
      resolved.motifs = input.node.motifs;
    }
    if (input.node.badcases.length > 0) {
      resolved.badcases = input.node.badcases;
    }
  }

  const motifText = input.node.motifs.length ? `Motifs: ${input.node.motifs.join(", ")}.` : "Motifs: none specified.";
  const constraintText = Object.entries(input.node.constraints)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
  const contextText = contextTrace.map((item) => `- ${item.sourceType}:${item.sourceId} ${item.summary}`).join("\n");
  const prompt = [
    `Design Network Atlas phenotype request.`,
    `Type: ${input.phenotypeType}.`,
    `Task: ${input.taskBrief}.`,
    `Species: ${input.node.name}.`,
    motifText,
    constraintText ? `Constraints: ${constraintText}.` : "Constraints: none specified.",
    contextText ? `Context:\n${contextText}` : "",
    input.node.badcases.length ? `Avoid: ${input.node.badcases.join(", ")}.` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    compilePolicy: policy,
    candidateGenes: { ...resolved },
    conflicts,
    resolvedGeneSnapshot: resolved,
    contextTrace,
    prompt,
    brief: `Produce ${input.phenotypeType} for ${input.node.name}: ${input.taskBrief}`,
    relationshipTrace: (input.relationshipDeltas ?? []).map((relationship) => relationship.relationshipId)
  };
}

function buildCompileContextTrace(input: CompileSpeciesInput): CompileContextTraceItem[] {
  const traces: CompileContextTraceItem[] = [];
  for (const group of input.speciesGroups ?? []) {
    const facts = group.sharedFacts.length ? `facts=${group.sharedFacts.join(", ")}` : "facts=none";
    const facetSchemas = group.facetSchemaIds.length ? `facetSchemas=${group.facetSchemaIds.join(", ")}` : "facetSchemas=none";
    traces.push({
      sourceType: "species-group",
      sourceId: group.groupId,
      summary: `${group.name}; ${facts}; ${facetSchemas}`,
      fixedRuleEligible: true
    });
  }
  for (const relationship of input.designRelationships ?? []) {
    traces.push({
      sourceType: "design-relationship",
      sourceId: relationship.relationshipId,
      relationType: relationship.relationshipType,
      summary: `[${relationship.relationshipType}] ${formatRelationshipEndpoint(relationship.source)} -> ${formatRelationshipEndpoint(relationship.target)}. ${relationship.description}`.trim(),
      fixedRuleEligible: isFixedRuleEligibleRelation(relationship.relationshipType)
    });
  }
  for (const context of input.designContexts ?? []) {
    const attachments = (input.contextAttachments ?? []).filter((attachment) => attachment.contextId === context.contextId);
    if (attachments.length === 0) {
      traces.push({
        sourceType: "design-context",
        sourceId: context.contextId,
        summary: `Design Context: ${context.name}; ${context.summary}`,
        fixedRuleEligible: false
      });
      continue;
    }
    for (const attachment of attachments) {
      const policy = (input.contextPolicies ?? []).find(
        (candidate) =>
          candidate.contextId === context.contextId &&
          (!candidate.attachmentId || candidate.attachmentId === attachment.attachmentId)
      );
      if (policy?.compileParticipation === "none") continue;
      traces.push({
        sourceType: "design-context",
        sourceId: context.contextId,
        compileLayer: attachment.compileLayer,
        role: attachment.role,
        strength: attachment.strength,
        summary: `Design Context: ${context.name}; ${context.summary}; target=${attachment.targetType}:${attachment.targetId}; role=${attachment.role}; participation=${policy?.compileParticipation ?? "llm-context"}`,
        fixedRuleEligible: policy?.compileParticipation === "fixed"
      });
    }
  }
  return traces;
}

function formatRelationshipEndpoint(endpoint: DesignRelationship["source"]): string {
  if (endpoint.type === "graph") return `graph:${endpoint.graphId}`;
  if (endpoint.type === "species-group") return `species-group:${endpoint.graphId}:${endpoint.groupId}`;
  return `species-node:${endpoint.graphId}:${endpoint.nodeId}`;
}
