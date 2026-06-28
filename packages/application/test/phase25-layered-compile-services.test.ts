import { describe, expect, test } from "vitest";
import {
  prepareEntityCompileArtifact,
  preparePhenotypeCompileArtifact,
  preparePhenotypeGeneration,
  prepareSpeciesCompileArtifact
} from "../src/index.js";
import {
  createDefaultAtlas,
  createDefaultContextAttachment,
  createDefaultDesignContext,
  createDefaultDesignRelationship,
  createDefaultFacetAssignment,
  createDefaultFacetDefinition,
  createDefaultFacetSchema,
  createDefaultGraph,
  createDefaultNodeVersion,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesNode
} from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";

function seedLayeredStore() {
  const store = new InMemoryDnaStore();
  const atlas = createDefaultAtlas({ atlasId: "atlas-layered", name: "Layered Atlas", purpose: "compile pipeline", graphIds: ["graph-layered"] });
  const graph = createDefaultGraph({ graphId: "graph-layered", name: "Layered Graph", purpose: "layered compile", currentVersion: "1.0.0" });
  const group = createDefaultSpeciesGroup({
    graphId: graph.graphId,
    groupId: "group-layered",
    name: "Layered Group",
    sharedFacts: ["group shared fact"],
    facetSchemaIds: ["schema-layered"]
  });
  const parent = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-parent", name: "Parent Node" });
  const node = createDefaultSpeciesNode({
    graphId: graph.graphId,
    nodeId: "node-layered",
    name: "Layered Node",
    parentNodes: [parent.nodeId],
    primaryParent: parent.nodeId,
    constraints: { shape: "ring" }
  });
  const context = createDefaultDesignContext({
    contextId: "ctx-layered",
    name: "Layered Context",
    contextType: "production",
    summary: "Compile context",
    version: "1.0.0"
  });

  store.atlases.create(atlas);
  store.graphs.create(graph);
  store.speciesGroups.create(group);
  store.nodes.create(parent);
  store.nodes.create(node);
  store.nodeVersions.create(
    createDefaultNodeVersion({ graphId: graph.graphId, nodeId: parent.nodeId, nodeVersionId: "node-parent@1.0.0", resolvedGeneSnapshot: { color: "red" } })
  );
  store.speciesGroupMemberships.create(
    createDefaultSpeciesGroupMembership({ graphId: graph.graphId, groupId: group.groupId, nodeId: node.nodeId, membershipId: "membership-layered" })
  );
  store.designRelationships.create(
    createDefaultDesignRelationship({
      relationshipId: "rel-layered-node",
      source: { type: "species-node", graphId: graph.graphId, nodeId: parent.nodeId },
      target: { type: "species-node", graphId: graph.graphId, nodeId: node.nodeId },
      relationshipType: "derives-from",
      metadata: { deltaGenes: { color: "amber" } }
    })
  );
  store.designContexts.create(context);
  store.contextAttachments.create(
    createDefaultContextAttachment({
      attachmentId: "att-graph-layered",
      contextId: context.contextId,
      targetType: "graph",
      targetId: graph.graphId,
      compileLayer: "graph-context"
    })
  );
  store.contextAttachments.create(
    createDefaultContextAttachment({
      attachmentId: "att-group-layered",
      contextId: context.contextId,
      targetType: "species-group",
      targetId: group.groupId,
      compileLayer: "group-context"
    })
  );
  store.facetDefinitions.create(createDefaultFacetDefinition({ facetId: "facet-layered", name: "Layered Facet" }));
  store.facetSchemas.create(createDefaultFacetSchema({ facetSchemaId: "schema-layered", name: "Layered Schema", facetIds: ["facet-layered"] }));
  store.facetAssignments.create(
    createDefaultFacetAssignment({
      assignmentId: "assign-node-layered",
      targetType: "species-node",
      targetId: node.nodeId,
      values: { "facet-layered": "active" }
    })
  );
  return { store, atlas, graph, group, node };
}

