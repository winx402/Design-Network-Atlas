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
import {
  AssetRepository,
  ChangeSetRepository,
  EdgeRepository,
  EdgeVersionRepository,
  ExternalLibraryMappingRepository,
  GenerationJobRepository,
  GraphRepository,
  ImpactRepository,
  LibraryRoutingPolicyRepository,
  LineageRepository,
  NodeVersionRepository,
  OutputReferenceRepository,
  PhenotypeRepository,
  PhenotypeLibraryGraphBindingRepository,
  PhenotypeLibraryRepository,
  PhenotypeVersionRepository,
  ReviewRepository,
  SearchRepository,
  StorageMountRepository,
  StorageEngine,
  TemplateRepository
} from "./index.js";

export interface DnaServiceStore extends StorageEngine {
  graphs: GraphRepository;
  templates: TemplateRepository;
  nodes: LineageRepository;
  nodeVersions: NodeVersionRepository;
  edges: EdgeRepository;
  edgeVersions: EdgeVersionRepository;
  phenotypes: PhenotypeRepository;
  phenotypeVersions: PhenotypeVersionRepository;
  assets: AssetRepository;
  outputReferences: OutputReferenceRepository;
  phenotypeLibraries: PhenotypeLibraryRepository;
  storageMounts: StorageMountRepository;
  phenotypeLibraryGraphBindings: PhenotypeLibraryGraphBindingRepository;
  externalLibraryMappings: ExternalLibraryMappingRepository;
  libraryRoutingPolicies: LibraryRoutingPolicyRepository;
  generationJobs: GenerationJobRepository;
  reviews: ReviewRepository;
  impacts: ImpactRepository;
  search: SearchRepository;
  changeSets: ChangeSetRepository;
}

export interface InMemoryStoreOptions {
  failOnNodeVersionCreate?: boolean;
}

interface MemoryState {
  graphs: Map<string, Graph>;
  templatePacks: Map<string, TemplatePack>;
  geneTemplates: Map<string, GeneTemplate>;
  nodes: Map<string, SpeciesNode>;
  nodeVersions: Map<string, NodeVersion>;
  edges: Map<string, EvolutionEdge>;
  edgeVersions: Map<string, EdgeVersion>;
  phenotypes: Map<string, Phenotype>;
  phenotypeVersions: Map<string, PhenotypeVersion>;
  assets: Map<string, AssetIndex>;
  outputReferences: Map<string, OutputReference>;
  phenotypeLibraries: Map<string, PhenotypeLibrary>;
  storageMounts: Map<string, StorageMount>;
  phenotypeLibraryGraphBindings: Map<string, PhenotypeLibraryGraphBinding>;
  externalLibraryMappings: Map<string, ExternalLibraryMapping>;
  libraryRoutingPolicies: Map<string, LibraryRoutingPolicy>;
  generationJobs: Map<string, GenerationJob>;
  reviews: Map<string, ReviewRecord>;
  impacts: Map<string, ImpactRecord>;
  changeSets: Map<string, ChangeSet>;
}

export class InMemoryDnaStore implements DnaServiceStore {
  private state: MemoryState = createState();
  readonly graphs: GraphRepository;
  readonly templates: TemplateRepository;
  readonly nodes: LineageRepository;
  readonly nodeVersions: NodeVersionRepository;
  readonly edges: EdgeRepository;
  readonly edgeVersions: EdgeVersionRepository;
  readonly phenotypes: PhenotypeRepository;
  readonly phenotypeVersions: PhenotypeVersionRepository;
  readonly assets: AssetRepository;
  readonly outputReferences: OutputReferenceRepository;
  readonly phenotypeLibraries: PhenotypeLibraryRepository;
  readonly storageMounts: StorageMountRepository;
  readonly phenotypeLibraryGraphBindings: PhenotypeLibraryGraphBindingRepository;
  readonly externalLibraryMappings: ExternalLibraryMappingRepository;
  readonly libraryRoutingPolicies: LibraryRoutingPolicyRepository;
  readonly generationJobs: GenerationJobRepository;
  readonly reviews: ReviewRepository;
  readonly impacts: ImpactRepository;
  readonly search: SearchRepository;
  readonly changeSets: ChangeSetRepository;

