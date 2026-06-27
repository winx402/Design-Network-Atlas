import {
  Atlas,
  AssetIndex,
  ChangeSet,
  ContextAttachment,
  ContextFact,
  ContextMotif,
  ContextPolicy,
  ContextReference,
  ContextReviewRubric,
  DesignContext,
  DesignPrinciple,
  EvolutionEdge,
  EdgeVersion,
  ExternalLibraryMapping,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  GeneTemplate,
  GenerationJob,
  Graph,
  GraphBridge,
  ImpactRecord,
  LibraryRoutingPolicy,
  NodeVersion,
  OutputReference,
  Phenotype,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  PhenotypeVersion,
  ReviewRecord,
  SpeciesGroup,
  SpeciesGroupMembership,
  SpeciesGroupRelation,
  SpeciesNode,
  StorageMount,
  TemplatePack
} from "@dna/core";

export interface StorageEngine {
  migrate(): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}

export interface GraphRepository {
  create(graph: Graph): void;
  get(graphId: string): Graph | undefined;
  list(): Graph[];
  update(graph: Graph): void;
  archive(graphId: string): void;
}

export interface TemplateRepository {
  createPack(pack: TemplatePack): void;
  createTemplate(template: GeneTemplate): void;
  getTemplate(templateId: string): GeneTemplate | undefined;
  listTemplates(): GeneTemplate[];
  listPacks(): TemplatePack[];
}

export interface FacetDefinitionRepository {
  create(definition: FacetDefinition): void;
  update(definition: FacetDefinition): void;
  get(facetId: string): FacetDefinition | undefined;
  list(): FacetDefinition[];
}

export interface FacetSchemaRepository {
  create(schema: FacetSchema): void;
  update(schema: FacetSchema): void;
  get(facetSchemaId: string): FacetSchema | undefined;
  list(): FacetSchema[];
}

export interface FacetAssignmentRepository {
  create(assignment: FacetAssignment): void;
  update(assignment: FacetAssignment): void;
  get(assignmentId: string): FacetAssignment | undefined;
  list(): FacetAssignment[];
  listByTarget(targetType: string, targetId: string): FacetAssignment[];
}

export interface SpeciesGroupRepository {
  create(group: SpeciesGroup): void;
  update(group: SpeciesGroup): void;
  get(groupId: string): SpeciesGroup | undefined;
  listByGraph(graphId: string): SpeciesGroup[];
}

export interface SpeciesGroupMembershipRepository {
  create(membership: SpeciesGroupMembership): void;
  update(membership: SpeciesGroupMembership): void;
  get(membershipId: string): SpeciesGroupMembership | undefined;
  listByGraph(graphId: string): SpeciesGroupMembership[];
  listByGroup(groupId: string): SpeciesGroupMembership[];
  listByNode(nodeId: string): SpeciesGroupMembership[];
}

export interface SpeciesGroupRelationRepository {
  create(relation: SpeciesGroupRelation): void;
  update(relation: SpeciesGroupRelation): void;
  get(relationId: string): SpeciesGroupRelation | undefined;
  listByGraph(graphId: string): SpeciesGroupRelation[];
}

export interface AtlasRepository {
  create(atlas: Atlas): void;
  update(atlas: Atlas): void;
  get(atlasId: string): Atlas | undefined;
  list(): Atlas[];
}

export interface GraphBridgeRepository {
  create(bridge: GraphBridge): void;
  update(bridge: GraphBridge): void;
  get(bridgeId: string): GraphBridge | undefined;
  listByAtlas(atlasId: string): GraphBridge[];
  listByGraph(graphId: string): GraphBridge[];
}

export interface DesignContextRepository {
  create(context: DesignContext): void;
  update(context: DesignContext): void;
  get(contextId: string): DesignContext | undefined;
  list(): DesignContext[];
}

export interface ContextFactRepository {
  create(fact: ContextFact): void;
  update(fact: ContextFact): void;
  get(factId: string): ContextFact | undefined;
  list(): ContextFact[];
}

export interface DesignPrincipleRepository {
  create(principle: DesignPrinciple): void;
  update(principle: DesignPrinciple): void;
  get(principleId: string): DesignPrinciple | undefined;
  list(): DesignPrinciple[];
}

export interface ContextMotifRepository {
  create(motif: ContextMotif): void;
  update(motif: ContextMotif): void;
  get(motifId: string): ContextMotif | undefined;
  list(): ContextMotif[];
}

export interface ContextReferenceRepository {
  create(reference: ContextReference): void;
  update(reference: ContextReference): void;
  get(referenceId: string): ContextReference | undefined;
  list(): ContextReference[];
}

export interface ContextReviewRubricRepository {
  create(rubric: ContextReviewRubric): void;
  update(rubric: ContextReviewRubric): void;
  get(rubricId: string): ContextReviewRubric | undefined;
  list(): ContextReviewRubric[];
}

export interface ContextAttachmentRepository {
  create(attachment: ContextAttachment): void;
  update(attachment: ContextAttachment): void;
  get(attachmentId: string): ContextAttachment | undefined;
  list(): ContextAttachment[];
  listByContext(contextId: string): ContextAttachment[];
  listByTarget(targetType: string, targetId: string): ContextAttachment[];
}

