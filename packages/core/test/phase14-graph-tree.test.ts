import { describe, expect, test } from "vitest";
import {
  buildGraphTree,
  createDefaultDesignRelationship,
  createDefaultGraph,
  createDefaultSpeciesNode,
  formatGraphTreeText
} from "@dna/core";

describe("Phase 14 graph tree view", () => {
  test("builds a readable tree while preserving additional parent relations", () => {
    const graph = createDefaultGraph({
      graphId: "graph-tree",
      name: "Tree Graph",
      purpose: "tree output",
      rootNodes: ["node-root", "node-accent"]
    });
    const nodes = [
      createDefaultSpeciesNode({
        graphId: graph.graphId,
        nodeId: "node-root",
        name: "Root Style"
      }),
      createDefaultSpeciesNode({
        graphId: graph.graphId,
        nodeId: "node-accent",
        name: "Accent Motif"
      }),
      createDefaultSpeciesNode({
        graphId: graph.graphId,
        nodeId: "node-child",
        name: "Child Icon",
        parentNodes: ["node-root"],
        primaryParent: "node-root",
        parentRoles: { "node-root": "primary" },
        incomingEdges: ["edge-root-child"],
        lineageStatus: "complete"
      }),
      createDefaultSpeciesNode({
        graphId: graph.graphId,
        nodeId: "node-hybrid",
        name: "Hybrid Icon",
        parentNodes: ["node-root", "node-accent"],
        primaryParent: "node-root",
        parentRoles: { "node-root": "primary", "node-accent": "fusion" },
        incomingEdges: ["edge-root-hybrid", "edge-accent-hybrid"],
        lineageStatus: "multi-origin"
      })
    ];
    const relationships = [
      createDefaultDesignRelationship({
        relationshipId: "rel-root-child",
        source: { type: "species-node", graphId: graph.graphId, nodeId: "node-root" },
        target: { type: "species-node", graphId: graph.graphId, nodeId: "node-child" },
        relationshipType: "derives-from",
        description: "adds warning semantics"
      }),
      createDefaultDesignRelationship({
        relationshipId: "rel-root-hybrid",
        source: { type: "species-node", graphId: graph.graphId, nodeId: "node-root" },
        target: { type: "species-node", graphId: graph.graphId, nodeId: "node-hybrid" },
        relationshipType: "derives-from"
      }),
      createDefaultDesignRelationship({
        relationshipId: "rel-accent-hybrid",
        source: { type: "species-node", graphId: graph.graphId, nodeId: "node-accent" },
        target: { type: "species-node", graphId: graph.graphId, nodeId: "node-hybrid" },
        relationshipType: "translates-to"
      })
    ];

    const tree = buildGraphTree({ graph, nodes, relationships });

    expect(tree.roots.map((root) => root.nodeId)).toEqual(["node-root", "node-accent"]);
    expect(tree.roots[0]?.children.map((child) => child.nodeId)).toEqual(["node-child", "node-hybrid"]);
    expect(tree.additionalRelations).toEqual([
      expect.objectContaining({
        fromNodeId: "node-accent",
        toNodeId: "node-hybrid",
        relationshipId: "rel-accent-hybrid",
        relationshipType: "translates-to",
        parentRole: "fusion"
      })
    ]);
    expect(formatGraphTreeText(tree)).toContain("- Root Style (node-root)");
    expect(formatGraphTreeText(tree)).toContain("  - Hybrid Icon (node-hybrid) [multi-origin]");
    expect(formatGraphTreeText(tree)).toContain("Additional parent relations:");
    expect(formatGraphTreeText(tree)).toContain("- Accent Motif (node-accent) -> Hybrid Icon (node-hybrid) [translates-to, rel-accent-hybrid]");
  });
});
