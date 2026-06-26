import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultSpeciesNode,
  createDefaultEvolutionEdge,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createImpactRecord,
  createReviewRecord
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempPath(name: string) {
  return join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

describe("SQLite DNA store", () => {
  test("migrates, persists graph lineage data, and keeps versions queryable", () => {
    const dbPath = join(tempPath("store"), "dna.sqlite");
    mkdirSync(join(dbPath, ".."), { recursive: true });
    const store = new SqliteDnaStore(dbPath);
    store.migrate();

    const graph = createDefaultGraph({ graphId: "graph-a", name: "Graph A", purpose: "test" });
    store.graphs.create(graph);
    store.nodes.create(createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-root", name: "Root" }));
    store.edges.create(
      createDefaultEvolutionEdge({
        graphId: graph.graphId,
        edgeId: "edge-1",
        fromNodeId: "node-root",
        toNodeId: "node-child"
      })
    );

    expect(store.graphs.get("graph-a")?.name).toBe("Graph A");
    expect(store.nodes.listByGraph("graph-a")).toHaveLength(1);
    expect(store.edges.listByGraph("graph-a")).toHaveLength(1);

    store.close();
  });

  test("rolls back failed transactions", () => {
    const dbPath = join(tempPath("rollback"), "dna.sqlite");
    mkdirSync(join(dbPath, ".."), { recursive: true });
    const store = new SqliteDnaStore(dbPath);
    store.migrate();

    expect(() =>
      store.transaction(() => {
        store.graphs.create(createDefaultGraph({ graphId: "graph-rollback", name: "Rollback", purpose: "test" }));
        throw new Error("force rollback");
      })
    ).toThrow(/force rollback/);

    expect(store.graphs.get("graph-rollback")).toBeUndefined();
    store.close();
  });

  test("exports and imports the Git directory exchange format", () => {
    const sourcePath = join(tempPath("source"), "dna.sqlite");
    mkdirSync(join(sourcePath, ".."), { recursive: true });
    const source = new SqliteDnaStore(sourcePath);
    source.migrate();
    source.graphs.create(createDefaultGraph({ graphId: "graph-export", name: "Export", purpose: "portable" }));
    source.nodes.create(createDefaultSpeciesNode({ graphId: "graph-export", nodeId: "node-export", name: "Export Node" }));
    const phenotype = createDefaultPhenotype({
      graphId: "graph-export",
      nodeId: "node-export",
      phenotypeId: "ph-export",
      name: "Export Phenotype"
    });
    source.phenotypes.create(phenotype);
    source.phenotypeVersions.create(
      createDefaultPhenotypeVersion({
        graphId: "graph-export",
        nodeId: "node-export",
        phenotypeId: phenotype.phenotypeId,
        phenotypeVersionId: "pv-export"
      })
    );
    source.reviews.create(
      createReviewRecord({
        reviewRecordId: "review-export",
        graphId: "graph-export",
        objectType: "phenotype-version",
        objectId: "pv-export",
        status: "pass"
      })
    );
    source.impacts.create(
      createImpactRecord({
        impactRecordId: "impact-export",
        graphId: "graph-export",
        changedObjectType: "node",
        changedObjectId: "node-export",
        changedVersionId: "node-export@2.0.0",
        objectType: "phenotype-version",
        objectId: "pv-export"
      })
    );

    const outDir = tempPath("export-dir");
    exportProject(source, outDir);

    const targetPath = join(tempPath("target"), "dna.sqlite");
    mkdirSync(join(targetPath, ".."), { recursive: true });
    const target = new SqliteDnaStore(targetPath);
    target.migrate();
    importProject(target, outDir);

    expect(target.graphs.get("graph-export")?.name).toBe("Export");
    expect(target.nodes.get("node-export")?.name).toBe("Export Node");
    expect(target.phenotypeVersions.get("pv-export")?.phenotypeId).toBe("ph-export");
    expect(target.reviews.get("review-export")?.objectId).toBe("pv-export");
    expect(target.impacts.listByChangedObject("node", "node-export").map((record) => record.impactRecordId)).toEqual([
      "impact-export"
    ]);

    source.close();
    target.close();
    rmSync(outDir, { recursive: true, force: true });
  });
});
