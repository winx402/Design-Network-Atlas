import {
  type CompileDependencyRef,
  type CompileFrame,
  type CompileFrameLevel,
  type CompileSnapshotEntry,
  type DesignReadinessDimension,
  type DesignReadinessPolicy,
  type DesignReadinessPolicyResult,
  type DesignReadinessResult
} from "./schemas.js";

type DimensionInput = {
  key: string;
  label: string;
  present: boolean;
  partial?: boolean;
  reasonPresent: string;
  reasonMissing: string;
  missing: string[];
  suggestedActions: string[];
  blocking?: boolean;
};

function dimension(input: DimensionInput): DesignReadinessDimension {
  const score = input.present ? 100 : input.partial ? 50 : 0;
  return {
    key: input.key,
    label: input.label,
    score,
    reason: input.present ? input.reasonPresent : input.partial ? `${input.reasonMissing} Partial evidence exists.` : input.reasonMissing,
    missing: input.present ? [] : input.missing,
    suggestedActions: input.present ? [] : input.suggestedActions
  };
}

function nonEmptySnapshot(entries: CompileSnapshotEntry[]) {
  return entries.some((entry) => {
    if (typeof entry.summary === "string" && entry.summary.trim().length > 0) return true;
    return entry.value !== undefined && JSON.stringify(entry.value) !== "{}" && JSON.stringify(entry.value) !== "[]";
  });
}

function hasLocalField(frame: CompileFrame, fieldPath: string) {
  return frame.localSnapshot.some((entry) => entry.fieldPath === fieldPath && nonEmptySnapshot([entry]));
}

function localValue(frame: CompileFrame, fieldPath: string): unknown {
  return frame.localSnapshot.find((entry) => entry.fieldPath === fieldPath)?.value;
}

function hasObjectKeys(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}

function hasArrayValue(value: unknown, key: string) {
  return Boolean(value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key]) && ((value as Record<string, unknown>)[key] as unknown[]).length > 0);
}

function dependencyRefsForFrame(frame: CompileFrame, dependencyVector?: CompileDependencyRef[]): CompileDependencyRef[] {
  const keys = new Set<string>();
  const refs: CompileDependencyRef[] = [];
  const push = (ref: CompileDependencyRef) => {
    const key = `${ref.objectType}:${ref.objectId}:${ref.versionId ?? ""}:${ref.role}`;
    if (keys.has(key)) return;
    keys.add(key);
    refs.push(ref);
  };
  for (const ref of dependencyVector ?? []) {
    if (ref.objectId === frame.target.objectId || ref.role !== "source") push(ref);
  }
  const fromEntries = (entries: CompileSnapshotEntry[], role: CompileDependencyRef["role"]) => {
    for (const entry of entries) {
      if (!entry.objectId) continue;
      push({ objectType: entry.objectType, objectId: entry.objectId, role });
    }
  };
  fromEntries(frame.localSnapshot, "source");
  fromEntries(frame.relationshipSnapshot, "relationship");
  fromEntries(frame.contextSnapshot, "context");
  fromEntries(frame.facetSnapshot, "facet");
  fromEntries(frame.templateSnapshot, "template");
  return refs;
}

function dimensionsForAtlas(frame: CompileFrame): DesignReadinessDimension[] {
  return [
    dimension({
      key: "atlas-graph-split",
      label: "Graph split quality",
      present: hasLocalField(frame, "graphIds"),
      reasonPresent: "Atlas lists graph boundaries for review.",
      reasonMissing: "Atlas has no graph split evidence.",
      missing: ["graphIds"],
      suggestedActions: ["Define the graph collection and split rationale before downstream generation."],
      blocking: true
    }),
    dimension({
      key: "atlas-graph-relationships",
      label: "Graph relationships",
      present: frame.relationshipSnapshot.length > 0,
      reasonPresent: "Atlas has relationship evidence between graph-level concepts.",
      reasonMissing: "Atlas has no graph-level relationship evidence.",
      missing: ["graph relationships"],
      suggestedActions: ["Add DesignRelationship records that explain graph-level dependencies."]
    }),
    dimension({
      key: "atlas-boundary-conflicts",
      label: "Collection boundaries and conflicts",
      present: frame.contextSnapshot.length > 0 || frame.feedback.length === 0,
      partial: frame.openQuestions.length === 0,
      reasonPresent: "Atlas has bounded context or no unresolved compile feedback.",
      reasonMissing: "Atlas boundaries need review context or conflict notes.",
      missing: ["collection context", "conflict notes"],
      suggestedActions: ["Attach context or record open questions for graph split conflicts."]
    })
  ];
}

