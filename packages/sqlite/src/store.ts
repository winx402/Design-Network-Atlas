import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AssetIndex,
  ChangeSet,
  createImpactRecord,
  EdgeVersion,
  EvolutionEdge,
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
  PROJECT_VERSION,
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
} from "@dna/storage";

type Row = Record<string, unknown>;

function parsePayload<T>(row: Row | undefined): T | undefined {
  if (!row) return undefined;
  const payload = row.payload;
  return typeof payload === "string" ? (JSON.parse(payload) as T) : (payload as T);
}

function parseRows<T>(rows: Row[]): T[] {
  return rows.map((row) => parsePayload<T>(row)).filter((value): value is T => Boolean(value));
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

function syncSqliteLibraryGraphId(store: SqliteDnaStore, libraryId: string, graphId: string) {
  const library = store.phenotypeLibraries.get(libraryId);
  if (!library || library.graphIds.includes(graphId)) return;
  store.phenotypeLibraries.update({
    ...library,
    graphIds: [...library.graphIds, graphId].sort(),
    updatedAt: new Date().toISOString()
  });
}

export class SqliteDnaStore implements StorageEngine {
  readonly db: DatabaseSync;
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

  constructor(readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.graphs = new SqliteGraphRepository(this);
    this.templates = new SqliteTemplateRepository(this);
    this.nodes = new SqliteNodeRepository(this);
    this.nodeVersions = new SqliteNodeVersionRepository(this);
    this.edges = new SqliteEdgeRepository(this);
    this.edgeVersions = new SqliteEdgeVersionRepository(this);
    this.phenotypes = new SqlitePhenotypeRepository(this);
    this.phenotypeVersions = new SqlitePhenotypeVersionRepository(this);
    this.assets = new SqliteAssetRepository(this);
    this.outputReferences = new SqliteOutputReferenceRepository(this);
    this.phenotypeLibraries = new SqlitePhenotypeLibraryRepository(this);
    this.storageMounts = new SqliteStorageMountRepository(this);
    this.phenotypeLibraryGraphBindings = new SqlitePhenotypeLibraryGraphBindingRepository(this);
    this.externalLibraryMappings = new SqliteExternalLibraryMappingRepository(this);
    this.libraryRoutingPolicies = new SqliteLibraryRoutingPolicyRepository(this);
    this.generationJobs = new SqliteGenerationJobRepository(this);
    this.reviews = new SqliteReviewRepository(this);
    this.impacts = new SqliteImpactRepository(this);
    this.search = { assets: (filter) => this.assets.search(filter) };
    this.changeSets = new SqliteChangeSetRepository(this);
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
      CREATE TABLE IF NOT EXISTS edges (
        edge_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        from_node_id TEXT NOT NULL,
        to_node_id TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS edge_versions (
        edge_version_id TEXT PRIMARY KEY,
        edge_id TEXT NOT NULL,
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
    `);
  }

  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
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

class SqliteEdgeRepository implements EdgeRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(edge: EvolutionEdge) {
    this.store.db
      .prepare("INSERT INTO edges (edge_id, graph_id, from_node_id, to_node_id, edge_type, status, current_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(edge.edgeId, edge.graphId, edge.fromNodeId, edge.toNodeId, edge.edgeType, edge.status, edge.currentVersion, JSON.stringify(edge), edge.createdAt, edge.updatedAt);
  }
  update(edge: EvolutionEdge) {
    this.store.db
      .prepare("UPDATE edges SET edge_type = ?, status = ?, current_version = ?, payload = ?, updated_at = ? WHERE edge_id = ?")
      .run(edge.edgeType, edge.status, edge.currentVersion, JSON.stringify(edge), edge.updatedAt, edge.edgeId);
  }
  get(edgeId: string) {
    return parsePayload<EvolutionEdge>(this.store.db.prepare("SELECT payload FROM edges WHERE edge_id = ?").get(edgeId) as Row | undefined);
  }
  listByGraph(graphId: string) {
    return parseRows<EvolutionEdge>(this.store.db.prepare("SELECT payload FROM edges WHERE graph_id = ? ORDER BY created_at, edge_id").all(graphId) as Row[]);
  }
}

class SqliteEdgeVersionRepository implements EdgeVersionRepository {
  constructor(private readonly store: SqliteDnaStore) {}
  create(version: EdgeVersion) {
    this.store.db
      .prepare("INSERT INTO edge_versions (edge_version_id, edge_id, graph_id, version, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(version.edgeVersionId, version.edgeId, version.graphId, version.version, JSON.stringify(version), version.createdAt);
  }
  get(edgeVersionId: string) {
    return parsePayload<EdgeVersion>(this.store.db.prepare("SELECT payload FROM edge_versions WHERE edge_version_id = ?").get(edgeVersionId) as Row | undefined);
  }
  listByEdge(edgeId: string) {
    return parseRows<EdgeVersion>(this.store.db.prepare("SELECT payload FROM edge_versions WHERE edge_id = ? ORDER BY created_at").all(edgeId) as Row[]);
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
  update(version: PhenotypeVersion) {
    this.store.db
      .prepare("UPDATE phenotype_versions SET status = ?, payload = ? WHERE phenotype_version_id = ?")
      .run(version.status, JSON.stringify(version), version.phenotypeVersionId);
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
  listByChangedObject(objectType: "node" | "edge", objectId: string) {
    return parseRows<ImpactRecord>(
      this.store.db
        .prepare("SELECT payload FROM impact_records WHERE changed_object_type = ? AND changed_object_id = ? ORDER BY created_at")
        .all(objectType, objectId) as Row[]
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
}

export function exportProject(store: SqliteDnaStore, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "dna.project.json"), JSON.stringify({ format: "dna.git-directory", version: PROJECT_VERSION }, null, 2));
  mkdirSync(join(outDir, "templates"), { recursive: true });
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
  for (const graph of store.graphs.list()) {
    const graphDir = join(outDir, "graphs", graph.graphId);
    writeJson(join(graphDir, "graph.json"), graph);
    for (const node of store.nodes.listByGraph(graph.graphId)) writeJson(join(graphDir, "nodes", `${node.nodeId}.json`), node);
    for (const edge of store.edges.listByGraph(graph.graphId)) writeJson(join(graphDir, "edges", `${edge.edgeId}.json`), edge);
    for (const phenotype of store.phenotypes.listByGraph(graph.graphId)) writeJson(join(graphDir, "phenotypes", `${phenotype.phenotypeId}.json`), phenotype);
    for (const phenotype of store.phenotypes.listByGraph(graph.graphId)) {
      for (const version of store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId)) {
        writeJson(join(graphDir, "phenotypes", `${version.phenotypeVersionId}.version.json`), version);
      }
    }
    for (const asset of store.assets.search({ graphId: graph.graphId })) writeJson(join(graphDir, "assets", `${asset.assetId}.json`), asset);
    for (const job of store.generationJobs.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "generation-jobs", `${job.generationJobId}.json`), job);
    }
    for (const reference of store.outputReferences.listByGraph(graph.graphId)) {
      writeJson(join(graphDir, "output-references", `${reference.outputReferenceId}.json`), reference);
    }
    for (const record of store.reviews.listByGraph(graph.graphId)) writeJson(join(graphDir, "reviews", `${record.reviewRecordId}.json`), record);
    for (const record of store.impacts.listByGraph(graph.graphId)) writeJson(join(graphDir, "impacts", `${record.impactRecordId}.json`), record);
  }
}

export function importProject(store: SqliteDnaStore, inDir: string): void {
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
    for (const file of listJsonFiles(join(graphDir, "nodes"))) store.nodes.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "edges"))) store.edges.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "phenotypes"))) {
      const value = JSON.parse(readFileSync(file, "utf8"));
      if ("phenotypeVersionId" in value) store.phenotypeVersions.create(value);
      else store.phenotypes.create(value);
    }
    for (const file of listJsonFiles(join(graphDir, "assets"))) store.assets.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "generation-jobs"))) store.generationJobs.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "output-references"))) {
      store.outputReferences.create(JSON.parse(readFileSync(file, "utf8")));
    }
    for (const file of listJsonFiles(join(graphDir, "reviews"))) store.reviews.create(JSON.parse(readFileSync(file, "utf8")));
    for (const file of listJsonFiles(join(graphDir, "impacts"))) store.impacts.create(JSON.parse(readFileSync(file, "utf8")));
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
  changedObjectType: "node" | "edge";
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
