import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as core from "@dna/core";

const now = "2026-06-28T00:00:00.000Z";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Phase 22 PRD-14 unified design relationships", () => {
  test("parses graph, group, and species-node same-level design relationships", () => {
    const schema = (core as any).DesignRelationshipSchema;
    expect(schema).toBeDefined();

    const graphRelationship = schema.parse({
      relationshipId: "rel-graph-style-ui",
      source: { type: "graph", graphId: "graph-style" },
      target: { type: "graph", graphId: "graph-ui" },
      relationshipType: "aligns-with",
      direction: "bidirectional",
      description: "UI graph stays aligned with the style graph.",
      designContract: {
        transferRule: "Translate the core motif language into icon readability rules.",
        mustPreserve: ["crescent silhouette"],
        mustAvoid: ["low contrast states"],
        divergenceRule: "UI can simplify texture density.",
        reviewQuestions: ["Does the icon remain readable at small sizes?"]
      },
      auxiliaryRefs: {
        contextIds: ["ctx-style"],
        motifIds: ["motif-crescent"],
        principleIds: ["principle-readability"],
        facetIds: ["facet-tone"],
        rubricIds: ["rubric-icon"],
        referenceIds: ["reference-board"]
      },
      status: "active",
      metadata: { reviewOwner: "ui-art" },
      createdAt: now,
      updatedAt: now
    });
    expect(graphRelationship.source.type).toBe("graph");

    const groupRelationship = schema.parse({
      ...graphRelationship,
      relationshipId: "rel-group-icons-hud",
      source: { type: "species-group", graphId: "graph-ui", groupId: "group-icons" },
      target: { type: "species-group", graphId: "graph-ui", groupId: "group-hud" },
      relationshipType: "translates-to"
    });
    expect(groupRelationship.target.groupId).toBe("group-hud");

    const nodeRelationship = schema.parse({
      ...graphRelationship,
      relationshipId: "rel-node-root-alert",
      source: { type: "species-node", graphId: "graph-ui", nodeId: "node-root" },
      target: { type: "species-node", graphId: "graph-ui", nodeId: "node-alert" },
      relationshipType: "derives-from",
      direction: "source-to-target"
    });
    expect(nodeRelationship.relationshipType).toBe("derives-from");
  });

  test("rejects cross-level design relationship endpoints", () => {
    const schema = (core as any).DesignRelationshipSchema;
    expect(() =>
      schema.parse({
        relationshipId: "rel-invalid",
        source: { type: "graph", graphId: "graph-ui" },
        target: { type: "species-node", graphId: "graph-ui", nodeId: "node-alert" },
        relationshipType: "references",
        direction: "reference-only",
        description: "Invalid cross-level shortcut.",
        status: "draft",
        metadata: {},
        createdAt: now,
        updatedAt: now
      })
    ).toThrow(/same-level/i);
  });

  test("validates relationship type, direction, status, and default contract arrays", () => {
    const schema = (core as any).DesignRelationshipSchema;
    const parsed = schema.parse({
      relationshipId: "rel-node-reference",
      source: { type: "species-node", graphId: "graph-ui", nodeId: "node-a" },
      target: { type: "species-node", graphId: "graph-ui", nodeId: "node-b" },
      relationshipType: "custom:shared-negative-space",
      direction: "reference-only",
      description: "Node A references node B's negative-space rule.",
      designContract: {},
      status: "draft",
      metadata: {},
      createdAt: now,
      updatedAt: now
    });

    expect(parsed.designContract.mustPreserve).toEqual([]);
    expect(parsed.designContract.mustAvoid).toEqual([]);
    expect(parsed.designContract.reviewQuestions).toEqual([]);
    expect(() => schema.parse({ ...parsed, relationshipType: "custom:" })).toThrow();
    expect(() => schema.parse({ ...parsed, direction: "child-to-parent" })).toThrow();
  });

  test("uses relationship vocabulary for node lineage readiness", () => {
    const parsed = core.SpeciesNodeSchema.parse({
      nodeId: "node-child",
      graphId: "graph-ui",
      name: "Child",
      category: "component",
      level: "species",
      parentNodes: ["node-parent"],
      incomingRelationshipIds: [],
      currentVersion: "1.0.0",
      status: "draft",
      lineageStatus: "needs-relationship",
      constraints: {},
      facets: {},
      createdAt: now,
      updatedAt: now
    });

    expect(parsed.incomingRelationshipIds).toEqual([]);
    expect((parsed as any).incomingEdges).toBeUndefined();
    expect(core.resolveLineageStatus({ parentNodes: ["node-parent"], incomingRelationshipIds: [], primaryParent: "node-parent" })).toBe(
      "needs-relationship"
    );
    expect(core.canTransitionStatus("design-relationship", "draft", "active")).toBe(true);
  });

  test("no longer exposes legacy relationship schemas from the core package", () => {
    expect((core as any).EvolutionEdgeSchema).toBeUndefined();
    expect((core as any).EdgeVersionSchema).toBeUndefined();
    expect((core as any).SpeciesGroupRelationSchema).toBeUndefined();
    expect((core as any).GraphBridgeSchema).toBeUndefined();
  });
});

describe("Phase 22 PRD-14 public/runtime surface scan", () => {
  test("normal public docs, skills, and runtime source do not teach legacy relationship concepts", () => {
    const files = [
      "README.md",
      "docs/index.md",
      "docs/design/concept-registry.md",
      "docs/design/system-architecture.md",
      "docs/design/write-boundary-matrix.md",
      "docs/implementation/development-roadmap.md",
      "docs/testing/test-strategy.md",
      "codex-skills/dna-graph-modeling/SKILL.md",
      "codex-skills/dna-graph-editing/SKILL.md",
      "codex-skills/dna-phenotype-generation/SKILL.md",
      "packages/core/src/schemas.ts",
      "packages/core/src/defaults.ts",
      "packages/core/src/status.ts",
      "packages/core/src/modeling-batch.ts",
      "packages/storage/src/index.ts",
      "packages/storage/src/services.ts",
      "packages/sqlite/src/store.ts",
      "apps/cli/src/index.ts"
    ];
    const forbidden = [
      /\bEvolutionEdge\b/,
      /\bEdgeVersion\b/,
      /\bSpeciesGroupRelation\b/,
      /\bGraphBridge\b/,
      /\bgraph-bridge\b/,
      /\bevolution-edge\b/,
      /\bspecies-group-relation\b/,
      /\bincomingEdges\b/,
      /\bneeds-edge\b/,
      /\bedges?\b/i,
      /\bbridges?\b/i,
      /\bgraph\/node\/edge\b/,
      /\bgraph, node, and edge\b/i,
      /\bnode and edge\b/i,
      /\batlases\/<atlas_id>\/bridges\//,
      /\bgraphs\/<graph_id>\/group-relations\//,
      /\bgraphs\/<graph_id>\/edges\//,
      /\bdna edge\b/,
      /\bedge version trace\b/i
    ];

    const matches = files.flatMap((file) => {
      const body = readFileSync(join(projectRoot, file), "utf8");
      return forbidden.filter((term) => term.test(body)).map((term) => `${file}: ${term}`);
    });

    expect(matches).toEqual([]);
  });
});