function dimensionsForGraph(frame: CompileFrame): DesignReadinessDimension[] {
  return [
    dimension({
      key: "graph-purpose",
      label: "Purpose and design direction",
      present: hasLocalField(frame, "purpose"),
      reasonPresent: "Graph purpose is available to guide downstream compile.",
      reasonMissing: "Graph purpose or design direction is missing.",
      missing: ["Graph.purpose"],
      suggestedActions: ["Clarify the graph purpose and intended output family."],
      blocking: true
    }),
    dimension({
      key: "graph-context-language",
      label: "Context and design language",
      present: frame.contextSnapshot.length > 0,
      reasonPresent: "Graph has bound context language.",
      reasonMissing: "Graph has no bound context facts, principles, motifs, or references.",
      missing: ["context attachments"],
      suggestedActions: ["Attach design context, principles, motifs, or reference boundaries."]
    }),
    dimension({
      key: "graph-relationship-contracts",
      label: "Relationship contracts",
      present: frame.relationshipSnapshot.length > 0,
      reasonPresent: "Graph has design relationship evidence.",
      reasonMissing: "Graph has no relationship contract evidence.",
      missing: ["DesignRelationship"],
      suggestedActions: ["Model graph or species relationships with design contracts."]
    }),
    dimension({
      key: "graph-facet-coverage",
      label: "Facet coverage",
      present: frame.facetSnapshot.length > 0,
      reasonPresent: "Graph has facet schema or assignment coverage.",
      reasonMissing: "Graph has no facet coverage.",
      missing: ["FacetDefinition", "FacetSchema", "FacetAssignment"],
      suggestedActions: ["Define facets that reviewers can use to check generated outputs."]
    }),
    dimension({
      key: "graph-downstream-guidance",
      label: "Downstream guidance",
      present: frame.templateSnapshot.length > 0 || frame.contextSnapshot.length > 0 || frame.facetSnapshot.length > 0,
      reasonPresent: "Graph contains reusable downstream guidance.",
      reasonMissing: "Graph has little downstream compile guidance.",
      missing: ["templates or context/facet guidance"],
      suggestedActions: ["Add template dimensions, context, or facet expectations for generated phenotypes."]
    })
  ];
}

function dimensionsForGroup(frame: CompileFrame): DesignReadinessDimension[] {
  return [
    dimension({
      key: "group-division-reason",
      label: "Division reason",
      present: hasLocalField(frame, "sharedFacts"),
      reasonPresent: "Group has shared facts that explain why members belong together.",
      reasonMissing: "Group lacks a clear grouping reason.",
      missing: ["sharedFacts"],
      suggestedActions: ["Record shared facts or group rationale."]
    }),
    dimension({
      key: "group-shared-language",
      label: "Shared language and usage",
      present: frame.contextSnapshot.length > 0 || hasLocalField(frame, "sharedFacts"),
      reasonPresent: "Group has shared language evidence.",
      reasonMissing: "Group has no shared language or context evidence.",
      missing: ["group context", "shared language"],
      suggestedActions: ["Attach context or principles shared by group members."]
    }),
    dimension({
      key: "group-facet-policy",
      label: "Shared facts, facets, and review policy",
      present: frame.facetSnapshot.length > 0 || hasArrayValue(localValue(frame, "sharedFacts"), "facetSchemaIds"),
      reasonPresent: "Group has facet or schema evidence.",
      reasonMissing: "Group lacks facet schema or review policy evidence.",
      missing: ["facet schema", "review policy"],
      suggestedActions: ["Bind a facet schema or review rubric to the group."]
    }),
    dimension({
      key: "group-relationships",
      label: "Group-level relationships",
      present: frame.relationshipSnapshot.length > 0,
      reasonPresent: "Group has design relationship evidence.",
      reasonMissing: "Group has no group-level relationship evidence.",
      missing: ["group relationships"],
      suggestedActions: ["Model relationships to peer groups, graphs, or member species when they affect design."]
    })
  ];
}

