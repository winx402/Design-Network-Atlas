import { describe, expect, test } from "vitest";
import {
  AssetIndexSchema,
  ChangeSetSchema,
  DesignRelationshipSchema,
  GeneTemplateSchema,
  GenerationJobSchema,
  GraphSchema,
  PhenotypeSchema,
  TemplatePackSchema,
  bumpVersion,
  canTransitionStatus,
  createDefaultPhenotypeVersion,
  isVersionOutdated,
  resolveLineageStatus
} from "@dna/core";

const now = "2026-06-26T00:00:00.000Z";

describe("Phase 1 domain object coverage", () => {
  test("graph schema accepts multiple root nodes and rejects invalid compile policies", () => {
    const graph = GraphSchema.parse({
      graphId: "graph-multi-root",
      name: "Multi Root Graph",
      purpose: "test graph roots",
      status: "active",
      currentVersion: "1.0.0",
      rootNodes: ["node-shape", "node-material"],
      templateIds: ["template-ui"],
      versionPolicy: { defaultBump: "minor" },
      compilePolicy: { type: "system-rule-first" },
      facets: { product: "DNA" },
      createdAt: now,
      updatedAt: now
    });

    expect(graph.rootNodes).toEqual(["node-shape", "node-material"]);
    expect(() =>
      GraphSchema.parse({
        ...graph,
        compilePolicy: { type: "unknown-policy" }
      })
    ).toThrow(/compilePolicy/);
  });

  test("template pack and gene template preserve dimension groups and phenotype suggestions", () => {
    const pack = TemplatePackSchema.parse({
      templatePackId: "pack-ui",
      name: "UI Pack",
      version: "0.1.0",
      domain: "ui-icon",
      status: "active",
      description: "test pack",
      facets: { uiIcon: { platform: "web" } },
      createdAt: now,
      updatedAt: now
    });
    const template = GeneTemplateSchema.parse({
      templateId: "template-ui-icon",
      templatePackId: pack.templatePackId,
      version: "0.1.0",
      domain: "ui-icon",
      scope: "node",
      extends: ["base-visual"],
      requiredDimensions: ["visual_motif", "grid", "stroke"],
      recommendedDimensions: ["semantic_token"],
      optionalDimensions: ["figma_variable"],
      forbiddenDimensions: ["photorealistic_material"],
      dimensionSchema: { visual_motif: "recognizable structure" },
      propertyResolution: { visual_motif: "must-preserve" },
      reviewQuestions: ["Does the icon preserve the motif?"],
      phenotypeTypeSuggestions: ["image-prompt", "svg-spec", "review-checklist"],
      compatibility: { dna: "0.1.x" },
      status: "active",
      facets: { uiIcon: { defaultGrid: "24px" } },
      createdAt: now,
      updatedAt: now
    });

    expect(template.requiredDimensions).toContain("visual_motif");
    expect(template.forbiddenDimensions).toEqual(["photorealistic_material"]);
    expect(template.phenotypeTypeSuggestions).toEqual(["image-prompt", "svg-spec", "review-checklist"]);
  });

  test("design relationship schema accepts planned types with contract fields", () => {
    const relationshipTypes = ["derives-from", "translates-to", "aligns-with", "diverges-from", "references", "constrains", "custom:campaign-link"];
    for (const relationshipType of relationshipTypes) {
      const relationship = DesignRelationshipSchema.parse({
        relationshipId: `rel-${relationshipType.replace(":", "-")}`,
        source: { type: "species-node", graphId: "graph-design", nodeId: "node-child" },
        target: { type: "species-node", graphId: "graph-design", nodeId: "node-parent" },
        relationshipType,
        direction: "source-to-target",
        description: "test design relation",
        designContract: {
          transferRule: "child keeps parent silhouette while changing color",
          mustPreserve: ["broken-ring"],
          mustAvoid: ["photorealistic"],
          reviewQuestions: ["Does the child preserve the parent motif?"]
        },
        status: "active",
        metadata: {},
        createdAt: now,
        updatedAt: now
      });
      expect(relationship.designContract.transferRule).toContain("silhouette");
      expect(relationship.designContract.mustPreserve).toEqual(["broken-ring"]);
    }
  });

  test("asset index schema covers pointer, role, tags, and variant role", () => {
    const asset = AssetIndexSchema.parse({
      assetId: "asset-angle",
      uri: "eagle://library/asset-angle",
      storageType: "eagle",
      assetType: "image",
      role: "output",
      linkedObjectType: "phenotype-version",
      linkedObjectId: "pv-1",
      variantRole: "angle-variant",
      description: "45 degree render",
      tags: ["warning", "icon"],
      status: "active",
      checksum: "sha256-test",
      notes: "variant pointer only",
      facets: { image: { angle: 45 } },
      createdAt: now,
      updatedAt: now
    });

    expect(asset.variantRole).toBe("angle-variant");
    expect(asset.tags).toEqual(["warning", "icon"]);
  });

  test("phenotype schema supports custom type source and default version status", () => {
    const phenotype = PhenotypeSchema.parse({
      phenotypeId: "ph-custom",
      graphId: "graph-ui",
      nodeId: "node-ui",
      phenotypeType: "shader-spec",
      phenotypeTypeSource: "custom",
      name: "Shader Spec",
      objectBrief: "custom output",
      tags: [],
      status: "active",
      facets: {},
      createdAt: now,
      updatedAt: now
    });
    const version = createDefaultPhenotypeVersion({
      graphId: phenotype.graphId,
      nodeId: phenotype.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: "pv-custom"
    });

    expect(phenotype.phenotypeTypeSource).toBe("custom");
    expect(version.status).toBe("candidate");
  });

  test("generation job and change set schemas preserve snapshots without requiring sensitive values", () => {
    const job = GenerationJobSchema.parse({
      generationJobId: "job-1",
      graphId: "graph-ui",
      nodeId: "node-ui",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar icon",
      compilePolicy: { type: "system-rule-first" },
      inputSnapshot: { nodeVersionId: "node-ui@1.0.0" },
      outputSnapshot: { prompt: "prompt text" },
      tool: "manual",
      toolParameters: { size: "1024x1024", seed: 123 },
      status: "generated",
      facets: {},
      createdAt: now,
      updatedAt: now
    });
    const changeSet = ChangeSetSchema.parse({
      changeSetId: "cs-1",
      mode: "preview-confirm",
      objectType: "graph",
      operation: "create",
      status: "preview",
      preview: {
        summary: "create graph",
        diff: { graphId: "graph-ui" },
        impact: []
      },
      payload: { graphId: "graph-ui" },
      createdAt: now
    });

    expect(job.toolParameters).toEqual({ size: "1024x1024", seed: 123 });
    expect(changeSet.status).toBe("preview");
  });
});

