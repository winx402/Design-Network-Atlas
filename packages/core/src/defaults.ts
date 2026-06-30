import {
  Atlas,
  AssetIndex,
  ContextAttachment,
  ContextFact,
  ContextMotif,
  ContextPolicy,
  ContextReference,
  ContextReviewRubric,
  DesignContext,
  DesignRelationship,
  DesignPrinciple,
  ExternalLibraryMapping,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  GeneTemplate,
  GenerationJob,
  Graph,
  GenerationVersionBinding,
  ImpactRecord,
  LibraryRoutingPolicy,
  NodeVersion,
  OutputReference,
  Phenotype,
  PhenotypeGenerationPlan,
  PhenotypeGenerationTask,
  ProductionIntent,
  ProductionIntentSchema,
  ProductionSliceRoleSchema,
  PhenotypeUsageGuide,
  PhenotypeUsageGuideCompileSnapshot,
  PhenotypeVersionFeedback,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  PhenotypeVersion,
  Proposal,
  ReviewRecord,
  SpeciesGroup,
  SpeciesGroupMembership,
  SpeciesNode,
  StorageMount
} from "./schemas.js";

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SENSITIVE_KEY_PATTERN = /api[_-]?key|authorization|bearer|credential|password|private[_-]?(?:key|link|url)|secret|token|signed[_-]?url/i;
const SENSITIVE_STRING_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*\S+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /sk-[A-Za-z0-9_-]+/g,
  /password\s*=\s*\S+/gi,
  /private[_-]?key\s*=\s*\S+/gi,
  /https?:\/\/[^\s"'<>]*(?:[?&](?:token|signature|sig|X-Amz-Signature|se|sp|sv)=)[^\s"'<>]*/gi,
  /https?:\/\/private\.[^\s"'<>]+/gi
];

export function sanitizePlanningText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return SENSITIVE_STRING_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[redacted]"), value);
}

export function sanitizePlanningJson(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return sanitizePlanningRecord(value ?? {});
}

export function normalizeProductionSliceRole(value: string | undefined): string | undefined {
  return value === undefined ? undefined : ProductionSliceRoleSchema.parse(value);
}

export function sanitizeProductionIntent(value: ProductionIntent | undefined): ProductionIntent | undefined {
  if (!value) return undefined;
  const sanitized = sanitizePlanningJson(value as Record<string, unknown>);
  if (Object.keys(sanitized).length === 0) return undefined;
  return ProductionIntentSchema.parse(sanitized);
}

function normalizeVersionBinding(value: Partial<GenerationVersionBinding> | undefined): GenerationVersionBinding {
  return {
    mode: value?.mode ?? "latest-at-execution",
    nodeVersionId: value?.nodeVersionId,
    speciesCompileArtifactId: value?.speciesCompileArtifactId,
    phenotypeCompileArtifactId: value?.phenotypeCompileArtifactId,
    replayHistorical: value?.replayHistorical ?? false
  };
}

function sanitizePlanningRecord(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    const sanitized = sanitizePlanningValue(entry);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizePlanningValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizePlanningText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizePlanningValue(entry)).filter((entry) => entry !== undefined);
  if (value && typeof value === "object") return sanitizePlanningRecord(value as Record<string, unknown>);
  return value;
}

export function sanitizePhenotypeVersionFeedback(feedback: PhenotypeVersionFeedback | undefined): PhenotypeVersionFeedback {
  return {
    summary: sanitizePlanningText(feedback?.summary),
    items: (feedback?.items ?? []).map((item) => ({
      ...item,
      message: sanitizePlanningText(item.message) ?? "",
      suggestedAction: sanitizePlanningText(item.suggestedAction)
    }))
  };
}

function sanitizeStringArray(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => sanitizePlanningText(value) ?? "").filter(Boolean);
}

type PhenotypeUsageGuideInput = Partial<Omit<PhenotypeUsageGuide, "usageInstructions" | "designSemantics" | "productionHints">> &
  Pick<PhenotypeUsageGuide, "usageGuideId" | "phenotypeId" | "graphId" | "nodeId" | "phenotypeType" | "title" | "summary"> & {
    usageInstructions?: Partial<PhenotypeUsageGuide["usageInstructions"]>;
    designSemantics?: Partial<PhenotypeUsageGuide["designSemantics"]>;
    productionHints?: Partial<PhenotypeUsageGuide["productionHints"]>;
  };