describe("Phase 25 PRD-16 application layered compile services", () => {
  test("assembles store-backed atlas, graph, group, species, and phenotype artifacts without CLI parsing", () => {
    const { store, atlas, graph, group, node } = seedLayeredStore();

    const atlasArtifact = prepareEntityCompileArtifact(store, {
      artifactId: "eca-atlas",
      targetLevel: "atlas",
      atlasId: atlas.atlasId
    });
    const graphArtifact = prepareEntityCompileArtifact(store, {
      artifactId: "eca-graph",
      targetLevel: "graph",
      graphId: graph.graphId,
      upstreamArtifacts: [atlasArtifact]
    });
    const groupArtifact = prepareEntityCompileArtifact(store, {
      artifactId: "eca-group",
      targetLevel: "species-group",
      graphId: graph.graphId,
      groupId: group.groupId,
      upstreamArtifacts: [graphArtifact]
    });
    const speciesArtifact = prepareSpeciesCompileArtifact(store, {
      artifactId: "sca-layered",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      upstreamArtifacts: [graphArtifact, groupArtifact]
    });
    const phenotypeArtifact = preparePhenotypeCompileArtifact(store, {
      artifactId: "pca-layered",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeType: "ui-icon",
      taskBrief: "layered icon",
      speciesArtifact
    });

    expect(atlasArtifact.frames.map((frame) => frame.level)).toEqual(["atlas"]);
    expect(graphArtifact.frames.map((frame) => frame.level)).toEqual(["atlas", "graph"]);
    expect(groupArtifact.frames.map((frame) => frame.level)).toEqual(["atlas", "graph", "species-group"]);
    expect(speciesArtifact.frames.map((frame) => frame.level)).toEqual(["atlas", "graph", "species-group", "species-node"]);
    expect(phenotypeArtifact.frames.map((frame) => frame.level)).toEqual(["atlas", "graph", "species-group", "species-node", "phenotype"]);
    expect(speciesArtifact.dependencyVector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "entity-compile-artifact", objectId: "eca-graph", role: "inherited" }),
        expect.objectContaining({ objectType: "entity-compile-artifact", objectId: "eca-group", role: "inherited" })
      ])
    );
    expect(store.entityCompileArtifacts.listByGraph(graph.graphId)).toEqual([]);
    expect(store.speciesCompileArtifacts.listByGraph(graph.graphId)).toEqual([]);
    expect(store.phenotypeCompileArtifacts.listByGraph(graph.graphId)).toEqual([]);
  });

  test("formal generation records layered artifact summaries and rejects stale supplied artifacts unless historical replay is explicit", () => {
    const { store, graph, node } = seedLayeredStore();
    const speciesArtifact = prepareSpeciesCompileArtifact(store, {
      artifactId: "sca-generation-layered",
      graphId: graph.graphId,
      nodeId: node.nodeId
    });
    const phenotypeArtifact = preparePhenotypeCompileArtifact(store, {
      artifactId: "pca-generation-layered",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeType: "ui-icon",
      taskBrief: "layered icon",
      speciesArtifact
    });
    store.speciesCompileArtifacts.create({
      ...speciesArtifact,
      dependencyVector: speciesArtifact.dependencyVector.map((ref) =>
        ref.objectType === "graph" && ref.objectId === graph.graphId ? { ...ref, versionId: "0.9.0" } : ref
      )
    });
    store.phenotypeCompileArtifacts.create({
      ...phenotypeArtifact,
      dependencyVector: phenotypeArtifact.dependencyVector.map((ref) =>
        ref.objectType === "graph" && ref.objectId === graph.graphId ? { ...ref, versionId: "0.9.0" } : ref
      )
    });

    expect(() =>
      preparePhenotypeGeneration(store, {
        graphId: graph.graphId,
        nodeId: node.nodeId,
        phenotypeType: "ui-icon",
        name: "Layered Icon",
        taskBrief: "layered icon",
        phenotypeArtifactId: phenotypeArtifact.artifactId
      })
    ).toThrow(/stale compile artifact/);

    const replay = preparePhenotypeGeneration(store, {
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeType: "ui-icon",
      name: "Layered Icon",
      taskBrief: "layered icon",
      phenotypeArtifactId: phenotypeArtifact.artifactId,
      replayHistorical: true,
      ids: {
        phenotypeId: "ph-layered",
        phenotypeVersionId: "pv-layered",
        generationJobId: "job-layered"
      }
    });

    expect(replay.phenotypeVersion.compileArtifactSnapshot).toMatchObject({
      species: { frameCount: expect.any(Number), feedbackCount: expect.any(Number) },
      phenotype: { frameCount: expect.any(Number), decisionCount: expect.any(Number) },
      validity: { state: "historical" }
    });
    expect(replay.job.inputSnapshot).toMatchObject({
      compileMode: "historical-replay",
      speciesCompileArtifactId: speciesArtifact.artifactId,
      phenotypeCompileArtifactId: phenotypeArtifact.artifactId
    });
  });
});
