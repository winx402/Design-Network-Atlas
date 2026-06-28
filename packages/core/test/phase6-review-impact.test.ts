import { describe, expect, test } from "vitest";
import {
  collectImpact,
  compareStyleDistance,
  createImpactRecords,
  PhenotypeVersionSchema,
  reviewNode,
  reviewPhenotypeVersion,
  SpeciesNodeSchema
} from "@dna/core";

const now = "2026-06-26T00:00:00.000Z";

function speciesNode() {
  return SpeciesNodeSchema.parse({
    nodeId: "node-warning",
    graphId: "graph-review",
    name: "Warning Icon",
    category: "icon",
    level: "variant",
    parentNodes: ["node-root"],
    primaryParent: "node-root",
    parentRoles: { "node-root": "primary" },
    incomingEdges: ["rel-warning"],
    relatedNodes: [],
    currentVersion: "1.0.0",
    status: "active",
    lineageStatus: "complete",
    styleDescription: "sharp warning icon",
    motifs: ["broken-ring"],
    constraints: { color: "amber" },
    badcases: [],
    facets: {},
    createdAt: now,
    updatedAt: now
  });
}

function phenotypeVersion() {
  return PhenotypeVersionSchema.parse({
    phenotypeVersionId: "pv-warning-1",
    phenotypeId: "ph-warning",
    graphId: "graph-review",
    nodeId: "node-warning",
    nodeVersionId: "node-warning@1.0.0",
    relationshipTrace: ["rel-warning"],
    resolvedGeneSnapshot: {
      color: "amber",
      motifs: ["broken-ring"],
      badcases: ["photorealistic"]
    },
    generationRecipe: { compilePolicy: "system-rule-first" },
    generationBrief: "toolbar warning icon",
    promptSnapshot: [
      "Design Network Atlas phenotype request.",
      "Species: Warning Icon.",
      "Motifs: broken-ring.",
      "Constraints: color=amber.",
      "Avoid: photorealistic."
    ].join("\n"),
    tool: "manual",
    toolParameters: {},
    assetIds: ["asset-front", "asset-angle"],
    status: "pending-confirmation",
    reviewRecords: [],
    facets: {},
    createdAt: now
  });
}

describe("Phase 6 review and impact analysis", () => {
  test("node review reports missing required dimensions", () => {
    const review = reviewNode({ node: speciesNode(), requiredDimensions: ["color", "stroke", "visual_motif"] });

    expect(review.status).toBe("needs-review");
    expect(review.missingDimensions).toEqual(["stroke"]);
    expect(review.suggestedActions).toEqual(["fill required dimension: stroke"]);
  });

  test("phenotype version review reports missing motif, missing constraint, and forbidden prompt text", () => {
    const review = reviewPhenotypeVersion({
      version: phenotypeVersion(),
      requiredMotifs: ["broken-ring", "sharp-corner"],
      requiredConstraints: { color: "amber", stroke: "2px" },
      forbiddenText: ["photorealistic"]
    });

    expect(review.status).toBe("fail");
    expect(review.missingDimensions).toEqual(["motif:sharp-corner", "constraint:stroke"]);
    expect(review.constraintViolations).toEqual(["prompt must avoid forbidden text: photorealistic"]);
    expect(review.suggestedActions).toEqual([
      "restore required motif: sharp-corner",
      "fill required constraint: stroke",
      "remove forbidden prompt text: photorealistic"
    ]);
  });

  test("style distance reports shared and different motifs and constraints", () => {
    const distance = compareStyleDistance(
      { motifs: ["broken-ring", "triangle"], constraints: { color: "amber", stroke: "2px" } },
      { motifs: ["broken-ring", "diamond"], constraints: { color: "red", stroke: "2px", shadow: "hard" } }
    );

    expect(distance.sharedMotifs).toEqual(["broken-ring"]);
    expect(distance.differingMotifs).toEqual(["triangle", "diamond"]);
    expect(distance.differingConstraints).toEqual(["color", "shadow"]);
    expect(distance.summary).toContain("motif differences");
  });

  test("design relationship changes impact the target species, its phenotype versions, and downstream descendants", () => {
    const impacts = collectImpact({
      changed: { type: "design-relationship", id: "rel-root-warning", versionId: "rel-root-warning@2.0.0" },
      nodes: [
        { nodeId: "node-warning", phenotypeVersionIds: ["pv-warning"] },
        { nodeId: "node-alert", phenotypeVersionIds: ["pv-alert"] }
      ],
      relationships: [
        { relationshipId: "rel-root-warning", fromNodeId: "node-root", toNodeId: "node-warning" },
        { relationshipId: "rel-warning-alert", fromNodeId: "node-warning", toNodeId: "node-alert" }
      ]
    });

    expect(impacts.map((impact) => impact.objectId)).toEqual(["node-warning", "pv-warning", "node-alert", "pv-alert"]);
  });

  test("impact summaries can be materialized as pending impact records without mutating affected versions", () => {
    const impacts = collectImpact({
      changed: { type: "node", id: "node-root", versionId: "node-root@2.0.0" },
      nodes: [
        { nodeId: "node-warning", phenotypeVersionIds: ["pv-warning"] },
        { nodeId: "node-alert", phenotypeVersionIds: ["pv-alert"] }
      ],
      relationships: [
        { relationshipId: "rel-root-warning", fromNodeId: "node-root", toNodeId: "node-warning" },
        { relationshipId: "rel-warning-alert", fromNodeId: "node-warning", toNodeId: "node-alert" }
      ]
    });

    const records = createImpactRecords({
      graphId: "graph-review",
      changed: { type: "node", id: "node-root", versionId: "node-root@2.0.0" },
      impacts,
      createdAt: now
    });

    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({
      impactRecordId: "impact-node-root-node-warning-0",
      graphId: "graph-review",
      changedObjectType: "node",
      changedObjectId: "node-root",
      changedVersionId: "node-root@2.0.0",
      objectType: "node",
      objectId: "node-warning",
      reviewStatus: "pending"
    });
  });
});
