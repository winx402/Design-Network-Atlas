import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultPhenotypeVersion } from "@dna/core";
import { SqliteDnaStore } from "@dna/sqlite";
import { describe, expect, test } from "vitest";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

function immutableVersion() {
  return createDefaultPhenotypeVersion({
    phenotypeVersionId: "pv-sqlite-immutable@1.0.0",
    phenotypeId: "ph-sqlite-immutable",
    graphId: "graph-sqlite-immutable",
    nodeId: "node-sqlite-immutable",
    nodeVersionId: "node-sqlite-immutable@1.0.0",
    resolvedGeneSnapshot: { silhouette: "sharp" },
    generationRecipe: { model: "manual", seed: 7 },
    promptSnapshot: "Generate a sharp silhouette icon",
    speciesCompileArtifactId: "species-artifact-sqlite",
    phenotypeCompileArtifactId: "phenotype-artifact-sqlite",
    compileArtifactSnapshot: { prompt: "Generate a sharp silhouette icon" },
    status: "candidate"
  });
}

describe("Phase 21 PRD-10 SQLite phenotype version immutability", () => {
  test("updateLifecycleMetadata changes only row lifecycle metadata", () => {
    const store = new SqliteDnaStore(tempDb("phenotype-version-immutability"));
    store.migrate();
    const version = immutableVersion();
    store.phenotypeVersions.create(version);

    expect((store.phenotypeVersions as unknown as { update?: unknown }).update).toBeUndefined();

    store.phenotypeVersions.updateLifecycleMetadata(version.phenotypeVersionId, {
      status: "accepted",
      feedback: {
        summary: "Accepted metadata.",
        items: []
      }
    });
    const row = store.db
      .prepare("SELECT status, payload FROM phenotype_versions WHERE phenotype_version_id = ?")
      .get(version.phenotypeVersionId) as { status: string; payload: string };
    const payload = JSON.parse(row.payload);

    expect(row.status).toBe("accepted");
    expect(payload.status).toBe("accepted");
    expect(payload.feedback).toEqual({ summary: "Accepted metadata.", items: [] });
    expect(payload.promptSnapshot).toBe(version.promptSnapshot);
    expect(payload.generationRecipe).toEqual(version.generationRecipe);
    expect(payload.resolvedGeneSnapshot).toEqual(version.resolvedGeneSnapshot);
    expect(payload.speciesCompileArtifactId).toBe(version.speciesCompileArtifactId);
    expect(payload.phenotypeCompileArtifactId).toBe(version.phenotypeCompileArtifactId);
    expect(payload.compileArtifactSnapshot).toEqual(version.compileArtifactSnapshot);
    store.close();
  });
});
