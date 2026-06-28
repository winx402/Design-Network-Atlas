import { z } from "zod";
import {
  Atlas,
  DesignRelationship,
  ExternalLibraryMapping,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  Graph,
  LibraryRoutingPolicy,
  Phenotype,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  SpeciesGroup,
  SpeciesGroupMembership,
  SpeciesNode,
  StorageMount
} from "./schemas.js";

export const MODELING_BATCH_FORMAT = "dna.modeling-batch.v1";

const JsonObjectInput = z.record(z.string(), z.unknown()).default({});
const stringArray = z.array(z.string()).default([]);

const GraphInputSchema = z
  .object({
    graphId: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    status: z.string().optional(),
    rootNodes: stringArray.optional(),
    templateIds: stringArray.optional()
  })
  .passthrough();

const SpeciesNodeInputSchema = z
  .object({
    graphId: z.string().min(1),
    nodeId: z.string().min(1),
    name: z.string().min(1),
    category: z.string().optional(),
    level: z.string().optional(),
    parentNodes: stringArray.optional(),
    primaryParent: z.string().optional(),
    parentRoles: JsonObjectInput.optional(),
    motifs: stringArray.optional(),
    constraints: JsonObjectInput.optional(),
    badcases: stringArray.optional()
  })
  .passthrough();

const SpeciesGroupInputSchema = z
  .object({
    graphId: z.string().min(1),
    groupId: z.string().min(1),
    name: z.string().min(1),
    groupType: z.string().optional(),
    parentGroupIds: stringArray.optional(),
    templateIds: stringArray.optional(),
    sharedFacts: stringArray.optional(),
    facetSchemaIds: stringArray.optional(),
    phenotypeTypeSuggestions: stringArray.optional(),
    reviewPolicy: JsonObjectInput.optional(),
    owner: z.string().optional(),
    status: z.string().optional(),
    extensions: JsonObjectInput.optional()
  })
  .passthrough();

const SpeciesGroupMembershipInputSchema = z
  .object({
    membershipId: z.string().min(1),
    graphId: z.string().min(1),
    groupId: z.string().min(1),
    nodeId: z.string().min(1),
    role: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();

const AtlasInputSchema = z
  .object({
    atlasId: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    graphIds: stringArray.optional(),
    status: z.string().optional(),
    metadata: JsonObjectInput.optional()
  })
  .passthrough();

const RelationshipEndpointInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("graph"), graphId: z.string().min(1) }),
  z.object({ type: z.literal("species-group"), graphId: z.string().min(1), groupId: z.string().min(1) }),
  z.object({ type: z.literal("species-node"), graphId: z.string().min(1), nodeId: z.string().min(1) })
]);

const DesignRelationshipInputSchema = z
  .object({
    relationshipId: z.string().min(1),
    source: RelationshipEndpointInputSchema,
    target: RelationshipEndpointInputSchema,
    relationshipType: z.string().min(1),
    direction: z.string().optional(),
    description: z.string().optional(),
    designContract: JsonObjectInput.optional(),
    auxiliaryRefs: JsonObjectInput.optional(),
    status: z.string().optional(),
    metadata: JsonObjectInput.optional(),
    allowParallel: z.boolean().optional()
  })
  .passthrough();

const FacetDefinitionInputSchema = z
  .object({
    facetId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    valueType: z.string().optional(),
    allowedValues: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    status: z.string().optional()
  })
  .passthrough();

const FacetSchemaInputSchema = z
  .object({
    facetSchemaId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    facetIds: stringArray.optional(),
    requiredFacetIds: stringArray.optional(),
    status: z.string().optional()
  })
  .passthrough();

const FacetAssignmentInputSchema = z
  .object({
    assignmentId: z.string().min(1),
    targetType: z.string().min(1),
    targetId: z.string().min(1),
    values: JsonObjectInput.optional(),
    status: z.string().optional()
  })
  .passthrough();

const PhenotypePlanInputSchema = z
  .object({
    phenotypeId: z.string().min(1),
    graphId: z.string().min(1),
    nodeId: z.string().min(1),
    phenotypeType: z.string().min(1),
    name: z.string().min(1),
    phenotypeTypeSource: z.string().optional(),
    objectBrief: z.string().optional(),
    expectedAssetTypes: stringArray.optional(),
    routingPolicyId: z.string().optional(),
    reviewRubricIds: stringArray.optional(),
    tags: stringArray.optional(),
    facets: JsonObjectInput.optional(),
    status: z.string().optional(),
    metadata: JsonObjectInput.optional(),
    extensions: JsonObjectInput.optional()
  })
  .passthrough();

const PhenotypeLibraryInputSchema = z
  .object({
    libraryId: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    profile: z.string().min(1),
    graphIds: stringArray.optional()
  })
  .passthrough();

const LibraryGraphBindingInputSchema = z
  .object({
    bindingId: z.string().min(1),
    libraryId: z.string().min(1),
    graphId: z.string().min(1),
    role: z.string().min(1)
  })
  .passthrough();

