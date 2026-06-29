import { describe, expect, test } from "vitest";
import {
  compileEntityArtifact,
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultContextAttachment,
  createDefaultDesignContext,
  createDefaultDesignRelationship,
  createDefaultFacetAssignment,
  createDefaultFacetDefinition,
  createDefaultFacetSchema,
  createDefaultGraph,
  createDefaultSpeciesGroup,
  createDefaultSpeciesNode,
  DesignReadinessResultSchema,
  detectSelfOptimizationCandidates,
  evaluateDesignReadinessPolicy
} from "../src/index.js";

describe("Phase 33 PRD-23 design readiness and self-optimization core", () => {
  test("embeds per-level design readiness in layered compile frames", () => {
    const graph = createDefaultGraph({ graphId: "graph-readiness", name: "Readiness Graph", purpose: "production UI design language" });
    const group = createDefaultSpeciesGroup({
      graphId: graph.graphId,
      groupId: "group-readiness",
      name: "Warning Components",
      sharedFacts: ["warning components preserve strong silhouette"],
      facetSchemaIds: ["schema-readiness"]
    });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-readiness",
      name: "Warning Badge",
      constraints: { silhouette: "shield", contrast: "high" },
      motifs: ["split-ring"],
      badcases: ["decorative-only badge"]
    });
    const relationship = createDefaultDesignRelationship({
      relationshipId: "rel-readiness",
      source: { type: "species-node", graphId: graph.graphId, nodeId: "node-base" },
      target: { type: "species-node", graphId: graph.graphId, nodeId: node.nodeId },
      relationshipType: "derives-from",
      description: "Badge derives from warning base.",
      designContract: {
        transferRule: "preserve warning readability",
        mustPreserve: ["silhouette"],
        mustAvoid: ["soft contrast"],
        divergenceRule: "new badge may change ornament only",
        reviewQuestions: ["Is the warning role still visible?"]
      }
    });
    const context = createDefaultDesignContext({
      contextId: "ctx-readiness",
      name: "Readiness Context",
      contextType: "production-rationale",
      summary: "Warning symbols must be recognized quickly."
    });
    const attachment = createDefaultContextAttachment({
      attachmentId: "att-readiness",
      contextId: context.contextId,
      targetType: "graph",
      targetId: graph.graphId
    });
    const facet = createDefaultFacetDefinition({ facetId: "facet-readiness", name: "Readiness facet", valueType: "enum", allowedValues: ["reviewed"] });
    const schema = createDefaultFacetSchema({
      facetSchemaId: "schema-readiness",
      name: "Readiness schema",
      facetIds: [facet.facetId],
      requiredFacetIds: [facet.facetId]
    });
    const assignment = createDefaultFacetAssignment({
      assignmentId: "assign-readiness",
      targetType: "species-node",
      targetId: node.nodeId,
      values: { [facet.facetId]: "reviewed" }
    });

    const graphArtifact = compileEntityArtifact({
      artifactId: "eca-readiness",
      targetLevel: "graph",
      graph,
      designRelationships: [relationship],
      designContexts: [context],
      contextAttachments: [attachment],
      facetDefinitions: [facet],
      facetSchemas: [schema],
      facetAssignments: [assignment]
    });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-readiness",
      graph,
      node,
      nodeVersionId: "node-readiness@1.0.0",
      upstreamArtifacts: [graphArtifact],
      speciesGroups: [group],
      designRelationships: [relationship],
      designContexts: [context],
      contextAttachments: [attachment],
      facetDefinitions: [facet],
      facetSchemas: [schema],
      facetAssignments: [assignment]
    });

    const graphReadiness = DesignReadinessResultSchema.parse(graphArtifact.frames.find((frame) => frame.level === "graph")?.readiness);
    expect(graphReadiness).toMatchObject({
      enabled: true,
      targetLevel: "graph",
      targetId: graph.graphId,
      evaluator: "system"
    });
    expect(graphReadiness.dimensions.map((dimension) => dimension.key)).toEqual(
      expect.arrayContaining(["graph-purpose", "graph-context-language", "graph-relationship-contracts", "graph-facet-coverage"])
    );
    expect(graphReadiness.score).toBeGreaterThanOrEqual(50);

    const nodeReadiness = DesignReadinessResultSchema.parse(speciesArtifact.frames.find((frame) => frame.level === "species-node")?.readiness);
    expect(nodeReadiness.dimensions.map((dimension) => dimension.key)).toEqual(
      expect.arrayContaining(["species-phenotype-readiness", "species-constraints", "species-motifs-badcases", "species-relationship-contracts"])
    );
    expect(nodeReadiness.dependencyVector).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "species-node", objectId: node.nodeId })])
    );
  });

  test("phenotype readiness references usage guide revision and policy can block low readiness", () => {
    const graph = createDefaultGraph({ graphId: "graph-phenotype-ready", name: "Phenotype Ready Graph", purpose: "icons" });
    const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-empty", name: "Directory Node" });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-low-readiness",
      graph,
      node,
      nodeVersionId: "node-empty@1.0.0"
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-guide-ready",
      graph,
      node,
      nodeVersionId: "node-empty@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "small runtime icon",
      speciesArtifact,
      usageGuideSnapshot: {
        usageGuideId: "guide-ready",
        usageGuideRevision: 2,
        phenotypeId: "ph-ready",
        title: "Ready icon guide",
        summary: "Use as a small HUD warning icon.",
        primaryUsageScenario: "HUD warning",
        selectedScenarios: ["HUD warning"],
        mustPreserve: ["shield silhouette"],
        mustAvoid: ["soft contrast"],
        variantPlan: [{ variantId: "default", name: "Default", purpose: "runtime", required: true }],
        reviewChecklist: [{ checklistId: "review", question: "Readable at 32px?", severity: "warning" }],
        productionHints: { suggestedAssetTypes: ["image"] }
      }
    });
    const phenotypeReadiness = DesignReadinessResultSchema.parse(phenotypeArtifact.frames.at(-1)?.readiness);
    expect(phenotypeReadiness.boundVersionRef).toBe("phenotype-usage-guide:guide-ready@2");
    expect(phenotypeArtifact.dependencyVector).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "phenotype-usage-guide", objectId: "guide-ready", versionId: "2" })])
    );

    const blocked = DesignReadinessResultSchema.parse(speciesArtifact.frames.find((frame) => frame.level === "species-node")?.readiness);
    expect(evaluateDesignReadinessPolicy(blocked, "warn")).toMatchObject({ allowed: true, policy: "warn" });
    expect(evaluateDesignReadinessPolicy(blocked, "block")).toMatchObject({ allowed: false, policy: "block" });
    expect(evaluateDesignReadinessPolicy(blocked, "off")).toMatchObject({ allowed: true, policy: "off", warnings: [] });
  });

  test("detects bounded self-optimization candidates without leaking sensitive feedback", () => {
    const report = detectSelfOptimizationCandidates({
      sourceId: "feedback-secret",
      sourceText:
        "This icon should update its usage guide: preserve the amber shield in HUD warnings. OPENAI_API_KEY=sk-do-not-store Bearer private-token https://private.example.test/out.png?token=secret",
      targetScope: "phenotype:ph-warning"
    });

    expect(report.candidates).toEqual([
      expect.objectContaining({
        targetObjectType: "phenotype",
        targetObjectId: "ph-warning",
        suggestedWriteLocation: "PhenotypeUsageGuide",
        operationType: "update-usage-guide",
        confidence: "medium",
        generality: "phenotype-specific",
        requiresUserConfirmation: true
      })
    ]);
    expect(JSON.stringify(report)).not.toMatch(/OPENAI_API_KEY|sk-do-not-store|Bearer|private-token|private\.example|token=secret/);

    const lowConfidence = detectSelfOptimizationCandidates({ sourceText: "Looks nice.", targetScope: "graph:graph-ui" });
    expect(lowConfidence.candidates[0]).toMatchObject({
      suggestedWriteLocation: "PhenotypeVersion.feedback",
      operationType: "keep-feedback",
      confidence: "low"
    });
    expect(lowConfidence.proposal.changeSetIds).toEqual([]);
  });
});
