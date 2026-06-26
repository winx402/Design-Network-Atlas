import { z } from "zod";

export const FacetsSchema = z.record(z.string(), z.unknown()).default({});
export const JsonRecordSchema = z.record(z.string(), z.unknown()).default({});
export const IsoDateSchema = z.string().datetime();

export const GraphStatusSchema = z.enum(["draft", "active", "archived"]);
export const NodeStatusSchema = z.enum(["draft", "active", "deprecated", "archived"]);
export const EdgeStatusSchema = z.enum(["draft", "active", "deprecated", "archived"]);
export const LineageStatusSchema = z.enum(["complete", "species-first", "needs-edge", "needs-review", "multi-origin"]);
export const ParentRoleSchema = z.enum(["primary", "fusion", "reference", "constraint", "variant-source"]);
export const EdgeTypeSchema = z.enum([
  "inherit",
  "specialize",
  "variant",
  "reference",
  "fusion",
  "constraint",
  "deprecate",
  "remix"
]);
export const EvolutionStrengthSchema = z.enum(["low", "medium", "high"]);
export const PhenotypeTypeSourceSchema = z.enum(["built-in", "template", "custom"]);
export const PhenotypeStatusSchema = z.enum(["active", "archived", "deleted"]);
export const PhenotypeVersionStatusSchema = z.enum([
  "pending-confirmation",
  "accepted",
  "rejected",
  "deleted",
  "superseded",
  "archived"
]);
export const AssetStatusSchema = z.enum(["active", "pending", "rejected", "deleted", "archived"]);
export const AssetTypeSchema = z.enum(["image", "video", "svg", "pdf", "prompt", "text", "model-output", "other"]);
export const StorageTypeSchema = z.enum([
  "local",
  "url",
  "figma",
  "eagle",
  "object-storage",
  "nas",
  "git",
  "database",
  "engine-export",
  "other"
]);
export const AssetRoleSchema = z.enum([
  "output",
  "positive-example",
  "negative-example",
  "teaching-example",
  "reference",
  "snapshot"
]);
export const AssetVariantRoleSchema = z.enum([
  "size-variant",
  "angle-variant",
  "format-variant",
  "crop-variant",
  "preview",
  "source-file"
]);
export const ReviewStatusSchema = z.enum(["pass", "needs-review", "fail"]);
export const ChangeOperationSchema = z.enum(["create", "update", "archive", "delete", "import"]);
export const WriteModeSchema = z.enum(["preview-confirm", "draft-write", "changeset-apply"]);
export const ChangeSetStatusSchema = z.enum(["preview", "applied", "discarded"]);
export const OutputReferenceTypeSchema = z.enum([
  "local-file",
  "url",
  "object-storage",
  "eagle",
  "figma",
  "git",
  "database",
  "engine-export",
  "inline-text",
  "external-system",
  "other"
]);
export const OutputReferenceRoleSchema = z.enum([
  "primary-output",
  "candidate",
  "preview",
  "source",
  "reference",
  "negative-example",
  "runtime-export",
  "review-material"
]);
export const OutputReferenceStatusSchema = z.enum(["pending", "active", "missing", "stale", "rejected", "archived", "deleted"]);
export const PhenotypeLibraryProfileSchema = z.enum([
  "media-asset",
  "git-artifact",
  "database-record",
  "figma-object",
  "structured-data",
  "document",
  "engine-export",
  "mixed"
]);
export const PhenotypeLibraryStatusSchema = z.enum(["active", "draft", "read-only", "archived", "deleted"]);
export const StorageMountStatusSchema = z.enum(["active", "read-only", "disconnected", "archived", "deleted"]);
export const StorageAdapterKindSchema = z.enum(["pointer-only", "managed-library", "object-store", "git", "database", "custom"]);
export const PhenotypeLibraryBindingRoleSchema = z.enum([
  "primary-library",
  "reference-library",
  "generation-output",
  "review-source",
  "archive",
  "runtime-export"
]);
export const PhenotypeLibraryBindingStatusSchema = z.enum(["active", "paused", "archived", "deleted"]);
export const ExternalLibrarySyncModeSchema = z.enum([
  "pointer-only",
  "metadata-mirror",
  "metadata-authoritative",
  "bidirectional-sync",
  "import-only",
  "export-only"
]);
export const ExternalLibraryConflictPolicySchema = z.enum([
  "dna-wins",
  "external-wins",
  "manual-review",
  "namespace-split",
  "last-write-wins"
]);
export const ExternalLibraryMappingStatusSchema = z.enum(["active", "paused", "archived", "deleted"]);
export const ExternalFieldMappingDirectionSchema = z.enum(["external-to-dna", "dna-to-external", "bidirectional"]);

