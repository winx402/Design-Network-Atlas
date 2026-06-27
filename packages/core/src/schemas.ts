import { z } from "zod";

export const FacetsSchema = z.record(z.string(), z.unknown()).default({});
export const JsonRecordSchema = z.record(z.string(), z.unknown()).default({});
export const IsoDateSchema = z.string().datetime();

export const GraphStatusSchema = z.enum(["draft", "active", "archived"]);
export const NodeStatusSchema = z.enum(["draft", "active", "deprecated", "archived"]);
export const EdgeStatusSchema = z.enum(["draft", "active", "deprecated", "archived"]);
export const LineageStatusSchema = z.enum(["complete", "species-first", "needs-edge", "needs-review", "multi-origin"]);
export const ParentRoleSchema = z.enum([
  "primary",
  "style",
  "function",
  "reference",
  "fusion",
  "constraint",
  "variant-source"
]);
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
export const SharedObjectStatusSchema = z.enum(["draft", "active", "archived", "deprecated"]);
export const DesignContextTypeSchema = z.enum([
  "worldview",
  "narrative",
  "brand",
  "art-direction",
  "experience-intent",
  "production-rationale",
  "domain-knowledge",
  "custom"
]);
export const ContextConfidenceSchema = z.enum(["confirmed", "inferred", "draft"]);
export const ContextFactTypeSchema = z.enum([
  "faction",
  "era",
  "region",
  "technology",
  "belief",
  "material-culture",
  "symbol-rule",
  "taboo",
  "custom"
]);
export const ContextStrengthSchema = z.enum(["hard", "soft", "reference"]);
export const ContextBehaviorHintSchema = z.enum(["include", "weaken", "translate", "exclude", "reference-only"]);
export const DesignPrinciplePrioritySchema = z.enum(["must", "should", "may"]);
export const ContextMotifTypeSchema = z.enum(["narrative-motif", "cultural-motif", "symbolic-motif", "visual-motif-ref"]);
export const ContextReferenceTypeSchema = z.enum([
  "source-document",
  "reference-image",
  "moodboard",
  "badcase",
  "accepted-phenotype",
  "rejected-phenotype"
]);
export const ContextReferenceRoleSchema = z.enum(["positive", "negative", "mood", "evidence", "decision"]);
export const ContextReviewDimensionSchema = z.enum([
  "context-consistency",
  "motif-retention",
  "divergence",
  "readability",
  "production-feasibility",
  "risk-boundary",
  "custom"
]);
export const ContextReviewSeveritySchema = z.enum(["info", "warning", "blocking"]);
export const ContextAttachmentTargetTypeSchema = z.enum([
  "atlas",
  "graph",
  "species-group",
  "species-group-relation",
  "graph-bridge",
  "species-node",
  "evolution-edge",
  "gene-template",
  "phenotype-type",
  "phenotype",
  "phenotype-version"
]);
export const ContextAttachmentRoleSchema = z.enum(["foundation", "reference", "constraint", "rationale", "review-source"]);
export const ContextInheritanceSchema = z.enum(["none", "downstream", "children", "graph", "atlas"]);
export const ContextCompileLayerSchema = z.enum([
  "atlas-context",
  "graph-context",
  "group-context",
  "bridge-context",
  "node-context",
  "phenotype-context"
]);
export const ContextCompileParticipationSchema = z.enum(["none", "fixed", "llm-context"]);
export const ContextReviewParticipationSchema = z.enum(["none", "include"]);
export const ContextImpactParticipationSchema = z.enum(["none", "outdated-check", "trace"]);
export const ContextPrioritySchema = z.enum(["low", "normal", "high"]);
export const ContextResolutionRuleSchema = z.enum(["preserve", "merge", "weaken", "translate", "exclude", "manual"]);
export const CompileTargetSchema = z.enum(["species-snapshot", "phenotype-generation"]);
export const AtlasScopeSchema = z.enum(["none", "direct", "relevant"]);
export const CompileLayerSchema = z.enum([
  "atlas-foundation",
  "atlas-context",
  "graph-foundation",
  "graph-context",
  "graph-bridge-facts",
  "species-group-rules",
  "group-context",
  "context-references",
  "template-dimensions",
  "parent-snapshots",
  "evolution-edge-deltas",
  "node-own-genes",
  "phenotype-type-requirements",
  "phenotype-context",
  "task-brief"
]);
export const ResolutionRuleSchema = z.enum(["override", "preserve", "merge", "weaken", "translate", "exclude", "manual", "llm-review"]);
export const TraceDecisionSchema = z.enum(["included", "excluded", "weakened", "translated", "merged", "manual", "llm-suggested"]);
export const SpeciesGroupTypeSchema = z.enum(["domain", "family", "collection", "layer", "system"]);
export const SpeciesGroupMembershipRoleSchema = z.enum(["primary", "reference", "bridge", "source", "target"]);
export const FacetValueTypeSchema = z.enum(["string", "number", "boolean", "enum", "json"]);
export const FacetAssignmentTargetTypeSchema = z.enum([
  "atlas",
  "graph",
  "species-group",
  "species-node",
  "graph-bridge",
  "phenotype-type",
  "phenotype",
  "phenotype-version"
]);
export const BuiltInSpeciesGroupRelationTypes = [
  "shares-facts",
  "shares-context",
  "shares-template",
  "shares-facet-schema",
  "style-aligned-with",
  "feeds-output-to",
  "consumes-output-from",
  "references",
  "depends-on",
  "adapts-from",
  "must-diverge-from",
  "exports-to"
] as const;
export const BuiltInGraphBridgeTypes = [
  "inherits-foundation",
  "shares-context",
  "shares-template",
  "shares-facet-schema",
  "references-group",
  "references-species",
  "uses-phenotype",
  "style-aligned-with",
  "depends-on",
  "maps-taxonomy-to",
  "must-diverge-from",
  "exports-to"
] as const;
const CustomRelationTypeSchema = z.string().regex(/^custom:[A-Za-z0-9][A-Za-z0-9_-]*$/);
export const SpeciesGroupRelationTypeSchema = z.union([z.enum(BuiltInSpeciesGroupRelationTypes), CustomRelationTypeSchema]);
export const GraphBridgeTypeSchema = z.union([z.enum(BuiltInGraphBridgeTypes), CustomRelationTypeSchema]);
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
export const LibraryRoutingPolicyStatusSchema = z.enum(["active", "draft", "paused", "archived", "deleted"]);

