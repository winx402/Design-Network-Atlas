import {
  buildSpeciesCompileInput,
  collectContextImpact,
  collectGraphBridgeImpact,
  collectGroupImpact,
  preparePhenotypeGeneration,
  updatePhenotypeVersionStatus
} from "@dna/application";
import {
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultAtlas,
  createDefaultContextAttachment,
  createDefaultContextFact,
  createDefaultDesignContext,
  createDefaultEvolutionEdge,
  createDefaultGraph,
  createDefaultGraphBridge,
  createDefaultNodeVersion,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesGroupRelation,
  createDefaultSpeciesNode
} from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";
import { describe, expect, test } from "vitest";

describe("Phase 21 PRD-11 application services", () => {
  test("buildSpeciesCompileInput assembles graph, lineage, group, and context inputs without CLI", () => {
    const store = new InMemoryDnaStore();
    const graph = createDefaultGraph({ graphId: "graph-app", name: "Application Graph", purpose: "service test" });
    const parent = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-parent", name: "Parent" });
    const child = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-child",
      name: "Child",
      parentNodes: [parent.nodeId],
      primaryParent: parent.nodeId,
      incomingEdges: ["edge-parent-child"]
    });
    const edge = createDefaultEvolutionEdge({
      graphId: graph.graphId,
      edgeId: "edge-parent-child",
      fromNodeId: parent.nodeId,
      toNodeId: child.nodeId,
      deltaGenes: { color: "red" }
    });
    const group = createDefaultSpeciesGroup({ graphId: graph.graphId, groupId: "group-app", name: "Group" });
    const context = createDefaultDesignContext({
      contextId: "ctx-app",
      name: "Context",
      contextType: "worldview",
      factIds: ["fact-app"]
    });
    const fact = createDefaultContextFact({ factId: "fact-app", factType: "world-rule", statement: "Use red warnings." });

    store.graphs.create(graph);
    store.nodes.create(parent);
    store.nodes.create(child);
    store.nodeVersions.create(createDefaultNodeVersion({ graphId: graph.graphId, nodeId: parent.nodeId, nodeVersionId: "node-parent@1.0.0", resolvedGeneSnapshot: { motif: "ring" } }));
    store.edges.create(edge);
    store.edgeVersions.create({
      edgeVersionId: "edge-parent-child@1.0.0",
      edgeId: edge.edgeId,
      graphId: graph.graphId,
      version: "1.0.0",
      deltaGenes: { color: "red" },
      valueResolution: {},
      mustPreserve: [],
      mustAvoid: [],
      changeSummary: "initial",
      createdAt: "2026-06-27T00:00:00.000Z"
    });
    store.speciesGroups.create(group);
    store.speciesGroupMemberships.create(
      createDefaultSpeciesGroupMembership({ graphId: graph.graphId, groupId: group.groupId, nodeId: child.nodeId, membershipId: "mem-app" })
    );
    store.designContexts.create(context);
    store.contextFacts.create(fact);
    store.contextAttachments.create(
      createDefaultContextAttachment({
        attachmentId: "att-app",
        contextId: context.contextId,
        targetType: "species-group",
        targetId: group.groupId
      })
    );

    const input = buildSpeciesCompileInput(store, { graphId: graph.graphId, nodeId: child.nodeId });

    expect(input.graph.graphId).toBe(graph.graphId);
    expect(input.node.nodeId).toBe(child.nodeId);
    expect(input.parentSnapshots).toEqual([{ parentNodeId: parent.nodeId, nodeVersionId: "node-parent@1.0.0", snapshot: { motif: "ring" } }]);
    expect(input.edgeDeltas).toEqual([{ edgeVersionId: "edge-parent-child@1.0.0", delta: { color: "red" } }]);
    expect(input.speciesGroups.map((value) => value.groupId)).toEqual([group.groupId]);
    expect(input.designContexts.map((value) => value.contextId)).toEqual([context.contextId]);
    expect(input.contextFacts.map((value) => value.factId)).toEqual([fact.factId]);
  });

  test("impact services collect group, bridge, context, and status behavior without CLI", () => {
    const store = new InMemoryDnaStore();
    const sourceGraph = createDefaultGraph({ graphId: "graph-source", name: "Source", purpose: "source" });
    const targetGraph = createDefaultGraph({ graphId: "graph-target", name: "Target", purpose: "target" });
    const node = createDefaultSpeciesNode({ graphId: sourceGraph.graphId, nodeId: "node-impact", name: "Impact Node" });
    const targetNode = createDefaultSpeciesNode({ graphId: targetGraph.graphId, nodeId: "node-target", name: "Target Node" });
    const group = createDefaultSpeciesGroup({ graphId: sourceGraph.graphId, groupId: "group-impact", name: "Impact Group" });
    const otherGroup = createDefaultSpeciesGroup({ graphId: sourceGraph.graphId, groupId: "group-other", name: "Other Group" });
    const context = createDefaultDesignContext({ contextId: "ctx-impact", name: "Impact Context", contextType: "worldview" });
    const atlas = createDefaultAtlas({ atlasId: "atlas-impact", name: "Atlas" });
    const bridge = createDefaultGraphBridge({
      bridgeId: "bridge-impact",
      atlasId: atlas.atlasId,
      sourceGraphId: sourceGraph.graphId,
      targetGraphId: targetGraph.graphId,
      bridgeType: "theme-transfer"
    });
    const version = createDefaultPhenotypeVersion({
      phenotypeVersionId: "pv-impact@1.0.0",
      phenotypeId: "ph-impact",
      graphId: sourceGraph.graphId,
      nodeId: node.nodeId
    });

    store.graphs.create(sourceGraph);
    store.graphs.create(targetGraph);
    store.nodes.create(node);
    store.nodes.create(targetNode);
    store.speciesGroups.create(group);
    store.speciesGroups.create(otherGroup);
    store.speciesGroupMemberships.create(
      createDefaultSpeciesGroupMembership({ graphId: sourceGraph.graphId, groupId: group.groupId, nodeId: node.nodeId, membershipId: "mem-impact" })
    );
    store.speciesGroupRelations.create(
      createDefaultSpeciesGroupRelation({
        graphId: sourceGraph.graphId,
        relationId: "rel-impact",
        sourceGroupId: group.groupId,
        targetGroupId: otherGroup.groupId,
        relationType: "related-system"
      })
    );
    store.designContexts.create(context);
    store.contextAttachments.create(
      createDefaultContextAttachment({ attachmentId: "att-impact", contextId: context.contextId, targetType: "species-node", targetId: node.nodeId })
    );
    store.atlases.create(atlas);
    store.graphBridges.create(bridge);
    store.phenotypeVersions.create(version);
    store.phenotypeVersions.create(
      createDefaultPhenotypeVersion({
        phenotypeVersionId: "pv-target@1.0.0",
        phenotypeId: "ph-target",
        graphId: targetGraph.graphId,
        nodeId: targetNode.nodeId
      })
    );

    expect(collectGroupImpact(store, { graphId: sourceGraph.graphId, groupId: group.groupId }).map((impact) => impact.objectId)).toEqual([
      node.nodeId,
      version.phenotypeVersionId,
      otherGroup.groupId
    ]);
    expect(collectGraphBridgeImpact(store, { bridgeId: bridge.bridgeId }).map((impact) => impact.objectId)).toContain(targetGraph.graphId);
    expect(collectContextImpact(store, { graphId: sourceGraph.graphId, contextId: context.contextId }).map((impact) => impact.objectId)).toContain(
      version.phenotypeVersionId
    );

    updatePhenotypeVersionStatus(store, { phenotypeVersionId: version.phenotypeVersionId, status: "accepted" });
    expect(store.phenotypeVersions.get(version.phenotypeVersionId)?.status).toBe("accepted");
  });

  test("prepares formal phenotype generation through compile artifacts without persisting preview records", () => {
    const store = new InMemoryDnaStore();
    const graph = createDefaultGraph({ graphId: "graph-generate", name: "Generation Graph", purpose: "formal generation" });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-warning-icon",
      name: "Warning Icon",
      motifs: ["broken-ring"],
      constraints: { color: "red", readability: "high" }
    });

    store.graphs.create(graph);
    store.nodes.create(node);

    const prepared = preparePhenotypeGeneration(store, {
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeType: "ui-icon",
      name: "Warning Icon Prompt",
      taskBrief: "toolbar warning icon",
      tool: "manual",
      ids: {
        speciesArtifactId: "sca-formal",
        phenotypeArtifactId: "pca-formal",
        phenotypeId: "ph-formal",
        phenotypeVersionId: "pv-formal",
        generationJobId: "job-formal"
      }
    });

    expect(prepared.createdSpeciesArtifact).toBe(true);
    expect(prepared.createdPhenotypeArtifact).toBe(true);
    expect(prepared.speciesArtifact?.artifactId).toBe("sca-formal");
    expect(prepared.phenotypeArtifact.artifactId).toBe("pca-formal");
    expect(prepared.phenotypeArtifact.speciesCompileArtifactId).toBe("sca-formal");
    expect(prepared.phenotypeVersion).toMatchObject({
      speciesCompileArtifactId: "sca-formal",
      phenotypeCompileArtifactId: "pca-formal",
      compileArtifactSnapshot: {
        speciesCompileArtifactId: "sca-formal",
        phenotypeCompileArtifactId: "pca-formal"
      }
    });
    expect(prepared.job.inputSnapshot).toMatchObject({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      taskBrief: "toolbar warning icon",
      phenotypeType: "ui-icon",
      speciesCompileArtifactId: "sca-formal",
      phenotypeCompileArtifactId: "pca-formal"
    });
    expect(prepared.prompt).toBe(prepared.phenotypeArtifact.prompt);
    expect(store.speciesCompileArtifacts.listByGraph(graph.graphId)).toEqual([]);
    expect(store.phenotypeCompileArtifacts.listByGraph(graph.graphId)).toEqual([]);
    expect(store.phenotypeVersions.listByNode(node.nodeId)).toEqual([]);
    expect(store.generationJobs.listByGraph(graph.graphId)).toEqual([]);
  });

  test("validates explicit phenotype compile artifacts before formal generation replay", () => {
    const store = new InMemoryDnaStore();
    const graph = createDefaultGraph({ graphId: "graph-replay", name: "Replay Graph", purpose: "artifact replay" });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-replay",
      name: "Replay Node",
      constraints: { silhouette: "sharp" }
    });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-replay",
      graph,
      node,
      nodeVersionId: "node-replay@1.0.0"
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-replay",
      graph,
      node,
      nodeVersionId: "node-replay@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "sharp replay icon",
      speciesArtifact
    });

    store.graphs.create(graph);
    store.nodes.create(node);
    store.speciesCompileArtifacts.create(speciesArtifact);
    store.phenotypeCompileArtifacts.create(phenotypeArtifact);

    expect(() =>
      preparePhenotypeGeneration(store, {
        graphId: graph.graphId,
        nodeId: node.nodeId,
        phenotypeType: "concept-art",
        name: "Wrong Replay",
        taskBrief: "sharp replay icon",
        phenotypeArtifactId: phenotypeArtifact.artifactId
      })
    ).toThrow(/phenotype compile artifact pca-replay does not match phenotype type concept-art/);

    const replay = preparePhenotypeGeneration(store, {
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeType: "ui-icon",
      name: "Replay",
      taskBrief: "sharp replay icon",
      phenotypeArtifactId: phenotypeArtifact.artifactId,
      ids: {
        phenotypeId: "ph-replay",
        phenotypeVersionId: "pv-replay",
        generationJobId: "job-replay"
      }
    });

    expect(replay.createdSpeciesArtifact).toBe(false);
    expect(replay.createdPhenotypeArtifact).toBe(false);
    expect(replay.speciesArtifact?.artifactId).toBe(speciesArtifact.artifactId);
    expect(replay.phenotypeVersion.phenotypeCompileArtifactId).toBe(phenotypeArtifact.artifactId);
  });
});
