import { describe, expect, test } from "vitest";
import {
  PhenotypeUsageGuideSchema,
  createDefaultPhenotypeUsageGuide,
  createPhenotypeUsageGuidePromptTemplate,
  renderPhenotypeUsageGuideMarkdown,
  summarizePhenotypeUsageGuideForCompile
} from "../src/index.js";

describe("Phase 31 PRD-22 phenotype usage guide domain", () => {
  test("creates a stable phenotype-bound usage guide and renders AI-safe markdown", () => {
    const guide = createDefaultPhenotypeUsageGuide({
      usageGuideId: "guide-warning-icon",
      phenotypeId: "ph-warning-icon",
      graphId: "graph-ui",
      nodeId: "node-warning",
      phenotypeType: "ui-icon",
      title: "Warning icon usage",
      summary: "Use this icon to communicate recoverable warning states.",
      usageScenarios: [
        {
          scenarioId: "runtime-warning",
          name: "Runtime warning",
          surface: "HUD",
          userMoment: "Before a risky action",
          designIntent: "Warn without blocking flow.",
          implementationRole: "status signal",
          priority: "primary"
        }
      ],
      usageInstructions: {
        primaryUse: "Display near the warning copy.",
        placement: "Near the affected control.",
        stateBehavior: "Stay readable at small size.",
        doNotUseFor: ["fatal errors"]
      },
      designSemantics: {
        sourceContextIds: ["context-runtime"],
        sourceFactIds: ["fact-warning"],
        sourcePrincipleIds: ["principle-readable"],
        sourceMotifIds: ["motif-corner-shard"],
        sourceFacetIds: ["facet-state"],
        sourceRelationshipIds: ["rel-warning-language"],
        mustPreserve: ["sharp silhouette"],
        mustAvoid: ["success color"]
      },
      variantPlan: [{ variantId: "default", name: "Default", purpose: "standard runtime state", required: true }],
      productionHints: {
        suggestedAssetTypes: ["image", "svg"],
        suggestedAspectRatio: "1:1",
        suggestedTransparency: "recommended",
        suggestedSize: "64px",
        namingHint: "semantic name only, no project directory",
        deliveryNotes: "Keep source editable."
      },
      reviewChecklist: [{ checklistId: "check-readability", question: "Readable at 32px?", severity: "blocking" }],
      sourceSummary: "Derived from persisted graph/context objects.",
      metadata: { channel: "runtime" },
      extensions: {}
    });

    expect(PhenotypeUsageGuideSchema.parse(guide)).toMatchObject({
      usageGuideId: "guide-warning-icon",
      phenotypeId: "ph-warning-icon",
      status: "active",
      revision: 1
    });

    const summary = summarizePhenotypeUsageGuideForCompile(guide);
    expect(summary).toMatchObject({
      usageGuideId: "guide-warning-icon",
      usageGuideRevision: 1,
      summary: "Use this icon to communicate recoverable warning states.",
      mustPreserve: ["sharp silhouette"],
      mustAvoid: ["success color"]
    });

    const markdown = renderPhenotypeUsageGuideMarkdown(guide);
    expect(markdown).toContain("# Warning icon usage 使用说明");
    expect(markdown).toContain("## 2. 使用场景");
    expect(markdown).toContain("Runtime warning");
    expect(markdown).toContain("sharp silhouette");
    expect(markdown).not.toMatch(/OPENAI_API_KEY|sk-proj|Bearer|\/Users\/bot|Cocos|Eagle 字段/);
  });

  test("provides a prompt template that forbids invention, secrets, and project directory policy", () => {
    const template = createPhenotypeUsageGuidePromptTemplate({
      graph: { graphId: "graph-ui", name: "UI Graph" },
      species: { nodeId: "node-warning", name: "Warning Species" },
      phenotype: { phenotypeId: "ph-warning-icon", name: "Warning Icon", phenotypeType: "ui-icon" },
      contexts: [{ contextId: "context-runtime", summary: "Runtime warnings stay readable." }],
      relationships: [{ relationshipId: "rel-warning-language", summary: "Transfers warning language." }],
      userNotes: "Use only confirmed facts."
    });

    expect(template).toContain("关联对象");
    expect(template).toContain("使用场景");
    expect(template).toContain("设计语言来源");
    expect(template).toContain("不确定项");
    expect(template).toContain("Do not invent missing graph, species, relationship, asset, or context facts.");
    expect(template).toContain("Do not output API keys, provider credentials, signed URLs, complete private links, or raw provider payloads.");
    expect(template).toContain("Do not prescribe project file directories, Eagle fields, Cocos paths, wiki locations, or private project policies.");
  });
});