export const CompilePolicySchema = z.object({
  type: z.enum([
    "system-rule-first",
    "snapshot-fixed",
    "dynamic-assembly",
    "layered-resolution",
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

export const FacetDefinitionSchema = z.object({
  facetId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  valueType: FacetValueTypeSchema,
  allowedValues: z.array(z.union([z.string(), z.number(), z.boolean()])).default([]),
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const FacetSchemaSchema = z.object({
  facetSchemaId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  facetIds: z.array(z.string()).default([]),
  requiredFacetIds: z.array(z.string()).default([]),
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const FacetAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
  targetType: FacetAssignmentTargetTypeSchema,
  targetId: z.string().min(1),
  values: JsonRecordSchema,
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const SpeciesGroupSchema = z.object({
  groupId: z.string().min(1),
  graphId: z.string().min(1),
  name: z.string().min(1),
  groupType: SpeciesGroupTypeSchema,
  parentGroupIds: z.array(z.string()).default([]),
  templateIds: z.array(z.string()).default([]),
  sharedFacts: z.array(z.string()).default([]),
  facetSchemaIds: z.array(z.string()).default([]),
  phenotypeTypeSuggestions: z.array(z.string()).default([]),
  compilePolicy: CompilePolicySchema.optional(),
  reviewPolicy: JsonRecordSchema,
  owner: z.string().optional(),
  status: SharedObjectStatusSchema,
  extensions: JsonRecordSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const SpeciesGroupMembershipSchema = z.object({
  membershipId: z.string().min(1),
  graphId: z.string().min(1),
  groupId: z.string().min(1),
  nodeId: z.string().min(1),
  role: SpeciesGroupMembershipRoleSchema,
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const SpeciesGroupRelationSchema = z
  .object({
    relationId: z.string().min(1),
    graphId: z.string().min(1),
    sourceGroupId: z.string().min(1),
    targetGroupId: z.string().min(1),
    relationType: SpeciesGroupRelationTypeSchema,
    description: z.string().default(""),
    status: SharedObjectStatusSchema,
    extensions: JsonRecordSchema,
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema
  })
  .superRefine((relation, ctx) => {
    if (relation.sourceGroupId === relation.targetGroupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetGroupId"],
        message: "targetGroupId must differ from sourceGroupId"
      });
    }
  });

export const AtlasSchema = z.object({
  atlasId: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  graphIds: z.array(z.string()).default([]),
  status: SharedObjectStatusSchema,
  metadata: JsonRecordSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const GraphBridgeSchema = z
  .object({
    bridgeId: z.string().min(1),
    atlasId: z.string().min(1),
    sourceGraphId: z.string().min(1),
    targetGraphId: z.string().min(1),
    bridgeType: GraphBridgeTypeSchema,
    description: z.string().default(""),
    status: SharedObjectStatusSchema,
    extensions: JsonRecordSchema,
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema
  })
  .superRefine((bridge, ctx) => {
    if (bridge.sourceGraphId === bridge.targetGraphId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetGraphId"],
        message: "targetGraphId must differ from sourceGraphId"
      });
    }
  });

export const DesignContextSchema = z.object({
  contextId: z.string().min(1),
  name: z.string().min(1),
  contextType: DesignContextTypeSchema,
  summary: z.string().default(""),
  status: SharedObjectStatusSchema,
  factIds: z.array(z.string()).default([]),
  principleIds: z.array(z.string()).default([]),
  motifIds: z.array(z.string()).default([]),
  referenceIds: z.array(z.string()).default([]),
  reviewRubricIds: z.array(z.string()).default([]),
  negativeBoundaries: z.array(z.string()).default([]),
  sourceRefs: z.array(z.string()).default([]),
  confidence: ContextConfidenceSchema,
  owner: z.string().optional(),
  version: z.string().min(1),
  extensions: JsonRecordSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ContextFactSchema = z.object({
  factId: z.string().min(1),
  factType: ContextFactTypeSchema,
  statement: z.string().min(1),
  scopeHint: z.string().default(""),
  defaultStrength: ContextStrengthSchema,
  defaultBehaviorHint: ContextBehaviorHintSchema,
  sourceTrace: z.array(z.string()).default([]),
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const DesignPrincipleSchema = z.object({
  principleId: z.string().min(1),
  statement: z.string().min(1),
  priority: DesignPrinciplePrioritySchema,
  scopeHint: z.string().default(""),
  defaultBehaviorHint: ContextBehaviorHintSchema,
  experienceIntent: z.string().default(""),
  readabilityGoal: z.string().default(""),
  platformContext: z.string().default(""),
  reviewQuestions: z.array(z.string()).default([]),
  badcases: z.array(z.string()).default([]),
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ContextMotifSchema = z.object({
  motifId: z.string().min(1),
  motifType: ContextMotifTypeSchema,
  statement: z.string().min(1),
  sourceRef: z.string().optional(),
  visualMotifRef: z.string().optional(),
  note: z.string().default(""),
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ContextReferenceSchema = z.object({
  referenceId: z.string().min(1),
  referenceType: ContextReferenceTypeSchema,
  sourceRef: JsonRecordSchema,
  referenceRole: ContextReferenceRoleSchema,
  useFor: z.array(z.string()).default([]),
  doNotUseFor: z.array(z.string()).default([]),
  note: z.string().default(""),
  risk: z.array(z.string()).default([]),
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ContextReviewRubricSchema = z.object({
  rubricId: z.string().min(1),
  dimension: ContextReviewDimensionSchema,
  question: z.string().min(1),
  passSignal: z.string().default(""),
  failSignal: z.string().default(""),
  severity: ContextReviewSeveritySchema,
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ContextAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
  contextId: z.string().min(1),
  targetType: ContextAttachmentTargetTypeSchema,
  targetId: z.string().min(1),
  role: ContextAttachmentRoleSchema,
  strength: ContextStrengthSchema,
  inheritance: ContextInheritanceSchema,
  compileLayer: ContextCompileLayerSchema,
  status: SharedObjectStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
});

export const ContextPolicySchema = z.object({
  policyId: z.string().min(1),
  contextId: z.string().min(1),
  attachmentId: z.string().min(1).optional(),
  compileParticipation: ContextCompileParticipationSchema,
  reviewParticipation: ContextReviewParticipationSchema,
  impactParticipation: ContextImpactParticipationSchema,
  priority: ContextPrioritySchema,
  resolutionRule: ContextResolutionRuleSchema,
  status: SharedObjectStatusSchema,
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

export const CompileScopeSchema = z.object({
  includeDirectAttachments: z.boolean().default(true),
  includeInheritedContext: z.boolean().default(true),
  includeGroupRelations: z.boolean().default(true),
  includeGraphBridges: z.boolean().default(true),
  includeReferencedPhenotypes: z.boolean().default(false),
  atlasScope: AtlasScopeSchema.default("none"),
  maxReferenceDepth: z.number().int().min(0).default(1),
  reasons: z.array(z.string()).default([])
});

export const TraceEntrySchema = z.object({
  objectType: z.string().min(1),
  objectId: z.string().min(1),
  versionId: z.string().optional(),
  layer: CompileLayerSchema,
  fieldPath: z.string().min(1),
  valueSummary: z.string().default(""),
  decision: TraceDecisionSchema,
  metadata: JsonRecordSchema
});

export const CompileConflictSchema = z.object({
  key: z.string().min(1),
  previousValue: z.unknown(),
  nextValue: z.unknown(),
  source: z.string().min(1),
  layer: CompileLayerSchema,
  resolutionRule: ResolutionRuleSchema,
  parentRole: ParentRoleSchema.optional(),
  decision: TraceDecisionSchema.default("included")
});

export const ReviewChecklistItemSchema = z.object({
  rubricId: z.string().optional(),
  dimension: z.string().min(1),
  question: z.string().min(1),
  severity: ContextReviewSeveritySchema.default("info"),
  sourceTraceId: z.string().optional()
});

export const SpeciesCompileArtifactSchema = z.object({
  artifactId: z.string().min(1),
  compileTarget: z.literal("species-snapshot"),
  graphId: z.string().min(1),
  speciesNodeId: z.string().min(1),
  nodeVersionId: z.string().min(1),
  compilePolicy: CompilePolicySchema,
  compileScope: CompileScopeSchema,
  resolvedGeneSnapshot: JsonRecordSchema,
  candidateGenes: JsonRecordSchema,
  conflictReport: z.array(CompileConflictSchema).default([]),
  sourceTrace: z.array(TraceEntrySchema).default([]),
  contextTrace: z.array(TraceEntrySchema).default([]),
  referenceTrace: z.array(TraceEntrySchema).default([]),
  decisionTrace: z.array(TraceEntrySchema).default([]),
  openQuestions: z.array(z.string()).default([]),
  createdAt: IsoDateSchema
});

export const PhenotypeCompileArtifactSchema = z.object({
  artifactId: z.string().min(1),
  compileTarget: z.literal("phenotype-generation"),
  graphId: z.string().min(1),
  speciesNodeId: z.string().min(1),
  nodeVersionId: z.string().min(1),
  phenotypeType: z.string().min(1),
  taskBrief: z.string().default(""),
  speciesCompileArtifactId: z.string().optional(),
  compilePolicy: CompilePolicySchema,
  compileScope: CompileScopeSchema,
  resolvedGeneSnapshot: JsonRecordSchema,
  conflictReport: z.array(CompileConflictSchema).default([]),
  sourceTrace: z.array(TraceEntrySchema).default([]),
  contextTrace: z.array(TraceEntrySchema).default([]),
  referenceTrace: z.array(TraceEntrySchema).default([]),
  rubricTrace: z.array(TraceEntrySchema).default([]),
  decisionTrace: z.array(TraceEntrySchema).default([]),
  prompt: z.string().default(""),
  negativePrompt: z.string().default(""),
  artBrief: z.string().default(""),
  reviewChecklist: z.array(ReviewChecklistItemSchema).default([]),
  generationConstraints: JsonRecordSchema,
  openQuestions: z.array(z.string()).default([]),
  createdAt: IsoDateSchema
});

export const AssetIndexSchema = z.object({
  assetId: z.string().min(1),
  uri: z.string().min(1),
  storageType: StorageTypeSchema,
  assetType: AssetTypeSchema,
  role: AssetRoleSchema,
  linkedObjectType: z.enum([
    "graph",
    "template",
    "node",
    "edge",
    "species-group",
    "species-group-relation",
    "atlas",
    "graph-bridge",
    "facet-definition",
    "facet-schema",
    "phenotype",
    "phenotype-version",
    "species-compile-artifact",
    "phenotype-compile-artifact",
    "generation-job"
  ]),
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

export const LibraryRoutingPolicyMatchSchema = z.object({
  phenotypeType: z.string().min(1).optional(),
  outputRole: OutputReferenceRoleSchema.optional(),
  referenceType: OutputReferenceTypeSchema.optional(),
  tags: z.array(z.string()).default([])
});

export const LibraryRoutingPolicySchema = z.object({
  routingPolicyId: z.string().min(1),
  libraryId: z.string().min(1),
  name: z.string().min(1),
  priority: z.number().int().default(0),
  status: LibraryRoutingPolicyStatusSchema,
  match: LibraryRoutingPolicyMatchSchema,
  targetMountId: z.string().min(1),
  fallbackMountId: z.string().min(1).optional(),
  syncMode: ExternalLibrarySyncModeSchema,
  requiredMetadata: z.array(z.string()).default([]),
  metadataDefaults: JsonRecordSchema,
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
  objectType: z.enum([
    "node",
    "edge",
    "species-group",
    "species-group-relation",
    "atlas",
    "graph-bridge",
    "phenotype-version",
    "design-context",
    "context-fact",
    "design-principle",
    "context-motif",
    "context-reference",
    "context-review-rubric",
    "species-compile-artifact",
    "phenotype-compile-artifact"
  ]),
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
  changedObjectType: z.enum(["node", "edge", "species-group", "graph-bridge", "design-context"]),
  changedObjectId: z.string().min(1),
  changedVersionId: z.string().min(1),
  objectType: z.enum(["graph", "node", "species-group", "phenotype-version", "species-compile-artifact", "phenotype-compile-artifact"]),
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
export type FacetDefinition = z.infer<typeof FacetDefinitionSchema>;
export type FacetSchema = z.infer<typeof FacetSchemaSchema>;
export type FacetAssignment = z.infer<typeof FacetAssignmentSchema>;
export type SpeciesGroup = z.infer<typeof SpeciesGroupSchema>;
export type SpeciesGroupMembership = z.infer<typeof SpeciesGroupMembershipSchema>;
export type SpeciesGroupRelation = z.infer<typeof SpeciesGroupRelationSchema>;
export type Atlas = z.infer<typeof AtlasSchema>;
export type GraphBridge = z.infer<typeof GraphBridgeSchema>;
export type DesignContext = z.infer<typeof DesignContextSchema>;
export type ContextFact = z.infer<typeof ContextFactSchema>;
export type DesignPrinciple = z.infer<typeof DesignPrincipleSchema>;
export type ContextMotif = z.infer<typeof ContextMotifSchema>;
export type ContextReference = z.infer<typeof ContextReferenceSchema>;
export type ContextReviewRubric = z.infer<typeof ContextReviewRubricSchema>;
export type ContextAttachment = z.infer<typeof ContextAttachmentSchema>;
export type ContextPolicy = z.infer<typeof ContextPolicySchema>;
export type TemplatePack = z.infer<typeof TemplatePackSchema>;
export type GeneTemplate = z.infer<typeof GeneTemplateSchema>;
export type SpeciesNode = z.infer<typeof SpeciesNodeSchema>;
export type NodeVersion = z.infer<typeof NodeVersionSchema>;
export type EvolutionEdge = z.infer<typeof EvolutionEdgeSchema>;
export type EdgeVersion = z.infer<typeof EdgeVersionSchema>;
export type Phenotype = z.infer<typeof PhenotypeSchema>;
export type PhenotypeVersion = z.infer<typeof PhenotypeVersionSchema>;
export type CompileScope = z.infer<typeof CompileScopeSchema>;
export type TraceEntry = z.infer<typeof TraceEntrySchema>;
export type CompileConflict = z.infer<typeof CompileConflictSchema>;
export type ReviewChecklistItem = z.infer<typeof ReviewChecklistItemSchema>;
export type SpeciesCompileArtifact = z.infer<typeof SpeciesCompileArtifactSchema>;
export type PhenotypeCompileArtifact = z.infer<typeof PhenotypeCompileArtifactSchema>;
export type AssetIndex = z.infer<typeof AssetIndexSchema>;
export type OutputReference = z.infer<typeof OutputReferenceSchema>;
export type PhenotypeLibrary = z.infer<typeof PhenotypeLibrarySchema>;
export type StorageMount = z.infer<typeof StorageMountSchema>;
export type PhenotypeLibraryGraphBinding = z.infer<typeof PhenotypeLibraryGraphBindingSchema>;
export type ExternalLibraryMapping = z.infer<typeof ExternalLibraryMappingSchema>;
export type LibraryRoutingPolicy = z.infer<typeof LibraryRoutingPolicySchema>;
export type LibraryRoutingPolicyMatch = z.infer<typeof LibraryRoutingPolicyMatchSchema>;
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type ImpactRecord = z.infer<typeof ImpactRecordSchema>;
export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export type CompilePolicy = z.infer<typeof CompilePolicySchema>;
export type WriteMode = z.infer<typeof WriteModeSchema>;
