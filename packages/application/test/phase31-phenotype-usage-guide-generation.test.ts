import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultNodeVersion,
  createDefaultPhenotype,
  createDefaultPhenotypeUsageGuide,
  createDefaultSpeciesNode
} from "@dna/core";
import { persistPhenotypeGeneration, preparePhenotypeGeneration } from "@dna/application";
import { InMemoryDnaStore } from "@dna/storage";

function seedStore(withGuide: boolean) {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-guide-gen", name: "Guide Generation Graph", purpose: "guide generation" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-guide-gen", name: "Guide Generation Species" });
  const phenotype = createDefaultPhenotype({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: "ph-guide-gen",
    name: "Guide Generation Phenotype",
    phenotypeType: "ui-icon",
    status: "planned"
  });
  store.graphs.create(graph);
  store.nodes.create(node);
  store.nodeVersions.create(
    createDefaultNodeVersion({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      nodeVersionId: "node-guide-gen@1.0.0",
      resolvedGeneSnapshot: { silhouette: "sharp" }
    })
  );
  store.phenotypes.create(phenotype);
  if (withGuide) {
    store.phenotypeUsageGuides.create(
      createDefaultPhenotypeUsageGuide({
        usageGuideId: "guide-generation",
        phenotypeId: phenotype.phenotypeId,
        graphId: graph.graphId,
        nodeId: node.nodeId,
        phenotypeType: phenotype.phenotypeType,
        title: "Generation guide",
        summary: "Use for recoverable runtime warnings.",
        usageScenarios: [{ scenarioId: "runtime", name: "Runtime", designIntent: "Warn without blocking.", priority: "primary" }],
        usageInstructions: { primaryUse: "Display next to warning copy." },
        designSemantics: { mustPreserve: ["sharp silhouette"], mustAvoid: ["success color"] },
        variantPlan: [{ variantId: "default", name: "Default", purpose: "runtime baseline", required: true }],
        productionHints: { suggestedAssetTypes: ["image"] },
        reviewChecklist: [{ checklistId: "check-guide", question: "Matches the guide?", severity: "blocking" }],
        sourceSummary: "Confirmed guide."
      })
    );
  }
  return { store, graph, node, phenotype };
}

describe("Phase 31 PRD-22 usage guides in formal generation", () => {
  test("includes active guide snapshot in phenotype compile artifact, version, and generation job", () => {
    const { store, graph, node, phenotype } = seedStore(true);

    const prepared = preparePhenotypeGeneration(store, {
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeType: phenotype.phenotypeType,
      name: phenotype.name,
      taskBrief: "Generate warning icon"
    });

    expect(prepared.phenotypeArtifact.usageGuideSnapshot).toMatchObject({
      usageGuideId: "guide-generation",
      usageGuideRevision: 1,
      summary: "Use for recoverable runtime warnings.",
      mustPreserve: ["sharp silhouette"],
      mustAvoid: ["success color"]
    });
    expect(prepared.phenotypeVersion).toMatchObject({
      usageGuideId: "guide-generation",
      usageGuideRevision: 1
    });
    expect(prepared.job.inputSnapshot).toMatchObject({
      usageGuideId: "guide-generation",
      usageGuideRevision: 1,
      usageGuideSummary: expect.objectContaining({
        summary: "Use for recoverable runtime warnings.",
        selectedScenarios: ["Runtime"]
      })
    });

    persistPhenotypeGeneration(store, prepared);
    expect(store.phenotypeUsageGuides.get("guide-generation")?.revision).toBe(1);
  });

  test("records a compile warning when a target phenotype lacks a usage guide", () => {
    const { store, graph, node, phenotype } = seedStore(false);

    const prepared = preparePhenotypeGeneration(store, {
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeType: phenotype.phenotypeType,
      name: phenotype.name,
      taskBrief: "Generate warning icon"
    });

    expect(prepared.phenotypeArtifact.usageGuideSnapshot).toBeUndefined();
    expect(prepared.phenotypeArtifact.feedback.map((item) => item.reason)).toContain(
      "phenotype ph-guide-gen is missing an active usage guide"
    );
    expect(prepared.job.inputSnapshot).toMatchObject({
      usageGuideWarning: "phenotype ph-guide-gen is missing an active usage guide"
    });
  });
});