export const CompilePolicySchema = z.object({
  type: z.enum([
    "system-rule-first",
    "snapshot-fixed",
    "dynamic-assembly",
    "llm-conflict-resolution",
    "manual-resolution",
    "hybrid"
  ]),
  conflictResolution: z.enum(["system", "llm", "manual", "mixed"]).default("system"),
  notes: z.string().optional()
});

export const GraphSchema = z.object({
  graphId: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  status: GraphStatusSchema,
  currentVersion: z.string().min(1),
  rootNodes: z.array(z.string()).default([]),
  templateIds: z.array(z.string()).default([]),
  versionPolicy: JsonRecordSchema,
  compilePolicy: CompilePolicySchema,
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const TemplatePackSchema = z.object({
  templatePackId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  domain: z.string().min(1),
  status: z.enum(["draft", "active", "deprecated", "archived"]),
  description: z.string().default(""),
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const GeneTemplateSchema = z.object({
  templateId: z.string().min(1),
  templatePackId: z.string().nullable().optional(),
  version: z.string().min(1),
  domain: z.string().min(1),
  scope: z.string().min(1),
  extends: z.array(z.string()).default([]),
  requiredDimensions: z.array(z.string()).default([]),
  recommendedDimensions: z.array(z.string()).default([]),
  optionalDimensions: z.array(z.string()).default([]),
  forbiddenDimensions: z.array(z.string()).default([]),
  dimensionSchema: JsonRecordSchema,
  propertyResolution: JsonRecordSchema,
  reviewQuestions: z.array(z.string()).default([]),
  phenotypeTypeSuggestions: z.array(z.string()).default([]),
  compatibility: JsonRecordSchema,
  status: z.enum(["draft", "active", "deprecated", "archived"]),
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const SpeciesNodeSchema = z
  .object({
    nodeId: z.string().min(1),
    graphId: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    level: z.string().min(1),
    parentNodes: z.array(z.string()).default([]),
    primaryParent: z.string().nullable().optional(),
    parentRoles: z.record(z.string(), ParentRoleSchema).default({}),
    incomingEdges: z.array(z.string()).default([]),
    relatedNodes: z.array(z.string()).default([]),
    currentVersion: z.string().min(1),
    status: NodeStatusSchema,
    lineageStatus: LineageStatusSchema,
    styleDescription: z.string().optional(),
    motifs: z.array(z.string()).default([]),
    constraints: JsonRecordSchema,
    badcases: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).optional(),
    scope: z.string().optional(),
    deprecationReason: z.string().optional(),
    compilePolicy: CompilePolicySchema.optional(),
    facets: FacetsSchema,
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema
  })
  .superRefine((node, ctx) => {
    if (node.primaryParent && !node.parentNodes.includes(node.primaryParent)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryParent"],
        message: "primaryParent must be included in parentNodes"
      });
    }
    for (const parentId of Object.keys(node.parentRoles)) {
      if (!node.parentNodes.includes(parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parentRoles", parentId],
          message: "parentRoles can only reference declared parentNodes"
        });
      }
    }
  });

export const NodeVersionSchema = z.object({
  nodeVersionId: z.string().min(1),
  nodeId: z.string().min(1),
  graphId: z.string().min(1),
  version: z.string().min(1),
  baseTemplateVersions: z.array(z.string()).default([]),
  parentNodeVersions: z.array(z.string()).default([]),
  incomingEdgeVersions: z.array(z.string()).default([]),
  ownGeneDelta: JsonRecordSchema,
  resolvedGeneSnapshot: JsonRecordSchema,
  constraintSnapshot: JsonRecordSchema,
  promptContextSnapshot: JsonRecordSchema,
  compileSnapshot: JsonRecordSchema,
  changeSummary: z.string().default(""),
  impactNotes: z.string().default(""),
  createdAt: IsoDateSchema
});

export const EvolutionEdgeSchema = z.object({
  edgeId: z.string().min(1),
  graphId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  edgeType: EdgeTypeSchema,
  direction: z.string().min(1),
  operation: z.string().min(1),
  evolutionStrength: EvolutionStrengthSchema,
  deltaGenes: JsonRecordSchema,
  valueResolution: JsonRecordSchema,
  mustPreserve: z.array(z.string()).default([]),
  mustAvoid: z.array(z.string()).default([]),
  designRationale: z.string().default(""),
  currentVersion: z.string().min(1),
  status: EdgeStatusSchema,
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const EdgeVersionSchema = z.object({
  edgeVersionId: z.string().min(1),
  edgeId: z.string().min(1),
  graphId: z.string().min(1),
  version: z.string().min(1),
  deltaGenes: JsonRecordSchema,
  valueResolution: JsonRecordSchema,
  mustPreserve: z.array(z.string()).default([]),
  mustAvoid: z.array(z.string()).default([]),
  changeSummary: z.string().default(""),
  createdAt: IsoDateSchema
});

export const PhenotypeSchema = z.object({
  phenotypeId: z.string().min(1),
  graphId: z.string().min(1),
  nodeId: z.string().min(1),
  phenotypeType: z.string().min(1),
  phenotypeTypeSource: PhenotypeTypeSourceSchema,
  name: z.string().min(1),
  objectBrief: z.string().default(""),
  currentAcceptedVersion: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  status: PhenotypeStatusSchema,
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const PhenotypeVersionSchema = z.object({
  phenotypeVersionId: z.string().min(1),
  phenotypeId: z.string().min(1),
  graphId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeVersionId: z.string().min(1),
  edgeVersionTrace: z.array(z.string()).default([]),
  resolvedGeneSnapshot: JsonRecordSchema,
  generationRecipe: JsonRecordSchema,
  generationBrief: z.string().default(""),
  promptSnapshot: z.string().default(""),
  tool: z.string().default("manual"),
  toolParameters: JsonRecordSchema,
  assetIds: z.array(z.string()).default([]),
  status: PhenotypeVersionStatusSchema,
  reviewRecords: z.array(z.string()).default([]),
  facets: FacetsSchema,
  createdAt: IsoDateSchema
});

export const AssetIndexSchema = z.object({
  assetId: z.string().min(1),
  uri: z.string().min(1),
  storageType: StorageTypeSchema,
  assetType: AssetTypeSchema,
  role: AssetRoleSchema,
  linkedObjectType: z.enum(["graph", "template", "node", "edge", "phenotype", "phenotype-version", "generation-job"]),
  linkedObjectId: z.string().min(1),
  variantRole: AssetVariantRoleSchema.optional(),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  status: AssetStatusSchema,
  checksum: z.string().optional(),
  notes: z.string().default(""),
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const OutputReferenceSchema = z.object({
  outputReferenceId: z.string().min(1),
  graphId: z.string().min(1),
  phenotypeId: z.string().min(1).optional(),
  phenotypeVersionId: z.string().min(1),
  libraryId: z.string().min(1).optional(),
  storageMountId: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  uri: z.string().min(1),
  referenceType: OutputReferenceTypeSchema,
  role: OutputReferenceRoleSchema,
  status: OutputReferenceStatusSchema,
  tags: z.array(z.string()).default([]),
  normalizedTags: z.array(z.string()).default([]),
  metadata: JsonRecordSchema,
  externalMetadata: JsonRecordSchema,
  checksum: z.string().optional(),
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const PhenotypeLibrarySchema = z.object({
  libraryId: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  profile: PhenotypeLibraryProfileSchema,
  status: PhenotypeLibraryStatusSchema,
  graphIds: z.array(z.string()).default([]),
  acceptedReferenceTypes: z.array(OutputReferenceTypeSchema).default([]),
  tags: z.array(z.string()).default([]),
  metadata: JsonRecordSchema,
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const StorageMountSchema = z.object({
  mountId: z.string().min(1),
  libraryId: z.string().min(1),
  storageType: StorageTypeSchema,
  adapterKind: StorageAdapterKindSchema,
  displayName: z.string().min(1),
  location: z.string().min(1),
  status: StorageMountStatusSchema,
  capabilities: z.array(z.string()).default([]),
  credentialRef: z.string().optional(),
  metadata: JsonRecordSchema,
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const PhenotypeLibraryGraphBindingSchema = z.object({
  bindingId: z.string().min(1),
  libraryId: z.string().min(1),
  graphId: z.string().min(1),
  role: PhenotypeLibraryBindingRoleSchema,
  status: PhenotypeLibraryBindingStatusSchema,
  syncPolicy: JsonRecordSchema,
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ExternalLibraryMappingSchema = z.object({
  mappingId: z.string().min(1),
  libraryId: z.string().min(1),
  mountId: z.string().min(1),
  adapterId: z.string().min(1),
  syncMode: ExternalLibrarySyncModeSchema,
  conflictPolicy: ExternalLibraryConflictPolicySchema,
  status: ExternalLibraryMappingStatusSchema,
  tagMappings: z
    .array(
      z.object({
        externalTag: z.string().min(1),
        normalizedTag: z.string().min(1),
        direction: ExternalFieldMappingDirectionSchema,
        confidence: z.number().min(0).max(1).optional()
      })
    )
    .default([]),
  fieldMappings: z.record(z.string(), z.string()).default({}),
  externalSchemaSnapshot: JsonRecordSchema,
  notes: z.string().default(""),
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const GenerationJobSchema = z.object({
  generationJobId: z.string().min(1),
  graphId: z.string().min(1),
  nodeId: z.string().min(1),
  phenotypeId: z.string().optional(),
  phenotypeVersionId: z.string().optional(),
  phenotypeType: z.string().min(1),
  taskBrief: z.string().default(""),
  compilePolicy: CompilePolicySchema,
  inputSnapshot: JsonRecordSchema,
  outputSnapshot: JsonRecordSchema,
  tool: z.string().default("manual"),
  toolParameters: JsonRecordSchema,
  status: z.enum(["created", "generated", "failed"]),
  errorMessage: z.string().optional(),
  facets: FacetsSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ReviewRecordSchema = z.object({
  reviewRecordId: z.string().min(1),
  graphId: z.string().min(1),
  objectType: z.enum(["node", "edge", "phenotype-version"]),
  objectId: z.string().min(1),
  status: ReviewStatusSchema,
  missingDimensions: z.array(z.string()).default([]),
  constraintViolations: z.array(z.string()).default([]),
  styleDistanceSummary: JsonRecordSchema,
  suggestedActions: z.array(z.string()).default([]),
  inputSnapshot: JsonRecordSchema,
  confirmedByHuman: z.boolean().default(false),
  facets: FacetsSchema,
  createdAt: IsoDateSchema
});

export const ImpactRecordSchema = z.object({
  impactRecordId: z.string().min(1),
  graphId: z.string().min(1),
  changedObjectType: z.enum(["node", "edge"]),
  changedObjectId: z.string().min(1),
  changedVersionId: z.string().min(1),
  objectType: z.enum(["node", "phenotype-version"]),
  objectId: z.string().min(1),
  reason: z.string().min(1),
  suggestedAction: z.string().min(1),
  reviewStatus: z.enum(["pending", "reviewed", "ignored"]),
  createdAt: IsoDateSchema
});

export const ChangeSetSchema = z.object({
  changeSetId: z.string().min(1),
  mode: WriteModeSchema,
  objectType: z.string().min(1),
  operation: ChangeOperationSchema,
  status: ChangeSetStatusSchema,
  preview: z.object({
    summary: z.string(),
    diff: JsonRecordSchema,
    impact: z.array(JsonRecordSchema).default([])
  }),
  payload: JsonRecordSchema,
  createdAt: IsoDateSchema,
  appliedAt: IsoDateSchema.optional()
});

export type Graph = z.infer<typeof GraphSchema>;
export type TemplatePack = z.infer<typeof TemplatePackSchema>;
export type GeneTemplate = z.infer<typeof GeneTemplateSchema>;
export type SpeciesNode = z.infer<typeof SpeciesNodeSchema>;
export type NodeVersion = z.infer<typeof NodeVersionSchema>;
export type EvolutionEdge = z.infer<typeof EvolutionEdgeSchema>;
export type EdgeVersion = z.infer<typeof EdgeVersionSchema>;
export type Phenotype = z.infer<typeof PhenotypeSchema>;
export type PhenotypeVersion = z.infer<typeof PhenotypeVersionSchema>;
export type AssetIndex = z.infer<typeof AssetIndexSchema>;
export type OutputReference = z.infer<typeof OutputReferenceSchema>;
export type PhenotypeLibrary = z.infer<typeof PhenotypeLibrarySchema>;
export type StorageMount = z.infer<typeof StorageMountSchema>;
export type PhenotypeLibraryGraphBinding = z.infer<typeof PhenotypeLibraryGraphBindingSchema>;
export type ExternalLibraryMapping = z.infer<typeof ExternalLibraryMappingSchema>;
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type ImpactRecord = z.infer<typeof ImpactRecordSchema>;
export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export type CompilePolicy = z.infer<typeof CompilePolicySchema>;
export type WriteMode = z.infer<typeof WriteModeSchema>;
