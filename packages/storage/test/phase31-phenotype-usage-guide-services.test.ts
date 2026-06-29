import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultSpeciesNode,
  renderPhenotypeUsageGuideMarkdown
} from "@dna/core";
import { createDnaServices, InMemoryDnaStore } from "@dna/storage";

function seedStore() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-guide", name: "Guide Graph", purpose: "usage guide service" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-guide", name: "Guide Species" });
  const phenotype = createDefaultPhenotype({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: "ph-guide",
    name: "Guide Phenotype",
    phenotypeType: "ui-icon",
    status: "planned"
  });
  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  return { store, graph, node, phenotype };
}

const guideInput = {
  usageGuideId: "guide-service",
  title: "Service guide",
  summary: "Stable phenotype usage for service tests.",
  usageScenarios: [{ scenarioId: "primary", name: "Primary", designIntent: "Explain the output.", priority: "primary" as const }],
  usageInstructions: { primaryUse: "Use where the phenotype is expected." },
  designSemantics: { mustPreserve: ["identity"], mustAvoid: ["wrong state"] },
  variantPlan: [{ variantId: "default", name: "Default", purpose: "baseline", required: true }],
  productionHints: { suggestedAssetTypes: ["image"] },
  reviewChecklist: [{ checklistId: "check-purpose", question: "Does it match the usage?", severity: "warning" as const }],
  sourceSummary: "Confirmed by service test."
};

describe("Phase 31 PRD-22 phenotype usage guide services", () => {
  test("creates guides through preview/apply and enforces one active guide per phenotype", () => {
    const { store, phenotype } = seedStore();
    const services = createDnaServices(store);

    const preview = services.phenotypeGuide.create(
      { phenotypeId: phenotype.phenotypeId, ...guideInput },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(preview.changeSet.objectType).toBe("phenotype-usage-guide");
    expect(store.phenotypeUsageGuides.get("guide-service")).toBeUndefined();

    const created = services.phenotypeGuide.create(
      { phenotypeId: phenotype.phenotypeId, ...guideInput },
      { mode: "preview-confirm", apply: true }
    );
    expect(created.value).toMatchObject({ phenotypeId: phenotype.phenotypeId, status: "active", revision: 1 });
    expect(store.phenotypeUsageGuides.getActiveByPhenotype(phenotype.phenotypeId)?.usageGuideId).toBe("guide-service");

    expect(() =>
      services.phenotypeGuide.create(
        { phenotypeId: phenotype.phenotypeId, ...guideInput, usageGuideId: "guide-duplicate" },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/active usage guide already exists/);
  });

  test("updates revision, archives guides, and renders markdown without mutating phenotype content", () => {
    const { store, phenotype } = seedStore();
    const services = createDnaServices(store);
    services.phenotypeGuide.create({ phenotypeId: phenotype.phenotypeId, ...guideInput }, { mode: "preview-confirm", apply: true });

    const updated = services.phenotypeGuide.update(
      {
        usageGuideId: "guide-service",
        summary: "Updated stable usage summary.",
        reviewChecklist: [{ checklistId: "check-updated", question: "Updated review?", severity: "info" }]
      },
      { mode: "preview-confirm", apply: true }
    ).value;
    expect(updated.revision).toBe(2);
    expect(updated.summary).toBe("Updated stable usage summary.");
    expect(store.phenotypes.get(phenotype.phenotypeId)).toEqual(phenotype);
    expect(renderPhenotypeUsageGuideMarkdown(updated)).toContain("Updated stable usage summary.");

    const archived = services.phenotypeGuide.archive("guide-service", { mode: "preview-confirm", apply: true }).value;
    expect(archived.status).toBe("archived");
    expect(store.phenotypeUsageGuides.getActiveByPhenotype(phenotype.phenotypeId)).toBeUndefined();
  });
});
