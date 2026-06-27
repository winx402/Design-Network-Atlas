import {
  CompileConflict,
  CompileScope,
  ContextAttachment,
  ContextFact,
  ContextPolicy,
  ContextReference,
  ContextReviewRubric,
  DesignContext,
  DesignPrinciple,
  ContextMotif,
  Graph,
  GraphBridge,
  GeneTemplate,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  PhenotypeCompileArtifact,
  SpeciesGroup,
  SpeciesGroupRelation,
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
  edgeDeltas?: Array<{ edgeVersionId: string; delta: Record<string, unknown> }>;
  speciesGroups?: SpeciesGroup[];
  groupRelations?: SpeciesGroupRelation[];
  graphBridges?: GraphBridge[];
  designContexts?: DesignContext[];
  contextAttachments?: ContextAttachment[];
  contextPolicies?: ContextPolicy[];
  fixedSnapshot?: Record<string, unknown>;
  taskBrief: string;
  phenotypeType: string;
}

export interface CompileContextTraceItem {
  sourceType: "species-group" | "species-group-relation" | "graph-bridge" | "design-context";
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
  edgeVersionTrace: string[];
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
  edgeDeltas?: Array<{ edgeVersionId: string; delta: Record<string, unknown> }>;
  speciesGroups?: SpeciesGroup[];
  groupRelations?: SpeciesGroupRelation[];
  graphBridges?: GraphBridge[];
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
  generationConstraints?: Record<string, unknown>;
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
    includeGroupRelations: input?.includeGroupRelations ?? true,
    includeGraphBridges: input?.includeGraphBridges ?? true,
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

function compileLayerFromContextAttachment(attachment?: ContextAttachment): TraceEntry["layer"] {
  if (!attachment) return "graph-context";
  if (attachment.compileLayer === "atlas-context") return "atlas-context";
  if (attachment.compileLayer === "graph-context") return "graph-context";
  if (attachment.compileLayer === "group-context") return "group-context";
  if (attachment.compileLayer === "bridge-context") return "graph-bridge-facts";
  return "phenotype-context";
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

  if (compileScope.includeGroupRelations) {
    for (const relation of input.groupRelations ?? []) {
      sourceTrace.push(
        trace({
          objectType: "species-group-relation",
          objectId: relation.relationId,
          layer: "group-context",
          fieldPath: "description",
          valueSummary: `[${relation.relationType}] ${relation.description}`,
          decision: isFixedRuleEligibleRelation(relation.relationType) ? "included" : "llm-suggested",
          metadata: { relationType: relation.relationType, fixedRuleEligible: isFixedRuleEligibleRelation(relation.relationType) }
        })
      );
    }
  }

  if (compileScope.includeGraphBridges) {
    for (const bridge of input.graphBridges ?? []) {
      sourceTrace.push(
        trace({
          objectType: "graph-bridge",
          objectId: bridge.bridgeId,
          layer: "graph-bridge-facts",
          fieldPath: "description",
          valueSummary: `[${bridge.bridgeType}] ${bridge.description}`,
          decision: "included",
          metadata: { bridgeType: bridge.bridgeType, sourceGraphId: bridge.sourceGraphId, targetGraphId: bridge.targetGraphId }
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

  for (const edge of input.edgeDeltas ?? []) {
    mergeArtifactGenes({
      target: resolvedGeneSnapshot,
      next: edge.delta,
      source: `edge:${edge.edgeVersionId}`,
      layer: "evolution-edge-deltas",
      conflicts: conflictReport,
      sourceTrace,
      objectType: "edge-version",
      objectId: edge.edgeVersionId,
      versionId: edge.edgeVersionId
    });
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

  return {
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
  const prompt = [
    "Design Network Atlas phenotype generation.",
    `Phenotype type: ${input.phenotypeType}.`,
    `Species: ${input.node.name}.`,
    `Task: ${input.taskBrief}.`,
    typeGuidance,
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
      speciesCompileArtifactId: input.speciesArtifact?.artifactId
    },
    compilePolicy: input.node.compilePolicy ?? input.graph.compilePolicy,
    compileScope,
    resolvedGeneSnapshot,
    conflictReport: input.speciesArtifact?.conflictReport ?? [],
    sourceTrace,
    contextTrace,
    referenceTrace,
    rubricTrace,
    decisionTrace,
    prompt,
    negativePrompt: [...new Set(negativeParts)].join(", "),
    artBrief: `Produce ${input.phenotypeType} for ${input.node.name}. ${typeGuidance} ${input.taskBrief}`.trim(),
    reviewChecklist,
    generationConstraints: input.generationConstraints ?? {},
    openQuestions: input.speciesArtifact?.openQuestions ?? [],
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
    for (const edge of input.edgeDeltas ?? []) {
      mergeWithConflicts(resolved, edge.delta, `edge:${edge.edgeVersionId}`, conflicts);
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
    edgeVersionTrace: (input.edgeDeltas ?? []).map((edge) => edge.edgeVersionId)
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
  for (const relation of input.groupRelations ?? []) {
    traces.push({
      sourceType: "species-group-relation",
      sourceId: relation.relationId,
      relationType: relation.relationType,
      summary: `[${relation.relationType}] ${relation.sourceGroupId} -> ${relation.targetGroupId}. ${relation.description}`.trim(),
      fixedRuleEligible: isFixedRuleEligibleRelation(relation.relationType)
    });
  }
  for (const bridge of input.graphBridges ?? []) {
    traces.push({
      sourceType: "graph-bridge",
      sourceId: bridge.bridgeId,
      relationType: bridge.bridgeType,
      summary: `[${bridge.bridgeType}] ${bridge.sourceGraphId} -> ${bridge.targetGraphId}. ${bridge.description}`.trim(),
      fixedRuleEligible: isFixedRuleEligibleRelation(bridge.bridgeType)
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
