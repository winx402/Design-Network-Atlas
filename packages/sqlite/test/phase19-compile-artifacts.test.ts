import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultGraph,
  createDefaultSpeciesNode
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-phase19-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

describe("Phase 19 PRD-03 SQLite compile artifact storage", () => {
  test("migration creates compile artifact tables", () => {
    const store = new SqliteDnaStore(tempDb("tables"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    expect(names.has("species_compile_artifacts")).toBe(true);
    expect(names.has("phenotype_compile_artifacts")).toBe(true);
    store.close();
  });

  test("persists and exports species and phenotype compile artifacts", () => {
    const source = new SqliteDnaStore(tempDb("source"));
    source.migrate();
    const graph = createDefaultGraph({ graphId: "graph-ui", name: "UI Graph", purpose: "ui" });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-icon",
      name: "Icon",
      constraints: { readability: "high" },
      motifs: ["broken-ring"]
    });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-node-icon",
      graph,
      node,
      nodeVersionId: "node-icon@1.0.0"
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-node-icon-ui",
      graph,
      node,
      nodeVersionId: "node-icon@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "small HUD icon",
      speciesArtifact
    });

    source.graphs.create(graph);
    source.nodes.create(node);
    source.speciesCompileArtifacts.create(speciesArtifact);
    source.phenotypeCompileArtifacts.create(phenotypeArtifact);

    expect(source.speciesCompileArtifacts.get("sca-node-icon")?.compileTarget).toBe("species-snapshot");
    expect(source.speciesCompileArtifacts.listByNode("node-icon").map((artifact) => artifact.artifactId)).toEqual(["sca-node-icon"]);
    expect(source.phenotypeCompileArtifacts.get("pca-node-icon-ui")?.prompt).toContain("small-size readability");
    expect(source.phenotypeCompileArtifacts.listBySpeciesArtifact("sca-node-icon").map((artifact) => artifact.artifactId)).toEqual([
      "pca-node-icon-ui"
    ]);

    const outDir = join(tempDb("export"), "..", "export");
    exportProject(source, outDir);

    const target = new SqliteDnaStore(tempDb("target"));
    target.migrate();
    importProject(target, outDir);

    expect(target.speciesCompileArtifacts.get("sca-node-icon")?.sourceTrace.length).toBeGreaterThan(0);
    expect(target.phenotypeCompileArtifacts.get("pca-node-icon-ui")?.speciesCompileArtifactId).toBe("sca-node-icon");

    source.close();
    target.close();
  });
});