function dimensionsForSpecies(frame: CompileFrame): DesignReadinessDimension[] {
  const local = localValue(frame, "constraints") as Record<string, unknown> | undefined;
  const constraints = local?.constraints;
  const motifs = Array.isArray(local?.motifs) ? local.motifs : [];
  const badcases = Array.isArray(local?.badcases) ? local.badcases : [];
  return [
    dimension({
      key: "species-phenotype-readiness",
      label: "Concrete drawable/generatable species",
      present: hasObjectKeys(constraints),
      reasonPresent: "Species has concrete constraints that can guide a generated output.",
      reasonMissing: "Species is too broad or directory-like for reliable phenotype generation.",
      missing: ["constraints"],
      suggestedActions: ["Add concrete visual/behavioral constraints or downgrade abstract systems to groups/contexts."],
      blocking: true
    }),
    dimension({
      key: "species-constraints",
      label: "Constraints and bound semantics",
      present: hasObjectKeys(constraints),
      reasonPresent: "Species has explicit constraints.",
      reasonMissing: "Species has no explicit constraints.",
      missing: ["SpeciesNode.constraints"],
      suggestedActions: ["Add must-preserve and must-avoid constraints before formal generation."],
      blocking: true
    }),
    dimension({
      key: "species-motifs-badcases",
      label: "Motifs, bad cases, and negative boundaries",
      present: motifs.length > 0 || badcases.length > 0,
      reasonPresent: "Species includes motifs or negative boundaries.",
      reasonMissing: "Species lacks motifs and negative boundaries.",
      missing: ["motifs", "badcases"],
      suggestedActions: ["Record motifs and bad cases so outputs can be reviewed."]
    }),
    dimension({
      key: "species-relationship-contracts",
      label: "Parent and relationship roles",
      present: frame.relationshipSnapshot.length > 0 || frame.inheritedSnapshot.length > 0,
      reasonPresent: "Species has inherited or relationship context.",
      reasonMissing: "Species has no relationship contract or parent role evidence.",
      missing: ["DesignRelationship", "parent roles"],
      suggestedActions: ["Add relationship contracts or explicit parent roles instead of fake inheritance."]
    }),
    dimension({
      key: "species-context-facets",
      label: "Context and facet coverage",
      present: frame.contextSnapshot.length > 0 || frame.facetSnapshot.length > 0,
      reasonPresent: "Species has context or facet coverage.",
      reasonMissing: "Species lacks context and facet coverage.",
      missing: ["context", "facets"],
      suggestedActions: ["Bind context facts, motifs, references, or facet assignments."]
    })
  ];
}

function dimensionsForPhenotype(frame: CompileFrame): DesignReadinessDimension[] {
  const hasGuide = frame.localSnapshot.some((entry) => entry.objectType === "phenotype-usage-guide");
  return [
    dimension({
      key: "phenotype-usage-guide",
      label: "Usage guide",
      present: hasGuide,
      reasonPresent: "Phenotype has an active usage guide snapshot.",
      reasonMissing: "Phenotype lacks usage guide context.",
      missing: ["PhenotypeUsageGuide"],
      suggestedActions: ["Create or update the phenotype usage guide before production use."],
      blocking: true
    }),
    dimension({
      key: "phenotype-output-plan",
      label: "Output plan and task brief",
      present: hasLocalField(frame, "taskBrief"),
      reasonPresent: "Phenotype has an output task brief.",
      reasonMissing: "Phenotype lacks an output task brief.",
      missing: ["task brief"],
      suggestedActions: ["Record expected output type, routing, and task brief."],
      blocking: true
    }),
    dimension({
      key: "phenotype-scenarios-variants",
      label: "Scenarios and variants",
      present: hasGuide && JSON.stringify(frame.resolvedSnapshot).includes("usageGuide"),
      partial: hasGuide,
      reasonPresent: "Phenotype carries usage scenarios or variants.",
      reasonMissing: "Phenotype lacks scenario or variant guidance.",
      missing: ["usage scenarios", "variant plan"],
      suggestedActions: ["Capture usage scenarios and required variants in the guide."]
    }),
    dimension({
      key: "phenotype-review-checklist",
      label: "Review checklist",
      present: frame.traces.some((trace) => trace.objectType === "context-review-rubric") || hasGuide,
      reasonPresent: "Phenotype has review checklist evidence.",
      reasonMissing: "Phenotype lacks review checklist evidence.",
      missing: ["review checklist"],
      suggestedActions: ["Attach rubrics or guide checklist items for output review."]
    }),
    dimension({
      key: "phenotype-trace",
      label: "Trace to species, context, relationships, and task",
      present: frame.inheritedSnapshot.length > 0 && frame.traces.length > 0,
      partial: frame.inheritedSnapshot.length > 0 || frame.traces.length > 0,
      reasonPresent: "Phenotype can be traced back to species and task inputs.",
      reasonMissing: "Phenotype trace is incomplete.",
      missing: ["compile trace"],
      suggestedActions: ["Compile through layered species and phenotype artifacts."]
    })
  ];
}

