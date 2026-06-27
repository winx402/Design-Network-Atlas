import {
  Atlas,
  AssetIndex,
  assertCanTransitionStatus,
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
  PhenotypeCompileArtifact,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  PhenotypeVersion,
  Proposal,
  ReviewRecord,
  SpeciesGroup,
  SpeciesCompileArtifact,
  SpeciesGroupMembership,
  SpeciesGroupRelation,
  SpeciesNode,
  StorageMount,
  TemplatePack
} from "@dna/core";
import {
  AssetRepository,
  ChangeSetRepository,
  ContextAttachmentRepository,
  ContextFactRepository,
  ContextMotifRepository,
  ContextPolicyRepository,
  ContextReferenceRepository,
  ContextReviewRubricRepository,
  DesignContextRepository,
  DesignPrincipleRepository,
  EdgeRepository,
  EdgeVersionRepository,
  ExternalLibraryMappingRepository,
  GraphResetSummary,
  AtlasRepository,
  FacetAssignmentRepository,
  FacetDefinitionRepository,
  FacetSchemaRepository,
  GenerationJobRepository,
  GraphBridgeRepository,
  GraphRepository,
  ImpactRepository,
  LibraryRoutingPolicyRepository,
  LineageRepository,
  NodeVersionRepository,
  OutputReferenceRepository,
  PhenotypeRepository,
  PhenotypeLibraryGraphBindingRepository,
  PhenotypeLibraryRepository,
  PhenotypeCompileArtifactRepository,
  PhenotypeVersionRepository,
  ProposalRepository,
  ReviewRepository,
  SearchRepository,
  SpeciesGroupMembershipRepository,
  SpeciesGroupRelationRepository,
  SpeciesGroupRepository,
  SpeciesCompileArtifactRepository,
  StorageMountRepository,
  StorageEngine,
  TemplateRepository
} from "./index.js";

export interface DnaServiceStore extends StorageEngine {
  graphs: GraphRepository;
  facetDefinitions: FacetDefinitionRepository;
  facetSchemas: FacetSchemaRepository;
  facetAssignments: FacetAssignmentRepository;
  templates: TemplateRepository;
  speciesGroups: SpeciesGroupRepository;
  speciesGroupMemberships: SpeciesGroupMembershipRepository;
  speciesGroupRelations: SpeciesGroupRelationRepository;
  atlases: AtlasRepository;
  graphBridges: GraphBridgeRepository;
  designContexts: DesignContextRepository;
  contextFacts: ContextFactRepository;
  designPrinciples: DesignPrincipleRepository;
  contextMotifs: ContextMotifRepository;
  contextReferences: ContextReferenceRepository;
  contextReviewRubrics: ContextReviewRubricRepository;
  contextAttachments: ContextAttachmentRepository;
  contextPolicies: ContextPolicyRepository;
  nodes: LineageRepository;
  nodeVersions: NodeVersionRepository;
  edges: EdgeRepository;
  edgeVersions: EdgeVersionRepository;
  phenotypes: PhenotypeRepository;
  phenotypeVersions: PhenotypeVersionRepository;
  speciesCompileArtifacts: SpeciesCompileArtifactRepository;
  phenotypeCompileArtifacts: PhenotypeCompileArtifactRepository;
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
  proposals: ProposalRepository;
  previewGraphReset(graphId: string): GraphResetSummary;
  resetGraph(graphId: string): GraphResetSummary;
}

export interface InMemoryStoreOptions {
  failOnNodeVersionCreate?: boolean;
}

interface MemoryState {
  graphs: Map<string, Graph>;
  facetDefinitions: Map<string, FacetDefinition>;
  facetSchemas: Map<string, FacetSchema>;
  facetAssignments: Map<string, FacetAssignment>;
  templatePacks: Map<string, TemplatePack>;
  geneTemplates: Map<string, GeneTemplate>;
  speciesGroups: Map<string, SpeciesGroup>;
  speciesGroupMemberships: Map<string, SpeciesGroupMembership>;
  speciesGroupRelations: Map<string, SpeciesGroupRelation>;
  atlases: Map<string, Atlas>;
  graphBridges: Map<string, GraphBridge>;
  designContexts: Map<string, DesignContext>;
  contextFacts: Map<string, ContextFact>;
  designPrinciples: Map<string, DesignPrinciple>;
  contextMotifs: Map<string, ContextMotif>;
  contextReferences: Map<string, ContextReference>;
  contextReviewRubrics: Map<string, ContextReviewRubric>;
  contextAttachments: Map<string, ContextAttachment>;
  contextPolicies: Map<string, ContextPolicy>;
  nodes: Map<string, SpeciesNode>;
  nodeVersions: Map<string, NodeVersion>;
  edges: Map<string, EvolutionEdge>;
  edgeVersions: Map<string, EdgeVersion>;
  phenotypes: Map<string, Phenotype>;
  phenotypeVersions: Map<string, PhenotypeVersion>;
  speciesCompileArtifacts: Map<string, SpeciesCompileArtifact>;
  phenotypeCompileArtifacts: Map<string, PhenotypeCompileArtifact>;
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
  proposals: Map<string, Proposal>;
}