  constructor(private readonly options: InMemoryStoreOptions = {}) {
    this.graphs = {
      create: (graph) => this.state.graphs.set(graph.graphId, graph),
      get: (graphId) => this.state.graphs.get(graphId),
      list: () => [...this.state.graphs.values()],
      update: (graph) => this.state.graphs.set(graph.graphId, graph),
      archive: (graphId) => {
        const graph = this.state.graphs.get(graphId);
        if (graph) this.state.graphs.set(graphId, { ...graph, status: "archived" });
      }
    };
    this.templates = {
      createPack: (pack) => this.state.templatePacks.set(pack.templatePackId, pack),
      createTemplate: (template) => this.state.geneTemplates.set(template.templateId, template),
      getTemplate: (templateId) => this.state.geneTemplates.get(templateId),
      listTemplates: () => [...this.state.geneTemplates.values()],
      listPacks: () => [...this.state.templatePacks.values()]
    };
    this.nodes = {
      create: (node) => this.state.nodes.set(node.nodeId, node),
      update: (node) => this.state.nodes.set(node.nodeId, node),
      get: (nodeId) => this.state.nodes.get(nodeId),
      listByGraph: (graphId) => [...this.state.nodes.values()].filter((node) => node.graphId === graphId)
    };
    this.nodeVersions = {
      create: (version) => {
        if (this.options.failOnNodeVersionCreate) throw new Error("forced node version failure");
        this.state.nodeVersions.set(version.nodeVersionId, version);
      },
      get: (nodeVersionId) => this.state.nodeVersions.get(nodeVersionId),
      listByNode: (nodeId) => [...this.state.nodeVersions.values()].filter((version) => version.nodeId === nodeId)
    };
    this.edges = {
      create: (edge) => this.state.edges.set(edge.edgeId, edge),
      update: (edge) => this.state.edges.set(edge.edgeId, edge),
      get: (edgeId) => this.state.edges.get(edgeId),
      listByGraph: (graphId) => [...this.state.edges.values()].filter((edge) => edge.graphId === graphId)
    };
    this.edgeVersions = {
      create: (version) => this.state.edgeVersions.set(version.edgeVersionId, version),
      get: (edgeVersionId) => this.state.edgeVersions.get(edgeVersionId),
      listByEdge: (edgeId) => [...this.state.edgeVersions.values()].filter((version) => version.edgeId === edgeId)
    };
    this.phenotypes = {
      create: (phenotype) => this.state.phenotypes.set(phenotype.phenotypeId, phenotype),
      update: (phenotype) => this.state.phenotypes.set(phenotype.phenotypeId, phenotype),
      get: (phenotypeId) => this.state.phenotypes.get(phenotypeId),
      listByGraph: (graphId) => [...this.state.phenotypes.values()].filter((phenotype) => phenotype.graphId === graphId)
    };
    this.phenotypeVersions = {
      create: (version) => this.state.phenotypeVersions.set(version.phenotypeVersionId, version),
      update: (version) => this.state.phenotypeVersions.set(version.phenotypeVersionId, version),
      get: (phenotypeVersionId) => this.state.phenotypeVersions.get(phenotypeVersionId),
      listByPhenotype: (phenotypeId) => [...this.state.phenotypeVersions.values()].filter((version) => version.phenotypeId === phenotypeId),
      listByNode: (nodeId) => [...this.state.phenotypeVersions.values()].filter((version) => version.nodeId === nodeId)
    };
    this.assets = {
      create: (asset) => this.state.assets.set(asset.assetId, asset),
      update: (asset) => this.state.assets.set(asset.assetId, asset),
      get: (assetId) => this.state.assets.get(assetId),
      search: (filter) =>
        [...this.state.assets.values()].filter((asset) => {
          if (filter.linkedObjectId && asset.linkedObjectId !== filter.linkedObjectId) return false;
          if (filter.status && asset.status !== filter.status) return false;
          if (filter.tag && !asset.tags.includes(filter.tag)) return false;
          return true;
        })
    };
    this.outputReferences = {
      create: (reference) => this.state.outputReferences.set(reference.outputReferenceId, reference),
      update: (reference) => this.state.outputReferences.set(reference.outputReferenceId, reference),
      get: (outputReferenceId) => this.state.outputReferences.get(outputReferenceId),
      listByPhenotypeVersion: (phenotypeVersionId) =>
        [...this.state.outputReferences.values()].filter((reference) => reference.phenotypeVersionId === phenotypeVersionId),
      listByGraph: (graphId) => [...this.state.outputReferences.values()].filter((reference) => reference.graphId === graphId),
      search: (filter) =>
        [...this.state.outputReferences.values()].filter((reference) => {
          if (filter.graphId && reference.graphId !== filter.graphId) return false;
          if (filter.phenotypeVersionId && reference.phenotypeVersionId !== filter.phenotypeVersionId) return false;
          if (filter.libraryId && reference.libraryId !== filter.libraryId) return false;
          if (filter.status && reference.status !== filter.status) return false;
          if (filter.tag && !reference.tags.includes(filter.tag) && !reference.normalizedTags.includes(filter.tag)) return false;
          return true;
        })
    };
    this.phenotypeLibraries = {
      create: (library) => this.state.phenotypeLibraries.set(library.libraryId, library),
      update: (library) => this.state.phenotypeLibraries.set(library.libraryId, library),
      get: (libraryId) => this.state.phenotypeLibraries.get(libraryId),
      list: () => [...this.state.phenotypeLibraries.values()]
    };
    this.storageMounts = {
      create: (mount) => this.state.storageMounts.set(mount.mountId, mount),
      update: (mount) => this.state.storageMounts.set(mount.mountId, mount),
      get: (mountId) => this.state.storageMounts.get(mountId),
      listByLibrary: (libraryId) => [...this.state.storageMounts.values()].filter((mount) => mount.libraryId === libraryId)
    };
    this.phenotypeLibraryGraphBindings = {
      create: (binding) => {
        this.state.phenotypeLibraryGraphBindings.set(binding.bindingId, binding);
        syncMemoryLibraryGraphId(this.state, binding.libraryId, binding.graphId);
      },
      update: (binding) => {
        this.state.phenotypeLibraryGraphBindings.set(binding.bindingId, binding);
        syncMemoryLibraryGraphId(this.state, binding.libraryId, binding.graphId);
      },
      get: (bindingId) => this.state.phenotypeLibraryGraphBindings.get(bindingId),
      listByGraph: (graphId) => [...this.state.phenotypeLibraryGraphBindings.values()].filter((binding) => binding.graphId === graphId),
      listByLibrary: (libraryId) =>
        [...this.state.phenotypeLibraryGraphBindings.values()]
          .filter((binding) => binding.libraryId === libraryId)
          .sort((left, right) => left.graphId.localeCompare(right.graphId))
    };
    this.externalLibraryMappings = {
      create: (mapping) => this.state.externalLibraryMappings.set(mapping.mappingId, mapping),
      update: (mapping) => this.state.externalLibraryMappings.set(mapping.mappingId, mapping),
      get: (mappingId) => this.state.externalLibraryMappings.get(mappingId),
      listByLibrary: (libraryId) => [...this.state.externalLibraryMappings.values()].filter((mapping) => mapping.libraryId === libraryId)
    };
    this.libraryRoutingPolicies = {
      create: (policy) => this.state.libraryRoutingPolicies.set(policy.routingPolicyId, policy),
      update: (policy) => this.state.libraryRoutingPolicies.set(policy.routingPolicyId, policy),
      get: (routingPolicyId) => this.state.libraryRoutingPolicies.get(routingPolicyId),
      listByLibrary: (libraryId) =>
        [...this.state.libraryRoutingPolicies.values()]
          .filter((policy) => policy.libraryId === libraryId)
          .sort((left, right) => {
            const byPriority = right.priority - left.priority;
            if (byPriority !== 0) return byPriority;
            return left.routingPolicyId.localeCompare(right.routingPolicyId);
          })
    };
    this.generationJobs = {
      create: (job) => this.state.generationJobs.set(job.generationJobId, job),
      update: (job) => this.state.generationJobs.set(job.generationJobId, job),
      get: (generationJobId) => this.state.generationJobs.get(generationJobId),
      listByGraph: (graphId) =>
        [...this.state.generationJobs.values()]
          .filter((job) => job.graphId === graphId)
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.generationJobId.localeCompare(right.generationJobId))
    };
    this.reviews = {
      create: (review) => this.state.reviews.set(review.reviewRecordId, review),
      get: (reviewRecordId) => this.state.reviews.get(reviewRecordId),
      listByGraph: (graphId) => [...this.state.reviews.values()].filter((review) => review.graphId === graphId),
      listByObject: (objectType, objectId) =>
        [...this.state.reviews.values()].filter((review) => review.objectType === objectType && review.objectId === objectId)
    };
    this.impacts = {
      create: (record) => this.state.impacts.set(record.impactRecordId, record),
      listByGraph: (graphId) => [...this.state.impacts.values()].filter((record) => record.graphId === graphId),
      listByChangedObject: (objectType, objectId) =>
        [...this.state.impacts.values()].filter((record) => record.changedObjectType === objectType && record.changedObjectId === objectId)
    };
    this.search = {
      assets: (filter) => this.assets.search(filter)
    };
    this.changeSets = {
      create: (changeSet) => this.state.changeSets.set(changeSet.changeSetId, changeSet),
      update: (changeSet) => this.state.changeSets.set(changeSet.changeSetId, changeSet),
      get: (changeSetId) => this.state.changeSets.get(changeSetId)
    };
  }

  migrate(): void {}

  transaction<T>(fn: () => T): T {
    const snapshot = cloneState(this.state);
    try {
      return fn();
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }

  close(): void {}
}

