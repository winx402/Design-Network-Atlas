import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AssetIndex,
  ChangeSet,
  createImpactRecord,
  EdgeVersion,
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
import {
  AssetRepository,
  ChangeSetRepository,
  EdgeRepository,
  EdgeVersionRepository,
  GenerationJobRepository,
  GraphRepository,
  ImpactRepository,
  LineageRepository,
  NodeVersionRepository,
  PhenotypeRepository,
  PhenotypeVersionRepository,
  ReviewRepository,
  SearchRepository,
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
  writeFileSync(join(outDir, "dna.project.json"), JSON.stringify({ format: "dna.git-directory", version: "0.1.0" }, null, 2));
  mkdirSync(join(outDir, "templates"), { recursive: true });
  for (const pack of store.templates.listPacks()) writeJson(join(outDir, "templates", `${pack.templatePackId}.pack.json`), pack);
  for (const template of store.templates.listTemplates()) writeJson(join(outDir, "templates", `${template.templateId}.template.json`), template);
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
    for (const record of store.impacts.listByChangedObject("node", "__none__")) {
      writeJson(join(graphDir, "impacts", `${record.impactRecordId}.json`), record);
    }
  }
}

export function importProject(store: SqliteDnaStore, inDir: string): void {
  for (const file of listJsonFiles(join(inDir, "templates"))) {
    const value = JSON.parse(readFileSync(file, "utf8"));
    if ("templateId" in value) store.templates.createTemplate(value);
    else if ("templatePackId" in value) store.templates.createPack(value);
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
    for (const file of listJsonFiles(join(graphDir, "impacts"))) store.impacts.create(JSON.parse(readFileSync(file, "utf8")));
  }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
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