export class InMemoryDnaStore implements DnaServiceStore {
  private state: MemoryState = createState();
  readonly graphs: GraphRepository;
  readonly facetDefinitions: FacetDefinitionRepository;
  readonly facetSchemas: FacetSchemaRepository;
  readonly facetAssignments: FacetAssignmentRepository;
  readonly templates: TemplateRepository;
  readonly speciesGroups: SpeciesGroupRepository;
  readonly speciesGroupMemberships: SpeciesGroupMembershipRepository;
  readonly speciesGroupRelations: SpeciesGroupRelationRepository;
  readonly atlases: AtlasRepository;
  readonly graphBridges: GraphBridgeRepository;
  readonly designContexts: DesignContextRepository;
  readonly contextFacts: ContextFactRepository;
  readonly designPrinciples: DesignPrincipleRepository;
  readonly contextMotifs: ContextMotifRepository;
  readonly contextReferences: ContextReferenceRepository;
  readonly contextReviewRubrics: ContextReviewRubricRepository;
  readonly contextAttachments: ContextAttachmentRepository;
  readonly contextPolicies: ContextPolicyRepository;
  readonly nodes: LineageRepository;
  readonly nodeVersions: NodeVersionRepository;
  readonly edges: EdgeRepository;
  readonly edgeVersions: EdgeVersionRepository;
  readonly phenotypes: PhenotypeRepository;
  readonly phenotypeVersions: PhenotypeVersionRepository;
  readonly speciesCompileArtifacts: SpeciesCompileArtifactRepository;
  readonly phenotypeCompileArtifacts: PhenotypeCompileArtifactRepository;
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
  readonly proposals: ProposalRepository;

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
    this.facetDefinitions = {
      create: (definition) => this.state.facetDefinitions.set(definition.facetId, definition),
      update: (definition) => this.state.facetDefinitions.set(definition.facetId, definition),
      get: (facetId) => this.state.facetDefinitions.get(facetId),
      list: () => [...this.state.facetDefinitions.values()]
    };
    this.facetSchemas = {
      create: (schema) => this.state.facetSchemas.set(schema.facetSchemaId, schema),
      update: (schema) => this.state.facetSchemas.set(schema.facetSchemaId, schema),
      get: (facetSchemaId) => this.state.facetSchemas.get(facetSchemaId),
      list: () => [...this.state.facetSchemas.values()]
    };
    this.facetAssignments = {
      create: (assignment) => this.state.facetAssignments.set(assignment.assignmentId, assignment),
      update: (assignment) => this.state.facetAssignments.set(assignment.assignmentId, assignment),
      get: (assignmentId) => this.state.facetAssignments.get(assignmentId),
      list: () => [...this.state.facetAssignments.values()],
      listByTarget: (targetType, targetId) =>
        [...this.state.facetAssignments.values()].filter(
          (assignment) => assignment.targetType === targetType && assignment.targetId === targetId
        )
    };
    this.templates = {
      createPack: (pack) => this.state.templatePacks.set(pack.templatePackId, pack),
      createTemplate: (template) => this.state.geneTemplates.set(template.templateId, template),
      getTemplate: (templateId) => this.state.geneTemplates.get(templateId),
      listTemplates: () => [...this.state.geneTemplates.values()],
      listPacks: () => [...this.state.templatePacks.values()]
    };
    this.speciesGroups = {
      create: (group) => this.state.speciesGroups.set(group.groupId, group),
      update: (group) => this.state.speciesGroups.set(group.groupId, group),
      get: (groupId) => this.state.speciesGroups.get(groupId),
      listByGraph: (graphId) => [...this.state.speciesGroups.values()].filter((group) => group.graphId === graphId)
    };
    this.speciesGroupMemberships = {
      create: (membership) => this.state.speciesGroupMemberships.set(membership.membershipId, membership),
      update: (membership) => this.state.speciesGroupMemberships.set(membership.membershipId, membership),
      get: (membershipId) => this.state.speciesGroupMemberships.get(membershipId),
      listByGraph: (graphId) => [...this.state.speciesGroupMemberships.values()].filter((membership) => membership.graphId === graphId),
      listByGroup: (groupId) => [...this.state.speciesGroupMemberships.values()].filter((membership) => membership.groupId === groupId),
      listByNode: (nodeId) => [...this.state.speciesGroupMemberships.values()].filter((membership) => membership.nodeId === nodeId)
    };
    this.speciesGroupRelations = {
      create: (relation) => this.state.speciesGroupRelations.set(relation.relationId, relation),
      update: (relation) => this.state.speciesGroupRelations.set(relation.relationId, relation),
      get: (relationId) => this.state.speciesGroupRelations.get(relationId),
      listByGraph: (graphId) => [...this.state.speciesGroupRelations.values()].filter((relation) => relation.graphId === graphId)
    };
    this.atlases = {
      create: (atlas) => this.state.atlases.set(atlas.atlasId, atlas),
      update: (atlas) => this.state.atlases.set(atlas.atlasId, atlas),
      get: (atlasId) => this.state.atlases.get(atlasId),
      list: () => [...this.state.atlases.values()]
    };
    this.graphBridges = {
      create: (bridge) => this.state.graphBridges.set(bridge.bridgeId, bridge),
      update: (bridge) => this.state.graphBridges.set(bridge.bridgeId, bridge),
      get: (bridgeId) => this.state.graphBridges.get(bridgeId),
      listByAtlas: (atlasId) => [...this.state.graphBridges.values()].filter((bridge) => bridge.atlasId === atlasId),
      listByGraph: (graphId) =>
        [...this.state.graphBridges.values()].filter((bridge) => bridge.sourceGraphId === graphId || bridge.targetGraphId === graphId)
    };
    this.designContexts = {
      create: (context) => this.state.designContexts.set(context.contextId, context),
      update: (context) => this.state.designContexts.set(context.contextId, context),
      get: (contextId) => this.state.designContexts.get(contextId),
      list: () => [...this.state.designContexts.values()]
    };
    this.contextFacts = {
      create: (fact) => this.state.contextFacts.set(fact.factId, fact),
      update: (fact) => this.state.contextFacts.set(fact.factId, fact),
      get: (factId) => this.state.contextFacts.get(factId),
      list: () => [...this.state.contextFacts.values()]
    };
    this.designPrinciples = {
      create: (principle) => this.state.designPrinciples.set(principle.principleId, principle),
      update: (principle) => this.state.designPrinciples.set(principle.principleId, principle),
      get: (principleId) => this.state.designPrinciples.get(principleId),
      list: () => [...this.state.designPrinciples.values()]
    };
    this.contextMotifs = {
      create: (motif) => this.state.contextMotifs.set(motif.motifId, motif),
      update: (motif) => this.state.contextMotifs.set(motif.motifId, motif),
      get: (motifId) => this.state.contextMotifs.get(motifId),
      list: () => [...this.state.contextMotifs.values()]
    };
    this.contextReferences = {
      create: (reference) => this.state.contextReferences.set(reference.referenceId, reference),
      update: (reference) => this.state.contextReferences.set(reference.referenceId, reference),
      get: (referenceId) => this.state.contextReferences.get(referenceId),
      list: () => [...this.state.contextReferences.values()]
    };
    this.contextReviewRubrics = {
      create: (rubric) => this.state.contextReviewRubrics.set(rubric.rubricId, rubric),
      update: (rubric) => this.state.contextReviewRubrics.set(rubric.rubricId, rubric),
      get: (rubricId) => this.state.contextReviewRubrics.get(rubricId),
      list: () => [...this.state.contextReviewRubrics.values()]
    };
    this.contextAttachments = {
      create: (attachment) => this.state.contextAttachments.set(attachment.attachmentId, attachment),
      update: (attachment) => this.state.contextAttachments.set(attachment.attachmentId, attachment),
      get: (attachmentId) => this.state.contextAttachments.get(attachmentId),
      list: () => [...this.state.contextAttachments.values()],
      listByContext: (contextId) => [...this.state.contextAttachments.values()].filter((attachment) => attachment.contextId === contextId),
      listByTarget: (targetType, targetId) =>
        [...this.state.contextAttachments.values()].filter(
          (attachment) => attachment.targetType === targetType && attachment.targetId === targetId
        )
    };
    this.contextPolicies = {
      create: (policy) => this.state.contextPolicies.set(policy.policyId, policy),
      update: (policy) => this.state.contextPolicies.set(policy.policyId, policy),
      get: (policyId) => this.state.contextPolicies.get(policyId),
      list: () => [...this.state.contextPolicies.values()],
      listByContext: (contextId) => [...this.state.contextPolicies.values()].filter((policy) => policy.contextId === contextId)
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
      updateStatus: (phenotypeVersionId, status) => {
        const current = this.state.phenotypeVersions.get(phenotypeVersionId);
        if (!current) throw new Error(`phenotype version not found: ${phenotypeVersionId}`);
        assertCanTransitionStatus("phenotype-version", current.status, status);
        this.state.phenotypeVersions.set(phenotypeVersionId, { ...current, status });
      },
      get: (phenotypeVersionId) => this.state.phenotypeVersions.get(phenotypeVersionId),
      listByPhenotype: (phenotypeId) => [...this.state.phenotypeVersions.values()].filter((version) => version.phenotypeId === phenotypeId),
      listByNode: (nodeId) => [...this.state.phenotypeVersions.values()].filter((version) => version.nodeId === nodeId)
    };
    this.speciesCompileArtifacts = {
      create: (artifact) => this.state.speciesCompileArtifacts.set(artifact.artifactId, artifact),
      get: (artifactId) => this.state.speciesCompileArtifacts.get(artifactId),
      listByGraph: (graphId) => [...this.state.speciesCompileArtifacts.values()].filter((artifact) => artifact.graphId === graphId),
      listByNode: (nodeId) => [...this.state.speciesCompileArtifacts.values()].filter((artifact) => artifact.speciesNodeId === nodeId)
    };
    this.phenotypeCompileArtifacts = {
      create: (artifact) => this.state.phenotypeCompileArtifacts.set(artifact.artifactId, artifact),
      get: (artifactId) => this.state.phenotypeCompileArtifacts.get(artifactId),
      listByGraph: (graphId) => [...this.state.phenotypeCompileArtifacts.values()].filter((artifact) => artifact.graphId === graphId),
      listByNode: (nodeId) => [...this.state.phenotypeCompileArtifacts.values()].filter((artifact) => artifact.speciesNodeId === nodeId),
      listBySpeciesArtifact: (speciesCompileArtifactId) =>
        [...this.state.phenotypeCompileArtifacts.values()].filter(
          (artifact) => artifact.speciesCompileArtifactId === speciesCompileArtifactId
        )
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
      get: (changeSetId) => this.state.changeSets.get(changeSetId),
      list: () => [...this.state.changeSets.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    };
    this.proposals = {
      create: (proposal) => this.state.proposals.set(proposal.proposalId, proposal),
      update: (proposal) => this.state.proposals.set(proposal.proposalId, proposal),
      get: (proposalId) => this.state.proposals.get(proposalId),
      list: () => [...this.state.proposals.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
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

  previewGraphReset(graphId: string): GraphResetSummary {
    return summarizeMemoryGraphReset(this.state, graphId);
  }

  resetGraph(graphId: string): GraphResetSummary {
    return this.transaction(() => {
      const summary = summarizeMemoryGraphReset(this.state, graphId);
      applyMemoryGraphReset(this.state, graphId);
      return summary;
    });
  }

  close(): void {}
}

export function createInMemoryDnaStore(options?: InMemoryStoreOptions): InMemoryDnaStore {
  return new InMemoryDnaStore(options);
}

function createState(): MemoryState {
  return {
    graphs: new Map(),
    facetDefinitions: new Map(),
    facetSchemas: new Map(),
    facetAssignments: new Map(),
    templatePacks: new Map(),
    geneTemplates: new Map(),
    speciesGroups: new Map(),
    speciesGroupMemberships: new Map(),
    speciesGroupRelations: new Map(),
    atlases: new Map(),
    graphBridges: new Map(),
    designContexts: new Map(),
    contextFacts: new Map(),
    designPrinciples: new Map(),
    contextMotifs: new Map(),
    contextReferences: new Map(),
    contextReviewRubrics: new Map(),
    contextAttachments: new Map(),
    contextPolicies: new Map(),
    nodes: new Map(),
    nodeVersions: new Map(),
    edges: new Map(),
    edgeVersions: new Map(),
    phenotypes: new Map(),
    phenotypeVersions: new Map(),
    speciesCompileArtifacts: new Map(),
    phenotypeCompileArtifacts: new Map(),
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
    changeSets: new Map(),
    proposals: new Map()
  };
}

function cloneState(state: MemoryState): MemoryState {
  return {
    graphs: new Map(state.graphs),
    facetDefinitions: new Map(state.facetDefinitions),
    facetSchemas: new Map(state.facetSchemas),
    facetAssignments: new Map(state.facetAssignments),
    templatePacks: new Map(state.templatePacks),
    geneTemplates: new Map(state.geneTemplates),
    speciesGroups: new Map(state.speciesGroups),
    speciesGroupMemberships: new Map(state.speciesGroupMemberships),
    speciesGroupRelations: new Map(state.speciesGroupRelations),
    atlases: new Map(state.atlases),
    graphBridges: new Map(state.graphBridges),
    designContexts: new Map(state.designContexts),
    contextFacts: new Map(state.contextFacts),
    designPrinciples: new Map(state.designPrinciples),
    contextMotifs: new Map(state.contextMotifs),
    contextReferences: new Map(state.contextReferences),
    contextReviewRubrics: new Map(state.contextReviewRubrics),
    contextAttachments: new Map(state.contextAttachments),
    contextPolicies: new Map(state.contextPolicies),
    nodes: new Map(state.nodes),
    nodeVersions: new Map(state.nodeVersions),
    edges: new Map(state.edges),
    edgeVersions: new Map(state.edgeVersions),
    phenotypes: new Map(state.phenotypes),
    phenotypeVersions: new Map(state.phenotypeVersions),
    speciesCompileArtifacts: new Map(state.speciesCompileArtifacts),
    phenotypeCompileArtifacts: new Map(state.phenotypeCompileArtifacts),
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
    changeSets: new Map(state.changeSets),
    proposals: new Map(state.proposals)
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

function summarizeMemoryGraphReset(state: MemoryState, graphId: string): GraphResetSummary {
  const ids = collectMemoryGraphResetIds(state, graphId);
  const counts = resetCounts({
    graphs: state.graphs.has(graphId) ? 1 : 0,
    nodes: ids.nodeIds.size,
    nodeVersions: ids.nodeVersionIds.size,
    edges: ids.edgeIds.size,
    edgeVersions: ids.edgeVersionIds.size,
    speciesGroups: ids.groupIds.size,
    speciesGroupMemberships: ids.membershipIds.size,
    speciesGroupRelations: ids.relationIds.size,
    speciesCompileArtifacts: ids.speciesArtifactIds.size,
    phenotypeCompileArtifacts: ids.phenotypeArtifactIds.size,
    phenotypes: ids.phenotypeIds.size,
    phenotypeVersions: ids.phenotypeVersionIds.size,
    phenotypeVersionAssets: ids.phenotypeVersionAssetLinks,
    assets: ids.assetIds.size,
    generationJobs: ids.generationJobIds.size,
    outputReferences: ids.outputReferenceIds.size,
    reviewRecords: ids.reviewRecordIds.size,
    impactRecords: ids.impactRecordIds.size,
    graphBridges: ids.graphBridgeIds.size,
    atlasGraphLinks: ids.atlasIds.size,
    phenotypeLibraryGraphBindings: ids.libraryBindingIds.size,
    phenotypeLibraryGraphIds: ids.libraryIds.size,
    contextAttachments: ids.contextAttachmentIds.size,
    changeSets: ids.changeSetIds.size,
    proposals: ids.proposalIds.size
  });
  return { graphId, exists: state.graphs.has(graphId), counts, warnings: [], externalAssetsTouched: false };
}

function applyMemoryGraphReset(state: MemoryState, graphId: string) {
  const ids = collectMemoryGraphResetIds(state, graphId);
  for (const id of ids.proposalIds) state.proposals.delete(id);
  for (const id of ids.contextAttachmentIds) state.contextAttachments.delete(id);
  for (const id of ids.changeSetIds) state.changeSets.delete(id);
  for (const id of ids.assetIds) state.assets.delete(id);
  for (const id of ids.outputReferenceIds) state.outputReferences.delete(id);
  for (const id of ids.generationJobIds) state.generationJobs.delete(id);
  for (const id of ids.reviewRecordIds) state.reviews.delete(id);
  for (const id of ids.impactRecordIds) state.impacts.delete(id);
  for (const id of ids.phenotypeVersionIds) state.phenotypeVersions.delete(id);
  for (const id of ids.phenotypeIds) state.phenotypes.delete(id);
  for (const id of ids.speciesArtifactIds) state.speciesCompileArtifacts.delete(id);
  for (const id of ids.phenotypeArtifactIds) state.phenotypeCompileArtifacts.delete(id);
  for (const id of ids.nodeVersionIds) state.nodeVersions.delete(id);
  for (const id of ids.edgeVersionIds) state.edgeVersions.delete(id);
  for (const id of ids.edgeIds) state.edges.delete(id);
  for (const id of ids.membershipIds) state.speciesGroupMemberships.delete(id);
  for (const id of ids.relationIds) state.speciesGroupRelations.delete(id);
  for (const id of ids.groupIds) state.speciesGroups.delete(id);
  for (const id of ids.graphBridgeIds) state.graphBridges.delete(id);
  for (const atlasId of ids.atlasIds) {
    const atlas = state.atlases.get(atlasId);
    if (atlas) state.atlases.set(atlasId, { ...atlas, graphIds: atlas.graphIds.filter((id) => id !== graphId), updatedAt: new Date().toISOString() });
  }
  for (const bindingId of ids.libraryBindingIds) state.phenotypeLibraryGraphBindings.delete(bindingId);
  for (const libraryId of ids.libraryIds) {
    const library = state.phenotypeLibraries.get(libraryId);
    if (library) {
      state.phenotypeLibraries.set(libraryId, {
        ...library,
        graphIds: library.graphIds.filter((id) => id !== graphId),
        updatedAt: new Date().toISOString()
      });
    }
  }
  state.graphs.delete(graphId);
  for (const id of ids.nodeIds) state.nodes.delete(id);
}

function collectMemoryGraphResetIds(state: MemoryState, graphId: string) {
  const nodeIds = new Set([...state.nodes.values()].filter((node) => node.graphId === graphId).map((node) => node.nodeId));
  const edgeIds = new Set([...state.edges.values()].filter((edge) => edge.graphId === graphId).map((edge) => edge.edgeId));
  const groupIds = new Set([...state.speciesGroups.values()].filter((group) => group.graphId === graphId).map((group) => group.groupId));
  const membershipIds = new Set(
    [...state.speciesGroupMemberships.values()].filter((membership) => membership.graphId === graphId).map((membership) => membership.membershipId)
  );
  const relationIds = new Set([...state.speciesGroupRelations.values()].filter((relation) => relation.graphId === graphId).map((relation) => relation.relationId));
  const phenotypeIds = new Set([...state.phenotypes.values()].filter((phenotype) => phenotype.graphId === graphId).map((phenotype) => phenotype.phenotypeId));
  const phenotypeVersionIds = new Set(
    [...state.phenotypeVersions.values()].filter((version) => version.graphId === graphId).map((version) => version.phenotypeVersionId)
  );
  const nodeVersionIds = new Set([...state.nodeVersions.values()].filter((version) => version.graphId === graphId).map((version) => version.nodeVersionId));
  const edgeVersionIds = new Set([...state.edgeVersions.values()].filter((version) => version.graphId === graphId).map((version) => version.edgeVersionId));
  const speciesArtifactIds = new Set(
    [...state.speciesCompileArtifacts.values()].filter((artifact) => artifact.graphId === graphId).map((artifact) => artifact.artifactId)
  );
  const phenotypeArtifactIds = new Set(
    [...state.phenotypeCompileArtifacts.values()].filter((artifact) => artifact.graphId === graphId).map((artifact) => artifact.artifactId)
  );
  const generationJobIds = new Set([...state.generationJobs.values()].filter((job) => job.graphId === graphId).map((job) => job.generationJobId));
  const outputReferenceIds = new Set(
    [...state.outputReferences.values()].filter((reference) => reference.graphId === graphId).map((reference) => reference.outputReferenceId)
  );
  const reviewRecordIds = new Set([...state.reviews.values()].filter((review) => review.graphId === graphId).map((review) => review.reviewRecordId));
  const impactRecordIds = new Set([...state.impacts.values()].filter((impact) => impact.graphId === graphId).map((impact) => impact.impactRecordId));
  const graphBridgeIds = new Set(
    [...state.graphBridges.values()]
      .filter((bridge) => bridge.sourceGraphId === graphId || bridge.targetGraphId === graphId)
      .map((bridge) => bridge.bridgeId)
  );
  const atlasIds = new Set([...state.atlases.values()].filter((atlas) => atlas.graphIds.includes(graphId)).map((atlas) => atlas.atlasId));
  const libraryBindingIds = new Set(
    [...state.phenotypeLibraryGraphBindings.values()].filter((binding) => binding.graphId === graphId).map((binding) => binding.bindingId)
  );
  const libraryIds = new Set([...state.phenotypeLibraries.values()].filter((library) => library.graphIds.includes(graphId)).map((library) => library.libraryId));
  const deletedObjectIds = new Set([
    graphId,
    ...nodeIds,
    ...edgeIds,
    ...groupIds,
    ...membershipIds,
    ...relationIds,
    ...phenotypeIds,
    ...phenotypeVersionIds,
    ...speciesArtifactIds,
    ...phenotypeArtifactIds,
    ...generationJobIds,
    ...graphBridgeIds
  ]);
  const assetIds = new Set([...state.assets.values()].filter((asset) => deletedObjectIds.has(asset.linkedObjectId)).map((asset) => asset.assetId));
  const contextAttachmentIds = new Set(
    [...state.contextAttachments.values()].filter((attachment) => deletedObjectIds.has(attachment.targetId)).map((attachment) => attachment.attachmentId)
  );
  const changeSetIds = new Set(
    [...state.changeSets.values()]
      .filter((changeSet) => changeSetTouchesGraph(changeSet, graphId, deletedObjectIds))
      .map((changeSet) => changeSet.changeSetId)
  );
  const proposalIds = new Set(
    [...state.proposals.values()]
      .filter((proposal) => proposal.changeSetIds.some((changeSetId) => changeSetIds.has(changeSetId)))
      .map((proposal) => proposal.proposalId)
  );
  const phenotypeVersionAssetLinks = [...state.phenotypeVersions.values()]
    .filter((version) => phenotypeVersionIds.has(version.phenotypeVersionId))
    .reduce((total, version) => total + version.assetIds.length, 0);
  return {
    nodeIds,
    nodeVersionIds,
    edgeIds,
    edgeVersionIds,
    groupIds,
    membershipIds,
    relationIds,
    speciesArtifactIds,
    phenotypeArtifactIds,
    phenotypeIds,
    phenotypeVersionIds,
    phenotypeVersionAssetLinks,
    assetIds,
    generationJobIds,
    outputReferenceIds,
    reviewRecordIds,
    impactRecordIds,
    graphBridgeIds,
    atlasIds,
    libraryBindingIds,
    libraryIds,
    contextAttachmentIds,
    changeSetIds,
    proposalIds
  };
}

function resetCounts(counts: Record<string, number>) {
  return counts;
}

function changeSetTouchesGraph(changeSet: ChangeSet, graphId: string, deletedObjectIds: Set<string>): boolean {
  const payload = changeSet.payload as Record<string, unknown>;
  const graph = payload.graph as Graph | undefined;
  const node = payload.node as SpeciesNode | undefined;
  const edge = payload.edge as EvolutionEdge | undefined;
  const group = payload.group as SpeciesGroup | undefined;
  const membership = payload.membership as SpeciesGroupMembership | undefined;
  const relation = payload.relation as SpeciesGroupRelation | undefined;
  const atlas = payload.atlas as Atlas | undefined;
  const bridge = payload.bridge as GraphBridge | undefined;
  const attachment = payload.attachment as ContextAttachment | undefined;
  return Boolean(
    graph?.graphId === graphId ||
      node?.graphId === graphId ||
      edge?.graphId === graphId ||
      group?.graphId === graphId ||
      membership?.graphId === graphId ||
      relation?.graphId === graphId ||
      atlas?.graphIds?.includes(graphId) ||
      bridge?.sourceGraphId === graphId ||
      bridge?.targetGraphId === graphId ||
      (attachment && deletedObjectIds.has(attachment.targetId))
  );
}