const StorageMountInputSchema = z
  .object({
    mountId: z.string().min(1),
    libraryId: z.string().min(1),
    storageType: z.string().min(1),
    adapterKind: z.string().min(1),
    displayName: z.string().min(1),
    location: z.string().min(1)
  })
  .passthrough();

const ExternalLibraryMappingInputSchema = z
  .object({
    mappingId: z.string().min(1),
    libraryId: z.string().min(1),
    mountId: z.string().min(1),
    adapterId: z.string().min(1)
  })
  .passthrough();

const LibraryRoutingPolicyInputSchema = z
  .object({
    routingPolicyId: z.string().min(1),
    libraryId: z.string().min(1),
    name: z.string().min(1),
    targetMountId: z.string().min(1)
  })
  .passthrough();

export const ModelingBatchSchema = z.object({
  format: z.literal(MODELING_BATCH_FORMAT),
  graphs: z.array(GraphInputSchema).default([]),
  atlases: z.array(AtlasInputSchema).default([]),
  speciesGroups: z.array(SpeciesGroupInputSchema).default([]),
  groupMemberships: z.array(SpeciesGroupMembershipInputSchema).default([]),
  designRelationships: z.array(DesignRelationshipInputSchema).default([]),
  facetDefinitions: z.array(FacetDefinitionInputSchema).default([]),
  facetSchemas: z.array(FacetSchemaInputSchema).default([]),
  facetAssignments: z.array(FacetAssignmentInputSchema).default([]),
  speciesNodes: z.array(SpeciesNodeInputSchema).default([]),
  phenotypePlans: z.array(PhenotypePlanInputSchema).default([]),
  phenotypeLibraries: z.array(PhenotypeLibraryInputSchema).default([]),
  libraryGraphBindings: z.array(LibraryGraphBindingInputSchema).default([]),
  storageMounts: z.array(StorageMountInputSchema).default([]),
  externalLibraryMappings: z.array(ExternalLibraryMappingInputSchema).default([]),
  libraryRoutingPolicies: z.array(LibraryRoutingPolicyInputSchema).default([])
});

export interface ModelingBatch {
  format: typeof MODELING_BATCH_FORMAT;
  graphs: Array<Partial<Graph> & Pick<Graph, "graphId" | "name" | "purpose">>;
  atlases: Array<Partial<Atlas> & Pick<Atlas, "atlasId" | "name" | "purpose">>;
  speciesGroups: Array<Partial<SpeciesGroup> & Pick<SpeciesGroup, "graphId" | "groupId" | "name">>;
  groupMemberships: Array<
    Partial<SpeciesGroupMembership> & Pick<SpeciesGroupMembership, "membershipId" | "graphId" | "groupId" | "nodeId">
  >;
  designRelationships: Array<Partial<DesignRelationship> & Pick<DesignRelationship, "relationshipId" | "source" | "target" | "relationshipType"> & { allowParallel?: boolean }>;
  facetDefinitions: Array<Partial<FacetDefinition> & Pick<FacetDefinition, "facetId" | "name">>;
  facetSchemas: Array<Partial<FacetSchema> & Pick<FacetSchema, "facetSchemaId" | "name">>;
  facetAssignments: Array<Partial<FacetAssignment> & Pick<FacetAssignment, "assignmentId" | "targetType" | "targetId">>;
  speciesNodes: Array<Partial<SpeciesNode> & Pick<SpeciesNode, "graphId" | "nodeId" | "name">>;
  phenotypePlans: Array<
    Partial<Phenotype> &
      Pick<Phenotype, "phenotypeId" | "graphId" | "nodeId" | "phenotypeType" | "name"> & {
        expectedAssetTypes?: string[];
        routingPolicyId?: string;
        reviewRubricIds?: string[];
        metadata?: Record<string, unknown>;
        extensions?: Record<string, unknown>;
      }
  >;
  phenotypeLibraries: Array<Partial<PhenotypeLibrary> & Pick<PhenotypeLibrary, "libraryId" | "name" | "purpose" | "profile">>;
  libraryGraphBindings: Array<
    Partial<PhenotypeLibraryGraphBinding> &
      Pick<PhenotypeLibraryGraphBinding, "bindingId" | "libraryId" | "graphId" | "role">
  >;
  storageMounts: Array<
    Partial<StorageMount> & Pick<StorageMount, "mountId" | "libraryId" | "storageType" | "adapterKind" | "displayName" | "location">
  >;
  externalLibraryMappings: Array<
    Partial<ExternalLibraryMapping> & Pick<ExternalLibraryMapping, "mappingId" | "libraryId" | "mountId" | "adapterId">
  >;
  libraryRoutingPolicies: Array<
    Partial<LibraryRoutingPolicy> & Pick<LibraryRoutingPolicy, "routingPolicyId" | "libraryId" | "name" | "targetMountId">
  >;
}
