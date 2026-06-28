import { describe, expect, test } from "vitest";
import {
  compileSpecies,
  ContextAttachmentSchema,
  ContextFactSchema,
  ContextReferenceSchema,
  ContextReviewRubricSchema,
  createDefaultContextAttachment,
  createDefaultContextFact,
  createDefaultContextMotif,
  createDefaultContextPolicy,
  createDefaultContextReference,
  createDefaultContextReviewRubric,
  createDefaultDesignContext,
  createDefaultDesignPrinciple,
  createDefaultGraph,
  createDefaultSpeciesNode,
  DesignContextSchema,
  DesignPrincipleSchema
} from "../src/index.js";

describe("Phase 18 PRD-02 design context core model", () => {
  test("models design context as a reusable container that references normalized children", () => {
    const context = createDefaultDesignContext({
      contextId: "ctx-butian-worldview",
      name: "Butian worldview baseline",
      contextType: "worldview",
      summary: "异境世界观和基础禁忌",
      factIds: ["fact-moon-faction"],
      principleIds: ["principle-ui-readable-but-worlded"],
      motifIds: ["motif-broken-ring"],
      referenceIds: ["ref-moodboard-01"],
      reviewRubricIds: ["rubric-context-consistency"],
      negativeBoundaries: ["avoid modern military realism"],
      sourceRefs: ["docs/worldview.md"],
      confidence: "confirmed",
      owner: "art-direction",
      version: "1.0.0"
    });

    expect(DesignContextSchema.parse(context)).toMatchObject({
      contextId: "ctx-butian-worldview",
      factIds: ["fact-moon-faction"],
      principleIds: ["principle-ui-readable-but-worlded"],
      motifIds: ["motif-broken-ring"],
      referenceIds: ["ref-moodboard-01"],
      reviewRubricIds: ["rubric-context-consistency"],
      extensions: {}
    });
    expect(context).not.toHaveProperty("facets");
  });

  test("keeps facts and principles as content with default hints, not hard workflow behavior", () => {
    const fact = createDefaultContextFact({
      factId: "fact-moon-faction",
      factType: "faction",
      statement: "月蚀阵营使用残月誓约符号",
      scopeHint: "character and ui icon graphs",
      defaultStrength: "hard",
      defaultBehaviorHint: "include",
      sourceTrace: ["worldview/factions.md"]
    });
    const principle = createDefaultDesignPrinciple({
      principleId: "principle-ui-readable-but-worlded",
      statement: "UI 图标必须先可读，再保留世界观识别符号",
      priority: "must",
      experienceIntent: "玩家在 1 秒内识别阵营，同时感到异境感",
      readabilityGoal: "small-size first read",
      platformContext: "mobile hud icon",
      reviewQuestions: ["是否保留必要阵营符号？"],
      badcases: ["只靠复杂纹样表现世界观"]
    });

    expect(ContextFactSchema.parse(fact)).toMatchObject({
      defaultStrength: "hard",
      defaultBehaviorHint: "include"
    });
    expect(DesignPrincipleSchema.parse(principle)).toMatchObject({
      experienceIntent: "玩家在 1 秒内识别阵营，同时感到异境感",
      readabilityGoal: "small-size first read",
      platformContext: "mobile hud icon"
    });
    expect(fact).not.toHaveProperty("compileBehavior");
    expect(principle).not.toHaveProperty("compileBehavior");
  });

  test("records references and review rubrics without storing binaries or replacing human judgment", () => {
    const reference = createDefaultContextReference({
      referenceId: "ref-moodboard-01",
      referenceType: "moodboard",
      sourceRef: {
        type: "asset-index",
        id: "asset-moodboard-01"
      },
      referenceRole: "mood",
      useFor: ["emotion", "material culture"],
      doNotUseFor: ["exact layout", "character silhouette"],
      risk: ["style convergence"]
    });
    const rubric = createDefaultContextReviewRubric({
      rubricId: "rubric-context-consistency",
      dimension: "context-consistency",
      question: "是否符合异境世界观和阵营语境？",
      passSignal: "保留月蚀阵营识别符号并控制噪音",
      failSignal: "完全泛化成普通幻想图标",
      severity: "warning"
    });

    expect(ContextReferenceSchema.parse(reference)).toMatchObject({
      sourceRef: { type: "asset-index", id: "asset-moodboard-01" },
      useFor: ["emotion", "material culture"],
      doNotUseFor: ["exact layout", "character silhouette"]
    });
    expect(ContextReviewRubricSchema.parse(rubric)).toMatchObject({
      dimension: "context-consistency",
      severity: "warning"
    });
  });

  test("attaches context to phenotype versions as case evidence without back-writing species genes", () => {
    const attachment = createDefaultContextAttachment({
      attachmentId: "att-accepted-icon-case",
      contextId: "ctx-butian-worldview",
      targetType: "phenotype-version",
      targetId: "pv-icon-accepted@1.0.0",
      role: "review-source",
      strength: "reference",
      inheritance: "none",
      compileLayer: "phenotype-context"
    });
    const policy = createDefaultContextPolicy({
      policyId: "policy-review-only-case",
      contextId: "ctx-butian-worldview",
      attachmentId: attachment.attachmentId,
      compileParticipation: "llm-context",
      reviewParticipation: "include",
      impactParticipation: "none",
      priority: "normal",
      resolutionRule: "manual"
    });

    expect(ContextAttachmentSchema.parse(attachment)).toMatchObject({
      targetType: "phenotype-version",
      role: "review-source",
      inheritance: "none"
    });
    expect(policy).toMatchObject({
      compileParticipation: "llm-context",
      impactParticipation: "none"
    });
  });

  test("adds design context to compile context trace as LLM context without pretending to be a parent", () => {
    const graph = createDefaultGraph({
      graphId: "g-butian-ui",
      name: "Butian UI",
      purpose: "UI graph"
    });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-faction-icon",
      name: "Faction Icon",
      category: "ui",
      level: "species",
      constraints: { readability: "high" }
    });
    const context = createDefaultDesignContext({
      contextId: "ctx-butian-worldview",
      name: "Butian worldview baseline",
      contextType: "worldview",
      summary: "月蚀阵营、异境禁忌和 UI 降噪原则",
      factIds: ["fact-moon-faction"],
      principleIds: ["principle-ui-readable-but-worlded"],
      motifIds: ["motif-broken-ring"]
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
    const policy = createDefaultContextPolicy({
      policyId: "policy-node-context",
      contextId: context.contextId,
      attachmentId: attachment.attachmentId,
      compileParticipation: "llm-context",
      reviewParticipation: "include",
      impactParticipation: "outdated-check"
    });

    const result = compileSpecies({
      graph,
      node,
      designContexts: [context],
      contextAttachments: [attachment],
      contextPolicies: [policy],
      taskBrief: "生成阵营图标",
      phenotypeType: "ui-icon"
    });

    expect(result.contextTrace).toContainEqual(
      expect.objectContaining({
        sourceType: "design-context",
        sourceId: "ctx-butian-worldview",
        compileLayer: "node-context",
        fixedRuleEligible: false
      })
    );
    expect(result.prompt).toContain("Design Context");
    expect(result.prompt).toContain("月蚀阵营、异境禁忌和 UI 降噪原则");
    expect(result.relationshipTrace).toEqual([]);
  });
});
