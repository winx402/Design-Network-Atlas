import { describe, expect, test } from "vitest";
import {
  GraphSchema,
  SpeciesNodeSchema,
  PhenotypeVersionSchema,
  compileSpecies,
  compareStyleDistance,
  collectImpact,
  reviewNode
} from "@dna/core";

const now = "2026-06-26T00:00:00.000Z";

describe("DNA core domain schemas", () => {
  test("keeps visual motifs as explicit content and facets as extension metadata", () => {
    const node = SpeciesNodeSchema.parse({
      nodeId: "node-icon-root",
      graphId: "graph-ui",
      name: "基础图标",
      category: "icon",
      level: "root",
      parentNodes: [],
      parentRoles: {},
      incomingRelationshipIds: [],
      relatedNodes: [],
      currentVersion: "1.0.0",
      status: "draft",
      lineageStatus: "species-first",
      motifs: ["broken-ring"],
      constraints: { stroke: "2px", grid: "24px" },
      badcases: ["photo-realistic"],
      facets: { uiIcon: { platform: "ios" } },
      createdAt: now,
      updatedAt: now
    });

    expect(node.motifs).toEqual(["broken-ring"]);
    expect(node.facets).toEqual({ uiIcon: { platform: "ios" } });
  });

  test("rejects a primary parent that is not declared in parent nodes", () => {
    expect(() =>
      SpeciesNodeSchema.parse({
        nodeId: "node-child",
        graphId: "graph-ui",
        name: "子图标",
        category: "icon",
        level: "variant",
        parentNodes: ["node-parent-a"],
        primaryParent: "node-parent-b",
        parentRoles: { "node-parent-a": "primary" },
        incomingRelationshipIds: [],
        relatedNodes: [],
        currentVersion: "1.0.0",
        status: "draft",
        lineageStatus: "needs-relationship",
        motifs: [],
        constraints: {},
        badcases: [],
        facets: {},
        createdAt: now,
        updatedAt: now
      })
    ).toThrow(/primaryParent/);
  });

  test("allows one phenotype version to own multiple asset variants", () => {
    const version = PhenotypeVersionSchema.parse({
      phenotypeVersionId: "pv-1",
      phenotypeId: "ph-1",
      graphId: "graph-ui",
      nodeId: "node-icon-root",
      nodeVersionId: "nv-1",
      relationshipTrace: [],
      resolvedGeneSnapshot: { motifs: ["broken-ring"] },
      generationRecipe: { compilePolicy: "system-rule-first" },
      generationBrief: "mobile toolbar icon",
      promptSnapshot: "Design a mobile toolbar icon with a broken ring motif.",
      tool: "manual",
      toolParameters: {},
      assetIds: ["asset-1", "asset-2"],
      status: "candidate",
      reviewRecords: [],
      facets: {},
      createdAt: now
    });

    expect(version.assetIds).toHaveLength(2);
  });
});

describe("DNA core behavior", () => {
  test("compiles system-rule-first constraints without silently hiding conflicts", () => {
    const graph = GraphSchema.parse({
      graphId: "graph-ui",
      name: "UI 图标",
      purpose: "icon family",
      status: "active",
      currentVersion: "1.0.0",
      rootNodes: ["node-parent"],
      templateIds: [],
      versionPolicy: { defaultBump: "minor" },
      compilePolicy: { type: "system-rule-first" },
      facets: {},
      createdAt: now,
      updatedAt: now
    });

    const node = SpeciesNodeSchema.parse({
      nodeId: "node-child",
      graphId: "graph-ui",
      name: "危险图标",
      category: "icon",
      level: "variant",
      parentNodes: ["node-parent"],
      primaryParent: "node-parent",
      parentRoles: { "node-parent": "primary" },
      incomingRelationshipIds: ["rel-1"],
      relatedNodes: [],
      currentVersion: "1.0.0",
      status: "active",
      lineageStatus: "complete",
      motifs: ["broken-ring"],
      constraints: { color: "red", stroke: "2px" },
      badcases: [],
      facets: {},
      createdAt: now,
      updatedAt: now
    });

    const result = compileSpecies({
      graph,
      node,
      parentSnapshots: [{ nodeVersionId: "nv-parent", snapshot: { color: "blue", grid: "24px" } }],
      relationshipDeltas: [{ relationshipId: "rel-1", delta: { color: "red", danger: true } }],
      taskBrief: "generate warning icon",
      phenotypeType: "image-prompt"
    });

    expect(result.resolvedGeneSnapshot).toMatchObject({ color: "red", grid: "24px", danger: true });
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({ key: "color", previousValue: "blue", nextValue: "red" })
    );
    expect(result.prompt).toContain("broken-ring");
  });

  test("reviews required template dimensions and reports style distance", () => {
    const review = reviewNode({
      node: SpeciesNodeSchema.parse({
        nodeId: "node-review",
        graphId: "graph-ui",
        name: "待审查图标",
        category: "icon",
        level: "variant",
        parentNodes: [],
        parentRoles: {},
        incomingRelationshipIds: [],
        relatedNodes: [],
        currentVersion: "1.0.0",
        status: "draft",
        lineageStatus: "species-first",
        motifs: ["broken-ring"],
        constraints: { color: "red" },
        badcases: [],
        facets: {},
        createdAt: now,
        updatedAt: now
      }),
      requiredDimensions: ["color", "stroke", "visual_motif"]
    });

    expect(review.status).toBe("needs-review");
    expect(review.missingDimensions).toEqual(["stroke"]);

    const distance = compareStyleDistance(
      { motifs: ["broken-ring"], constraints: { color: "red", stroke: "2px" } },
      { motifs: ["hex-module"], constraints: { color: "red", stroke: "4px" } }
    );

    expect(distance.differingMotifs).toEqual(["broken-ring", "hex-module"]);
    expect(distance.score).toBeGreaterThan(0);
  });

  test("collects downstream impact for changed nodes and design relationships", () => {
    const impacts = collectImpact({
      changed: { type: "node", id: "node-a", versionId: "nv-2" },
      nodes: [
        { nodeId: "node-a", phenotypeVersionIds: [] },
        { nodeId: "node-b", phenotypeVersionIds: ["pv-b"] },
        { nodeId: "node-c", phenotypeVersionIds: ["pv-c"] }
      ],
      relationships: [
        { relationshipId: "rel-ab", fromNodeId: "node-a", toNodeId: "node-b" },
        { relationshipId: "rel-bc", fromNodeId: "node-b", toNodeId: "node-c" }
      ]
    });

    expect(impacts.map((impact) => impact.objectId)).toEqual(["node-b", "pv-b", "node-c", "pv-c"]);
  });
});