function dimensionsForFrame(frame: CompileFrame): DesignReadinessDimension[] {
  if (frame.level === "atlas") return dimensionsForAtlas(frame);
  if (frame.level === "graph") return dimensionsForGraph(frame);
  if (frame.level === "species-group") return dimensionsForGroup(frame);
  if (frame.level === "species-node") return dimensionsForSpecies(frame);
  return dimensionsForPhenotype(frame);
}

function boundVersionRef(frame: CompileFrame): string | undefined {
  const guide = frame.localSnapshot.find((entry) => entry.objectType === "phenotype-usage-guide")?.value;
  if (!guide || typeof guide !== "object") return undefined;
  const value = guide as Record<string, unknown>;
  const guideId = typeof value.usageGuideId === "string" ? value.usageGuideId : undefined;
  const revision = typeof value.usageGuideRevision === "number" || typeof value.usageGuideRevision === "string" ? String(value.usageGuideRevision) : undefined;
  return guideId && revision ? `phenotype-usage-guide:${guideId}@${revision}` : undefined;
}

export function evaluateDesignReadinessForFrame(
  frame: CompileFrame,
  options: { dependencyVector?: CompileDependencyRef[]; evaluatedAt?: string; enabled?: boolean } = {}
): DesignReadinessResult {
  const enabled = options.enabled ?? true;
  const dimensions = enabled ? dimensionsForFrame(frame) : [];
  const score = dimensions.length ? Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length) : 0;
  const missing = dimensions.flatMap((item) => item.missing.map((entry) => `${item.label}: ${entry}`));
  const suggestions = [...new Set(dimensions.flatMap((item) => item.suggestedActions))];
  const blockingIssues = dimensions
    .filter((item) => item.score === 0 && ["graph-purpose", "species-phenotype-readiness", "species-constraints", "phenotype-usage-guide", "phenotype-output-plan"].includes(item.key))
    .map((item) => item.reason);
  const level = !enabled ? "ready" : score < 50 || blockingIssues.length > 0 ? "blocked" : score < 75 || missing.length > 0 ? "warning" : "ready";
  return {
    enabled,
    score,
    level,
    targetLevel: frame.level,
    targetId: frame.target.objectId,
    boundVersionRef: boundVersionRef(frame),
    dependencyVector: dependencyRefsForFrame(frame, options.dependencyVector),
    dimensions,
    warnings: level === "ready" ? [] : missing,
    blockingIssues,
    suggestions,
    evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
    evaluator: "system"
  };
}

export function evaluateDesignReadinessPolicy(
  readiness: DesignReadinessResult | undefined,
  policy: DesignReadinessPolicy = "warn"
): DesignReadinessPolicyResult {
  if (policy === "off") return { policy, allowed: true, warnings: [], blockingIssues: [] };
  if (!readiness) {
    const missing = "design readiness result is missing";
    return policy === "block" ? { policy, allowed: false, warnings: [], blockingIssues: [missing] } : { policy, allowed: true, warnings: [missing], blockingIssues: [] };
  }
  const warnings = [...readiness.warnings, ...readiness.suggestions];
  const blockingIssues = readiness.level === "blocked" ? readiness.blockingIssues.length ? readiness.blockingIssues : [`design readiness is ${readiness.level}`] : [];
  if (policy === "block" && (readiness.level === "blocked" || blockingIssues.length > 0)) {
    return { policy, allowed: false, warnings, blockingIssues };
  }
  return { policy, allowed: true, warnings: policy === "warn" ? [...warnings, ...blockingIssues] : [], blockingIssues: [] };
}
