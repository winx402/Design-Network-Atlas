import {
  AssetIndex,
  EvolutionEdge,
  GeneTemplate,
  GenerationJob,
  Graph,
  ImpactRecord,
  NodeVersion,
  Phenotype,
  PhenotypeVersion,
  ReviewRecord,
  SpeciesNode,
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

export interface GenerationJobRepository {
  create(job: GenerationJob): void;
  update(job: GenerationJob): void;
  get(generationJobId: string): GenerationJob | undefined;
}

export interface ReviewRepository {
  create(review: ReviewRecord): void;
  get(reviewRecordId: string): ReviewRecord | undefined;
  listByObject(objectType: string, objectId: string): ReviewRecord[];
}

export interface ImpactRepository {
  create(record: ImpactRecord): void;
  listByChangedObject(objectType: "node" | "edge", objectId: string): ImpactRecord[];
}

export interface SearchRepository {
  assets(filter: { graphId?: string; tag?: string; status?: string }): AssetIndex[];
}

export * from "./memory.js";
export * from "./services.js";