export function createInMemoryDnaStore(options?: InMemoryStoreOptions): InMemoryDnaStore {
  return new InMemoryDnaStore(options);
}

function createState(): MemoryState {
  return {
    graphs: new Map(),
    templatePacks: new Map(),
    geneTemplates: new Map(),
    nodes: new Map(),
    nodeVersions: new Map(),
    edges: new Map(),
    edgeVersions: new Map(),
    phenotypes: new Map(),
    phenotypeVersions: new Map(),
    assets: new Map(),
    outputReferences: new Map(),
    phenotypeLibraries: new Map(),
    storageMounts: new Map(),
    phenotypeLibraryGraphBindings: new Map(),
    externalLibraryMappings: new Map(),
    libraryRoutingPolicies: new Map(),
    generationJobs: new Map(),
    reviews: new Map(),
    impacts: new Map(),
    changeSets: new Map()
  };
}

function cloneState(state: MemoryState): MemoryState {
  return {
    graphs: new Map(state.graphs),
    templatePacks: new Map(state.templatePacks),
    geneTemplates: new Map(state.geneTemplates),
    nodes: new Map(state.nodes),
    nodeVersions: new Map(state.nodeVersions),
    edges: new Map(state.edges),
    edgeVersions: new Map(state.edgeVersions),
    phenotypes: new Map(state.phenotypes),
    phenotypeVersions: new Map(state.phenotypeVersions),
    assets: new Map(state.assets),
    outputReferences: new Map(state.outputReferences),
    phenotypeLibraries: new Map(state.phenotypeLibraries),
    storageMounts: new Map(state.storageMounts),
    phenotypeLibraryGraphBindings: new Map(state.phenotypeLibraryGraphBindings),
    externalLibraryMappings: new Map(state.externalLibraryMappings),
    libraryRoutingPolicies: new Map(state.libraryRoutingPolicies),
    generationJobs: new Map(state.generationJobs),
    reviews: new Map(state.reviews),
    impacts: new Map(state.impacts),
    changeSets: new Map(state.changeSets)
  };
}

function syncMemoryLibraryGraphId(state: MemoryState, libraryId: string, graphId: string) {
  const library = state.phenotypeLibraries.get(libraryId);
  if (!library || library.graphIds.includes(graphId)) return;
  state.phenotypeLibraries.set(libraryId, {
    ...library,
    graphIds: [...library.graphIds, graphId].sort(),
    updatedAt: new Date().toISOString()
  });
}
