import { z } from "zod";
import {
  Atlas,
  EvolutionEdge,
  ExternalLibraryMapping,
  Graph,
  GraphBridge,
  LibraryRoutingPolicy,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  SpeciesGroup,
  SpeciesGroupMembership,
  SpeciesGroupRelation,
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

const EvolutionEdgeInputSchema = z
  .object({
    graphId: z.string().min(1),
    edgeId: z.string().min(1),
    fromNodeId: z.string().min(1),
    toNodeId: z.string().min(1),
    edgeType: z.string().optional(),
    direction: z.string().optional(),
    operation: z.string().optional(),
    deltaGenes: JsonObjectInput.optional(),
    valueResolution: JsonObjectInput.optional(),
    mustPreserve: stringArray.optional(),
    mustAvoid: stringArray.optional()
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

const SpeciesGroupRelationInputSchema = z
  .object({
    relationId: z.string().min(1),
    graphId: z.string().min(1),
    sourceGroupId: z.string().min(1),
    targetGroupId: z.string().min(1),
    relationType: z.string().min(1),
    description: z.string().optional(),
    status: z.string().optional(),
    extensions: JsonObjectInput.optional(),
    allowParallel: z.boolean().optional()
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

const GraphBridgeInputSchema = z
  .object({
    bridgeId: z.string().min(1),
    atlasId: z.string().min(1),
    sourceGraphId: z.string().min(1),
    targetGraphId: z.string().min(1),
    bridgeType: z.string().min(1),
    description: z.string().optional(),
    status: z.string().optional(),
    extensions: JsonObjectInput.optional(),
    allowParallel: z.boolean().optional()
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
  groupRelations: z.array(SpeciesGroupRelationInputSchema).default([]),
  graphBridges: z.array(GraphBridgeInputSchema).default([]),
  speciesNodes: z.array(SpeciesNodeInputSchema).default([]),
  evolutionEdges: z.array(EvolutionEdgeInputSchema).default([]),
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
  groupRelations: Array<
    Partial<SpeciesGroupRelation> &
      Pick<SpeciesGroupRelation, "relationId" | "graphId" | "sourceGroupId" | "targetGroupId" | "relationType"> & {
        allowParallel?: boolean;
      }
  >;
  graphBridges: Array<
    Partial<GraphBridge> &
      Pick<GraphBridge, "bridgeId" | "atlasId" | "sourceGraphId" | "targetGraphId" | "bridgeType"> & { allowParallel?: boolean }
  >;
  speciesNodes: Array<Partial<SpeciesNode> & Pick<SpeciesNode, "graphId" | "nodeId" | "name">>;
  evolutionEdges: Array<Partial<EvolutionEdge> & Pick<EvolutionEdge, "graphId" | "edgeId" | "fromNodeId" | "toNodeId">>;
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
