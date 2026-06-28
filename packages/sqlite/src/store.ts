import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  Atlas,
  assertCanTransitionStatus,
  AssetIndex,
  ChangeSet,
  ContextAttachment,
  ContextFact,
  ContextMotif,
  ContextPolicy,
  ContextReference,
  ContextReviewRubric,
  createImpactRecord,
  DesignContext,
  DesignPrinciple,
  DesignRelationship,
  EntityCompileArtifact,
  ExternalLibraryMapping,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  GeneTemplate,
  GenerationJob,
  Graph,
  ImpactRecord,
  LibraryRoutingPolicy,
  NodeVersion,
  OutputReference,
  Phenotype,
  PhenotypeGenerationPlan,
  PhenotypeGenerationTask,
  PhenotypeCompileArtifact,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  PROJECT_VERSION,
  PhenotypeVersion,
  Proposal,
  ReviewRecord,
  SpeciesGroup,
  SpeciesCompileArtifact,
  SpeciesGroupMembership,
  SpeciesNode,
  StorageMount,
  TemplatePack
} from "@dna/core";
import {
  AtlasRepository,
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
  DesignRelationshipRepository,
  EntityCompileArtifactRepository,
  ExternalLibraryMappingRepository,
  FacetAssignmentRepository,
  FacetDefinitionRepository,
  FacetSchemaRepository,
  GenerationJobRepository,
  GraphRepository,
  GraphResetSummary,
  ImpactRepository,
  LibraryRoutingPolicyRepository,
  LineageRepository,
  NodeVersionRepository,
  OutputReferenceRepository,
  PhenotypeGenerationPlanRepository,
  PhenotypeGenerationTaskRepository,
  PhenotypeRepository,
  PhenotypeCompileArtifactRepository,
  PhenotypeLibraryGraphBindingRepository,
  PhenotypeLibraryRepository,
  PhenotypeVersionRepository,
  ProposalRepository,
  ReviewRepository,
  SearchRepository,
  SpeciesGroupMembershipRepository,
  SpeciesGroupRepository,
  SpeciesCompileArtifactRepository,
  StorageMountRepository,
  StorageEngine,
  TemplateRepository
} from "@dna/storage";

type Row = Record<string, unknown>;

export const DNA_EXCHANGE_VERSION = "1.0.0";

export const SQLITE_COMPATIBILITY_TABLES = ["node_relations", "phenotype_types"] as const;

export const RUNTIME_SQLITE_TABLES = [
  "graphs",
  "facet_definitions",
  "facet_schemas",
  "facet_assignments",
  "template_packs",
  "gene_templates",
  "species_groups",
  "species_group_memberships",
  "design_relationships",
  "atlases",
  "design_contexts",
  "context_facts",
  "design_principles",
  "context_motifs",
  "context_references",
  "context_review_rubrics",
  "context_attachments",
  "context_policies",
  "nodes",
  "node_versions",
  "node_relations",
  "phenotype_types",
  "phenotypes",
  "phenotype_versions",
  "phenotype_version_assets",
  "entity_compile_artifacts",
  "species_compile_artifacts",
  "phenotype_compile_artifacts",
  "assets",
  "output_references",
  "phenotype_libraries",
  "storage_mounts",
  "phenotype_library_graph_bindings",
  "external_library_mappings",
  "library_routing_policies",
  "generation_jobs",
  "phenotype_generation_plans",
  "phenotype_generation_tasks",
  "review_records",
  "impact_records",
  "tags",
  "object_tags",
  "change_sets",
  "proposals"
] as const;

const EXCHANGE_CAPABILITIES = [
  "change-sets",
  "proposals",
  "facets",
  "contexts",
  "templates",
  "libraries",
  "atlases",
  "design-relationships",
  "species-groups",
  "compile-artifacts",
  "generation-jobs",
  "generation-planning",
  "output-references",
  "reviews",
  "impacts"
];

interface ExchangeManifest {
  format: "dna.git-directory";
  version: string;
  projectVersion: string;
  exchangeVersion: string;
  capabilities: string[];
  exportProfile: ExportProfile;
  proposalId?: string;
  omitted?: {
    sections: string[];
    changeSetCount: number;
    proposalCount: number;
  };
  review?: {
    stage: "reviewed";
    cleanCurrentState: boolean;
  };
}

export type ExportProfile = "full" | "review-current" | "proposal-review";

export interface ExportProjectOptions {
  profile?: ExportProfile;
  proposalId?: string;
}

function createExchangeManifest(options: {
  profile: ExportProfile;
  proposalId?: string;
  omitted?: ExchangeManifest["omitted"];
  review?: ExchangeManifest["review"];
}): ExchangeManifest {
  return {
    format: "dna.git-directory",
    version: PROJECT_VERSION,
    projectVersion: PROJECT_VERSION,
    exchangeVersion: DNA_EXCHANGE_VERSION,
    capabilities: EXCHANGE_CAPABILITIES,
    exportProfile: options.profile,
    proposalId: options.proposalId,
    omitted: options.omitted,
    review: options.review
  };
}

function parsePayload<T>(row: Row | undefined): T | undefined {
  if (!row) return undefined;
  const payload = row.payload;
  return typeof payload === "string" ? (JSON.parse(payload) as T) : (payload as T);
}

function parseRows<T>(rows: Row[]): T[] {
  return rows.map((row) => parsePayload<T>(row)).filter((value): value is T => Boolean(value));
}

function relationshipEndpointId(endpoint: DesignRelationship["source"]): string {
  if (endpoint.type === "graph") return `graph:${endpoint.graphId}`;
  if (endpoint.type === "species-group") return `species-group:${endpoint.groupId}`;
  return `species-node:${endpoint.nodeId}`;
}

function sortOutputReferences(references: OutputReference[]): OutputReference[] {
  const rolePriority: Record<string, number> = {
    "primary-output": 0,
    preview: 1,
    candidate: 2,
    source: 3,
    reference: 4,
    "review-material": 5,
    "runtime-export": 6,
    "negative-example": 7
  };
  return references.sort((left, right) => {
    const byRole = (rolePriority[left.role] ?? 99) - (rolePriority[right.role] ?? 99);
    if (byRole !== 0) return byRole;
    const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
    if (byCreatedAt !== 0) return byCreatedAt;
    return left.outputReferenceId.localeCompare(right.outputReferenceId);
  });
}

function syncSqliteLibraryGraphId(store: SqliteDnaStore, libraryId: string, graphId: string): boolean {
  const library = store.phenotypeLibraries.get(libraryId);
  if (!library || library.graphIds.includes(graphId)) return false;
  store.phenotypeLibraries.update({
    ...library,
    graphIds: [...library.graphIds, graphId].sort(),
    updatedAt: new Date().toISOString()
  });
  return true;
}

function repairSqliteLibraryGraphIds(store: SqliteDnaStore): number {
  const rows = store.db
    .prepare("SELECT DISTINCT library_id, graph_id FROM phenotype_library_graph_bindings WHERE status != 'deleted' ORDER BY library_id, graph_id")
    .all() as Array<{ library_id: string; graph_id: string }>;
  let repaired = 0;
  for (const row of rows) {
    if (syncSqliteLibraryGraphId(store, row.library_id, row.graph_id)) repaired += 1;
  }
  return repaired;
}

export class SqliteDnaStore implements StorageEngine {
  readonly db: DatabaseSync;
  private transactionDepth = 0;
  readonly graphs: GraphRepository;
  readonly facetDefinitions: FacetDefinitionRepository;
  readonly facetSchemas: FacetSchemaRepository;
  readonly facetAssignments: FacetAssignmentRepository;
  readonly templates: TemplateRepository;
  readonly speciesGroups: SpeciesGroupRepository;
  readonly speciesGroupMemberships: SpeciesGroupMembershipRepository;
  readonly designRelationships: DesignRelationshipRepository;
  readonly atlases: AtlasRepository;
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
  readonly phenotypes: PhenotypeRepository;
  readonly phenotypeVersions: PhenotypeVersionRepository;
  readonly entityCompileArtifacts: EntityCompileArtifactRepository;
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
  readonly generationPlans: PhenotypeGenerationPlanRepository;
  readonly generationTasks: PhenotypeGenerationTaskRepository;
  readonly reviews: ReviewRepository;
  readonly impacts: ImpactRepository;
  readonly search: SearchRepository;
  readonly changeSets: ChangeSetRepository;
  readonly proposals: ProposalRepository;

