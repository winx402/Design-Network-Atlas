import { describe, expect, test } from "vitest";
import {
  acceptPhenotypeVersion,
  addPhenotypeVersionFeedback,
  deprecatePhenotypeVersion,
  replacePhenotypeVersion,
  rollbackPhenotypeVersion,
  updatePhenotypeVersionFeedbackSummary
} from "@dna/application";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode,
  createGenerationJob
} from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";

function seedLifecycleStore() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-life", name: "Lifecycle Graph", purpose: "version lifecycle" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-life", name: "Lifecycle Node" });
  const phenotype = createDefaultPhenotype({
    phenotypeId: "ph-life",
    graphId: graph.graphId,
    nodeId: node.nodeId,
    name: "Lifecycle Phenotype",
    phenotypeType: "image-prompt"
  });
  const candidate = createDefaultPhenotypeVersion({
    phenotypeVersionId: "pv-candidate",
    phenotypeId: phenotype.phenotypeId,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    nodeVersionId: "node-life@1.0.0",
    promptSnapshot: "candidate prompt",
    generationRecipe: { seed: 1 },
    resolvedGeneSnapshot: { color: "red" },
    speciesCompileArtifactId: "sca-1",
    phenotypeCompileArtifactId: "pca-1",
    compileArtifactSnapshot: { artifact: "candidate" }
  });
  const nextCandidate = createDefaultPhenotypeVersion({
    phenotypeVersionId: "pv-next",
    phenotypeId: phenotype.phenotypeId,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    nodeVersionId: "node-life@1.1.0",
    promptSnapshot: "next prompt",
    generationRecipe: { seed: 2 },
    resolvedGeneSnapshot: { color: "blue" },
    speciesCompileArtifactId: "sca-2",
    phenotypeCompileArtifactId: "pca-2",
    compileArtifactSnapshot: { artifact: "next" }
  });

  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  store.phenotypeVersions.create(candidate);
  store.phenotypeVersions.create(nextCandidate);
  store.generationJobs.create(
    createGenerationJob({
      generationJobId: "job-candidate",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: candidate.phenotypeVersionId,
      phenotypeType: "image-prompt",
      taskBrief: "candidate job",
      compilePolicy: graph.compilePolicy,
      inputSnapshot: { generationTaskId: "task-life", generationPlanId: "plan-life" },
      outputSnapshot: { phenotypeVersionId: candidate.phenotypeVersionId },
      tool: "mock",
      status: "generated"
    })
  );
  return { store, candidate, nextCandidate };
}

