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
  GenerationJob,
  Graph,
  ImpactRecord,
  LibraryRoutingPolicy,
  NodeVersion,
  OutputReference,
  Phenotype,
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
    phenotypeTypeSource: input.phenotypeTypeSource ?? "built-in",
    name: input.name,
    objectBrief: input.objectBrief ?? "",
    currentAcceptedVersion: input.currentAcceptedVersion,
    tags: input.tags ?? [],
    status: input.status ?? "active",
    facets: input.facets ?? {},
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
    compileArtifactSnapshot: input.compileArtifactSnapshot ?? {},
    status: input.status ?? "pending-confirmation",
    reviewRecords: input.reviewRecords ?? [],
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? nowIso()
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

export function createGenerationJob(input: Partial<GenerationJob> & Pick<GenerationJob, "generationJobId" | "graphId" | "nodeId" | "phenotypeType">): GenerationJob {
  const timestamp = nowIso();
  return {
    generationJobId: input.generationJobId,
    graphId: input.graphId,
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