describe("Phase 1 status and version rules", () => {
  test("status transitions allow forward lifecycle changes and block archived reactivation", () => {
    expect(canTransitionStatus("node", "draft", "active")).toBe(true);
    expect(canTransitionStatus("node", "active", "deprecated")).toBe(true);
    expect(canTransitionStatus("node", "deprecated", "archived")).toBe(true);
    expect(canTransitionStatus("node", "archived", "active")).toBe(false);
  });

  test("lineage status is derived from parent and design relationship completeness", () => {
    expect(resolveLineageStatus({ parentNodes: [], incomingRelationshipIds: [], primaryParent: undefined })).toBe("species-first");
    expect(resolveLineageStatus({ parentNodes: ["node-a"], incomingRelationshipIds: [], primaryParent: "node-a" })).toBe("needs-relationship");
    expect(resolveLineageStatus({ parentNodes: ["node-a"], incomingRelationshipIds: ["rel-a"], primaryParent: "node-a" })).toBe("complete");
    expect(resolveLineageStatus({ parentNodes: ["node-a", "node-b"], incomingRelationshipIds: ["rel-a", "rel-b"], primaryParent: undefined })).toBe(
      "multi-origin"
    );
  });

  test("semantic versions bump predictably and compare outdated versions", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
    expect(isVersionOutdated("1.2.3", "1.2.4")).toBe(true);
    expect(isVersionOutdated("1.2.4", "1.2.4")).toBe(false);
  });
});