describe("Phase 27 PRD-18 phenotype version lifecycle application service", () => {
  test("previews and applies accept while preserving generated content", () => {
    const { store, candidate } = seedLifecycleStore();
    const before = store.phenotypeVersions.get(candidate.phenotypeVersionId);

    const preview = acceptPhenotypeVersion(store, {
      phenotypeVersionId: candidate.phenotypeVersionId,
      feedback: "Accepted for current production use."
    });
    expect(preview.persisted).toBe(false);
    expect(preview.statusChanges).toEqual([{ phenotypeVersionId: "pv-candidate", from: "candidate", to: "accepted" }]);
    expect(preview.currentAcceptedVersion).toEqual({ before: null, after: "pv-candidate" });
    expect(store.phenotypes.get("ph-life")?.currentAcceptedVersion).toBeNull();

    const applied = acceptPhenotypeVersion(store, {
      phenotypeVersionId: candidate.phenotypeVersionId,
      feedback: "Accepted for current production use.",
      apply: true
    });
    const updated = store.phenotypeVersions.get(candidate.phenotypeVersionId);

    expect(applied.persisted).toBe(true);
    expect(store.phenotypes.get("ph-life")?.currentAcceptedVersion).toBe(candidate.phenotypeVersionId);
    expect(updated?.status).toBe("accepted");
    expect(updated?.feedback.items[0]).toMatchObject({ source: "human", message: "Accepted for current production use." });
    expect(updated).toMatchObject({
      promptSnapshot: before?.promptSnapshot,
      generationRecipe: before?.generationRecipe,
      resolvedGeneSnapshot: before?.resolvedGeneSnapshot,
      speciesCompileArtifactId: before?.speciesCompileArtifactId,
      phenotypeCompileArtifactId: before?.phenotypeCompileArtifactId,
      compileArtifactSnapshot: before?.compileArtifactSnapshot,
      createdAt: before?.createdAt
    });
    expect(store.generationJobs.get("job-candidate")?.status).toBe("generated");
    expect(applied.provenance.generationJobIds).toEqual(["job-candidate"]);
    expect(applied.provenance.generationTaskIds).toEqual(["task-life"]);
    expect(applied.provenance.generationPlanIds).toEqual(["plan-life"]);
  });

  test("blocks second accept and supports explicit replace and rollback", () => {
    const { store } = seedLifecycleStore();
    acceptPhenotypeVersion(store, { phenotypeVersionId: "pv-candidate", apply: true });

    expect(() => acceptPhenotypeVersion(store, { phenotypeVersionId: "pv-next", apply: true })).toThrow(/replace or rollback/);

    replacePhenotypeVersion(store, {
      oldPhenotypeVersionId: "pv-candidate",
      newPhenotypeVersionId: "pv-next",
      feedback: "Replacing with cleaner output.",
      apply: true
    });
    expect(store.phenotypeVersions.get("pv-candidate")?.status).toBe("replaced");
    expect(store.phenotypeVersions.get("pv-next")?.status).toBe("accepted");
    expect(store.phenotypes.get("ph-life")?.currentAcceptedVersion).toBe("pv-next");

    const rollback = rollbackPhenotypeVersion(store, {
      phenotypeId: "ph-life",
      toPhenotypeVersionId: "pv-candidate",
      feedback: "Rollback after review.",
      apply: true
    });
    expect(rollback.statusChanges).toEqual([
      { phenotypeVersionId: "pv-next", from: "accepted", to: "rolled-back" },
      { phenotypeVersionId: "pv-candidate", from: "replaced", to: "accepted" }
    ]);
    expect(store.phenotypeVersions.get("pv-next")?.status).toBe("rolled-back");
    expect(store.phenotypeVersions.get("pv-candidate")?.status).toBe("accepted");
    expect(store.phenotypes.get("ph-life")?.currentAcceptedVersion).toBe("pv-candidate");
  });

  test("deprecating current accepted clears pointer and feedback writes do not create ReviewRecord dependency", () => {
    const { store } = seedLifecycleStore();
    acceptPhenotypeVersion(store, { phenotypeVersionId: "pv-candidate", apply: true });

    addPhenotypeVersionFeedback(store, {
      phenotypeVersionId: "pv-candidate",
      severity: "blocking",
      source: "agent",
      message: "Needs a shape pass.",
      suggestedAction: "Regenerate silhouette.",
      apply: true
    });
    updatePhenotypeVersionFeedbackSummary(store, {
      phenotypeVersionId: "pv-candidate",
      summary: "Accepted, then deprecated after style review.",
      apply: true
    });
    deprecatePhenotypeVersion(store, { phenotypeVersionId: "pv-candidate", feedback: "No longer matches style.", apply: true });

    const version = store.phenotypeVersions.get("pv-candidate");
    expect(version?.status).toBe("deprecated");
    expect(version?.feedback.summary).toBe("Accepted, then deprecated after style review.");
    expect(version?.feedback.items.map((item) => item.message)).toContain("Needs a shape pass.");
    expect(version?.feedback.items.map((item) => item.message)).toContain("No longer matches style.");
    expect(store.phenotypes.get("ph-life")?.currentAcceptedVersion).toBeNull();
    expect(store.reviews.listByObject("phenotype-version", "pv-candidate")).toEqual([]);
  });
});
