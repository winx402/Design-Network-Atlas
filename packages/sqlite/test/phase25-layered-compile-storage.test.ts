import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  compileEntityArtifact,
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultGraph,
  createDefaultSpeciesGroup,
  createDefaultSpeciesNode
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Phase 25 PRD-16 SQLite layered compile storage", () => {
  test("migration creates entity compile artifact table", () => {
    const store = new SqliteDnaStore(join(tempDir("phase25-layered-tables"), "dna.sqlite"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    expect(names.has("entity_compile_artifacts")).toBe(true);
    store.close();
  });

  test("persists and round-trips entity, species, and phenotype layered artifacts with dependency vectors", () => {
    const dir = tempDir("phase25-layered-exchange");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();

    const graph = createDefaultGraph({ graphId: "graph-layered", name: "Layered Graph", purpose: "compile" });
    const group = createDefaultSpeciesGroup({ graphId: graph.graphId, groupId: "group-layered", name: "Layered Group" });
    const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-layered", name: "Layered Node" });
    const graphArtifact = compileEntityArtifact({
      artifactId: "eca-graph-layered",
      targetLevel: "graph",
      graph
    });
    const groupArtifact = compileEntityArtifact({
      artifactId: "eca-group-layered",
      targetLevel: "species-group",
      graph,
      group,
      upstreamArtifacts: [graphArtifact]
    });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-layered",
      graph,
      node,
      nodeVersionId: "node-layered@1.0.0",
      speciesGroups: [group]
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-layered",
      graph,
      node,
      nodeVersionId: "node-layered@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "small layered icon",
      speciesArtifact
    });

    source.graphs.create(graph);
    source.speciesGroups.create(group);
    source.nodes.create(node);
    source.entityCompileArtifacts.create(graphArtifact);
    source.entityCompileArtifacts.create(groupArtifact);
    source.speciesCompileArtifacts.create(speciesArtifact);
    source.phenotypeCompileArtifacts.create(phenotypeArtifact);

    expect(source.entityCompileArtifacts.get("eca-graph-layered")?.dependencyVector).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "graph", objectId: graph.graphId })])
    );
    expect(source.entityCompileArtifacts.listByGraph(graph.graphId).map((artifact) => artifact.artifactId)).toEqual([
      "eca-graph-layered",
      "eca-group-layered"
    ]);

    exportProject(source, out, { profile: "review-current" });
    expect(existsSync(join(out, "graphs", graph.graphId, "compile", "graph", "eca-graph-layered.json"))).toBe(true);
    expect(existsSync(join(out, "graphs", graph.graphId, "compile", "groups", "eca-group-layered.json"))).toBe(true);
    expect(readJson(join(out, "dna.project.json"))).toMatchObject({
      exportProfile: "review-current",
      review: { cleanCurrentState: true }
    });

    importProject(target, out);
    expect(target.entityCompileArtifacts.get("eca-group-layered")?.frames.map((frame) => frame.level)).toEqual(["graph", "species-group"]);
    expect(target.speciesCompileArtifacts.get("sca-layered")?.frames.map((frame) => frame.level)).toContain("species-node");
    expect(target.phenotypeCompileArtifacts.get("pca-layered")?.dependencyVector).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "task-brief", role: "source" })])
    );

    source.close();
    target.close();
  });
});
