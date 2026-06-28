import { describe, expect, test } from "vitest";
import { compileSpecies, GraphSchema, SpeciesNodeSchema } from "@dna/core";

const now = "2026-06-26T00:00:00.000Z";

function graph(policy: "system-rule-first" | "snapshot-fixed") {
  return GraphSchema.parse({
    graphId: `graph-${policy}`,
    name: "Compile Graph",
    purpose: "compile tests",
    status: "active",
    currentVersion: "1.0.0",
    rootNodes: ["node-parent"],
    templateIds: [],
    versionPolicy: { defaultBump: "minor" },
    compilePolicy: { type: policy },
    facets: {},
    createdAt: now,
    updatedAt: now
  });
}

function node() {
  return SpeciesNodeSchema.parse({
    nodeId: "node-warning",
    graphId: "graph-system-rule-first",
    name: "Warning Icon",
    category: "icon",
    level: "variant",
    parentNodes: ["node-parent"],
    primaryParent: "node-parent",
    parentRoles: { "node-parent": "primary" },
    incomingRelationshipIds: ["rel-warning"],
    relatedNodes: [],
    currentVersion: "1.0.0",
    status: "active",
    lineageStatus: "complete",
    styleDescription: "sharp warning icon",
    motifs: ["broken-ring"],
    constraints: { color: "amber", stroke: "2px" },
    badcases: ["photorealistic"],
    facets: {},
    createdAt: now,
    updatedAt: now
  });
}

describe("Phase 5 compile policies and phenotype production text", () => {
  test("system-rule-first records every override in source order", () => {
    const result = compileSpecies({
      graph: graph("system-rule-first"),
      node: node(),
      parentSnapshots: [{ nodeVersionId: "node-parent@1.0.0", snapshot: { color: "blue", grid: "24px" } }],
      relationshipDeltas: [{ relationshipId: "rel-warning", delta: { color: "red", danger: true } }],
      taskBrief: "toolbar warning icon",
      phenotypeType: "image-prompt"
    });

    expect(result.resolvedGeneSnapshot).toMatchObject({
      color: "amber",
      grid: "24px",
      danger: true,
      stroke: "2px",
      motifs: ["broken-ring"],
      badcases: ["photorealistic"]
    });
    expect(result.conflicts.map((conflict) => `${conflict.key}:${conflict.previousValue}->${conflict.nextValue}`)).toEqual([
      "color:blue->red",
      "color:red->amber"
    ]);
    expect(result.relationshipTrace).toEqual(["rel-warning"]);
  });

  test("snapshot-fixed uses the fixed snapshot instead of recomputing parent and relationship deltas", () => {
    const result = compileSpecies({
      graph: graph("snapshot-fixed"),
      node: node(),
      parentSnapshots: [{ nodeVersionId: "node-parent@1.0.0", snapshot: { color: "blue", grid: "24px" } }],
      relationshipDeltas: [{ relationshipId: "rel-warning", delta: { color: "red", danger: true } }],
      fixedSnapshot: { color: "green", grid: "16px", motifs: ["fixed-ring"] },
      taskBrief: "toolbar warning icon",
      phenotypeType: "art-brief"
    });

    expect(result.resolvedGeneSnapshot).toEqual({ color: "green", grid: "16px", motifs: ["fixed-ring"] });
    expect(result.conflicts).toEqual([]);
    expect(result.compilePolicy).toBe("snapshot-fixed");
  });

  test("prompt and brief output are stable for review-checklist phenotypes", () => {
    const result = compileSpecies({
      graph: graph("system-rule-first"),
      node: node(),
      parentSnapshots: [{ nodeVersionId: "node-parent@1.0.0", snapshot: { grid: "24px" } }],
      relationshipDeltas: [{ relationshipId: "rel-warning", delta: { semantic: "danger" } }],
      taskBrief: "check if generated icon stays inside the warning family",
      phenotypeType: "review-checklist"
    });

    expect(result.prompt).toMatchInlineSnapshot(`
      "Design Network Atlas phenotype request.
      Type: review-checklist.
      Task: check if generated icon stays inside the warning family.
      Species: Warning Icon.
      Motifs: broken-ring.
      Constraints: color=amber, stroke=2px.
      Avoid: photorealistic."
    `);
    expect(result.brief).toBe(
      "Produce review-checklist for Warning Icon: check if generated icon stays inside the warning family"
    );
  });
});
