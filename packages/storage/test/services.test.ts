import { describe, expect, test } from "vitest";
import { createDefaultGraph, createDefaultSpeciesNode } from "@dna/core";
import { createDnaServices, createInMemoryDnaStore } from "@dna/storage";

describe("Phase 2 service and change-set behavior", () => {
  test("createGraph preview returns a change-set without writing", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const result = services.graph.createGraph(
      { graphId: "graph-preview", name: "Preview Graph", purpose: "preview only" },
      { mode: "preview-confirm", apply: false }
    );

    expect(result.changeSet.status).toBe("preview");
    expect(result.changeSet.preview.summary).toContain("create graph graph-preview");
    expect(store.graphs.get("graph-preview")).toBeUndefined();
  });

  test("createGraph apply writes the graph and returns an applied change-set", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const result = services.graph.createGraph(
      { graphId: "graph-apply", name: "Apply Graph", purpose: "apply write" },
      { mode: "preview-confirm", apply: true }
    );

    expect(result.changeSet.status).toBe("applied");
    expect(store.graphs.get("graph-apply")?.name).toBe("Apply Graph");
  });

  test("createNode apply creates a species node and an immutable initial node version", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    store.graphs.create(createDefaultGraph({ graphId: "graph-node", name: "Node Graph", purpose: "node test" }));

    const result = services.lineage.createNode(
      {
        graphId: "graph-node",
        nodeId: "node-root",
        name: "Root Node",
        category: "icon",
        level: "root",
        motifs: ["broken-ring"],
        constraints: { color: "red" }
      },
      { mode: "preview-confirm", apply: true }
    );

    expect(result.changeSet.status).toBe("applied");
    expect(store.nodes.get("node-root")?.motifs).toEqual(["broken-ring"]);
    expect(store.nodeVersions.get("node-root@1.0.0")?.resolvedGeneSnapshot).toMatchObject({
      color: "red",
      motifs: ["broken-ring"]
    });
    expect(store.graphs.get("graph-node")?.rootNodes).toEqual(["node-root"]);
  });

  test("failed apply rolls back all writes in the transaction", () => {
    const store = createInMemoryDnaStore({ failOnNodeVersionCreate: true });
    const services = createDnaServices(store);
    store.graphs.create(createDefaultGraph({ graphId: "graph-rollback", name: "Rollback", purpose: "rollback test" }));

    expect(() =>
      services.lineage.createNode(
        {
          graphId: "graph-rollback",
          nodeId: "node-rollback",
          name: "Rollback Node",
          category: "icon",
          level: "root"
        },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/forced node version failure/);

    expect(store.nodes.get("node-rollback")).toBeUndefined();
    expect(store.nodeVersions.get("node-rollback@1.0.0")).toBeUndefined();
  });

  test("draft-write applies immediately and keeps the created graph in draft", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const result = services.graph.createGraph(
      { graphId: "graph-draft", name: "Draft Graph", purpose: "draft mode" },
      { mode: "draft-write" }
    );

    expect(result.changeSet.status).toBe("applied");
    expect(store.graphs.get("graph-draft")?.status).toBe("draft");
  });

  test("changeset-apply requires an existing preview change-set", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    expect(() =>
      services.graph.createGraph(
        { graphId: "graph-missing-change-set", name: "Missing", purpose: "missing change-set" },
        { mode: "changeset-apply", changeSetId: "cs-missing" }
      )
    ).toThrow(/change-set not found/);
  });

  test("facet service previews and applies definitions, schemas, and assignments through change-sets", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    store.graphs.create(createDefaultGraph({ graphId: "graph-facet", name: "Facet Graph", purpose: "facet test" }));

    const preview = services.facet.createDefinition(
      { facetId: "facet-tone", name: "Tone", valueType: "enum", allowedValues: ["warm", "cool"] },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(store.facetDefinitions.get("facet-tone")).toBeUndefined();

    services.facet.createDefinition(
      { facetId: "facet-tone", name: "Tone", valueType: "enum", allowedValues: ["warm", "cool"] },
      { mode: "preview-confirm", apply: true }
    );
    services.facet.createSchema(
      { facetSchemaId: "schema-tone", name: "Tone Schema", facetIds: ["facet-tone"], requiredFacetIds: ["facet-tone"] },
      { mode: "preview-confirm", apply: true }
    );
    const assignment = services.facet.createAssignment(
      { assignmentId: "assign-graph-tone", targetType: "graph", targetId: "graph-facet", values: { "facet-tone": "warm" } },
      { mode: "preview-confirm", apply: true }
    );

    expect(assignment.changeSet.status).toBe("applied");
    expect(store.facetAssignments.get("assign-graph-tone")?.values).toEqual({ "facet-tone": "warm" });
  });

  test("facet service validates schema references, assignment targets, and allowed values", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    store.graphs.create(createDefaultGraph({ graphId: "graph-facet-validation", name: "Facet Validation", purpose: "facet validation" }));
    services.facet.createDefinition(
      { facetId: "facet-tone", name: "Tone", valueType: "enum", allowedValues: ["warm", "cool"] },
      { mode: "preview-confirm", apply: true }
    );

    expect(() =>
      services.facet.createSchema(
        { facetSchemaId: "schema-missing", name: "Missing Schema", facetIds: ["facet-missing"] },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/facet definition not found: facet-missing/);

    expect(() =>
      services.facet.createAssignment(
        { assignmentId: "assign-missing-target", targetType: "graph", targetId: "graph-missing", values: { "facet-tone": "warm" } },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/assignment target not found/);

    expect(() =>
      services.facet.createAssignment(
        { assignmentId: "assign-bad-value", targetType: "graph", targetId: "graph-facet-validation", values: { "facet-tone": "loud" } },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/not allowed/);
  });
});
