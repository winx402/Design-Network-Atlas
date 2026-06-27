import { describe, expect, test } from "vitest";
import {
  checkCompileArtifactOutdated,
  CompilePolicySchema,
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultContextAttachment,
  createDefaultContextFact,
  createDefaultContextMotif,
  createDefaultContextReference,
  createDefaultContextReviewRubric,
  createDefaultDesignContext,
  createDefaultDesignPrinciple,
  createDefaultGraph,
  createDefaultGraphBridge,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupRelation,
  createDefaultSpeciesNode,
  PhenotypeCompileArtifactSchema,
  SpeciesCompileArtifactSchema
} from "../src/index.js";

describe("Phase 19 PRD-03 compile artifacts", () => {
  test("compiles a species snapshot artifact with layered trace and role-aware parent conflicts", () => {
    const graph = createDefaultGraph({
      graphId: "graph-ui",
      name: "UI Graph",
      purpose: "ui production",
      compilePolicy: { type: "layered-resolution", conflictResolution: "mixed" }
    });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-faction-icon",
      name: "Faction Icon",
      parentNodes: ["node-base", "node-bronze-style"],
      primaryParent: "node-base",
      parentRoles: {
        "node-base": "primary",
        "node-bronze-style": "style"
      },
      motifs: ["broken-ring"],
      constraints: { color: "moon-white", readability: "high" },
      badcases: ["modern military realism"]
    });
    const group = createDefaultSpeciesGroup({
      groupId: "group-ui",
      graphId: graph.graphId,
      name: "UI Group",
      sharedFacts: ["all faction icons must read at 32px"],
      phenotypeTypeSuggestions: ["ui-icon"]
    });
    const relation = createDefaultSpeciesGroupRelation({
      relationId: "rel-ui-world",
      graphId: graph.graphId,
      sourceGroupId: "group-world",
      targetGroupId: group.groupId,
      relationType: "custom:inherits-worldview-symbols",
      description: "Use custom worldview relationship as LLM context."
    });
    const bridge = createDefaultGraphBridge({
      bridgeId: "bridge-style",
      atlasId: "atlas-butian",
      sourceGraphId: "graph-visual-foundation",
      targetGraphId: graph.graphId,
      bridgeType: "style-aligned-with",
      description: "Align UI graph with the visual foundation graph."
    });
    const context = createDefaultDesignContext({
      contextId: "ctx-worldview",
      name: "Worldview",
      contextType: "worldview",
      summary: "月蚀阵营和异境禁忌",
      factIds: ["fact-faction"],
      principleIds: ["principle-readable"],
      motifIds: ["motif-oath"],
      referenceIds: ["ref-badcase"],
      reviewRubricIds: ["rubric-context"]
    });
    const attachment = createDefaultContextAttachment({
      attachmentId: "att-node-context",
      contextId: context.contextId,
      targetType: "species-node",
      targetId: node.nodeId,
      role: "constraint",
      strength: "soft",
      compileLayer: "node-context"
    });

    const artifact = compileSpeciesSnapshot({
      artifactId: "sca-node-faction-icon",
      graph,
      node,
      nodeVersionId: "node-faction-icon@2.0.0",
      parentSnapshots: [
        { parentNodeId: "node-base", nodeVersionId: "node-base@1.0.0", snapshot: { shape: "circle", color: "blue" } },
        { parentNodeId: "node-bronze-style", nodeVersionId: "node-bronze-style@1.0.0", snapshot: { material: "bronze", color: "bronze" } }
      ],
      edgeDeltas: [{ edgeVersionId: "edge-faction-icon@1.0.0", delta: { shape: "broken circle", symbol: "crescent" } }],
      speciesGroups: [group],
      groupRelations: [relation],
      graphBridges: [bridge],
      designContexts: [context],
      contextAttachments: [attachment],
      contextFacts: [createDefaultContextFact({ factId: "fact-faction", factType: "faction", statement: "月蚀阵营使用残月符号" })],
      designPrinciples: [
        createDefaultDesignPrinciple({ principleId: "principle-readable", statement: "UI 先可读再保留世界观识别", priority: "must" })
      ],
      contextMotifs: [createDefaultContextMotif({ motifId: "motif-oath", motifType: "narrative-motif", statement: "断环代表破碎誓约" })],
      llmSuggestions: [{ fieldPath: "worldview.newFact", valueSummary: "AI guessed a new faction taboo" }]
    });

    expect(CompilePolicySchema.parse(graph.compilePolicy).type).toBe("layered-resolution");
    expect(SpeciesCompileArtifactSchema.parse(artifact).compileTarget).toBe("species-snapshot");
    expect(artifact).not.toHaveProperty("prompt");
    expect(artifact.resolvedGeneSnapshot).toMatchObject({
      shape: "broken circle",
      color: "moon-white",
      material: "bronze",
      symbol: "crescent",
      readability: "high",
      motifs: ["broken-ring"],
      badcases: ["modern military realism"]
    });
    expect(artifact.resolvedGeneSnapshot).not.toHaveProperty("worldview");
    expect(artifact.conflictReport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "color", resolutionRule: "override", parentRole: "style" }),
        expect.objectContaining({ key: "shape", resolutionRule: "override", layer: "evolution-edge-deltas" })
      ])
    );
    expect(artifact.sourceTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectType: "species-group",
          objectId: "group-ui",
          layer: "species-group-rules",
          fieldPath: "sharedFacts",
          decision: "included"
        }),
        expect.objectContaining({
          objectType: "graph-bridge",
          objectId: "bridge-style",
          layer: "graph-bridge-facts",
          decision: "included"
        }),
        expect.objectContaining({
          objectType: "node-version",
          objectId: "node-bronze-style@1.0.0",
          layer: "parent-snapshots",
          decision: "merged",
          metadata: expect.objectContaining({ parentRole: "style" })
        })
      ])
    );
    expect(artifact.contextTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "design-context", objectId: "ctx-worldview", layer: "phenotype-context" }),
        expect.objectContaining({ objectType: "context-fact", objectId: "fact-faction", layer: "graph-context" })
      ])
    );
    expect(artifact.decisionTrace).toEqual(
      expect.arrayContaining([expect.objectContaining({ decision: "llm-suggested", valueSummary: "AI guessed a new faction taboo" })])
    );
    expect(artifact.openQuestions).toEqual(expect.arrayContaining(["Review LLM suggestion before writing worldview.newFact."]));
  });

  test("compiles phenotype generation artifacts differently by phenotype type with negative references and rubrics", () => {
    const graph = createDefaultGraph({ graphId: "graph-ui", name: "UI Graph", purpose: "ui production" });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-faction-icon",
      name: "Faction Icon",
      motifs: ["broken-ring"],
      constraints: { readability: "high", color: "moon-white" }
    });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-node-faction-icon",
      graph,
      node,
      nodeVersionId: "node-faction-icon@1.0.0",
      speciesGroups: [createDefaultSpeciesGroup({ groupId: "group-ui", graphId: graph.graphId, name: "UI Group", sharedFacts: ["32px readable"] })]
    });
    const badcase = createDefaultContextReference({
      referenceId: "ref-badcase",
      referenceType: "badcase",
      sourceRef: { type: "asset-index", id: "asset-too-noisy" },
      referenceRole: "negative",
      doNotUseFor: ["dense ornament", "exact silhouette"]
    });
    const rubric = createDefaultContextReviewRubric({
      rubricId: "rubric-context",
      dimension: "context-consistency",
      question: "是否保留月蚀阵营识别，同时避免 UI 噪音？",
      severity: "warning"
    });

    const uiArtifact = compilePhenotypeGeneration({
      artifactId: "pca-node-faction-icon-ui",
      graph,
      node,
      nodeVersionId: "node-faction-icon@1.0.0",
      speciesArtifact,
      phenotypeType: "ui-icon",
      taskBrief: "generate a small HUD faction icon",
      contextReferences: [badcase],
      contextReviewRubrics: [rubric]
    });
    const conceptArtifact = compilePhenotypeGeneration({
      artifactId: "pca-node-faction-icon-concept",
      graph,
      node,
      nodeVersionId: "node-faction-icon@1.0.0",
      speciesArtifact,
      phenotypeType: "concept-art",
      taskBrief: "explore the faction visual direction",
      contextReferences: [badcase],
      contextReviewRubrics: [rubric]
    });

    expect(PhenotypeCompileArtifactSchema.parse(uiArtifact).compileTarget).toBe("phenotype-generation");
    expect(uiArtifact.prompt).toContain("small-size readability");
    expect(conceptArtifact.prompt).toContain("composition and mood exploration");
    expect(uiArtifact.prompt).not.toBe(conceptArtifact.prompt);
    expect(uiArtifact.negativePrompt).toContain("dense ornament");
    expect(uiArtifact.negativePrompt).toContain("exact silhouette");
    expect(uiArtifact.reviewChecklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rubricId: "rubric-context",
          question: "是否保留月蚀阵营识别，同时避免 UI 噪音？"
        })
      ])
    );
    expect(uiArtifact.referenceTrace).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "context-reference", objectId: "ref-badcase", decision: "excluded" })])
    );
    expect(uiArtifact.rubricTrace).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "context-review-rubric", objectId: "rubric-context" })])
    );
    expect(checkCompileArtifactOutdated(uiArtifact, { objectType: "context-reference", objectId: "ref-badcase" })).toMatchObject({
      outdated: true,
      reasons: expect.arrayContaining([expect.stringContaining("ref-badcase")])
    });
  });
});