export interface ContextPolicyRepository {
  create(policy: ContextPolicy): void;
  update(policy: ContextPolicy): void;
  get(policyId: string): ContextPolicy | undefined;
  list(): ContextPolicy[];
  listByContext(contextId: string): ContextPolicy[];
}

export interface LineageRepository {
  create(node: SpeciesNode): void;
  update(node: SpeciesNode): void;
  get(nodeId: string): SpeciesNode | undefined;
  listByGraph(graphId: string): SpeciesNode[];
}

export interface EdgeRepository {
  create(edge: EvolutionEdge): void;
  update(edge: EvolutionEdge): void;
  get(edgeId: string): EvolutionEdge | undefined;
  listByGraph(graphId: string): EvolutionEdge[];
}

export interface EdgeVersionRepository {
  create(version: EdgeVersion): void;
  get(edgeVersionId: string): EdgeVersion | undefined;
  listByEdge(edgeId: string): EdgeVersion[];
}

export interface NodeVersionRepository {
  create(version: NodeVersion): void;
  get(nodeVersionId: string): NodeVersion | undefined;
  listByNode(nodeId: string): NodeVersion[];
}

export interface PhenotypeRepository {
  create(phenotype: Phenotype): void;
  update(phenotype: Phenotype): void;
  get(phenotypeId: string): Phenotype | undefined;
  listByGraph(graphId: string): Phenotype[];
}

export interface PhenotypeVersionRepository {
  create(version: PhenotypeVersion): void;
  update(version: PhenotypeVersion): void;
  get(phenotypeVersionId: string): PhenotypeVersion | undefined;
  listByPhenotype(phenotypeId: string): PhenotypeVersion[];
  listByNode(nodeId: string): PhenotypeVersion[];
}

export interface AssetRepository {
  create(asset: AssetIndex): void;
  update(asset: AssetIndex): void;
  get(assetId: string): AssetIndex | undefined;
  search(filter: { graphId?: string; linkedObjectId?: string; tag?: string; status?: string }): AssetIndex[];
}

export interface OutputReferenceRepository {
  create(reference: OutputReference): void;
  update(reference: OutputReference): void;
  get(outputReferenceId: string): OutputReference | undefined;
  listByPhenotypeVersion(phenotypeVersionId: string): OutputReference[];
  listByGraph(graphId: string): OutputReference[];
  search(filter: { graphId?: string; phenotypeVersionId?: string; libraryId?: string; tag?: string; status?: string }): OutputReference[];
}

export interface PhenotypeLibraryRepository {
  create(library: PhenotypeLibrary): void;
  update(library: PhenotypeLibrary): void;
  get(libraryId: string): PhenotypeLibrary | undefined;
  list(): PhenotypeLibrary[];
}

export interface StorageMountRepository {
  create(mount: StorageMount): void;
  update(mount: StorageMount): void;
  get(mountId: string): StorageMount | undefined;
  listByLibrary(libraryId: string): StorageMount[];
}

export interface PhenotypeLibraryGraphBindingRepository {
  create(binding: PhenotypeLibraryGraphBinding): void;
  update(binding: PhenotypeLibraryGraphBinding): void;
  get(bindingId: string): PhenotypeLibraryGraphBinding | undefined;
  listByGraph(graphId: string): PhenotypeLibraryGraphBinding[];
  listByLibrary(libraryId: string): PhenotypeLibraryGraphBinding[];
}

export interface ExternalLibraryMappingRepository {
  create(mapping: ExternalLibraryMapping): void;
  update(mapping: ExternalLibraryMapping): void;
  get(mappingId: string): ExternalLibraryMapping | undefined;
  listByLibrary(libraryId: string): ExternalLibraryMapping[];
}

export interface LibraryRoutingPolicyRepository {
  create(policy: LibraryRoutingPolicy): void;
  update(policy: LibraryRoutingPolicy): void;
  get(routingPolicyId: string): LibraryRoutingPolicy | undefined;
  listByLibrary(libraryId: string): LibraryRoutingPolicy[];
}

export interface GenerationJobRepository {
  create(job: GenerationJob): void;
  update(job: GenerationJob): void;
  get(generationJobId: string): GenerationJob | undefined;
  listByGraph(graphId: string): GenerationJob[];
}

export interface ReviewRepository {
  create(review: ReviewRecord): void;
  get(reviewRecordId: string): ReviewRecord | undefined;
  listByGraph(graphId: string): ReviewRecord[];
  listByObject(objectType: string, objectId: string): ReviewRecord[];
}

export interface ImpactRepository {
  create(record: ImpactRecord): void;
  listByGraph(graphId: string): ImpactRecord[];
  listByChangedObject(objectType: ImpactRecord["changedObjectType"], objectId: string): ImpactRecord[];
}

export interface SearchRepository {
  assets(filter: { graphId?: string; tag?: string; status?: string }): AssetIndex[];
}

export interface ChangeSetRepository {
  create(changeSet: ChangeSet): void;
  update(changeSet: ChangeSet): void;
  get(changeSetId: string): ChangeSet | undefined;
  list(): ChangeSet[];
}

export * from "./memory.js";
export * from "./services.js";
