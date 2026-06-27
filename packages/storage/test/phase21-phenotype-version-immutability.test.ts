import { createDefaultPhenotypeVersion } from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "../../..");

function immutableVersion() {
  return createDefaultPhenotypeVersion({
    phenotypeVersionId: "pv-immutable@1.0.0",
    phenotypeId: "ph-immutable",
    graphId: "graph-immutable",
    nodeId: "node-immutable",
    nodeVersionId: "node-immutable@1.0.0",
    resolvedGeneSnapshot: { color: "red" },
    generationRecipe: { seed: 42 },
    promptSnapshot: "Generate a red warning icon",
    speciesCompileArtifactId: "species-artifact-immutable",
    phenotypeCompileArtifactId: "phenotype-artifact-immutable",
    compileArtifactSnapshot: { prompt: "Generate a red warning icon" },
    status: "pending-confirmation"
  });
}

describe("Phase 21 PRD-10 memory phenotype version immutability", () => {
  test("repository exposes status-only update and preserves content fields", () => {
    const store = new InMemoryDnaStore();
    const version = immutableVersion();
    store.phenotypeVersions.create(version);

    expect((store.phenotypeVersions as unknown as { update?: unknown }).update).toBeUndefined();

    store.phenotypeVersions.updateStatus(version.phenotypeVersionId, "accepted");
    const updated = store.phenotypeVersions.get(version.phenotypeVersionId);

    expect(updated).toMatchObject({
      status: "accepted",
      promptSnapshot: version.promptSnapshot,
      generationRecipe: version.generationRecipe,
      resolvedGeneSnapshot: version.resolvedGeneSnapshot,
      speciesCompileArtifactId: version.speciesCompileArtifactId,
      phenotypeCompileArtifactId: version.phenotypeCompileArtifactId,
      compileArtifactSnapshot: version.compileArtifactSnapshot
    });
  });

  test("status-only update validates phenotype version transitions", () => {
    const store = new InMemoryDnaStore();
    const version = immutableVersion();
    store.phenotypeVersions.create({ ...version, status: "accepted" });

    expect(() => store.phenotypeVersions.updateStatus(version.phenotypeVersionId, "pending-confirmation")).toThrow(
      /Invalid phenotype-version status transition: accepted -> pending-confirmation/
    );
  });

  test("public docs describe content immutability and status-only lifecycle changes", () => {
    const docs = [
      readFileSync(resolve(root, "docs/design/system-architecture.md"), "utf8"),
      readFileSync(resolve(root, "docs/design/concept-registry.md"), "utf8")
    ].join("\n");

    expect(docs).toContain("PhenotypeVersion");
    expect(docs).toContain("content immutable");
    expect(docs).toContain("status-only");
    expect(docs).toContain("assertCanTransitionStatus");
  });
});
