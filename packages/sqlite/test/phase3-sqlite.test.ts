import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createDefaultDesignRelationship, createDefaultGraph, createDefaultSpeciesNode } from "@dna/core";
import { createDnaServices } from "@dna/storage";
import { SqliteDnaStore } from "@dna/sqlite";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

describe("Phase 3 SQLite storage requirements", () => {
  test("migration is repeatable and creates every required table", () => {
    const store = new SqliteDnaStore(tempDb("tables"));
    store.migrate();
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));
    for (const table of [
      "graphs",
      "template_packs",
      "gene_templates",
      "nodes",
      "node_versions",
      "design_relationships",
      "node_relations",
      "phenotype_types",
      "phenotypes",
      "phenotype_versions",
      "phenotype_version_assets",
      "assets",
      "output_references",
      "phenotype_libraries",
      "storage_mounts",
      "phenotype_library_graph_bindings",
      "external_library_mappings",
      "library_routing_policies",
      "generation_jobs",
      "review_records",
      "tags",
      "object_tags",
      "impact_records",
      "change_sets"
    ]) {
      expect(names.has(table), table).toBe(true);
    }
    store.close();
  });

  test("SQLite store passes the Phase 2 service preview and apply behavior", () => {
    const store = new SqliteDnaStore(tempDb("service"));
    store.migrate();
    const services = createDnaServices(store);

    const preview = services.graph.createGraph(
      { graphId: "graph-preview-sqlite", name: "Preview", purpose: "sqlite preview" },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(store.graphs.get("graph-preview-sqlite")).toBeUndefined();

    const applied = services.graph.createGraph(
      { graphId: "graph-apply-sqlite", name: "Apply", purpose: "sqlite apply" },
      { mode: "preview-confirm", apply: true }
    );
    expect(applied.changeSet.status).toBe("applied");
    expect(store.graphs.get("graph-apply-sqlite")?.name).toBe("Apply");
    store.close();
  });

  test("SQLite service createNode rolls back if graph is missing", () => {
    const store = new SqliteDnaStore(tempDb("rollback-service"));
    store.migrate();
    const services = createDnaServices(store);

    expect(() =>
      services.lineage.createNode(
        {
          graphId: "graph-missing",
          nodeId: "node-no-graph",
          name: "No Graph",
          category: "icon",
          level: "root"
        },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/graph not found/);

    expect(store.nodes.get("node-no-graph")).toBeUndefined();
    expect(store.nodeVersions.get("node-no-graph@1.0.0")).toBeUndefined();
    store.close();
  });

  test("design relationships can be created and queried by graph", () => {
    const store = new SqliteDnaStore(tempDb("design-relationship"));
    store.migrate();
    const relationship = createDefaultDesignRelationship({
      relationshipId: "rel-1",
      source: { type: "species-node", graphId: "graph-relationship", nodeId: "node-parent" },
      target: { type: "species-node", graphId: "graph-relationship", nodeId: "node-child" },
      relationshipType: "derives-from",
      designContract: {
        transferRule: "child keeps parent silhouette",
        mustPreserve: ["broken-ring"],
        mustAvoid: ["photorealistic"],
        divergenceRule: "",
        reviewQuestions: []
      }
    });

    store.designRelationships.create(relationship);

    expect(store.designRelationships.get("rel-1")?.designContract.mustPreserve).toEqual(["broken-ring"]);
    expect(store.designRelationships.listByGraph("graph-relationship")).toHaveLength(1);
    store.close();
  });

  test("archiving a graph preserves child nodes and node versions", () => {
    const store = new SqliteDnaStore(tempDb("archive"));
    store.migrate();
    store.graphs.create(createDefaultGraph({ graphId: "graph-archive", name: "Archive", purpose: "archive test" }));
    store.nodes.create(createDefaultSpeciesNode({ graphId: "graph-archive", nodeId: "node-archive", name: "Archive Node" }));
    store.nodeVersions.create({
      nodeVersionId: "node-archive@1.0.0",
      nodeId: "node-archive",
      graphId: "graph-archive",
      version: "1.0.0",
      baseTemplateVersions: [],
      parentNodeVersions: [],
      incomingRelationshipIds: [],
      ownGeneDelta: {},
      resolvedGeneSnapshot: {},
      constraintSnapshot: {},
      promptContextSnapshot: {},
      compileSnapshot: {},
      changeSummary: "initial",
      impactNotes: "",
      createdAt: "2026-06-26T00:00:00.000Z"
    });

    store.graphs.archive("graph-archive");

    expect(store.graphs.get("graph-archive")?.status).toBe("archived");
    expect(store.nodes.get("node-archive")?.name).toBe("Archive Node");
    expect(store.nodeVersions.get("node-archive@1.0.0")?.nodeId).toBe("node-archive");
    store.close();
  });
});
