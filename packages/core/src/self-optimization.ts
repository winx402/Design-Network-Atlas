import { createDefaultProposal, sanitizePlanningText } from "./defaults.js";
import { type SelfOptimizationCandidate, type SelfOptimizationSuggestionReport } from "./schemas.js";

function boundedEvidence(value: string) {
  const sanitized = sanitizePlanningText(value)?.replace(/\s+/g, " ").trim() ?? "";
  return sanitized.length > 220 ? `${sanitized.slice(0, 217)}...` : sanitized || "No actionable evidence supplied.";
}

function parseTargetScope(scope: string | undefined) {
  if (!scope) return { targetObjectType: "feedback", targetObjectId: "unknown" };
  const [targetObjectType, ...rest] = scope.split(":");
  return {
    targetObjectType: targetObjectType || "feedback",
    targetObjectId: rest.join(":") || "unknown"
  };
}

function classify(text: string, targetObjectType: string): Pick<
  SelfOptimizationCandidate,
  "suggestedWriteLocation" | "operationType" | "confidence" | "generality" | "applicabilityScope" | "conflictRisk" | "suggestedActions"
> {
  const source = text.toLowerCase();
  if (/usage|guide|scenario|variant|使用|场景|用法|变体/.test(source)) {
    return {
      suggestedWriteLocation: "PhenotypeUsageGuide",
      operationType: "update-usage-guide",
      confidence: "medium",
      generality: "phenotype-specific",
      applicabilityScope: targetObjectType === "phenotype" ? "target phenotype" : "nearest phenotype usage guide",
      conflictRisk: "medium",
      suggestedActions: ["Prepare a usage guide update change-set and ask the user to confirm scope."]
    };
  }
  if (/constraint|motif|badcase|must preserve|must avoid|silhouette|约束|母题|反例/.test(source)) {
    return {
      suggestedWriteLocation: "SpeciesNode constraints/motifs or attached context",
      operationType: "propose-species-language-update",
      confidence: "medium",
      generality: "species-level",
      applicabilityScope: "target species and downstream phenotypes",
      conflictRisk: "medium",
      suggestedActions: ["Create a preview change-set for species constraints or context, then review downstream impacts."]
    };
  }
  if (/group|shared|family|common|种群|共性/.test(source)) {
    return {
      suggestedWriteLocation: "SpeciesGroup shared facts/context/facet schema",
      operationType: "propose-group-language-update",
      confidence: "medium",
      generality: "group-level",
      applicabilityScope: "target species group",
      conflictRisk: "medium",
      suggestedActions: ["Promote only reusable group language into a reviewable proposal."]
    };
  }
  if (/graph|world|principle|relationship|contract|图谱|原则|关系/.test(source)) {
    return {
      suggestedWriteLocation: "Graph context/principles/motifs/facets/relationships",
      operationType: "propose-graph-language-update",
      confidence: "medium",
      generality: "graph-level",
      applicabilityScope: "target graph",
      conflictRisk: "high",
      suggestedActions: ["Review for graph-wide impact before creating change-sets."]
    };
  }
  return {
    suggestedWriteLocation: "PhenotypeVersion.feedback",
    operationType: "keep-feedback",
    confidence: "low",
    generality: "single-output",
    applicabilityScope: "source feedback only",
    conflictRisk: "low",
    suggestedActions: ["Keep as version feedback or ask for clearer scope before promotion."]
  };
}

export function detectSelfOptimizationCandidates(input: {
  sourceId?: string;
  sourceText: string;
  targetScope?: string;
  proposalId?: string;
  evaluatedAt?: string;
}): SelfOptimizationSuggestionReport {
  const evidenceSummary = boundedEvidence(input.sourceText);
  const target = parseTargetScope(input.targetScope);
  const classification = classify(input.sourceText, target.targetObjectType);
  const candidate: SelfOptimizationCandidate = {
    candidateId: `${input.sourceId ?? "feedback"}:candidate:0`,
    targetObjectType: target.targetObjectType,
    targetObjectId: target.targetObjectId,
    suggestedWriteLocation: classification.suggestedWriteLocation,
    operationType: classification.operationType,
    evidenceSummary,
    confidence: classification.confidence,
    generality: classification.generality,
    applicabilityScope: classification.applicabilityScope,
    conflictRisk: classification.conflictRisk,
    downstreamImpact:
      classification.confidence === "low"
        ? []
        : [`Review downstream compile artifacts and phenotype outputs for ${target.targetObjectType}:${target.targetObjectId}.`],
    requiresUserConfirmation: true,
    suggestedActions: classification.suggestedActions
  };
  const proposal = createDefaultProposal({
    proposalId: input.proposalId ?? `self-optimize-${input.sourceId ?? "preview"}`,
    title: `Self-optimization proposal for ${input.targetScope ?? "feedback"}`,
    summary:
      candidate.confidence === "low"
        ? "Low-confidence feedback remains as feedback/open question; no change-set is generated."
        : "Review candidate before creating or applying any graph/context/facet/guide change-set.",
    changeSetIds: [],
    riskNotes: candidate.conflictRisk === "high" ? ["Graph-level change may affect downstream compile artifacts and generated outputs."] : [],
    reviewNotes: [candidate.evidenceSummary],
    status: "draft",
    createdAt: input.evaluatedAt,
    updatedAt: input.evaluatedAt
  });
  return {
    sourceId: input.sourceId,
    targetScope: input.targetScope,
    candidates: [candidate],
    proposal,
    warnings:
      candidate.confidence === "low"
        ? ["Feedback was not promoted because scope or reusable design-language signal was too weak."]
        : ["No formal graph fact was written. Convert candidates to preview change-sets before applying."]
  };
}
