import { describe, expect, test } from "vitest";
import {
  assessDesignReadiness,
  preparePhenotypeGeneration,
  showDesignReadiness
} from "../src/index.js";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultSpeciesNode
} from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";

function seedReadinessStore() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-service-readiness", name: "Service Readiness", purpose: "icon production" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-service-readiness", name: "Service Directory Node" });
  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(
    createDefaultPhenotype({
      phenotypeId: "ph-service-readiness",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeType: "ui-icon",
      name: "Service Icon",
      objectBrief: "small icon"
    })
  );
  return { store, graph, node };
}

describe("Phase 33 PRD-23 application design readiness services", () => {
  test("assesses readiness by creating a new compile artifact and never mutates old artifacts", () => {
    const { store, graph } = seedReadinessStore();

    const preview = assessDesignReadiness(store, {
      targetType: "graph",
      targetId: graph.graphId,
      artifactId: "eca-readiness-preview",
      policy: "warn"
    });
    expect(preview.persisted).toBe(false);
    expect(preview.readiness).toMatchObject({ targetLevel: "graph", targetId: graph.graphId });
    expect(store.entityCompileArtifacts.get("eca-readiness-preview")).toBeUndefined();

    const applied = assessDesignReadiness(
      store,
      {
        targetType: "graph",
        targetId: graph.graphId,
        artifactId: "eca-readiness-applied",
        policy: "warn"
      },
      { apply: true }
    );
    expect(applied.persisted).toBe(true);
    expect(store.entityCompileArtifacts.get("eca-readiness-applied")?.frames.at(-1)?.readiness).toMatchObject({
      targetLevel: "graph",
      targetId: graph.graphId
    });

    const shown = showDesignReadiness(store, { targetType: "graph", targetId: graph.graphId });
    expect(shown?.artifactId).toBe("eca-readiness-applied");
    expect(shown?.readiness.targetId).toBe(graph.graphId);
  });

  test("formal generation records readiness summaries and block policy rejects blocked targets", () => {
    const { store, graph, node } = seedReadinessStore();

    const warned = preparePhenotypeGeneration(store, {
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: "ph-service-readiness",
      phenotypeType: "ui-icon",
      name: "Service Icon",
      taskBrief: "small icon",
      readinessPolicy: "warn"
    });
    expect(warned.job.inputSnapshot).toMatchObject({
      readinessPolicy: "warn",
      designReadiness: {
        species: expect.objectContaining({ targetLevel: "species-node" }),
        phenotype: expect.objectContaining({ targetLevel: "phenotype" })
      }
    });
    expect(warned.phenotypeVersion.compileArtifactSnapshot).toMatchObject({
      species: { readiness: expect.objectContaining({ targetLevel: "species-node" }) },
      phenotype: { readiness: expect.objectContaining({ targetLevel: "phenotype" }) }
    });

    expect(() =>
      preparePhenotypeGeneration(store, {
        graphId: graph.graphId,
        nodeId: node.nodeId,
        phenotypeId: "ph-service-readiness",
        phenotypeType: "ui-icon",
        name: "Service Icon",
        taskBrief: "small icon",
        readinessPolicy: "block"
      })
    ).toThrow(/design readiness blocked/);
  });
});
