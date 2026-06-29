import { describe, expect, test } from "vitest";
import {
  createDefaultContextFact,
  createDefaultContextReviewRubric,
  createDefaultDesignContext,
  createDefaultDesignPrinciple,
  createDefaultGraph,
  createDefaultSpeciesNode
} from "@dna/core";
import { createDnaServices, createInMemoryDnaStore } from "@dna/storage";

describe("Phase 30 issue #19 mutation services", () => {
  test("updates graph facets through preview/apply without replacing unrelated fields", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    store.graphs.create(createDefaultGraph({ graphId: "graph-update", name: "Original", purpose: "initial", facets: { keep: "yes" } }));

    const preview = services.graph.updateGraph(
      { graphId: "graph-update", name: "Preview Name", setFacets: { slice: "runtime-ui" }, unsetFacets: ["missing"] },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(preview.value.facets).toEqual({ keep: "yes", slice: "runtime-ui" });
    expect(store.graphs.get("graph-update")?.name).toBe("Original");

    const applied = services.graph.updateGraph(
      { graphId: "graph-update", purpose: "updated", setFacets: { responsive: true, apiKey: "sk-should-not-persist" }, unsetFacets: ["keep"] },
      { mode: "preview-confirm", apply: true }
    );
    expect(applied.changeSet.status).toBe("applied");
    expect(store.graphs.get("graph-update")).toMatchObject({
      name: "Original",
      purpose: "updated",
      facets: { responsive: true }
    });
    expect(store.graphs.get("graph-update")?.facets).not.toHaveProperty("apiKey");
  });

  test("updates context membership idempotently and validates referenced records", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    store.designContexts.create(createDefaultDesignContext({ contextId: "context-update", name: "Context", contextType: "art-direction", summary: "initial" }));
    store.contextFacts.create(createDefaultContextFact({ factId: "fact-one", factType: "custom", statement: "fact" }));
    store.designPrinciples.create(createDefaultDesignPrinciple({ principleId: "principle-one", statement: "principle" }));
    store.contextReviewRubrics.create(createDefaultContextReviewRubric({ rubricId: "rubric-one", dimension: "readability", question: "Readable?" }));

    const preview = services.context.updateContext(
      {
        contextId: "context-update",
        summary: "preview",
        appendFactIds: ["fact-one", "fact-one"],
        appendPrincipleIds: ["principle-one"],
        appendReviewRubricIds: ["rubric-one"],
        appendNegativeBoundaries: [" do not flatten "],
        appendSourceRefs: ["source-a", "OPENAI_API_KEY=sk-should-redact"]
      },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.value).toMatchObject({
      summary: "preview",
      factIds: ["fact-one"],
      principleIds: ["principle-one"],
      reviewRubricIds: ["rubric-one"],
      negativeBoundaries: ["do not flatten"],
      sourceRefs: ["source-a", "[redacted]"]
    });
    expect(store.designContexts.get("context-update")?.summary).toBe("initial");

    services.context.updateContext(
      {
        contextId: "context-update",
        appendFactIds: ["fact-one"],
        appendSourceRefs: ["source-a"],
        removeFactIds: ["missing-fact"],
        removeSourceRefs: ["missing-source"]
      },
      { mode: "preview-confirm", apply: true }
    );
    expect(store.designContexts.get("context-update")).toMatchObject({
      factIds: ["fact-one"],
      sourceRefs: ["source-a"]
    });
    expect(() => services.context.updateContext({ contextId: "context-update", appendFactIds: ["missing"] }, { mode: "preview-confirm", apply: true })).toThrow(
      /context fact not found: missing/
    );
    expect(() => services.context.updateContext({ contextId: "context-update", appendSourceRefs: [" "] }, { mode: "preview-confirm", apply: true })).toThrow(
      /append-source-ref cannot be empty/
    );
  });

  test("creates planned phenotype containers without versions jobs assets or output references", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    store.graphs.create(createDefaultGraph({ graphId: "graph-phenotype", name: "Phenotype Graph", purpose: "planned phenotypes" }));
    store.nodes.create(createDefaultSpeciesNode({ graphId: "graph-phenotype", nodeId: "node-phenotype", name: "Node", category: "ui", level: "species" }));

    const preview = services.phenotype.createPlanned(
      {
        phenotypeId: "phenotype-planned",
        graphId: "graph-phenotype",
        nodeId: "node-phenotype",
        phenotypeType: "icon",
        name: "Planned Icon",
        objectBrief: "plan only",
        facets: { state: "warning", password: "secret-value" },
        outputPlan: { expectedAssetTypes: ["image"], reviewRubricIds: [] }
      },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(preview.value.status).toBe("planned");
    expect(preview.value.facets).not.toHaveProperty("password");
    expect(store.phenotypes.get("phenotype-planned")).toBeUndefined();

    const applied = services.phenotype.createPlanned(
      {
        phenotypeId: "phenotype-planned",
        graphId: "graph-phenotype",
        nodeId: "node-phenotype",
        phenotypeType: "icon",
        name: "Planned Icon",
        objectBrief: "plan only",
        facets: { password: "secret-value" }
      },
      { mode: "preview-confirm", apply: true }
    );
    expect(applied.changeSet.status).toBe("applied");
    expect(store.phenotypes.get("phenotype-planned")).toMatchObject({ status: "planned" });
    expect(store.phenotypes.get("phenotype-planned")?.facets).not.toHaveProperty("password");
    expect(store.phenotypeVersions.listByPhenotype("phenotype-planned")).toEqual([]);
    expect(store.generationJobs.listByGraph("graph-phenotype")).toEqual([]);
    expect(store.assets.search({ graphId: "graph-phenotype" })).toEqual([]);
    expect(store.outputReferences.listByGraph("graph-phenotype")).toEqual([]);
  });
});
