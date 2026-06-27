import {
  ContextAttachment,
  ContextPolicy,
  DesignContext,
  Graph,
  GraphBridge,
  SpeciesGroup,
  SpeciesGroupRelation,
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
  parentSnapshots?: Array<{ nodeVersionId: string; snapshot: Record<string, unknown> }>;
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
