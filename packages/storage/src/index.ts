import {
  AssetIndex,
  ChangeSet,
  EvolutionEdge,
  EdgeVersion,
  ExternalLibraryMapping,
  GeneTemplate,
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
  ReviewRecord,
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
  listByChangedObject(objectType: "node" | "edge", objectId: string): ImpactRecord[];
}

export interface SearchRepository {
  assets(filter: { graphId?: string; tag?: string; status?: string }): AssetIndex[];
}

export interface ChangeSetRepository {
  create(changeSet: ChangeSet): void;
  update(changeSet: ChangeSet): void;
  get(changeSetId: string): ChangeSet | undefined;
}

export * from "./memory.js";
export * from "./services.js";