  constructor(readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.graphs = new SqliteGraphRepository(this);
    this.facetDefinitions = new SqliteFacetDefinitionRepository(this);
    this.facetSchemas = new SqliteFacetSchemaRepository(this);
    this.facetAssignments = new SqliteFacetAssignmentRepository(this);
    this.templates = new SqliteTemplateRepository(this);
    this.speciesGroups = new SqliteSpeciesGroupRepository(this);
    this.speciesGroupMemberships = new SqliteSpeciesGroupMembershipRepository(this);
    this.designRelationships = new SqliteDesignRelationshipRepository(this);
    this.atlases = new SqliteAtlasRepository(this);
    this.designContexts = new SqliteDesignContextRepository(this);
    this.contextFacts = new SqliteContextFactRepository(this);
    this.designPrinciples = new SqliteDesignPrincipleRepository(this);
    this.contextMotifs = new SqliteContextMotifRepository(this);
    this.contextReferences = new SqliteContextReferenceRepository(this);
    this.contextReviewRubrics = new SqliteContextReviewRubricRepository(this);
    this.contextAttachments = new SqliteContextAttachmentRepository(this);
    this.contextPolicies = new SqliteContextPolicyRepository(this);
    this.nodes = new SqliteNodeRepository(this);
    this.nodeVersions = new SqliteNodeVersionRepository(this);
    this.phenotypes = new SqlitePhenotypeRepository(this);
    this.phenotypeVersions = new SqlitePhenotypeVersionRepository(this);
    this.entityCompileArtifacts = new SqliteEntityCompileArtifactRepository(this);
    this.speciesCompileArtifacts = new SqliteSpeciesCompileArtifactRepository(this);
    this.phenotypeCompileArtifacts = new SqlitePhenotypeCompileArtifactRepository(this);
    this.assets = new SqliteAssetRepository(this);
    this.outputReferences = new SqliteOutputReferenceRepository(this);
    this.phenotypeLibraries = new SqlitePhenotypeLibraryRepository(this);
    this.storageMounts = new SqliteStorageMountRepository(this);
    this.phenotypeLibraryGraphBindings = new SqlitePhenotypeLibraryGraphBindingRepository(this);
    this.externalLibraryMappings = new SqliteExternalLibraryMappingRepository(this);
    this.libraryRoutingPolicies = new SqliteLibraryRoutingPolicyRepository(this);
    this.generationJobs = new SqliteGenerationJobRepository(this);
    this.generationPlans = new SqlitePhenotypeGenerationPlanRepository(this);
    this.generationTasks = new SqlitePhenotypeGenerationTaskRepository(this);
    this.reviews = new SqliteReviewRepository(this);
    this.impacts = new SqliteImpactRepository(this);
    this.search = { assets: (filter) => this.assets.search(filter) };
    this.changeSets = new SqliteChangeSetRepository(this);
    this.proposals = new SqliteProposalRepository(this);
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS graphs (
        graph_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS facet_definitions (
        facet_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS facet_schemas (
        facet_schema_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS facet_assignments (
        assignment_id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS template_packs (
        template_pack_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS gene_templates (
        template_id TEXT PRIMARY KEY,
        template_pack_id TEXT,
        domain TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS species_groups (
        group_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        name TEXT NOT NULL,
        group_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS species_group_memberships (
        membership_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS design_relationships (
        relationship_id TEXT PRIMARY KEY,
        source_graph_id TEXT NOT NULL,
        target_graph_id TEXT NOT NULL,
        endpoint_level TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS atlases (
        atlas_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS design_contexts (
        context_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        context_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS context_facts (
        fact_id TEXT PRIMARY KEY,
        fact_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS design_principles (
        principle_id TEXT PRIMARY KEY,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS context_motifs (
        motif_id TEXT PRIMARY KEY,
        motif_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS context_references (
        reference_id TEXT PRIMARY KEY,
        reference_type TEXT NOT NULL,
        reference_role TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS context_review_rubrics (
        rubric_id TEXT PRIMARY KEY,
        dimension TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS context_attachments (
        attachment_id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS context_policies (
        policy_id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        attachment_id TEXT,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nodes (
        node_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS node_versions (
        node_version_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        graph_id TEXT NOT NULL,
        version TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS node_relations (
        relation_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        from_node_id TEXT NOT NULL,
        to_node_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_types (
        phenotype_type TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotypes (
        phenotype_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        phenotype_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_versions (
        phenotype_version_id TEXT PRIMARY KEY,
        phenotype_id TEXT NOT NULL,
        graph_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_version_assets (
        phenotype_version_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        variant_role TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (phenotype_version_id, asset_id)
      );
      CREATE TABLE IF NOT EXISTS entity_compile_artifacts (
        artifact_id TEXT PRIMARY KEY,
        target_level TEXT NOT NULL,
        target_object_id TEXT NOT NULL,
        graph_id TEXT,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS species_compile_artifacts (
        artifact_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        species_node_id TEXT NOT NULL,
        node_version_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_compile_artifacts (
        artifact_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        species_node_id TEXT NOT NULL,
        node_version_id TEXT NOT NULL,
        phenotype_type TEXT NOT NULL,
        species_compile_artifact_id TEXT,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assets (
        asset_id TEXT PRIMARY KEY,
        linked_object_type TEXT NOT NULL,
        linked_object_id TEXT NOT NULL,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS output_references (
        output_reference_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        phenotype_version_id TEXT NOT NULL,
        library_id TEXT,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        normalized_tags TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_libraries (
        library_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        profile TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS storage_mounts (
        mount_id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        adapter_kind TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_library_graph_bindings (
        binding_id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        graph_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS external_library_mappings (
        mapping_id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        mount_id TEXT NOT NULL,
        adapter_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS library_routing_policies (
        routing_policy_id TEXT PRIMARY KEY,
        library_id TEXT NOT NULL,
        priority INTEGER NOT NULL,
        status TEXT NOT NULL,
        target_mount_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS generation_jobs (
        generation_job_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_generation_plans (
        plan_id TEXT PRIMARY KEY,
        graph_id TEXT,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phenotype_generation_tasks (
        task_id TEXT PRIMARY KEY,
        plan_id TEXT,
        graph_id TEXT NOT NULL,
        node_id TEXT,
        phenotype_id TEXT,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS review_records (
        review_record_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS impact_records (
        impact_record_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        changed_object_type TEXT NOT NULL,
        changed_object_id TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tags (
        tag TEXT PRIMARY KEY,
        usage_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS object_tags (
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS change_sets (
        change_set_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        object_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT
      );
      CREATE TABLE IF NOT EXISTS proposals (
        proposal_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    repairSqliteLibraryGraphIds(this);
  }

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      return fn();
    }
    this.db.exec("BEGIN");
    this.transactionDepth += 1;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  previewGraphReset(graphId: string): GraphResetSummary {
    return summarizeSqliteGraphReset(this, graphId);
  }

  resetGraph(graphId: string): GraphResetSummary {
    return this.transaction(() => {
      const summary = summarizeSqliteGraphReset(this, graphId);
      applySqliteGraphReset(this, graphId);
      return summary;
    });
  }

  close(): void {
    this.db.close();
  }
}

function summarizeSqliteGraphReset(store: SqliteDnaStore, graphId: string): GraphResetSummary {
  const ids = collectSqliteGraphResetIds(store, graphId);
  return {
    graphId,
    exists: Boolean(store.graphs.get(graphId)),
    counts: {
      graphs: store.graphs.get(graphId) ? 1 : 0,
      nodes: ids.nodeIds.size,
      nodeVersions: ids.nodeVersionIds.size,
      designRelationships: ids.relationshipIds.size,
      speciesGroups: ids.groupIds.size,
      speciesGroupMemberships: ids.membershipIds.size,
      entityCompileArtifacts: ids.entityArtifactIds.size,
      speciesCompileArtifacts: ids.speciesArtifactIds.size,
      phenotypeCompileArtifacts: ids.phenotypeArtifactIds.size,
      phenotypes: ids.phenotypeIds.size,
      phenotypeVersions: ids.phenotypeVersionIds.size,
      phenotypeVersionAssets: ids.phenotypeVersionAssetLinks,
      assets: ids.assetIds.size,
      generationJobs: ids.generationJobIds.size,
      generationPlans: ids.generationPlanIds.size,
      generationTasks: ids.generationTaskIds.size,
      outputReferences: ids.outputReferenceIds.size,
      reviewRecords: ids.reviewRecordIds.size,
      impactRecords: ids.impactRecordIds.size,
      atlasGraphLinks: ids.atlasIds.size,
      phenotypeLibraryGraphBindings: ids.libraryBindingIds.size,
      phenotypeLibraryGraphIds: ids.libraryIds.size,
      contextAttachments: ids.contextAttachmentIds.size,
      changeSets: ids.changeSetIds.size,
      proposals: ids.proposalIds.size
    },
    warnings: [],
    externalAssetsTouched: false
  };
}

function applySqliteGraphReset(store: SqliteDnaStore, graphId: string) {
  const ids = collectSqliteGraphResetIds(store, graphId);
  deleteRowsByIds(store, "proposals", "proposal_id", ids.proposalIds);
  deleteRowsByIds(store, "context_attachments", "attachment_id", ids.contextAttachmentIds);
  deleteRowsByIds(store, "change_sets", "change_set_id", ids.changeSetIds);
  for (const assetId of ids.assetIds) {
    store.db.prepare("DELETE FROM object_tags WHERE object_type = 'asset' AND object_id = ?").run(assetId);
  }
  deleteRowsByIds(store, "phenotype_version_assets", "phenotype_version_id", ids.phenotypeVersionIds);
  deleteRowsByIds(store, "phenotype_version_assets", "asset_id", ids.assetIds);
  deleteRowsByIds(store, "assets", "asset_id", ids.assetIds);
  deleteRowsByIds(store, "output_references", "output_reference_id", ids.outputReferenceIds);
  deleteRowsByIds(store, "phenotype_generation_tasks", "task_id", ids.generationTaskIds);
  deleteRowsByIds(store, "phenotype_generation_plans", "plan_id", ids.generationPlanIds);
  deleteRowsByIds(store, "generation_jobs", "generation_job_id", ids.generationJobIds);
  deleteRowsByIds(store, "review_records", "review_record_id", ids.reviewRecordIds);
  deleteRowsByIds(store, "impact_records", "impact_record_id", ids.impactRecordIds);
  deleteRowsByIds(store, "phenotype_versions", "phenotype_version_id", ids.phenotypeVersionIds);
  deleteRowsByIds(store, "phenotypes", "phenotype_id", ids.phenotypeIds);
  deleteRowsByIds(store, "entity_compile_artifacts", "artifact_id", ids.entityArtifactIds);
  deleteRowsByIds(store, "species_compile_artifacts", "artifact_id", ids.speciesArtifactIds);
  deleteRowsByIds(store, "phenotype_compile_artifacts", "artifact_id", ids.phenotypeArtifactIds);
  deleteRowsByIds(store, "node_versions", "node_version_id", ids.nodeVersionIds);
  deleteRowsByIds(store, "design_relationships", "relationship_id", ids.relationshipIds);
  deleteRowsByIds(store, "species_group_memberships", "membership_id", ids.membershipIds);
  deleteRowsByIds(store, "species_groups", "group_id", ids.groupIds);
  for (const atlasId of ids.atlasIds) {
    const atlas = store.atlases.get(atlasId);
    if (atlas) store.atlases.update({ ...atlas, graphIds: atlas.graphIds.filter((id) => id !== graphId), updatedAt: new Date().toISOString() });
  }
  deleteRowsByIds(store, "phenotype_library_graph_bindings", "binding_id", ids.libraryBindingIds);
  for (const libraryId of ids.libraryIds) {
    const library = store.phenotypeLibraries.get(libraryId);
    if (library) {
      store.phenotypeLibraries.update({
        ...library,
        graphIds: library.graphIds.filter((id) => id !== graphId),
        updatedAt: new Date().toISOString()
      });
    }
  }
  deleteRowsByIds(store, "nodes", "node_id", ids.nodeIds);
  store.db.prepare("DELETE FROM graphs WHERE graph_id = ?").run(graphId);
}

function collectSqliteGraphResetIds(store: SqliteDnaStore, graphId: string) {
  const nodeIds = new Set(store.nodes.listByGraph(graphId).map((node) => node.nodeId));
  const relationshipIds = new Set(store.designRelationships.listByGraph(graphId).map((relationship) => relationship.relationshipId));
  const groupIds = new Set(store.speciesGroups.listByGraph(graphId).map((group) => group.groupId));
  const membershipIds = new Set(store.speciesGroupMemberships.listByGraph(graphId).map((membership) => membership.membershipId));
  const nodeVersionIds = new Set(
    parseRows<NodeVersion>(store.db.prepare("SELECT payload FROM node_versions WHERE graph_id = ?").all(graphId) as Row[]).map(
      (version) => version.nodeVersionId
    )
  );
  const speciesArtifactIds = new Set(store.speciesCompileArtifacts.listByGraph(graphId).map((artifact) => artifact.artifactId));
  const entityArtifactIds = new Set(store.entityCompileArtifacts.listByGraph(graphId).map((artifact) => artifact.artifactId));
  const phenotypeArtifactIds = new Set(store.phenotypeCompileArtifacts.listByGraph(graphId).map((artifact) => artifact.artifactId));
  const phenotypeIds = new Set(store.phenotypes.listByGraph(graphId).map((phenotype) => phenotype.phenotypeId));
  const phenotypeVersionRows = parseRows<PhenotypeVersion>(
    store.db.prepare("SELECT payload FROM phenotype_versions WHERE graph_id = ?").all(graphId) as Row[]
  );
  const phenotypeVersionIds = new Set(phenotypeVersionRows.map((version) => version.phenotypeVersionId));
  const phenotypeVersionAssetLinks = Number(
    store.db
      .prepare(`SELECT COUNT(*) AS count FROM phenotype_version_assets WHERE phenotype_version_id IN (${sqlPlaceholders(phenotypeVersionIds)})`)
      .get(...[...phenotypeVersionIds])?.count ?? 0
  );
  const generationJobIds = new Set(store.generationJobs.listByGraph(graphId).map((job) => job.generationJobId));
  const generationPlanIds = new Set(store.generationPlans.listByGraph(graphId).map((plan) => plan.planId));
  const generationTaskIds = new Set(store.generationTasks.listByGraph(graphId).map((task) => task.taskId));
  const outputReferenceIds = new Set(store.outputReferences.listByGraph(graphId).map((reference) => reference.outputReferenceId));
  const reviewRecordIds = new Set(store.reviews.listByGraph(graphId).map((review) => review.reviewRecordId));
  const impactRecordIds = new Set(store.impacts.listByGraph(graphId).map((impact) => impact.impactRecordId));
  const atlasIds = new Set(store.atlases.list().filter((atlas) => atlas.graphIds.includes(graphId)).map((atlas) => atlas.atlasId));
  const libraryBindingIds = new Set(store.phenotypeLibraryGraphBindings.listByGraph(graphId).map((binding) => binding.bindingId));
  const libraryIds = new Set(store.phenotypeLibraries.list().filter((library) => library.graphIds.includes(graphId)).map((library) => library.libraryId));
  const deletedObjectIds = new Set([
    graphId,
    ...nodeIds,
    ...relationshipIds,
    ...groupIds,
    ...membershipIds,
    ...phenotypeIds,
    ...phenotypeVersionIds,
    ...entityArtifactIds,
    ...speciesArtifactIds,
    ...phenotypeArtifactIds,
    ...generationJobIds,
    ...generationPlanIds,
    ...generationTaskIds
  ]);
  const allAssets = parseRows<AssetIndex>(store.db.prepare("SELECT payload FROM assets ORDER BY created_at, asset_id").all() as Row[]);
  const assetIds = new Set(allAssets.filter((asset) => deletedObjectIds.has(asset.linkedObjectId)).map((asset) => asset.assetId));
  const contextAttachmentIds = new Set(
    store.contextAttachments.list().filter((attachment) => deletedObjectIds.has(attachment.targetId)).map((attachment) => attachment.attachmentId)
  );
  const changeSetIds = new Set(
    store.changeSets
      .list()
      .filter((changeSet) => changeSetTouchesResetGraph(changeSet, graphId, deletedObjectIds))
      .map((changeSet) => changeSet.changeSetId)
  );
  const proposalIds = new Set(
    store.proposals
      .list()
      .filter((proposal) => proposal.changeSetIds.some((changeSetId) => changeSetIds.has(changeSetId)))
      .map((proposal) => proposal.proposalId)
  );
  return {
    nodeIds,
    relationshipIds,
    groupIds,
    membershipIds,
    nodeVersionIds,
    entityArtifactIds,
    speciesArtifactIds,
    phenotypeArtifactIds,
    phenotypeIds,
    phenotypeVersionIds,
    phenotypeVersionAssetLinks,
    generationJobIds,
    generationPlanIds,
    generationTaskIds,
    outputReferenceIds,
    reviewRecordIds,
    impactRecordIds,
    atlasIds,
    libraryBindingIds,
    libraryIds,
    assetIds,
    contextAttachmentIds,
    changeSetIds,
    proposalIds
  };
}

function changeSetTouchesResetGraph(changeSet: ChangeSet, graphId: string, deletedObjectIds: Set<string>): boolean {
  const payload = changeSet.payload as Record<string, unknown>;
  const graph = payload.graph as Graph | undefined;
  const node = payload.node as SpeciesNode | undefined;
  const relationship = payload.relationship as DesignRelationship | undefined;
  const group = payload.group as SpeciesGroup | undefined;
  const membership = payload.membership as SpeciesGroupMembership | undefined;
  const atlas = payload.atlas as Atlas | undefined;
  const attachment = payload.attachment as ContextAttachment | undefined;
  return Boolean(
    graph?.graphId === graphId ||
      node?.graphId === graphId ||
      relationshipEndpointGraphIds(relationship).includes(graphId) ||
      group?.graphId === graphId ||
      membership?.graphId === graphId ||
      atlas?.graphIds?.includes(graphId) ||
      (attachment && deletedObjectIds.has(attachment.targetId))
  );
}

function relationshipEndpointGraphIds(relationship: DesignRelationship | undefined): string[] {
  if (!relationship) return [];
  return [relationship.source.graphId, relationship.target.graphId];
}

function deleteRowsByIds(store: SqliteDnaStore, table: string, column: string, ids: Set<string>) {
  if (ids.size === 0) return;
  const statement = store.db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`);
  for (const id of ids) statement.run(id);
}

function sqlPlaceholders(ids: Set<string>) {
  return ids.size === 0 ? "NULL" : [...ids].map(() => "?").join(", ");
}

class SqliteGraphRepository implements GraphRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(graph: Graph) {
    this.store.db
      .prepare("INSERT INTO graphs (graph_id, name, status, current_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(graph.graphId, graph.name, graph.status, graph.currentVersion, JSON.stringify(graph), graph.createdAt, graph.updatedAt);
  }
  get(graphId: string) {
    return parsePayload<Graph>(this.store.db.prepare("SELECT payload FROM graphs WHERE graph_id = ?").get(graphId) as Row | undefined);
  }
  list() {
    return parseRows<Graph>(this.store.db.prepare("SELECT payload FROM graphs ORDER BY created_at, graph_id").all() as Row[]);
  }
  update(graph: Graph) {
    this.store.db
      .prepare("UPDATE graphs SET name = ?, status = ?, current_version = ?, payload = ?, updated_at = ? WHERE graph_id = ?")
      .run(graph.name, graph.status, graph.currentVersion, JSON.stringify(graph), graph.updatedAt, graph.graphId);
  }
  archive(graphId: string) {
    const graph = this.get(graphId);
    if (!graph) return;
    this.update({ ...graph, status: "archived", updatedAt: new Date().toISOString() });
  }
}

class SqliteFacetDefinitionRepository implements FacetDefinitionRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(definition: FacetDefinition) {
    this.store.db
      .prepare("INSERT INTO facet_definitions (facet_id, name, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(definition.facetId, definition.name, definition.status, JSON.stringify(definition), definition.createdAt, definition.updatedAt);
  }
  update(definition: FacetDefinition) {
    this.store.db
      .prepare("UPDATE facet_definitions SET name = ?, status = ?, payload = ?, updated_at = ? WHERE facet_id = ?")
      .run(definition.name, definition.status, JSON.stringify(definition), definition.updatedAt, definition.facetId);
  }
  get(facetId: string) {
    return parsePayload<FacetDefinition>(
      this.store.db.prepare("SELECT payload FROM facet_definitions WHERE facet_id = ?").get(facetId) as Row | undefined
    );
  }
  list() {
    return parseRows<FacetDefinition>(
      this.store.db.prepare("SELECT payload FROM facet_definitions ORDER BY created_at, rowid").all() as Row[]
    );
  }
}

class SqliteFacetSchemaRepository implements FacetSchemaRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(schema: FacetSchema) {
    this.store.db
      .prepare("INSERT INTO facet_schemas (facet_schema_id, name, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(schema.facetSchemaId, schema.name, schema.status, JSON.stringify(schema), schema.createdAt, schema.updatedAt);
  }
  update(schema: FacetSchema) {
    this.store.db
      .prepare("UPDATE facet_schemas SET name = ?, status = ?, payload = ?, updated_at = ? WHERE facet_schema_id = ?")
      .run(schema.name, schema.status, JSON.stringify(schema), schema.updatedAt, schema.facetSchemaId);
  }
  get(facetSchemaId: string) {
    return parsePayload<FacetSchema>(
      this.store.db.prepare("SELECT payload FROM facet_schemas WHERE facet_schema_id = ?").get(facetSchemaId) as Row | undefined
    );
  }
  list() {
    return parseRows<FacetSchema>(
      this.store.db.prepare("SELECT payload FROM facet_schemas ORDER BY created_at, rowid").all() as Row[]
    );
  }
}

class SqliteFacetAssignmentRepository implements FacetAssignmentRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(assignment: FacetAssignment) {
    this.store.db
      .prepare(
        "INSERT INTO facet_assignments (assignment_id, target_type, target_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        assignment.assignmentId,
        assignment.targetType,
        assignment.targetId,
        assignment.status,
        JSON.stringify(assignment),
        assignment.createdAt,
        assignment.updatedAt
      );
  }
  update(assignment: FacetAssignment) {
    this.store.db
      .prepare("UPDATE facet_assignments SET target_type = ?, target_id = ?, status = ?, payload = ?, updated_at = ? WHERE assignment_id = ?")
      .run(assignment.targetType, assignment.targetId, assignment.status, JSON.stringify(assignment), assignment.updatedAt, assignment.assignmentId);
  }
  get(assignmentId: string) {
    return parsePayload<FacetAssignment>(
      this.store.db.prepare("SELECT payload FROM facet_assignments WHERE assignment_id = ?").get(assignmentId) as Row | undefined
    );
  }
  list() {
    return parseRows<FacetAssignment>(
      this.store.db.prepare("SELECT payload FROM facet_assignments ORDER BY created_at, rowid").all() as Row[]
    );
  }
  listByTarget(targetType: string, targetId: string) {
    return parseRows<FacetAssignment>(
      this.store.db
        .prepare("SELECT payload FROM facet_assignments WHERE target_type = ? AND target_id = ? ORDER BY created_at, rowid")
        .all(targetType, targetId) as Row[]
    );
  }
}

class SqliteTemplateRepository implements TemplateRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  createPack(pack: TemplatePack) {
    this.store.db
      .prepare("INSERT OR REPLACE INTO template_packs (template_pack_id, name, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(pack.templatePackId, pack.name, pack.status, JSON.stringify(pack), pack.createdAt, pack.updatedAt);
  }
  createTemplate(template: GeneTemplate) {
    this.store.db
      .prepare("INSERT OR REPLACE INTO gene_templates (template_id, template_pack_id, domain, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(template.templateId, template.templatePackId ?? null, template.domain, template.status, JSON.stringify(template), template.createdAt, template.updatedAt);
  }
  getTemplate(templateId: string) {
    return parsePayload<GeneTemplate>(this.store.db.prepare("SELECT payload FROM gene_templates WHERE template_id = ?").get(templateId) as Row | undefined);
  }
  listTemplates() {
    return parseRows<GeneTemplate>(this.store.db.prepare("SELECT payload FROM gene_templates ORDER BY template_id").all() as Row[]);
  }
  listPacks() {
    return parseRows<TemplatePack>(this.store.db.prepare("SELECT payload FROM template_packs ORDER BY template_pack_id").all() as Row[]);
  }
}

class SqliteSpeciesGroupRepository implements SpeciesGroupRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(group: SpeciesGroup) {
    this.store.db
      .prepare("INSERT INTO species_groups (group_id, graph_id, name, group_type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(group.groupId, group.graphId, group.name, group.groupType, group.status, JSON.stringify(group), group.createdAt, group.updatedAt);
  }
  update(group: SpeciesGroup) {
    this.store.db
      .prepare("UPDATE species_groups SET name = ?, group_type = ?, status = ?, payload = ?, updated_at = ? WHERE group_id = ?")
      .run(group.name, group.groupType, group.status, JSON.stringify(group), group.updatedAt, group.groupId);
  }
  get(groupId: string) {
    return parsePayload<SpeciesGroup>(this.store.db.prepare("SELECT payload FROM species_groups WHERE group_id = ?").get(groupId) as Row | undefined);
  }
  listByGraph(graphId: string) {
    return parseRows<SpeciesGroup>(
      this.store.db.prepare("SELECT payload FROM species_groups WHERE graph_id = ? ORDER BY created_at, rowid").all(graphId) as Row[]
    );
  }
}

class SqliteSpeciesGroupMembershipRepository implements SpeciesGroupMembershipRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(membership: SpeciesGroupMembership) {
    this.store.db
      .prepare(
        "INSERT INTO species_group_memberships (membership_id, graph_id, group_id, node_id, role, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        membership.membershipId,
        membership.graphId,
        membership.groupId,
        membership.nodeId,
        membership.role,
        membership.status,
        JSON.stringify(membership),
        membership.createdAt,
        membership.updatedAt
      );
  }
  update(membership: SpeciesGroupMembership) {
    this.store.db
      .prepare("UPDATE species_group_memberships SET role = ?, status = ?, payload = ?, updated_at = ? WHERE membership_id = ?")
      .run(membership.role, membership.status, JSON.stringify(membership), membership.updatedAt, membership.membershipId);
  }
  get(membershipId: string) {
    return parsePayload<SpeciesGroupMembership>(
      this.store.db.prepare("SELECT payload FROM species_group_memberships WHERE membership_id = ?").get(membershipId) as Row | undefined
    );
  }
  listByGraph(graphId: string) {
    return parseRows<SpeciesGroupMembership>(
      this.store.db
        .prepare("SELECT payload FROM species_group_memberships WHERE graph_id = ? ORDER BY created_at, rowid")
        .all(graphId) as Row[]
    );
  }
  listByGroup(groupId: string) {
    return parseRows<SpeciesGroupMembership>(
      this.store.db
        .prepare("SELECT payload FROM species_group_memberships WHERE group_id = ? ORDER BY created_at, rowid")
        .all(groupId) as Row[]
    );
  }
  listByNode(nodeId: string) {
    return parseRows<SpeciesGroupMembership>(
      this.store.db
        .prepare("SELECT payload FROM species_group_memberships WHERE node_id = ? ORDER BY created_at, rowid")
        .all(nodeId) as Row[]
    );
  }
}

class SqliteAtlasRepository implements AtlasRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(atlas: Atlas) {
    this.store.db
      .prepare("INSERT INTO atlases (atlas_id, name, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(atlas.atlasId, atlas.name, atlas.status, JSON.stringify(atlas), atlas.createdAt, atlas.updatedAt);
  }
  update(atlas: Atlas) {
    this.store.db
      .prepare("UPDATE atlases SET name = ?, status = ?, payload = ?, updated_at = ? WHERE atlas_id = ?")
      .run(atlas.name, atlas.status, JSON.stringify(atlas), atlas.updatedAt, atlas.atlasId);
  }
  get(atlasId: string) {
    return parsePayload<Atlas>(this.store.db.prepare("SELECT payload FROM atlases WHERE atlas_id = ?").get(atlasId) as Row | undefined);
  }
  list() {
    return parseRows<Atlas>(this.store.db.prepare("SELECT payload FROM atlases ORDER BY created_at, rowid").all() as Row[]);
  }
}

class SqliteDesignRelationshipRepository implements DesignRelationshipRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(relationship: DesignRelationship) {
    this.store.db
      .prepare(
        "INSERT INTO design_relationships (relationship_id, source_graph_id, target_graph_id, endpoint_level, relationship_type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        relationship.relationshipId,
        relationship.source.graphId,
        relationship.target.graphId,
        relationship.source.type,
        relationship.relationshipType,
        relationship.status,
        JSON.stringify(relationship),
        relationship.createdAt,
        relationship.updatedAt
      );
  }
  update(relationship: DesignRelationship) {
    this.store.db
      .prepare(
        "UPDATE design_relationships SET source_graph_id = ?, target_graph_id = ?, endpoint_level = ?, relationship_type = ?, status = ?, payload = ?, updated_at = ? WHERE relationship_id = ?"
      )
      .run(
        relationship.source.graphId,
        relationship.target.graphId,
        relationship.source.type,
        relationship.relationshipType,
        relationship.status,
        JSON.stringify(relationship),
        relationship.updatedAt,
        relationship.relationshipId
      );
  }
  get(relationshipId: string) {
    return parsePayload<DesignRelationship>(
      this.store.db.prepare("SELECT payload FROM design_relationships WHERE relationship_id = ?").get(relationshipId) as Row | undefined
    );
  }
  list() {
    return parseRows<DesignRelationship>(
      this.store.db.prepare("SELECT payload FROM design_relationships ORDER BY created_at, relationship_id").all() as Row[]
    );
  }
  listByGraph(graphId: string) {
    return parseRows<DesignRelationship>(
      this.store.db
        .prepare("SELECT payload FROM design_relationships WHERE source_graph_id = ? OR target_graph_id = ? ORDER BY created_at, relationship_id")
        .all(graphId, graphId) as Row[]
    );
  }
  listByEndpoint(type: DesignRelationship["source"]["type"], id: string) {
    return this.list().filter(
      (relationship) => relationshipEndpointId(relationship.source) === `${type}:${id}` || relationshipEndpointId(relationship.target) === `${type}:${id}`
    );
  }
}

class SqliteDesignContextRepository implements DesignContextRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(context: DesignContext) {
    this.store.db
      .prepare("INSERT INTO design_contexts (context_id, name, context_type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(context.contextId, context.name, context.contextType, context.status, JSON.stringify(context), context.createdAt, context.updatedAt);
  }
  update(context: DesignContext) {
    this.store.db
      .prepare("UPDATE design_contexts SET name = ?, context_type = ?, status = ?, payload = ?, updated_at = ? WHERE context_id = ?")
      .run(context.name, context.contextType, context.status, JSON.stringify(context), context.updatedAt, context.contextId);
  }
  get(contextId: string) {
    return parsePayload<DesignContext>(this.store.db.prepare("SELECT payload FROM design_contexts WHERE context_id = ?").get(contextId) as Row | undefined);
  }
  list() {
    return parseRows<DesignContext>(this.store.db.prepare("SELECT payload FROM design_contexts ORDER BY created_at, rowid").all() as Row[]);
  }
}

class SqliteContextFactRepository implements ContextFactRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(fact: ContextFact) {
    this.store.db
      .prepare("INSERT INTO context_facts (fact_id, fact_type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(fact.factId, fact.factType, fact.status, JSON.stringify(fact), fact.createdAt, fact.updatedAt);
  }
  update(fact: ContextFact) {
    this.store.db
      .prepare("UPDATE context_facts SET fact_type = ?, status = ?, payload = ?, updated_at = ? WHERE fact_id = ?")
      .run(fact.factType, fact.status, JSON.stringify(fact), fact.updatedAt, fact.factId);
  }
  get(factId: string) {
    return parsePayload<ContextFact>(this.store.db.prepare("SELECT payload FROM context_facts WHERE fact_id = ?").get(factId) as Row | undefined);
  }
  list() {
    return parseRows<ContextFact>(this.store.db.prepare("SELECT payload FROM context_facts ORDER BY created_at, rowid").all() as Row[]);
  }
}

class SqliteDesignPrincipleRepository implements DesignPrincipleRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(principle: DesignPrinciple) {
    this.store.db
      .prepare("INSERT INTO design_principles (principle_id, priority, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(principle.principleId, principle.priority, principle.status, JSON.stringify(principle), principle.createdAt, principle.updatedAt);
  }
  update(principle: DesignPrinciple) {
    this.store.db
      .prepare("UPDATE design_principles SET priority = ?, status = ?, payload = ?, updated_at = ? WHERE principle_id = ?")
      .run(principle.priority, principle.status, JSON.stringify(principle), principle.updatedAt, principle.principleId);
  }
  get(principleId: string) {
    return parsePayload<DesignPrinciple>(
      this.store.db.prepare("SELECT payload FROM design_principles WHERE principle_id = ?").get(principleId) as Row | undefined
    );
  }
  list() {
    return parseRows<DesignPrinciple>(this.store.db.prepare("SELECT payload FROM design_principles ORDER BY created_at, rowid").all() as Row[]);
  }
}

class SqliteContextMotifRepository implements ContextMotifRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(motif: ContextMotif) {
    this.store.db
      .prepare("INSERT INTO context_motifs (motif_id, motif_type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(motif.motifId, motif.motifType, motif.status, JSON.stringify(motif), motif.createdAt, motif.updatedAt);
  }
  update(motif: ContextMotif) {
    this.store.db
      .prepare("UPDATE context_motifs SET motif_type = ?, status = ?, payload = ?, updated_at = ? WHERE motif_id = ?")
      .run(motif.motifType, motif.status, JSON.stringify(motif), motif.updatedAt, motif.motifId);
  }
  get(motifId: string) {
    return parsePayload<ContextMotif>(this.store.db.prepare("SELECT payload FROM context_motifs WHERE motif_id = ?").get(motifId) as Row | undefined);
  }
  list() {
    return parseRows<ContextMotif>(this.store.db.prepare("SELECT payload FROM context_motifs ORDER BY created_at, rowid").all() as Row[]);
  }
}

class SqliteContextReferenceRepository implements ContextReferenceRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(reference: ContextReference) {
    this.store.db
      .prepare(
        "INSERT INTO context_references (reference_id, reference_type, reference_role, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        reference.referenceId,
        reference.referenceType,
        reference.referenceRole,
        reference.status,
        JSON.stringify(reference),
        reference.createdAt,
        reference.updatedAt
      );
  }
  update(reference: ContextReference) {
    this.store.db
      .prepare("UPDATE context_references SET reference_type = ?, reference_role = ?, status = ?, payload = ?, updated_at = ? WHERE reference_id = ?")
      .run(reference.referenceType, reference.referenceRole, reference.status, JSON.stringify(reference), reference.updatedAt, reference.referenceId);
  }
  get(referenceId: string) {
    return parsePayload<ContextReference>(
      this.store.db.prepare("SELECT payload FROM context_references WHERE reference_id = ?").get(referenceId) as Row | undefined
    );
  }
  list() {
    return parseRows<ContextReference>(
      this.store.db.prepare("SELECT payload FROM context_references ORDER BY created_at, rowid").all() as Row[]
    );
  }
}

class SqliteContextReviewRubricRepository implements ContextReviewRubricRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(rubric: ContextReviewRubric) {
    this.store.db
      .prepare(
        "INSERT INTO context_review_rubrics (rubric_id, dimension, severity, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(rubric.rubricId, rubric.dimension, rubric.severity, rubric.status, JSON.stringify(rubric), rubric.createdAt, rubric.updatedAt);
  }
  update(rubric: ContextReviewRubric) {
    this.store.db
      .prepare("UPDATE context_review_rubrics SET dimension = ?, severity = ?, status = ?, payload = ?, updated_at = ? WHERE rubric_id = ?")
      .run(rubric.dimension, rubric.severity, rubric.status, JSON.stringify(rubric), rubric.updatedAt, rubric.rubricId);
  }
  get(rubricId: string) {
    return parsePayload<ContextReviewRubric>(
      this.store.db.prepare("SELECT payload FROM context_review_rubrics WHERE rubric_id = ?").get(rubricId) as Row | undefined
    );
  }
  list() {
    return parseRows<ContextReviewRubric>(
      this.store.db.prepare("SELECT payload FROM context_review_rubrics ORDER BY created_at, rowid").all() as Row[]
    );
  }
}

class SqliteContextAttachmentRepository implements ContextAttachmentRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(attachment: ContextAttachment) {
    this.store.db
      .prepare(
        "INSERT INTO context_attachments (attachment_id, context_id, target_type, target_id, role, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        attachment.attachmentId,
        attachment.contextId,
        attachment.targetType,
        attachment.targetId,
        attachment.role,
        attachment.status,
        JSON.stringify(attachment),
        attachment.createdAt,
        attachment.updatedAt
      );
  }
  update(attachment: ContextAttachment) {
    this.store.db
      .prepare("UPDATE context_attachments SET target_type = ?, target_id = ?, role = ?, status = ?, payload = ?, updated_at = ? WHERE attachment_id = ?")
      .run(
        attachment.targetType,
        attachment.targetId,
        attachment.role,
        attachment.status,
        JSON.stringify(attachment),
        attachment.updatedAt,
        attachment.attachmentId
      );
  }
  get(attachmentId: string) {
    return parsePayload<ContextAttachment>(
      this.store.db.prepare("SELECT payload FROM context_attachments WHERE attachment_id = ?").get(attachmentId) as Row | undefined
    );
  }
  list() {
    return parseRows<ContextAttachment>(
      this.store.db.prepare("SELECT payload FROM context_attachments ORDER BY created_at, rowid").all() as Row[]
    );
  }
  listByContext(contextId: string) {
    return parseRows<ContextAttachment>(
      this.store.db.prepare("SELECT payload FROM context_attachments WHERE context_id = ? ORDER BY created_at, rowid").all(contextId) as Row[]
    );
  }
  listByTarget(targetType: string, targetId: string) {
    return parseRows<ContextAttachment>(
      this.store.db
        .prepare("SELECT payload FROM context_attachments WHERE target_type = ? AND target_id = ? ORDER BY created_at, rowid")
        .all(targetType, targetId) as Row[]
    );
  }
}

class SqliteContextPolicyRepository implements ContextPolicyRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(policy: ContextPolicy) {
    this.store.db
      .prepare("INSERT INTO context_policies (policy_id, context_id, attachment_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(policy.policyId, policy.contextId, policy.attachmentId ?? null, policy.status, JSON.stringify(policy), policy.createdAt, policy.updatedAt);
  }
  update(policy: ContextPolicy) {
    this.store.db
      .prepare("UPDATE context_policies SET attachment_id = ?, status = ?, payload = ?, updated_at = ? WHERE policy_id = ?")
      .run(policy.attachmentId ?? null, policy.status, JSON.stringify(policy), policy.updatedAt, policy.policyId);
  }
  get(policyId: string) {
    return parsePayload<ContextPolicy>(this.store.db.prepare("SELECT payload FROM context_policies WHERE policy_id = ?").get(policyId) as Row | undefined);
  }
  list() {
    return parseRows<ContextPolicy>(this.store.db.prepare("SELECT payload FROM context_policies ORDER BY created_at, rowid").all() as Row[]);
  }
  listByContext(contextId: string) {
    return parseRows<ContextPolicy>(
      this.store.db.prepare("SELECT payload FROM context_policies WHERE context_id = ? ORDER BY created_at, rowid").all(contextId) as Row[]
    );
  }
}

class SqliteNodeRepository implements LineageRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(node: SpeciesNode) {
    this.store.db
      .prepare("INSERT INTO nodes (node_id, graph_id, name, status, current_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(node.nodeId, node.graphId, node.name, node.status, node.currentVersion, JSON.stringify(node), node.createdAt, node.updatedAt);
  }
  update(node: SpeciesNode) {
    this.store.db
      .prepare("UPDATE nodes SET name = ?, status = ?, current_version = ?, payload = ?, updated_at = ? WHERE node_id = ?")
      .run(node.name, node.status, node.currentVersion, JSON.stringify(node), node.updatedAt, node.nodeId);
  }
  get(nodeId: string) {
    return parsePayload<SpeciesNode>(this.store.db.prepare("SELECT payload FROM nodes WHERE node_id = ?").get(nodeId) as Row | undefined);
  }
  listByGraph(graphId: string) {
    return parseRows<SpeciesNode>(this.store.db.prepare("SELECT payload FROM nodes WHERE graph_id = ? ORDER BY created_at, node_id").all(graphId) as Row[]);
  }
}

class SqliteNodeVersionRepository implements NodeVersionRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(version: NodeVersion) {
    this.store.db
      .prepare("INSERT INTO node_versions (node_version_id, node_id, graph_id, version, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(version.nodeVersionId, version.nodeId, version.graphId, version.version, JSON.stringify(version), version.createdAt);
  }
  get(nodeVersionId: string) {
    return parsePayload<NodeVersion>(this.store.db.prepare("SELECT payload FROM node_versions WHERE node_version_id = ?").get(nodeVersionId) as Row | undefined);
  }
  listByNode(nodeId: string) {
    return parseRows<NodeVersion>(this.store.db.prepare("SELECT payload FROM node_versions WHERE node_id = ? ORDER BY created_at").all(nodeId) as Row[]);
  }
}

class SqlitePhenotypeRepository implements PhenotypeRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(phenotype: Phenotype) {
    this.store.db
      .prepare("INSERT INTO phenotypes (phenotype_id, graph_id, node_id, phenotype_type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(phenotype.phenotypeId, phenotype.graphId, phenotype.nodeId, phenotype.phenotypeType, phenotype.status, JSON.stringify(phenotype), phenotype.createdAt, phenotype.updatedAt);
  }
  update(phenotype: Phenotype) {
    this.store.db
      .prepare("UPDATE phenotypes SET status = ?, payload = ?, updated_at = ? WHERE phenotype_id = ?")
      .run(phenotype.status, JSON.stringify(phenotype), phenotype.updatedAt, phenotype.phenotypeId);
  }
  get(phenotypeId: string) {
    return parsePayload<Phenotype>(this.store.db.prepare("SELECT payload FROM phenotypes WHERE phenotype_id = ?").get(phenotypeId) as Row | undefined);
  }
  listByGraph(graphId: string) {
    return parseRows<Phenotype>(this.store.db.prepare("SELECT payload FROM phenotypes WHERE graph_id = ? ORDER BY created_at, phenotype_id").all(graphId) as Row[]);
  }
}

class SqlitePhenotypeVersionRepository implements PhenotypeVersionRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(version: PhenotypeVersion) {
    this.store.db
      .prepare("INSERT INTO phenotype_versions (phenotype_version_id, phenotype_id, graph_id, node_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(version.phenotypeVersionId, version.phenotypeId, version.graphId, version.nodeId, version.status, JSON.stringify(version), version.createdAt);
    for (const assetId of version.assetIds) {
      this.store.db
        .prepare("INSERT OR REPLACE INTO phenotype_version_assets (phenotype_version_id, asset_id, variant_role, payload) VALUES (?, ?, ?, ?)")
        .run(version.phenotypeVersionId, assetId, null, JSON.stringify({ phenotypeVersionId: version.phenotypeVersionId, assetId }));
    }
  }
  updateStatus(phenotypeVersionId: string, status: PhenotypeVersion["status"]) {
    const current = this.get(phenotypeVersionId);
    if (!current) throw new Error(`phenotype version not found: ${phenotypeVersionId}`);
    assertCanTransitionStatus("phenotype-version", current.status, status);
    const next = { ...current, status };
    this.store.db
      .prepare("UPDATE phenotype_versions SET status = ?, payload = ? WHERE phenotype_version_id = ?")
      .run(status, JSON.stringify(next), phenotypeVersionId);
  }
  get(phenotypeVersionId: string) {
    return parsePayload<PhenotypeVersion>(this.store.db.prepare("SELECT payload FROM phenotype_versions WHERE phenotype_version_id = ?").get(phenotypeVersionId) as Row | undefined);
  }
  listByPhenotype(phenotypeId: string) {
    return parseRows<PhenotypeVersion>(this.store.db.prepare("SELECT payload FROM phenotype_versions WHERE phenotype_id = ? ORDER BY created_at").all(phenotypeId) as Row[]);
  }
  listByNode(nodeId: string) {
    return parseRows<PhenotypeVersion>(this.store.db.prepare("SELECT payload FROM phenotype_versions WHERE node_id = ? ORDER BY created_at").all(nodeId) as Row[]);
  }
}

class SqliteEntityCompileArtifactRepository implements EntityCompileArtifactRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(artifact: EntityCompileArtifact) {
    this.store.db
      .prepare(
        "INSERT INTO entity_compile_artifacts (artifact_id, target_level, target_object_id, graph_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        artifact.artifactId,
        artifact.targetLevel,
        artifact.target.objectId,
        artifact.graphId ?? null,
        JSON.stringify(artifact),
        artifact.createdAt
      );
  }
  get(artifactId: string) {
    return parsePayload<EntityCompileArtifact>(
      this.store.db.prepare("SELECT payload FROM entity_compile_artifacts WHERE artifact_id = ?").get(artifactId) as Row | undefined
    );
  }
  listByGraph(graphId: string) {
    return parseRows<EntityCompileArtifact>(
      this.store.db
        .prepare("SELECT payload FROM entity_compile_artifacts WHERE graph_id = ? ORDER BY created_at, artifact_id")
        .all(graphId) as Row[]
    );
  }
  listByTarget(targetLevel: EntityCompileArtifact["targetLevel"], objectId: string) {
    return parseRows<EntityCompileArtifact>(
      this.store.db
        .prepare(
          "SELECT payload FROM entity_compile_artifacts WHERE target_level = ? AND target_object_id = ? ORDER BY created_at, artifact_id"
        )
        .all(targetLevel, objectId) as Row[]
    );
  }
}

class SqliteSpeciesCompileArtifactRepository implements SpeciesCompileArtifactRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(artifact: SpeciesCompileArtifact) {
    this.store.db
      .prepare(
        "INSERT INTO species_compile_artifacts (artifact_id, graph_id, species_node_id, node_version_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        artifact.artifactId,
        artifact.graphId,
        artifact.speciesNodeId,
        artifact.nodeVersionId,
        JSON.stringify(artifact),
        artifact.createdAt
      );
  }
  get(artifactId: string) {
    return parsePayload<SpeciesCompileArtifact>(
      this.store.db.prepare("SELECT payload FROM species_compile_artifacts WHERE artifact_id = ?").get(artifactId) as Row | undefined
    );
  }
  listByGraph(graphId: string) {
    return parseRows<SpeciesCompileArtifact>(
      this.store.db.prepare("SELECT payload FROM species_compile_artifacts WHERE graph_id = ? ORDER BY created_at, artifact_id").all(graphId) as Row[]
    );
  }
  listByNode(nodeId: string) {
    return parseRows<SpeciesCompileArtifact>(
      this.store.db
        .prepare("SELECT payload FROM species_compile_artifacts WHERE species_node_id = ? ORDER BY created_at, artifact_id")
        .all(nodeId) as Row[]
    );
  }
}

class SqlitePhenotypeCompileArtifactRepository implements PhenotypeCompileArtifactRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(artifact: PhenotypeCompileArtifact) {
    this.store.db
      .prepare(
        "INSERT INTO phenotype_compile_artifacts (artifact_id, graph_id, species_node_id, node_version_id, phenotype_type, species_compile_artifact_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        artifact.artifactId,
        artifact.graphId,
        artifact.speciesNodeId,
        artifact.nodeVersionId,
        artifact.phenotypeType,
        artifact.speciesCompileArtifactId ?? null,
        JSON.stringify(artifact),
        artifact.createdAt
      );
  }
  get(artifactId: string) {
    return parsePayload<PhenotypeCompileArtifact>(
      this.store.db.prepare("SELECT payload FROM phenotype_compile_artifacts WHERE artifact_id = ?").get(artifactId) as Row | undefined
    );
  }
  listByGraph(graphId: string) {
    return parseRows<PhenotypeCompileArtifact>(
      this.store.db.prepare("SELECT payload FROM phenotype_compile_artifacts WHERE graph_id = ? ORDER BY created_at, artifact_id").all(graphId) as Row[]
    );
  }
  listByNode(nodeId: string) {
    return parseRows<PhenotypeCompileArtifact>(
      this.store.db
        .prepare("SELECT payload FROM phenotype_compile_artifacts WHERE species_node_id = ? ORDER BY created_at, artifact_id")
        .all(nodeId) as Row[]
    );
  }
  listBySpeciesArtifact(speciesCompileArtifactId: string) {
    return parseRows<PhenotypeCompileArtifact>(
      this.store.db
        .prepare(
          "SELECT payload FROM phenotype_compile_artifacts WHERE species_compile_artifact_id = ? ORDER BY created_at, artifact_id"
        )
        .all(speciesCompileArtifactId) as Row[]
    );
  }
}

class SqliteAssetRepository implements AssetRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(asset: AssetIndex) {
    this.store.db
      .prepare("INSERT INTO assets (asset_id, linked_object_type, linked_object_id, status, tags, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(asset.assetId, asset.linkedObjectType, asset.linkedObjectId, asset.status, JSON.stringify(asset.tags), JSON.stringify(asset), asset.createdAt, asset.updatedAt);
    for (const tag of asset.tags) {
      this.store.db.prepare("INSERT OR IGNORE INTO tags (tag, usage_count) VALUES (?, 0)").run(tag);
      this.store.db.prepare("UPDATE tags SET usage_count = usage_count + 1 WHERE tag = ?").run(tag);
      this.store.db.prepare("INSERT INTO object_tags (object_type, object_id, tag, created_at) VALUES (?, ?, ?, ?)").run("asset", asset.assetId, tag, asset.createdAt);
    }
  }
  update(asset: AssetIndex) {
    this.store.db
      .prepare("UPDATE assets SET status = ?, tags = ?, payload = ?, updated_at = ? WHERE asset_id = ?")
      .run(asset.status, JSON.stringify(asset.tags), JSON.stringify(asset), asset.updatedAt, asset.assetId);
  }
  get(assetId: string) {
    return parsePayload<AssetIndex>(this.store.db.prepare("SELECT payload FROM assets WHERE asset_id = ?").get(assetId) as Row | undefined);
  }
  search(filter: { graphId?: string; linkedObjectId?: string; tag?: string; status?: string }) {
    let assets = parseRows<AssetIndex>(this.store.db.prepare("SELECT payload FROM assets ORDER BY created_at, asset_id").all() as Row[]);
    if (filter.linkedObjectId) assets = assets.filter((asset) => asset.linkedObjectId === filter.linkedObjectId);
    if (filter.status) assets = assets.filter((asset) => asset.status === filter.status);
    if (filter.tag) assets = assets.filter((asset) => asset.tags.includes(filter.tag!));
    if (filter.graphId) {
      const nodeIds = new Set(this.store.nodes.listByGraph(filter.graphId).map((node) => node.nodeId));
      const phenotypes = this.store.phenotypes.listByGraph(filter.graphId);
      const phenotypeIds = new Set(phenotypes.map((phenotype) => phenotype.phenotypeId));
      const phenotypeVersionIds = new Set(
        phenotypes.flatMap((phenotype) =>
          this.store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId).map((version) => version.phenotypeVersionId)
        )
      );
      assets = assets.filter(
        (asset) =>
          nodeIds.has(asset.linkedObjectId) ||
          phenotypeIds.has(asset.linkedObjectId) ||
          phenotypeVersionIds.has(asset.linkedObjectId)
      );
    }
    return assets;
  }
}

class SqliteOutputReferenceRepository implements OutputReferenceRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(reference: OutputReference) {
    this.store.db
      .prepare(
        "INSERT INTO output_references (output_reference_id, graph_id, phenotype_version_id, library_id, status, tags, normalized_tags, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        reference.outputReferenceId,
        reference.graphId,
        reference.phenotypeVersionId,
        reference.libraryId ?? null,
        reference.status,
        JSON.stringify(reference.tags),
        JSON.stringify(reference.normalizedTags),
        JSON.stringify(reference),
        reference.createdAt,
        reference.updatedAt
      );
  }
  update(reference: OutputReference) {
    this.store.db
      .prepare(
        "UPDATE output_references SET library_id = ?, status = ?, tags = ?, normalized_tags = ?, payload = ?, updated_at = ? WHERE output_reference_id = ?"
      )
      .run(
        reference.libraryId ?? null,
        reference.status,
        JSON.stringify(reference.tags),
        JSON.stringify(reference.normalizedTags),
        JSON.stringify(reference),
        reference.updatedAt,
        reference.outputReferenceId
      );
  }
  get(outputReferenceId: string) {
    return parsePayload<OutputReference>(
      this.store.db.prepare("SELECT payload FROM output_references WHERE output_reference_id = ?").get(outputReferenceId) as
        | Row
        | undefined
    );
  }
  listByPhenotypeVersion(phenotypeVersionId: string) {
    return sortOutputReferences(
      parseRows<OutputReference>(
        this.store.db
          .prepare("SELECT payload FROM output_references WHERE phenotype_version_id = ? ORDER BY created_at, output_reference_id")
          .all(phenotypeVersionId) as Row[]
      )
    );
  }
  listByGraph(graphId: string) {
    return sortOutputReferences(
      parseRows<OutputReference>(
        this.store.db.prepare("SELECT payload FROM output_references WHERE graph_id = ? ORDER BY created_at, output_reference_id").all(graphId) as Row[]
      )
    );
  }
  search(filter: { graphId?: string; phenotypeVersionId?: string; libraryId?: string; tag?: string; status?: string }) {
    let references = parseRows<OutputReference>(
      this.store.db.prepare("SELECT payload FROM output_references ORDER BY created_at, output_reference_id").all() as Row[]
    );
    if (filter.graphId) references = references.filter((reference) => reference.graphId === filter.graphId);
    if (filter.phenotypeVersionId) {
      references = references.filter((reference) => reference.phenotypeVersionId === filter.phenotypeVersionId);
    }
    if (filter.libraryId) references = references.filter((reference) => reference.libraryId === filter.libraryId);
    if (filter.status) references = references.filter((reference) => reference.status === filter.status);
    if (filter.tag) {
      references = references.filter(
        (reference) => reference.tags.includes(filter.tag!) || reference.normalizedTags.includes(filter.tag!)
      );
    }
    return sortOutputReferences(references);
  }
}

class SqlitePhenotypeLibraryRepository implements PhenotypeLibraryRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(library: PhenotypeLibrary) {
    this.store.db
      .prepare("INSERT INTO phenotype_libraries (library_id, name, profile, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(library.libraryId, library.name, library.profile, library.status, JSON.stringify(library), library.createdAt, library.updatedAt);
  }
  update(library: PhenotypeLibrary) {
    this.store.db
      .prepare("UPDATE phenotype_libraries SET name = ?, profile = ?, status = ?, payload = ?, updated_at = ? WHERE library_id = ?")
      .run(library.name, library.profile, library.status, JSON.stringify(library), library.updatedAt, library.libraryId);
  }
  get(libraryId: string) {
    return parsePayload<PhenotypeLibrary>(
      this.store.db.prepare("SELECT payload FROM phenotype_libraries WHERE library_id = ?").get(libraryId) as Row | undefined
    );
  }
  list() {
    return parseRows<PhenotypeLibrary>(
      this.store.db.prepare("SELECT payload FROM phenotype_libraries ORDER BY created_at, library_id").all() as Row[]
    );
  }
}

class SqliteStorageMountRepository implements StorageMountRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(mount: StorageMount) {
    this.store.db
      .prepare(
        "INSERT INTO storage_mounts (mount_id, library_id, storage_type, adapter_kind, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        mount.mountId,
        mount.libraryId,
        mount.storageType,
        mount.adapterKind,
        mount.status,
        JSON.stringify(mount),
        mount.createdAt,
        mount.updatedAt
      );
  }
  update(mount: StorageMount) {
    this.store.db
      .prepare("UPDATE storage_mounts SET storage_type = ?, adapter_kind = ?, status = ?, payload = ?, updated_at = ? WHERE mount_id = ?")
      .run(mount.storageType, mount.adapterKind, mount.status, JSON.stringify(mount), mount.updatedAt, mount.mountId);
  }
  get(mountId: string) {
    return parsePayload<StorageMount>(this.store.db.prepare("SELECT payload FROM storage_mounts WHERE mount_id = ?").get(mountId) as Row | undefined);
  }
  listByLibrary(libraryId: string) {
    return parseRows<StorageMount>(
      this.store.db.prepare("SELECT payload FROM storage_mounts WHERE library_id = ? ORDER BY created_at, mount_id").all(libraryId) as Row[]
    );
  }
}

class SqlitePhenotypeLibraryGraphBindingRepository implements PhenotypeLibraryGraphBindingRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(binding: PhenotypeLibraryGraphBinding) {
    this.store.transaction(() => {
      this.store.db
        .prepare(
          "INSERT INTO phenotype_library_graph_bindings (binding_id, library_id, graph_id, role, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          binding.bindingId,
          binding.libraryId,
          binding.graphId,
          binding.role,
          binding.status,
          JSON.stringify(binding),
          binding.createdAt,
          binding.updatedAt
        );
      syncSqliteLibraryGraphId(this.store, binding.libraryId, binding.graphId);
    });
  }
  update(binding: PhenotypeLibraryGraphBinding) {
    this.store.transaction(() => {
      this.store.db
        .prepare("UPDATE phenotype_library_graph_bindings SET role = ?, status = ?, payload = ?, updated_at = ? WHERE binding_id = ?")
        .run(binding.role, binding.status, JSON.stringify(binding), binding.updatedAt, binding.bindingId);
      syncSqliteLibraryGraphId(this.store, binding.libraryId, binding.graphId);
    });
  }
  get(bindingId: string) {
    return parsePayload<PhenotypeLibraryGraphBinding>(
      this.store.db.prepare("SELECT payload FROM phenotype_library_graph_bindings WHERE binding_id = ?").get(bindingId) as Row | undefined
    );
  }
  listByGraph(graphId: string) {
    return parseRows<PhenotypeLibraryGraphBinding>(
      this.store.db
        .prepare("SELECT payload FROM phenotype_library_graph_bindings WHERE graph_id = ? ORDER BY created_at, binding_id")
        .all(graphId) as Row[]
    );
  }
  listByLibrary(libraryId: string) {
    return parseRows<PhenotypeLibraryGraphBinding>(
      this.store.db
        .prepare("SELECT payload FROM phenotype_library_graph_bindings WHERE library_id = ? ORDER BY graph_id, binding_id")
        .all(libraryId) as Row[]
    );
  }
}

class SqliteExternalLibraryMappingRepository implements ExternalLibraryMappingRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(mapping: ExternalLibraryMapping) {
    this.store.db
      .prepare(
        "INSERT INTO external_library_mappings (mapping_id, library_id, mount_id, adapter_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        mapping.mappingId,
        mapping.libraryId,
        mapping.mountId,
        mapping.adapterId,
        mapping.status,
        JSON.stringify(mapping),
        mapping.createdAt,
        mapping.updatedAt
      );
  }
  update(mapping: ExternalLibraryMapping) {
    this.store.db
      .prepare("UPDATE external_library_mappings SET status = ?, payload = ?, updated_at = ? WHERE mapping_id = ?")
      .run(mapping.status, JSON.stringify(mapping), mapping.updatedAt, mapping.mappingId);
  }
  get(mappingId: string) {
    return parsePayload<ExternalLibraryMapping>(
      this.store.db.prepare("SELECT payload FROM external_library_mappings WHERE mapping_id = ?").get(mappingId) as Row | undefined
    );
  }
  listByLibrary(libraryId: string) {
    return parseRows<ExternalLibraryMapping>(
      this.store.db
        .prepare("SELECT payload FROM external_library_mappings WHERE library_id = ? ORDER BY created_at, mapping_id")
        .all(libraryId) as Row[]
    );
  }
}

class SqliteLibraryRoutingPolicyRepository implements LibraryRoutingPolicyRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(policy: LibraryRoutingPolicy) {
    this.store.db
      .prepare(
        "INSERT INTO library_routing_policies (routing_policy_id, library_id, priority, status, target_mount_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        policy.routingPolicyId,
        policy.libraryId,
        policy.priority,
        policy.status,
        policy.targetMountId,
        JSON.stringify(policy),
        policy.createdAt,
        policy.updatedAt
      );
  }
  update(policy: LibraryRoutingPolicy) {
    this.store.db
      .prepare(
        "UPDATE library_routing_policies SET priority = ?, status = ?, target_mount_id = ?, payload = ?, updated_at = ? WHERE routing_policy_id = ?"
      )
      .run(policy.priority, policy.status, policy.targetMountId, JSON.stringify(policy), policy.updatedAt, policy.routingPolicyId);
  }
  get(routingPolicyId: string) {
    return parsePayload<LibraryRoutingPolicy>(
      this.store.db.prepare("SELECT payload FROM library_routing_policies WHERE routing_policy_id = ?").get(routingPolicyId) as
        | Row
        | undefined
    );
  }
  listByLibrary(libraryId: string) {
    return parseRows<LibraryRoutingPolicy>(
      this.store.db
        .prepare("SELECT payload FROM library_routing_policies WHERE library_id = ? ORDER BY priority DESC, routing_policy_id")
        .all(libraryId) as Row[]
    );
  }
}

class SqliteGenerationJobRepository implements GenerationJobRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(job: GenerationJob) {
    this.store.db
      .prepare("INSERT INTO generation_jobs (generation_job_id, graph_id, node_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(job.generationJobId, job.graphId, job.nodeId, job.status, JSON.stringify(job), job.createdAt, job.updatedAt);
  }
  update(job: GenerationJob) {
    this.store.db.prepare("UPDATE generation_jobs SET status = ?, payload = ?, updated_at = ? WHERE generation_job_id = ?").run(job.status, JSON.stringify(job), job.updatedAt, job.generationJobId);
  }
  get(generationJobId: string) {
    return parsePayload<GenerationJob>(this.store.db.prepare("SELECT payload FROM generation_jobs WHERE generation_job_id = ?").get(generationJobId) as Row | undefined);
  }
  listByGraph(graphId: string) {
    return parseRows<GenerationJob>(
      this.store.db.prepare("SELECT payload FROM generation_jobs WHERE graph_id = ? ORDER BY created_at, generation_job_id").all(graphId) as Row[]
    );
  }
}

class SqlitePhenotypeGenerationPlanRepository implements PhenotypeGenerationPlanRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(plan: PhenotypeGenerationPlan) {
    this.store.db
      .prepare(
        "INSERT INTO phenotype_generation_plans (plan_id, graph_id, scope_type, scope_id, status, priority, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        plan.planId,
        plan.graphId ?? null,
        plan.scopeType,
        plan.scopeId,
        plan.status,
        plan.priority,
        JSON.stringify(plan),
        plan.createdAt,
        plan.updatedAt
      );
  }
  update(plan: PhenotypeGenerationPlan) {
    this.store.db
      .prepare(
        "UPDATE phenotype_generation_plans SET graph_id = ?, scope_type = ?, scope_id = ?, status = ?, priority = ?, payload = ?, updated_at = ? WHERE plan_id = ?"
      )
      .run(plan.graphId ?? null, plan.scopeType, plan.scopeId, plan.status, plan.priority, JSON.stringify(plan), plan.updatedAt, plan.planId);
  }
  get(planId: string) {
    return parsePayload<PhenotypeGenerationPlan>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_plans WHERE plan_id = ?").get(planId) as Row | undefined
    );
  }
  list() {
    return parseRows<PhenotypeGenerationPlan>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_plans ORDER BY created_at, plan_id").all() as Row[]
    );
  }
  listByGraph(graphId: string) {
    return parseRows<PhenotypeGenerationPlan>(
      this.store.db
        .prepare(
          "SELECT payload FROM phenotype_generation_plans WHERE graph_id = ? OR (scope_type = 'graph' AND scope_id = ?) ORDER BY created_at, plan_id"
        )
        .all(graphId, graphId) as Row[]
    );
  }
  listByScope(scopeType: PhenotypeGenerationPlan["scopeType"], scopeId: string) {
    return parseRows<PhenotypeGenerationPlan>(
      this.store.db
        .prepare("SELECT payload FROM phenotype_generation_plans WHERE scope_type = ? AND scope_id = ? ORDER BY created_at, plan_id")
        .all(scopeType, scopeId) as Row[]
    );
  }
}

class SqlitePhenotypeGenerationTaskRepository implements PhenotypeGenerationTaskRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(task: PhenotypeGenerationTask) {
    this.store.db
      .prepare(
        "INSERT INTO phenotype_generation_tasks (task_id, plan_id, graph_id, node_id, phenotype_id, status, priority, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        task.taskId,
        task.planId ?? null,
        task.graphId,
        task.nodeId ?? null,
        task.phenotypeId ?? null,
        task.status,
        task.priority,
        JSON.stringify(task),
        task.createdAt,
        task.updatedAt
      );
  }
  update(task: PhenotypeGenerationTask) {
    this.store.db
      .prepare(
        "UPDATE phenotype_generation_tasks SET plan_id = ?, graph_id = ?, node_id = ?, phenotype_id = ?, status = ?, priority = ?, payload = ?, updated_at = ? WHERE task_id = ?"
      )
      .run(
        task.planId ?? null,
        task.graphId,
        task.nodeId ?? null,
        task.phenotypeId ?? null,
        task.status,
        task.priority,
        JSON.stringify(task),
        task.updatedAt,
        task.taskId
      );
  }
  get(taskId: string) {
    return parsePayload<PhenotypeGenerationTask>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_tasks WHERE task_id = ?").get(taskId) as Row | undefined
    );
  }
  list() {
    return parseRows<PhenotypeGenerationTask>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_tasks ORDER BY created_at, task_id").all() as Row[]
    );
  }
  listByGraph(graphId: string) {
    return parseRows<PhenotypeGenerationTask>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_tasks WHERE graph_id = ? ORDER BY created_at, task_id").all(graphId) as Row[]
    );
  }
  listByPlan(planId: string) {
    return parseRows<PhenotypeGenerationTask>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_tasks WHERE plan_id = ? ORDER BY created_at, task_id").all(planId) as Row[]
    );
  }
  listByNode(nodeId: string) {
    return parseRows<PhenotypeGenerationTask>(
      this.store.db.prepare("SELECT payload FROM phenotype_generation_tasks WHERE node_id = ? ORDER BY created_at, task_id").all(nodeId) as Row[]
    );
  }
  listByPhenotype(phenotypeId: string) {
    return parseRows<PhenotypeGenerationTask>(
      this.store.db
        .prepare("SELECT payload FROM phenotype_generation_tasks WHERE phenotype_id = ? ORDER BY created_at, task_id")
        .all(phenotypeId) as Row[]
    );
  }
}

class SqliteReviewRepository implements ReviewRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(review: ReviewRecord) {
    this.store.db
      .prepare("INSERT INTO review_records (review_record_id, graph_id, object_type, object_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(review.reviewRecordId, review.graphId, review.objectType, review.objectId, review.status, JSON.stringify(review), review.createdAt);
  }
  get(reviewRecordId: string) {
    return parsePayload<ReviewRecord>(this.store.db.prepare("SELECT payload FROM review_records WHERE review_record_id = ?").get(reviewRecordId) as Row | undefined);
  }
  listByGraph(graphId: string) {
    return parseRows<ReviewRecord>(
      this.store.db.prepare("SELECT payload FROM review_records WHERE graph_id = ? ORDER BY created_at, review_record_id").all(graphId) as Row[]
    );
  }
  listByObject(objectType: string, objectId: string) {
    return parseRows<ReviewRecord>(this.store.db.prepare("SELECT payload FROM review_records WHERE object_type = ? AND object_id = ? ORDER BY created_at").all(objectType, objectId) as Row[]);
  }
}

class SqliteImpactRepository implements ImpactRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(record: ImpactRecord) {
    this.store.db
      .prepare("INSERT INTO impact_records (impact_record_id, graph_id, changed_object_type, changed_object_id, object_type, object_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(record.impactRecordId, record.graphId, record.changedObjectType, record.changedObjectId, record.objectType, record.objectId, JSON.stringify(record), record.createdAt);
  }
  listByGraph(graphId: string) {
    return parseRows<ImpactRecord>(
      this.store.db.prepare("SELECT payload FROM impact_records WHERE graph_id = ? ORDER BY created_at, impact_record_id").all(graphId) as Row[]
    );
  }
  listByChangedObject(objectType: ImpactRecord["changedObjectType"], objectId: string) {
    return parseRows<ImpactRecord>(
      this.store.db
        .prepare("SELECT payload FROM impact_records WHERE changed_object_type = ? AND changed_object_id = ? ORDER BY created_at")
        .all(objectType, objectId) as Row[]
    );
  }
}

class SqliteProposalRepository implements ProposalRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(proposal: Proposal) {
    this.store.db
      .prepare("INSERT INTO proposals (proposal_id, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(proposal.proposalId, proposal.status, JSON.stringify(proposal), proposal.createdAt, proposal.updatedAt);
  }
  update(proposal: Proposal) {
    this.store.db
      .prepare("UPDATE proposals SET status = ?, payload = ?, updated_at = ? WHERE proposal_id = ?")
      .run(proposal.status, JSON.stringify(proposal), proposal.updatedAt, proposal.proposalId);
  }
  get(proposalId: string) {
    return parsePayload<Proposal>(this.store.db.prepare("SELECT payload FROM proposals WHERE proposal_id = ?").get(proposalId) as Row | undefined);
  }
  list() {
    return parseRows<Proposal>(
      this.store.db.prepare("SELECT payload FROM proposals ORDER BY created_at, proposal_id").all() as Row[]
    );
  }
}

class SqliteChangeSetRepository implements ChangeSetRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(changeSet: ChangeSet) {
    this.store.db
      .prepare("INSERT INTO change_sets (change_set_id, mode, object_type, operation, status, payload, created_at, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        changeSet.changeSetId,
        changeSet.mode,
        changeSet.objectType,
        changeSet.operation,
        changeSet.status,
        JSON.stringify(changeSet),
        changeSet.createdAt,
        changeSet.appliedAt ?? null
      );
  }
  update(changeSet: ChangeSet) {
    this.store.db
      .prepare("UPDATE change_sets SET status = ?, payload = ?, applied_at = ? WHERE change_set_id = ?")
      .run(changeSet.status, JSON.stringify(changeSet), changeSet.appliedAt ?? null, changeSet.changeSetId);
  }
  get(changeSetId: string) {
    return parsePayload<ChangeSet>(this.store.db.prepare("SELECT payload FROM change_sets WHERE change_set_id = ?").get(changeSetId) as Row | undefined);
  }
  list() {
    return parseRows<ChangeSet>(
      this.store.db.prepare("SELECT payload FROM change_sets ORDER BY created_at, change_set_id").all() as Row[]
    );
  }
}

export function exportProject(store: SqliteDnaStore, outDir: string, options: ExportProjectOptions = {}): void {
  const profile = options.profile ?? "full";
  const allChangeSets = store.changeSets.list();
  const allProposals = store.proposals.list();
  const proposal =
    profile === "proposal-review"
      ? requireExportProposal(allProposals, allChangeSets, options.proposalId)
      : undefined;
  const proposalChangeSetIds = new Set(proposal?.changeSetIds ?? []);
  const exportedChangeSets =
    profile === "review-current"
      ? []
      : profile === "proposal-review"
        ? allChangeSets.filter((changeSet) => proposalChangeSetIds.has(changeSet.changeSetId))
        : allChangeSets;
  const exportedProposals =
    profile === "review-current"
      ? []
      : profile === "proposal-review"
        ? proposal
          ? [proposal]
          : []
        : allProposals;
  const omitted =
    profile === "full"
      ? undefined
      : profile === "review-current"
        ? {
            sections: ["change-sets", "proposals"],
            changeSetCount: allChangeSets.length,
            proposalCount: allProposals.length
          }
        : {
            sections: ["unrelated change-sets", "unrelated proposals"],
            changeSetCount: allChangeSets.length - exportedChangeSets.length,
            proposalCount: allProposals.length - exportedProposals.length
          };
  const review =
    profile === "review-current"
      ? {
          stage: "reviewed" as const,
          cleanCurrentState: true
        }
      : undefined;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "dna.project.json"),
    `${JSON.stringify(createExchangeManifest({ profile, proposalId: proposal?.proposalId, omitted, review }), null, 2)}\n`
  );
  mkdirSync(join(outDir, "templates"), { recursive: true });
  for (const changeSet of exportedChangeSets) writeJson(join(outDir, "change-sets", `${changeSet.changeSetId}.json`), changeSet);
  for (const proposalValue of exportedProposals) writeJson(join(outDir, "proposals", `${proposalValue.proposalId}.json`), proposalValue);
  for (const definition of store.facetDefinitions.list()) {
    writeJson(join(outDir, "facets", "definitions", `${definition.facetId}.json`), definition);
  }
  for (const schema of store.facetSchemas.list()) {
    writeJson(join(outDir, "facets", "schemas", `${schema.facetSchemaId}.json`), schema);
  }
  for (const assignment of store.facetAssignments.list()) {
    writeJson(join(outDir, "facets", "assignments", `${assignment.assignmentId}.json`), assignment);
  }
  for (const context of store.designContexts.list()) writeJson(join(outDir, "contexts", "contexts", `${context.contextId}.json`), context);
  for (const fact of store.contextFacts.list()) writeJson(join(outDir, "contexts", "facts", `${fact.factId}.json`), fact);
  for (const principle of store.designPrinciples.list()) {
    writeJson(join(outDir, "contexts", "principles", `${principle.principleId}.json`), principle);
  }
  for (const motif of store.contextMotifs.list()) writeJson(join(outDir, "contexts", "motifs", `${motif.motifId}.json`), motif);
  for (const reference of store.contextReferences.list()) {
    writeJson(join(outDir, "contexts", "references", `${reference.referenceId}.json`), reference);
  }
  for (const rubric of store.contextReviewRubrics.list()) {
    writeJson(join(outDir, "contexts", "review-rubrics", `${rubric.rubricId}.json`), rubric);
  }
  for (const attachment of store.contextAttachments.list()) {
    writeJson(join(outDir, "contexts", "attachments", `${attachment.attachmentId}.json`), attachment);
  }
  for (const policy of store.contextPolicies.list()) writeJson(join(outDir, "contexts", "policies", `${policy.policyId}.json`), policy);
  for (const pack of store.templates.listPacks()) writeJson(join(outDir, "templates", `${pack.templatePackId}.pack.json`), pack);
  for (const template of store.templates.listTemplates()) writeJson(join(outDir, "templates", `${template.templateId}.template.json`), template);
  for (const library of store.phenotypeLibraries.list()) {
    const libraryDir = join(outDir, "libraries", library.libraryId);
    writeJson(join(libraryDir, "library.json"), library);
    for (const mount of store.storageMounts.listByLibrary(library.libraryId)) {
      writeJson(join(libraryDir, "mounts", `${mount.mountId}.json`), mount);
    }
    for (const binding of store.phenotypeLibraryGraphBindings.listByLibrary(library.libraryId)) {
      writeJson(join(libraryDir, "bindings", `${binding.bindingId}.json`), binding);
    }
    for (const mapping of store.externalLibraryMappings.listByLibrary(library.libraryId)) {
      writeJson(join(libraryDir, "mappings", `${mapping.mappingId}.json`), mapping);
    }
    for (const policy of store.libraryRoutingPolicies.listByLibrary(library.libraryId)) {
      writeJson(join(libraryDir, "routing-policies", `${policy.routingPolicyId}.json`), policy);
    }
  }
  for (const atlas of store.atlases.list()) {
    const atlasDir = join(outDir, "atlases", atlas.atlasId);
    writeJson(join(atlasDir, "atlas.json"), atlas);
    for (const artifact of store.entityCompileArtifacts.listByTarget("atlas", atlas.atlasId)) {
      writeJson(join(atlasDir, "compile", `${artifact.artifactId}.json`), artifact);
    }
  }
  for (const relationship of store.designRelationships.list()) {
    writeJson(join(outDir, "relationships", `${relationship.relationshipId}.json`), relationship);
  }
  for (const graph of store.graphs.list()) {
    const graphDir = join(outDir, "graphs", graph.graphId);
    writeJson(join(graphDir, "graph.json"), graph);
    for (const group of store.speciesGroups.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "groups", `${group.groupId}.json`), group);
    }
    for (const membership of store.speciesGroupMemberships.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "group-memberships", `${membership.membershipId}.json`), membership);
    }
    for (const node of store.nodes.listByGraph(graph.graphId)) writeJson(join(graphDir, "nodes", `${node.nodeId}.json`), node);
    for (const phenotype of store.phenotypes.listByGraph(graph.graphId)) writeJson(join(graphDir, "phenotypes", `${phenotype.phenotypeId}.json`), phenotype);
    for (const phenotype of store.phenotypes.listByGraph(graph.graphId)) {
      for (const version of store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId)) {
        writeJson(join(graphDir, "phenotypes", `${version.phenotypeVersionId}.version.json`), version);
      }
    }
    for (const artifact of store.entityCompileArtifacts.listByTarget("graph", graph.graphId)) {
      writeJson(join(graphDir, "compile", "graph", `${artifact.artifactId}.json`), artifact);
    }
    for (const group of store.speciesGroups.listByGraph(graph.graphId)) {
      for (const artifact of store.entityCompileArtifacts.listByTarget("species-group", group.groupId)) {
        writeJson(join(graphDir, "compile", "groups", `${artifact.artifactId}.json`), artifact);
      }
    }
    for (const artifact of store.speciesCompileArtifacts.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "compile", "species", `${artifact.artifactId}.json`), artifact);
    }
    for (const artifact of store.phenotypeCompileArtifacts.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "compile", "phenotypes", `${artifact.artifactId}.json`), artifact);
    }
    for (const asset of store.assets.search({ graphId: graph.graphId })) writeJson(join(graphDir, "assets", `${asset.assetId}.json`), asset);
    for (const job of store.generationJobs.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "generation-jobs", `${job.generationJobId}.json`), job);
    }
    for (const plan of store.generationPlans.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "generation-plans", `${plan.planId}.json`), plan);
    }
    for (const task of store.generationTasks.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "generation-tasks", `${task.taskId}.json`), task);
    }
    for (const reference of store.outputReferences.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "output-references", `${reference.outputReferenceId}.json`), reference);
    }
    for (const record of store.reviews.listByGraph(graph.graphId)) writeJson(join(graphDir, "reviews", `${record.reviewRecordId}.json`), record);
    for (const record of store.impacts.listByGraph(graph.graphId)) writeJson(join(graphDir, "impacts", `${record.impactRecordId}.json`), record);
  }
}

function requireExportProposal(proposals: Proposal[], changeSets: ChangeSet[], proposalId: string | undefined): Proposal {
  if (!proposalId) throw new Error("--proposal is required for proposal-review export");
  const proposal = proposals.find((value) => value.proposalId === proposalId);
  if (!proposal) throw new Error(`proposal not found: ${proposalId}`);
  const changeSetIds = new Set(changeSets.map((changeSet) => changeSet.changeSetId));
  const missing = proposal.changeSetIds.filter((changeSetId) => !changeSetIds.has(changeSetId));
  if (missing.length > 0) {
    throw new Error(`proposal ${proposalId} references missing change-set: ${missing.join(", ")}`);
  }
  return proposal;
}

export function importProject(store: SqliteDnaStore, inDir: string): void {
  validateExchangeManifest(readJsonIfExists<Record<string, unknown>>(join(inDir, "dna.project.json")));
  for (const file of listJsonFiles(join(inDir, "change-sets"))) store.changeSets.create(JSON.parse(readFileSync(file, "utf8")));
  for (const file of listJsonFiles(join(inDir, "proposals"))) store.proposals.create(JSON.parse(readFileSync(file, "utf8")));
  for (const file of listJsonFiles(join(inDir, "facets", "definitions"))) {
    store.facetDefinitions.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "facets", "schemas"))) {
    store.facetSchemas.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "facets", "assignments"))) {
    store.facetAssignments.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "contexts", "contexts"))) store.designContexts.create(JSON.parse(readFileSync(file, "utf8")));
  for (const file of listJsonFiles(join(inDir, "contexts", "facts"))) store.contextFacts.create(JSON.parse(readFileSync(file, "utf8")));
  for (const file of listJsonFiles(join(inDir, "contexts", "principles"))) {
    store.designPrinciples.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "contexts", "motifs"))) store.contextMotifs.create(JSON.parse(readFileSync(file, "utf8")));
  for (const file of listJsonFiles(join(inDir, "contexts", "references"))) {
    store.contextReferences.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "contexts", "review-rubrics"))) {
    store.contextReviewRubrics.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "contexts", "attachments"))) {
    store.contextAttachments.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const file of listJsonFiles(join(inDir, "contexts", "policies"))) store.contextPolicies.create(JSON.parse(readFileSync(file, "utf8")));
  for (const file of listJsonFiles(join(inDir, "templates"))) {
    const value = JSON.parse(readFileSync(file, "utf8"));
    if ("templateId" in value) store.templates.createTemplate(value);
    else if ("templatePackId" in value) store.templates.createPack(value);
  }
  for (const libraryDir of safeReadDirs(join(inDir, "libraries"))) {
    const library = readJsonIfExists<PhenotypeLibrary>(join(libraryDir, "library.json"));
    if (library) store.phenotypeLibraries.create(library);
    for (const file of listJsonFiles(join(libraryDir, "mounts"))) store.storageMounts.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(libraryDir, "bindings"))) {
      store.phenotypeLibraryGraphBindings.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(libraryDir, "mappings"))) {
      store.externalLibraryMappings.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(libraryDir, "routing-policies"))) {
      store.libraryRoutingPolicies.create(JSON.parse(readFileSync(file, "utf8")));
    }
  }
  for (const graphDir of safeReadDirs(join(inDir, "graphs"))) {
    const graph = JSON.parse(readFileSync(join(graphDir, "graph.json"), "utf8")) as Graph;
    store.graphs.create(graph);
    for (const file of listJsonFiles(join(graphDir, "groups"))) store.speciesGroups.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "group-memberships"))) {
      store.speciesGroupMemberships.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "facets"))) store.facetAssignments.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "nodes"))) store.nodes.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "phenotypes"))) {
      const value = JSON.parse(readFileSync(file, "utf8"));
      if ("phenotypeVersionId" in value) store.phenotypeVersions.create(value);
      else store.phenotypes.create(value);
    }
    for (const file of listJsonFiles(join(graphDir, "compile", "graph"))) {
      store.entityCompileArtifacts.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "compile", "groups"))) {
      store.entityCompileArtifacts.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "compile", "species"))) {
      store.speciesCompileArtifacts.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "compile", "phenotypes"))) {
      store.phenotypeCompileArtifacts.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "assets"))) store.assets.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "generation-jobs"))) store.generationJobs.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "generation-plans"))) store.generationPlans.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "generation-tasks"))) store.generationTasks.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "output-references"))) {
      store.outputReferences.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "reviews"))) store.reviews.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "impacts"))) store.impacts.create(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const atlasDir of safeReadDirs(join(inDir, "atlases"))) {
    const atlas = readJsonIfExists<Atlas>(join(atlasDir, "atlas.json"));
    if (atlas) store.atlases.create(atlas);
    for (const file of listJsonFiles(join(atlasDir, "compile"))) {
      store.entityCompileArtifacts.create(JSON.parse(readFileSync(file, "utf8")));
    }
  }
  for (const file of listJsonFiles(join(inDir, "relationships"))) store.designRelationships.create(JSON.parse(readFileSync(file, "utf8")));
}

function validateExchangeManifest(manifest: Record<string, unknown> | undefined) {
  if (!manifest) return;
  if (manifest.format !== undefined && manifest.format !== "dna.git-directory") {
    throw new Error(`unsupported exchange format ${String(manifest.format)}`);
  }
  if (manifest.exportProfile === "proposal-review") {
    throw new Error("proposal-review export packages are review-only and cannot be imported as project state");
  }
  if (manifest.exchangeVersion === undefined) return;
  if (manifest.exchangeVersion !== DNA_EXCHANGE_VERSION) {
    throw new Error(`unsupported exchangeVersion ${String(manifest.exchangeVersion)}; supported exchangeVersion is ${DNA_EXCHANGE_VERSION}`);
  }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function safeReadDirs(path: string) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(path, entry.name));
  } catch {
    return [];
  }
}

function listJsonFiles(path: string) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(path, entry.name));
  } catch {
    return [];
  }
}

export function createImpactRecordsFromSummaries(input: {
  graphId: string;
  changedObjectType: "node" | "design-relationship";
  changedObjectId: string;
  changedVersionId: string;
  summaries: Array<{ objectType: "node" | "phenotype-version"; objectId: string; reason: string }>;
}): ImpactRecord[] {
  return input.summaries.map((summary, index) =>
    createImpactRecord({
      impactRecordId: `impact-${Date.now().toString(36)}-${index}`,
      graphId: input.graphId,
      changedObjectType: input.changedObjectType,
      changedObjectId: input.changedObjectId,
      changedVersionId: input.changedVersionId,
      objectType: summary.objectType,
      objectId: summary.objectId,
      reason: summary.reason
    })
  );
}