export function createDefaultPhenotypeUsageGuide(input: PhenotypeUsageGuideInput): PhenotypeUsageGuide {
  const timestamp = nowIso();
  return {
    usageGuideId: input.usageGuideId,
    phenotypeId: input.phenotypeId,
    graphId: input.graphId,
    nodeId: input.nodeId,
    phenotypeType: sanitizePlanningText(input.phenotypeType) ?? input.phenotypeType,
    status: input.status ?? "active",
    revision: input.revision ?? 1,
    title: sanitizePlanningText(input.title) ?? input.title,
    summary: sanitizePlanningText(input.summary) ?? input.summary,
    usageScenarios: (input.usageScenarios ?? []).map((scenario) => ({
      ...scenario,
      name: sanitizePlanningText(scenario.name) ?? scenario.name,
      surface: sanitizePlanningText(scenario.surface),
      userMoment: sanitizePlanningText(scenario.userMoment),
      designIntent: sanitizePlanningText(scenario.designIntent) ?? scenario.designIntent,
      implementationRole: sanitizePlanningText(scenario.implementationRole)
    })),
    usageInstructions: {
      primaryUse: sanitizePlanningText(input.usageInstructions?.primaryUse) ?? input.usageInstructions?.primaryUse ?? "",
      placement: sanitizePlanningText(input.usageInstructions?.placement),
      composition: sanitizePlanningText(input.usageInstructions?.composition),
      stateBehavior: sanitizePlanningText(input.usageInstructions?.stateBehavior),
      doNotUseFor: sanitizeStringArray(input.usageInstructions?.doNotUseFor)
    },
    designSemantics: {
      sourceContextIds: input.designSemantics?.sourceContextIds ?? [],
      sourceFactIds: input.designSemantics?.sourceFactIds ?? [],
      sourcePrincipleIds: input.designSemantics?.sourcePrincipleIds ?? [],
      sourceMotifIds: input.designSemantics?.sourceMotifIds ?? [],
      sourceFacetIds: input.designSemantics?.sourceFacetIds ?? [],
      sourceRelationshipIds: input.designSemantics?.sourceRelationshipIds ?? [],
      mustPreserve: sanitizeStringArray(input.designSemantics?.mustPreserve),
      mustAvoid: sanitizeStringArray(input.designSemantics?.mustAvoid)
    },
    variantPlan: (input.variantPlan ?? []).map((variant) => ({
      ...variant,
      name: sanitizePlanningText(variant.name) ?? variant.name,
      purpose: sanitizePlanningText(variant.purpose) ?? variant.purpose,
      notes: sanitizePlanningText(variant.notes)
    })),
    productionHints: {
      suggestedAssetTypes: input.productionHints?.suggestedAssetTypes ?? [],
      suggestedAspectRatio: sanitizePlanningText(input.productionHints?.suggestedAspectRatio),
      suggestedTransparency: input.productionHints?.suggestedTransparency,
      suggestedSize: sanitizePlanningText(input.productionHints?.suggestedSize),
      namingHint: sanitizePlanningText(input.productionHints?.namingHint),
      deliveryNotes: sanitizePlanningText(input.productionHints?.deliveryNotes)
    },
    reviewChecklist: (input.reviewChecklist ?? []).map((item) => ({
      ...item,
      question: sanitizePlanningText(item.question) ?? item.question
    })),
    llmPromptTemplate: sanitizePlanningText(input.llmPromptTemplate),
    sourceSummary: sanitizePlanningText(input.sourceSummary) ?? "",
    metadata: sanitizePlanningJson(input.metadata),
    extensions: sanitizePlanningJson(input.extensions),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function summarizePhenotypeUsageGuideForCompile(guide: PhenotypeUsageGuide): PhenotypeUsageGuideCompileSnapshot {
  return {
    usageGuideId: guide.usageGuideId,
    usageGuideRevision: guide.revision,
    phenotypeId: guide.phenotypeId,
    title: guide.title,
    summary: guide.summary,
    primaryUsageScenario: guide.usageScenarios.find((scenario) => scenario.priority === "primary")?.name ?? guide.usageScenarios[0]?.name,
    selectedScenarios: guide.usageScenarios.map((scenario) => scenario.name),
    mustPreserve: guide.designSemantics.mustPreserve,
    mustAvoid: guide.designSemantics.mustAvoid,
    variantPlan: guide.variantPlan.map((variant) => ({
      variantId: variant.variantId,
      name: variant.name,
      purpose: variant.purpose,
      required: variant.required
    })),
    reviewChecklist: guide.reviewChecklist.map((item) => ({
      checklistId: item.checklistId,
      question: item.question,
      severity: item.severity
    })),
    productionHints: guide.productionHints
  };
}

export function renderPhenotypeUsageGuideMarkdown(guide: PhenotypeUsageGuide): string {
  const scenarios = guide.usageScenarios.length
    ? guide.usageScenarios
        .map(
          (scenario) =>
            `| ${scenario.name} | ${scenario.surface ?? "Not specified"} | ${scenario.userMoment ?? "Not specified"} | ${scenario.designIntent} | ${scenario.priority ?? "optional"} |`
        )
        .join("\n")
    : "| None | Not specified | Not specified | Not specified | optional |";
  const variants = guide.variantPlan.length
    ? guide.variantPlan
        .map((variant) => `| ${variant.name} | ${variant.purpose} | ${variant.required ? "yes" : "no"} | ${variant.notes ?? ""} |`)
        .join("\n")
    : "| default | Not specified | no | None |";
  const checklist = guide.reviewChecklist.length
    ? guide.reviewChecklist.map((item) => `- [ ] ${item.severity}: ${item.question}`).join("\n")
    : "- [ ] info: No review checklist recorded.";
  const sourceIds = [
    ...guide.designSemantics.sourceContextIds,
    ...guide.designSemantics.sourceFactIds,
    ...guide.designSemantics.sourcePrincipleIds,
    ...guide.designSemantics.sourceMotifIds,
    ...guide.designSemantics.sourceFacetIds
  ];
  return [
    `# ${guide.title} 使用说明`,
    "",
    "## 1. 关联对象",
    "",
    `- Graph: ${guide.graphId}`,
    `- Species: ${guide.nodeId}`,
    `- Phenotype: ${guide.phenotypeId}`,
    `- Phenotype type: ${guide.phenotypeType}`,
    `- Usage guide revision: ${guide.revision}`,
    `- Summary: ${guide.summary}`,
    "",
    "## 2. 使用场景",
    "",
    "| 场景 | 出现位置/消费面 | 用户感知 | 设计目的 | 优先级 |",
    "| --- | --- | --- | --- | --- |",
    scenarios,
    "",
    "## 3. 使用方式",
    "",
    `- 主要用途：${guide.usageInstructions.primaryUse}`,
    `- 推荐放置/组合方式：${guide.usageInstructions.placement ?? guide.usageInstructions.composition ?? "Not specified"}`,
    `- 状态或表现行为：${guide.usageInstructions.stateBehavior ?? "Not specified"}`,
    `- 不建议使用在：${guide.usageInstructions.doNotUseFor.length ? guide.usageInstructions.doNotUseFor.join(", ") : "None"}`,
    "",
    "## 4. 设计语言来源",
    "",
    `- 来源 context / facts / principles / motifs / facets：${sourceIds.length ? sourceIds.join(", ") : "None"}`,
    `- 相关 design relationships：${guide.designSemantics.sourceRelationshipIds.length ? guide.designSemantics.sourceRelationshipIds.join(", ") : "None"}`,
    `- 必须保留：${guide.designSemantics.mustPreserve.length ? guide.designSemantics.mustPreserve.join(", ") : "None"}`,
    `- 必须避免：${guide.designSemantics.mustAvoid.length ? guide.designSemantics.mustAvoid.join(", ") : "None"}`,
    "",
    "## 5. 表现变体",
    "",
    "| 变体 | 用途 | 是否必需 | 说明 |",
    "| --- | --- | --- | --- |",
    variants,
    "",
    "## 6. 制作与交付建议",
    "",
    `- 建议 asset type：${guide.productionHints.suggestedAssetTypes.join(", ") || "Not specified"}`,
    `- 建议尺寸/比例：${guide.productionHints.suggestedSize ?? guide.productionHints.suggestedAspectRatio ?? "Not specified"}`,
    `- 透明通道建议：${guide.productionHints.suggestedTransparency ?? "Not specified"}`,
    `- 命名建议：${guide.productionHints.namingHint ?? "semantic naming only; do not prescribe a project directory"}`,
    `- 其他交付注意：${guide.productionHints.deliveryNotes ?? "None"}`,
    "",
    "## 7. 审阅清单",
    "",
    checklist,
    "",
    "## 8. 不确定项",
    "",
    "- 不确定内容必须标注为需要项目侧确认，不要编造不存在对象。"
  ].join("\n");
}

export function createPhenotypeUsageGuidePromptTemplate(input: {
  graph: { graphId: string; name?: string };
  species: { nodeId: string; name?: string };
  phenotype: { phenotypeId: string; name?: string; phenotypeType: string };
  contexts?: Array<{ contextId: string; summary?: string }>;
  relationships?: Array<{ relationshipId: string; summary?: string }>;
  userNotes?: string;
}): string {
  return [
    "CLI usage guide template for a DNA PhenotypeUsageGuide.",
    "",
    "Create structured JSON or Markdown with these sections: 关联对象, 使用场景, 使用方式, 设计语言来源, 表现变体, 制作与交付建议, 审阅清单, 不确定项.",
    "",
    `Graph: ${input.graph.name ?? input.graph.graphId} (${input.graph.graphId})`,
    `Species: ${input.species.name ?? input.species.nodeId} (${input.species.nodeId})`,
    `Phenotype: ${input.phenotype.name ?? input.phenotype.phenotypeId} (${input.phenotype.phenotypeId})`,
    `Phenotype type: ${input.phenotype.phenotypeType}`,
    input.contexts?.length ? `Context summaries: ${input.contexts.map((context) => `${context.contextId}: ${context.summary ?? ""}`).join("; ")}` : "Context summaries: none.",
    input.relationships?.length
      ? `Design relationships: ${input.relationships.map((relationship) => `${relationship.relationshipId}: ${relationship.summary ?? ""}`).join("; ")}`
      : "Design relationships: none.",
    input.userNotes ? `User notes: ${sanitizePlanningText(input.userNotes)}` : "User notes: none.",
    "",
    "Do not invent missing graph, species, relationship, asset, or context facts.",
    "Do not output API keys, provider credentials, signed URLs, complete private links, or raw provider payloads.",
    "Do not prescribe project file directories, Eagle fields, Cocos paths, wiki locations, or private project policies.",
    "Mark uncertainty explicitly as needs project-side confirmation."
  ].join("\n");
}

export function createDefaultProposal(
  input: Partial<Proposal> & Pick<Proposal, "proposalId" | "title">
): Proposal {
  const timestamp = nowIso();
  return {
    proposalId: input.proposalId,
    title: input.title,
    summary: input.summary ?? "",
    status: input.status ?? "draft",
    changeSetIds: input.changeSetIds ?? [],
    riskNotes: input.riskNotes ?? [],
    reviewNotes: input.reviewNotes ?? [],
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultGraph(input: Partial<Graph> & Pick<Graph, "graphId" | "name" | "purpose">): Graph {
  const timestamp = nowIso();
  return {
    graphId: input.graphId,
    name: input.name,
    purpose: input.purpose,
    status: input.status ?? "draft",
    currentVersion: input.currentVersion ?? "1.0.0",
    rootNodes: input.rootNodes ?? [],
    templateIds: input.templateIds ?? [],
    versionPolicy: input.versionPolicy ?? { patch: "metadata", minor: "compatible gene change", major: "identity change" },
    compilePolicy: input.compilePolicy ?? { type: "system-rule-first", conflictResolution: "system" },
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultFacetDefinition(input: Partial<FacetDefinition> & Pick<FacetDefinition, "facetId" | "name">): FacetDefinition {
  const timestamp = nowIso();
  return {
    facetId: input.facetId,
    name: input.name,
    description: input.description ?? "",
    valueType: input.valueType ?? "string",
    allowedValues: input.allowedValues ?? [],
    status: input.status ?? "active",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultFacetSchema(input: Partial<FacetSchema> & Pick<FacetSchema, "facetSchemaId" | "name">): FacetSchema {
  const timestamp = nowIso();
  return {
    facetSchemaId: input.facetSchemaId,
    name: input.name,
    description: input.description ?? "",
    facetIds: input.facetIds ?? [],
    requiredFacetIds: input.requiredFacetIds ?? [],
    status: input.status ?? "active",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultFacetAssignment(
  input: Partial<FacetAssignment> & Pick<FacetAssignment, "assignmentId" | "targetType" | "targetId">
): FacetAssignment {
  const timestamp = nowIso();
  return {
    assignmentId: input.assignmentId,
    targetType: input.targetType,
    targetId: input.targetId,
    values: input.values ?? {},
    status: input.status ?? "active",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultSpeciesGroup(
  input: Partial<SpeciesGroup> & Pick<SpeciesGroup, "groupId" | "graphId" | "name">
): SpeciesGroup {
  const timestamp = nowIso();
  return {
    groupId: input.groupId,
    graphId: input.graphId,
    name: input.name,
    groupType: input.groupType ?? "domain",
    parentGroupIds: input.parentGroupIds ?? [],
    templateIds: input.templateIds ?? [],
    sharedFacts: input.sharedFacts ?? [],
    facetSchemaIds: input.facetSchemaIds ?? [],
    phenotypeTypeSuggestions: input.phenotypeTypeSuggestions ?? [],
    compilePolicy: input.compilePolicy,
    reviewPolicy: input.reviewPolicy ?? {},
    owner: input.owner,
    status: input.status ?? "draft",
    extensions: input.extensions ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultSpeciesGroupMembership(
  input: Partial<SpeciesGroupMembership> & Pick<SpeciesGroupMembership, "membershipId" | "graphId" | "groupId" | "nodeId">
): SpeciesGroupMembership {
  const timestamp = nowIso();
  return {
    membershipId: input.membershipId,
    graphId: input.graphId,
    groupId: input.groupId,
    nodeId: input.nodeId,
    role: input.role ?? "primary",
    status: input.status ?? "active",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultAtlas(input: Partial<Atlas> & Pick<Atlas, "atlasId" | "name" | "purpose">): Atlas {
  const timestamp = nowIso();
  return {
    atlasId: input.atlasId,
    name: input.name,
    purpose: input.purpose,
    graphIds: [...(input.graphIds ?? [])].sort(),
    status: input.status ?? "draft",
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultDesignRelationship(
  input: Partial<DesignRelationship> &
    Pick<DesignRelationship, "relationshipId" | "source" | "target" | "relationshipType">
): DesignRelationship {
  const timestamp = nowIso();
  return {
    relationshipId: input.relationshipId,
    source: input.source,
    target: input.target,
    relationshipType: input.relationshipType,
    direction: input.direction ?? "source-to-target",
    description: input.description ?? "",
    designContract: {
      transferRule: input.designContract?.transferRule ?? "",
      mustPreserve: input.designContract?.mustPreserve ?? [],
      mustAvoid: input.designContract?.mustAvoid ?? [],
      divergenceRule: input.designContract?.divergenceRule ?? "",
      reviewQuestions: input.designContract?.reviewQuestions ?? []
    },
    auxiliaryRefs: {
      contextIds: input.auxiliaryRefs?.contextIds ?? [],
      motifIds: input.auxiliaryRefs?.motifIds ?? [],
      principleIds: input.auxiliaryRefs?.principleIds ?? [],
      facetIds: input.auxiliaryRefs?.facetIds ?? [],
      rubricIds: input.auxiliaryRefs?.rubricIds ?? [],
      referenceIds: input.auxiliaryRefs?.referenceIds ?? []
    },
    status: input.status ?? "draft",
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultDesignContext(
  input: Partial<DesignContext> & Pick<DesignContext, "contextId" | "name" | "contextType">
): DesignContext {
  const timestamp = nowIso();
  return {
    contextId: input.contextId,
    name: input.name,
    contextType: input.contextType,
    summary: input.summary ?? "",
    status: input.status ?? "draft",
    factIds: input.factIds ?? [],
    principleIds: input.principleIds ?? [],
    motifIds: input.motifIds ?? [],
    referenceIds: input.referenceIds ?? [],
    reviewRubricIds: input.reviewRubricIds ?? [],
    negativeBoundaries: input.negativeBoundaries ?? [],
    sourceRefs: input.sourceRefs ?? [],
    confidence: input.confidence ?? "draft",
    owner: input.owner,
    version: input.version ?? "1.0.0",
    extensions: input.extensions ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultContextFact(
  input: Partial<ContextFact> & Pick<ContextFact, "factId" | "factType" | "statement">
): ContextFact {
  const timestamp = nowIso();
  return {
    factId: input.factId,
    factType: input.factType,
    statement: input.statement,
    scopeHint: input.scopeHint ?? "",
    defaultStrength: input.defaultStrength ?? "reference",
    defaultBehaviorHint: input.defaultBehaviorHint ?? "reference-only",
    sourceTrace: input.sourceTrace ?? [],
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultDesignPrinciple(
  input: Partial<DesignPrinciple> & Pick<DesignPrinciple, "principleId" | "statement">
): DesignPrinciple {
  const timestamp = nowIso();
  return {
    principleId: input.principleId,
    statement: input.statement,
    priority: input.priority ?? "should",
    scopeHint: input.scopeHint ?? "",
    defaultBehaviorHint: input.defaultBehaviorHint ?? "reference-only",
    experienceIntent: input.experienceIntent ?? "",
    readabilityGoal: input.readabilityGoal ?? "",
    platformContext: input.platformContext ?? "",
    reviewQuestions: input.reviewQuestions ?? [],
    badcases: input.badcases ?? [],
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultContextMotif(
  input: Partial<ContextMotif> & Pick<ContextMotif, "motifId" | "motifType" | "statement">
): ContextMotif {
  const timestamp = nowIso();
  return {
    motifId: input.motifId,
    motifType: input.motifType,
    statement: input.statement,
    sourceRef: input.sourceRef,
    visualMotifRef: input.visualMotifRef,
    note: input.note ?? "",
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultContextReference(
  input: Partial<ContextReference> & Pick<ContextReference, "referenceId" | "referenceType" | "sourceRef">
): ContextReference {
  const timestamp = nowIso();
  return {
    referenceId: input.referenceId,
    referenceType: input.referenceType,
    sourceRef: input.sourceRef,
    referenceRole: input.referenceRole ?? "evidence",
    useFor: input.useFor ?? [],
    doNotUseFor: input.doNotUseFor ?? [],
    note: input.note ?? "",
    risk: input.risk ?? [],
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultContextReviewRubric(
  input: Partial<ContextReviewRubric> & Pick<ContextReviewRubric, "rubricId" | "dimension" | "question">
): ContextReviewRubric {
  const timestamp = nowIso();
  return {
    rubricId: input.rubricId,
    dimension: input.dimension,
    question: input.question,
    passSignal: input.passSignal ?? "",
    failSignal: input.failSignal ?? "",
    severity: input.severity ?? "info",
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultContextAttachment(
  input: Partial<ContextAttachment> & Pick<ContextAttachment, "attachmentId" | "contextId" | "targetType" | "targetId">
): ContextAttachment {
  const timestamp = nowIso();
  return {
    attachmentId: input.attachmentId,
    contextId: input.contextId,
    targetType: input.targetType,
    targetId: input.targetId,
    role: input.role ?? "reference",
    strength: input.strength ?? "reference",
    inheritance: input.inheritance ?? "none",
    compileLayer: input.compileLayer ?? "node-context",
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultContextPolicy(
  input: Partial<ContextPolicy> & Pick<ContextPolicy, "policyId" | "contextId">
): ContextPolicy {
  const timestamp = nowIso();
  return {
    policyId: input.policyId,
    contextId: input.contextId,
    attachmentId: input.attachmentId,
    compileParticipation: input.compileParticipation ?? "none",
    reviewParticipation: input.reviewParticipation ?? "none",
    impactParticipation: input.impactParticipation ?? "none",
    priority: input.priority ?? "normal",
    resolutionRule: input.resolutionRule ?? "manual",
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultGeneTemplate(
  input: Partial<GeneTemplate> & {
    templateId: string;
    packId?: string;
    name?: string;
    dimensions?: Array<{ dimensionId: string; prompt?: string; required?: boolean }>;
  }
): GeneTemplate {
  const timestamp = nowIso();
  const requiredDimensions =
    input.requiredDimensions ?? input.dimensions?.filter((dimension) => dimension.required).map((dimension) => dimension.dimensionId) ?? [];
  const recommendedDimensions =
    input.recommendedDimensions ?? input.dimensions?.filter((dimension) => !dimension.required).map((dimension) => dimension.dimensionId) ?? [];
  return {
    templateId: input.templateId,
    templatePackId: input.templatePackId ?? input.packId ?? null,
    version: input.version ?? "1.0.0",
    domain: input.domain ?? "design",
    scope: input.scope ?? input.name ?? input.templateId,
    extends: input.extends ?? [],
    requiredDimensions,
    recommendedDimensions,
    optionalDimensions: input.optionalDimensions ?? [],
    forbiddenDimensions: input.forbiddenDimensions ?? [],
    dimensionSchema:
      input.dimensionSchema ??
      Object.fromEntries((input.dimensions ?? []).map((dimension) => [dimension.dimensionId, { prompt: dimension.prompt ?? "" }])),
    propertyResolution: input.propertyResolution ?? {},
    reviewQuestions: input.reviewQuestions ?? [],
    phenotypeTypeSuggestions: input.phenotypeTypeSuggestions ?? [],
    compatibility: input.compatibility ?? {},
    status: input.status ?? "active",
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultSpeciesNode(
  input: Partial<SpeciesNode> & Pick<SpeciesNode, "graphId" | "nodeId" | "name">
): SpeciesNode {
  const timestamp = nowIso();
  return {
    nodeId: input.nodeId,
    graphId: input.graphId,
    name: input.name,
    category: input.category ?? "uncategorized",
    level: input.level ?? "species",
    parentNodes: input.parentNodes ?? [],
    primaryParent: input.primaryParent,
    parentRoles: input.parentRoles ?? {},
    incomingRelationshipIds: input.incomingRelationshipIds ?? [],
    relatedNodes: input.relatedNodes ?? [],
    currentVersion: input.currentVersion ?? "1.0.0",
    status: input.status ?? "draft",
    lineageStatus: input.lineageStatus ?? (input.parentNodes?.length ? "needs-relationship" : "species-first"),
    styleDescription: input.styleDescription,
    motifs: input.motifs ?? [],
    constraints: input.constraints ?? {},
    badcases: input.badcases ?? [],
    confidence: input.confidence,
    scope: input.scope,
    deprecationReason: input.deprecationReason,
    compilePolicy: input.compilePolicy,
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultNodeVersion(
  input: Partial<NodeVersion> & Pick<NodeVersion, "graphId" | "nodeId" | "nodeVersionId">
): NodeVersion {
  return {
    nodeVersionId: input.nodeVersionId,
    nodeId: input.nodeId,
    graphId: input.graphId,
    version: input.version ?? "1.0.0",
    baseTemplateVersions: input.baseTemplateVersions ?? [],
    parentNodeVersions: input.parentNodeVersions ?? [],
    incomingRelationshipIds: input.incomingRelationshipIds ?? [],
    ownGeneDelta: input.ownGeneDelta ?? {},
    resolvedGeneSnapshot: input.resolvedGeneSnapshot ?? {},
    constraintSnapshot: input.constraintSnapshot ?? {},
    promptContextSnapshot: input.promptContextSnapshot ?? {},
    compileSnapshot: input.compileSnapshot ?? {},
    changeSummary: input.changeSummary ?? "",
    impactNotes: input.impactNotes ?? "",
    createdAt: input.createdAt ?? nowIso()
  };
}

export function createDefaultPhenotype(
  input: Partial<Phenotype> & Pick<Phenotype, "graphId" | "nodeId" | "phenotypeId" | "name">
): Phenotype {
  const timestamp = nowIso();
  return {
    phenotypeId: input.phenotypeId,
    graphId: input.graphId,
    nodeId: input.nodeId,
    phenotypeType: input.phenotypeType ?? "image-prompt",
    productionSliceRole: normalizeProductionSliceRole(input.productionSliceRole),
    phenotypeTypeSource: input.phenotypeTypeSource ?? "built-in",
    name: input.name,
    objectBrief: input.objectBrief ?? "",
    currentAcceptedVersion: input.currentAcceptedVersion ?? null,
    tags: input.tags ?? [],
    status: input.status ?? "active",
    facets: input.facets ?? {},
    outputPlan: input.outputPlan ?? { expectedAssetTypes: [], reviewRubricIds: [] },
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultPhenotypeVersion(
  input: Partial<PhenotypeVersion> &
    Pick<PhenotypeVersion, "graphId" | "nodeId" | "phenotypeId" | "phenotypeVersionId">
): PhenotypeVersion {
  return {
    phenotypeVersionId: input.phenotypeVersionId,
    phenotypeId: input.phenotypeId,
    graphId: input.graphId,
    nodeId: input.nodeId,
    nodeVersionId: input.nodeVersionId ?? "unversioned",
    relationshipTrace: input.relationshipTrace ?? [],
    resolvedGeneSnapshot: input.resolvedGeneSnapshot ?? {},
    generationRecipe: input.generationRecipe ?? {},
    generationBrief: input.generationBrief ?? "",
    promptSnapshot: input.promptSnapshot ?? "",
    tool: input.tool ?? "manual",
    toolParameters: input.toolParameters ?? {},
    assetIds: input.assetIds ?? [],
    speciesCompileArtifactId: input.speciesCompileArtifactId,
    phenotypeCompileArtifactId: input.phenotypeCompileArtifactId,
    usageGuideId: input.usageGuideId,
    usageGuideRevision: input.usageGuideRevision,
    compileArtifactSnapshot: input.compileArtifactSnapshot ?? {},
    status: input.status ?? "candidate",
    feedback: sanitizePhenotypeVersionFeedback(input.feedback),
    reviewRecords: input.reviewRecords ?? [],
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? nowIso()
  };
}

export function createDefaultPhenotypeGenerationPlan(
  input: Partial<PhenotypeGenerationPlan> &
    Pick<PhenotypeGenerationPlan, "planId" | "scopeType" | "scopeId" | "priority" | "description">
): PhenotypeGenerationPlan {
  const timestamp = nowIso();
  return {
    planId: input.planId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    graphId: input.graphId,
    priority: input.priority,
    description: sanitizePlanningText(input.description) ?? "",
    status: input.status ?? "draft",
    phenotypeType: sanitizePlanningText(input.phenotypeType),
    taskBrief: sanitizePlanningText(input.taskBrief),
    modelPreference: sanitizePlanningText(input.modelPreference),
    providerPreference: sanitizePlanningText(input.providerPreference),
    toolPreference: sanitizePlanningText(input.toolPreference),
    requirements: sanitizePlanningJson(input.requirements),
    llmInstructions: sanitizePlanningText(input.llmInstructions),
    operatorNotes: sanitizePlanningText(input.operatorNotes),
    versionBinding: normalizeVersionBinding(input.versionBinding),
    createdBy: sanitizePlanningText(input.createdBy),
    tags: input.tags ?? [],
    metadata: sanitizePlanningJson(input.metadata),
    extensions: sanitizePlanningJson(input.extensions),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultPhenotypeGenerationTask(
  input: Partial<PhenotypeGenerationTask> &
    Pick<PhenotypeGenerationTask, "taskId" | "graphId" | "phenotypeType" | "taskBrief" | "priority">
): PhenotypeGenerationTask {
  const timestamp = nowIso();
  return {
    taskId: input.taskId,
    graphId: input.graphId,
    phenotypeType: sanitizePlanningText(input.phenotypeType) ?? input.phenotypeType,
    taskBrief: sanitizePlanningText(input.taskBrief) ?? "",
    priority: input.priority,
    status: input.status ?? "planned",
    versionBinding: normalizeVersionBinding(input.versionBinding),
    planId: input.planId,
    nodeId: input.nodeId,
    phenotypeId: input.phenotypeId,
    speciesCompileArtifactId: input.speciesCompileArtifactId,
    phenotypeCompileArtifactId: input.phenotypeCompileArtifactId,
    generationJobIds: input.generationJobIds ?? [],
    phenotypeVersionIds: input.phenotypeVersionIds ?? [],
    modelPreference: sanitizePlanningText(input.modelPreference),
    providerPreference: sanitizePlanningText(input.providerPreference),
    toolPreference: sanitizePlanningText(input.toolPreference),
    requirements: sanitizePlanningJson(input.requirements),
    productionIntent: sanitizeProductionIntent(input.productionIntent),
    llmInstructions: sanitizePlanningText(input.llmInstructions),
    operatorNotes: sanitizePlanningText(input.operatorNotes),
    blockingReason: sanitizePlanningText(input.blockingReason),
    tags: input.tags ?? [],
    metadata: sanitizePlanningJson(input.metadata),
    extensions: sanitizePlanningJson(input.extensions),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultAsset(input: Partial<AssetIndex> & Pick<AssetIndex, "assetId" | "uri" | "linkedObjectType" | "linkedObjectId">): AssetIndex {
  const timestamp = nowIso();
  return {
    assetId: input.assetId,
    uri: input.uri,
    storageType: input.storageType ?? "local",
    assetType: input.assetType ?? "image",
    role: input.role ?? "output",
    linkedObjectType: input.linkedObjectType,
    linkedObjectId: input.linkedObjectId,
    variantRole: input.variantRole,
    description: input.description ?? "",
    tags: input.tags ?? [],
    status: input.status ?? "pending",
    checksum: input.checksum,
    notes: input.notes ?? "",
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultOutputReference(
  input: Partial<OutputReference> &
    Pick<OutputReference, "outputReferenceId" | "graphId" | "phenotypeVersionId" | "uri" | "referenceType" | "role">
): OutputReference {
  const timestamp = nowIso();
  return {
    outputReferenceId: input.outputReferenceId,
    graphId: input.graphId,
    phenotypeId: input.phenotypeId,
    phenotypeVersionId: input.phenotypeVersionId,
    usageGuideId: input.usageGuideId,
    usageGuideRevision: input.usageGuideRevision,
    libraryId: input.libraryId,
    storageMountId: input.storageMountId,
    externalId: input.externalId,
    uri: input.uri,
    referenceType: input.referenceType,
    role: input.role,
    status: input.status ?? "pending",
    tags: input.tags ?? [],
    normalizedTags: input.normalizedTags ?? [],
    metadata: input.metadata ?? {},
    externalMetadata: input.externalMetadata ?? {},
    checksum: input.checksum,
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultPhenotypeLibrary(
  input: Partial<PhenotypeLibrary> & Pick<PhenotypeLibrary, "libraryId" | "name" | "purpose" | "profile">
): PhenotypeLibrary {
  const timestamp = nowIso();
  return {
    libraryId: input.libraryId,
    name: input.name,
    purpose: input.purpose,
    profile: input.profile,
    status: input.status ?? "active",
    graphIds: input.graphIds ?? [],
    acceptedReferenceTypes: input.acceptedReferenceTypes ?? [],
    tags: input.tags ?? [],
    metadata: input.metadata ?? {},
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultStorageMount(
  input: Partial<StorageMount> &
    Pick<StorageMount, "mountId" | "libraryId" | "storageType" | "adapterKind" | "displayName" | "location">
): StorageMount {
  const timestamp = nowIso();
  return {
    mountId: input.mountId,
    libraryId: input.libraryId,
    storageType: input.storageType,
    adapterKind: input.adapterKind,
    displayName: input.displayName,
    location: input.location,
    status: input.status ?? "active",
    capabilities: input.capabilities ?? [],
    credentialRef: input.credentialRef,
    metadata: input.metadata ?? {},
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultPhenotypeLibraryGraphBinding(
  input: Partial<PhenotypeLibraryGraphBinding> &
    Pick<PhenotypeLibraryGraphBinding, "bindingId" | "libraryId" | "graphId" | "role">
): PhenotypeLibraryGraphBinding {
  const timestamp = nowIso();
  return {
    bindingId: input.bindingId,
    libraryId: input.libraryId,
    graphId: input.graphId,
    role: input.role,
    status: input.status ?? "active",
    syncPolicy: input.syncPolicy ?? {},
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultExternalLibraryMapping(
  input: Partial<ExternalLibraryMapping> &
    Pick<ExternalLibraryMapping, "mappingId" | "libraryId" | "mountId" | "adapterId">
): ExternalLibraryMapping {
  const timestamp = nowIso();
  return {
    mappingId: input.mappingId,
    libraryId: input.libraryId,
    mountId: input.mountId,
    adapterId: input.adapterId,
    syncMode: input.syncMode ?? "pointer-only",
    conflictPolicy: input.conflictPolicy ?? "manual-review",
    status: input.status ?? "active",
    tagMappings: input.tagMappings ?? [],
    fieldMappings: input.fieldMappings ?? {},
    externalSchemaSnapshot: input.externalSchemaSnapshot ?? {},
    notes: input.notes ?? "",
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createDefaultLibraryRoutingPolicy(
  input: Partial<Omit<LibraryRoutingPolicy, "match">> &
    Pick<LibraryRoutingPolicy, "routingPolicyId" | "libraryId" | "name" | "targetMountId"> & {
      match?: Partial<LibraryRoutingPolicy["match"]>;
    }
): LibraryRoutingPolicy {
  const timestamp = nowIso();
  return {
    routingPolicyId: input.routingPolicyId,
    libraryId: input.libraryId,
    name: input.name,
    priority: input.priority ?? 0,
    status: input.status ?? "active",
    match: { ...input.match, tags: input.match?.tags ?? [] },
    targetMountId: input.targetMountId,
    fallbackMountId: input.fallbackMountId,
    syncMode: input.syncMode ?? "pointer-only",
    requiredMetadata: input.requiredMetadata ?? [],
    metadataDefaults: input.metadataDefaults ?? {},
    notes: input.notes ?? "",
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createGenerationJob(input: Partial<GenerationJob> & Pick<GenerationJob, "generationJobId" | "graphId">): GenerationJob {
  const timestamp = nowIso();
  const generationKind = input.generationKind ?? "phenotype";
  const target =
    input.target ??
    (generationKind === "phenotype" && input.nodeId
      ? { type: "species-node" as const, id: input.nodeId, graphId: input.graphId }
      : undefined);
  return {
    generationJobId: input.generationJobId,
    graphId: input.graphId,
    generationKind,
    target,
    nodeId: input.nodeId,
    phenotypeId: input.phenotypeId,
    phenotypeVersionId: input.phenotypeVersionId,
    phenotypeType: input.phenotypeType,
    taskBrief: input.taskBrief ?? "",
    compilePolicy: input.compilePolicy ?? { type: "system-rule-first", conflictResolution: "system" },
    inputSnapshot: input.inputSnapshot ?? {},
    outputSnapshot: input.outputSnapshot ?? {},
    tool: input.tool ?? "manual",
    toolParameters: input.toolParameters ?? {},
    status: input.status ?? "created",
    errorMessage: input.errorMessage,
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function createReviewRecord(input: Partial<ReviewRecord> & Pick<ReviewRecord, "reviewRecordId" | "graphId" | "objectType" | "objectId" | "status">): ReviewRecord {
  return {
    reviewRecordId: input.reviewRecordId,
    graphId: input.graphId,
    objectType: input.objectType,
    objectId: input.objectId,
    status: input.status,
    missingDimensions: input.missingDimensions ?? [],
    constraintViolations: input.constraintViolations ?? [],
    styleDistanceSummary: input.styleDistanceSummary ?? {},
    suggestedActions: input.suggestedActions ?? [],
    inputSnapshot: input.inputSnapshot ?? {},
    confirmedByHuman: input.confirmedByHuman ?? false,
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? nowIso()
  };
}

export function createImpactRecord(input: Partial<ImpactRecord> & Pick<ImpactRecord, "impactRecordId" | "graphId" | "changedObjectType" | "changedObjectId" | "changedVersionId" | "objectType" | "objectId">): ImpactRecord {
  return {
    impactRecordId: input.impactRecordId,
    graphId: input.graphId,
    changedObjectType: input.changedObjectType,
    changedObjectId: input.changedObjectId,
    changedVersionId: input.changedVersionId,
    objectType: input.objectType,
    objectId: input.objectId,
    reason: input.reason ?? `${input.objectType} depends on ${input.changedObjectType} ${input.changedObjectId}`,
    suggestedAction: input.suggestedAction ?? "review-or-regenerate",
    reviewStatus: input.reviewStatus ?? "pending",
    createdAt: input.createdAt ?? nowIso()
  };
}
