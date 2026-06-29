import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

function seedStore(store: SqliteDnaStore) {
  const graph = createDefaultGraph({ graphId: "graph-lifecycle-sqlite", name: "Lifecycle SQLite", purpose: "lifecycle storage" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-lifecycle-sqlite", name: "Lifecycle Node" });
  const phenotype = createDefaultPhenotype({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: "ph-lifecycle-sqlite",
    name: "Lifecycle Phenotype",
    phenotypeType: "image-prompt"
  });
  const version = createDefaultPhenotypeVersion({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: "pv-lifecycle-sqlite",
    nodeVersionId: "node-lifecycle-sqlite@1.0.0",
    promptSnapshot: "immutable prompt",
    generationRecipe: { seed: 11 },
    resolvedGeneSnapshot: { line: "clean" },
    speciesCompileArtifactId: "sca-sqlite-life",
    phenotypeCompileArtifactId: "pca-sqlite-life",
    compileArtifactSnapshot: { kind: "life" }
  });

  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  store.phenotypeVersions.create(version);
  return { graph, phenotype, version };
}

describe("Phase 27 PRD-18 phenotype version lifecycle SQLite and export", () => {
  test("updates only lifecycle metadata and current accepted pointer through narrow repositories", () => {
    const store = new SqliteDnaStore(tempDb("phenotype-version-lifecycle-storage"));
    store.migrate();
    const { phenotype, version } = seedStore(store);

    expect((store.phenotypeVersions as unknown as { update?: unknown }).update).toBeUndefined();

    store.phenotypeVersions.updateLifecycleMetadata(version.phenotypeVersionId, {
      status: "accepted",
      feedback: {
        summary: "Accepted summary.",
        items: [
          {
            feedbackId: "fb-sqlite",
            severity: "info",
            source: "human",
            message: "Accepted for production.",
            createdAt: "2026-06-29T00:00:00.000Z"
          }
        ]
      }
    });
    store.phenotypes.updateCurrentAcceptedVersion(phenotype.phenotypeId, version.phenotypeVersionId);

    const row = store.db
      .prepare("SELECT status, payload FROM phenotype_versions WHERE phenotype_version_id = ?")
      .get(version.phenotypeVersionId) as { status: string; payload: string };
    const payload = JSON.parse(row.payload);

    expect(row.status).toBe("accepted");
    expect(payload.feedback.summary).toBe("Accepted summary.");
    expect(payload.promptSnapshot).toBe(version.promptSnapshot);
    expect(payload.generationRecipe).toEqual(version.generationRecipe);
    expect(payload.speciesCompileArtifactId).toBe(version.speciesCompileArtifactId);
    expect(payload.phenotypeCompileArtifactId).toBe(version.phenotypeCompileArtifactId);
    expect(store.phenotypes.get(phenotype.phenotypeId)?.currentAcceptedVersion).toBe(version.phenotypeVersionId);
    store.close();
  });

  test("full and review-current export/import preserve lifecycle feedback without lifecycle record directories", () => {
    const source = new SqliteDnaStore(tempDb("phenotype-version-lifecycle-export-source"));
    source.migrate();
    const { phenotype, version } = seedStore(source);
    source.phenotypeVersions.updateLifecycleMetadata(version.phenotypeVersionId, {
      status: "accepted",
      feedback: {
        summary: "Exported feedback.",
        items: [
          {
            feedbackId: "fb-export",
            severity: "warning",
            source: "agent",
            message: "Keep this version but revisit contrast.",
            suggestedAction: "Check contrast in runtime theme.",
            createdAt: "2026-06-29T00:00:00.000Z"
          }
        ]
      }
    });
    source.phenotypes.updateCurrentAcceptedVersion(phenotype.phenotypeId, version.phenotypeVersionId);

    const fullOut = tempDir("phenotype-version-lifecycle-full-export");
    const reviewOut = tempDir("phenotype-version-lifecycle-review-export");
    exportProject(source, fullOut);
    exportProject(source, reviewOut, { profile: "review-current" });

    const exportedVersion = JSON.parse(
      readFileSync(join(reviewOut, "graphs", "graph-lifecycle-sqlite", "phenotypes", "pv-lifecycle-sqlite.version.json"), "utf8")
    );
    const exportedPhenotype = JSON.parse(
      readFileSync(join(reviewOut, "graphs", "graph-lifecycle-sqlite", "phenotypes", "ph-lifecycle-sqlite.json"), "utf8")
    );
    const manifest = JSON.parse(readFileSync(join(reviewOut, "dna.project.json"), "utf8"));

    expect(exportedVersion.status).toBe("accepted");
    expect(exportedVersion.feedback.summary).toBe("Exported feedback.");
    expect(exportedPhenotype.currentAcceptedVersion).toBe(version.phenotypeVersionId);
    expect(manifest.review.stage).toBe("reviewed");
    expect(JSON.stringify(exportedVersion)).not.toContain("OPENAI_API_KEY");
    expect(existsSync(join(reviewOut, "phenotype-version-lifecycle"))).toBe(false);
    expect(existsSync(join(fullOut, "phenotype-version-lifecycle"))).toBe(false);

    const target = new SqliteDnaStore(tempDb("phenotype-version-lifecycle-export-target"));
    target.migrate();
    importProject(target, reviewOut);
    expect(target.phenotypeVersions.get(version.phenotypeVersionId)?.feedback.summary).toBe("Exported feedback.");
    expect(target.phenotypes.get(phenotype.phenotypeId)?.currentAcceptedVersion).toBe(version.phenotypeVersionId);
    source.close();
    target.close();
  });
});
