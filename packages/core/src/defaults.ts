import {
  AssetIndex,
  EvolutionEdge,
  ExternalLibraryMapping,
  GenerationJob,
  Graph,
  ImpactRecord,
  NodeVersion,
  OutputReference,
  Phenotype,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  PhenotypeVersion,
  ReviewRecord,
  SpeciesNode,
  StorageMount
} from "./schemas.js";

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    incomingEdges: input.incomingEdges ?? [],
    relatedNodes: input.relatedNodes ?? [],
    currentVersion: input.currentVersion ?? "1.0.0",
    status: input.status ?? "draft",
    lineageStatus: input.lineageStatus ?? (input.parentNodes?.length ? "needs-edge" : "species-first"),
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
    incomingEdgeVersions: input.incomingEdgeVersions ?? [],
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

export function createDefaultEvolutionEdge(
  input: Partial<EvolutionEdge> & Pick<EvolutionEdge, "graphId" | "edgeId" | "fromNodeId" | "toNodeId">
): EvolutionEdge {
  const timestamp = nowIso();
  return {
    edgeId: input.edgeId,
    graphId: input.graphId,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    edgeType: input.edgeType ?? "inherit",
    direction: input.direction ?? "inherits visual identity",
    operation: input.operation ?? "merge",
    evolutionStrength: input.evolutionStrength ?? "medium",
    deltaGenes: input.deltaGenes ?? {},
    valueResolution: input.valueResolution ?? { default: "override" },
    mustPreserve: input.mustPreserve ?? [],
    mustAvoid: input.mustAvoid ?? [],
    designRationale: input.designRationale ?? "",
    currentVersion: input.currentVersion ?? "1.0.0",
    status: input.status ?? "draft",
    facets: input.facets ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
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
    edgeVersionTrace: input.edgeVersionTrace ?? [],
    resolvedGeneSnapshot: input.resolvedGeneSnapshot ?? {},
    generationRecipe: input.generationRecipe ?? {},
    generationBrief: input.generationBrief ?? "",
    promptSnapshot: input.promptSnapshot ?? "",
    tool: input.tool ?? "manual",
    toolParameters: input.toolParameters ?? {},
    assetIds: input.assetIds ?? [],
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
