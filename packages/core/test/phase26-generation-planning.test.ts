import { describe, expect, test } from "vitest";
import {
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  PhenotypeSchema,
  PhenotypeGenerationPlanSchema,
  PhenotypeGenerationTaskSchema
} from "@dna/core";

describe("Phase 26 PRD-17 generation planning domain", () => {
  test("creates generation plans and tasks with default version binding", () => {
    const plan = createDefaultPhenotypeGenerationPlan({
      planId: "plan-graph",
      scopeType: "graph",
      scopeId: "graph-ui",
      priority: 10,
      description: "Generate planned UI outputs",
      graphId: "graph-ui",
      toolPreference: "codex image2",
      llmInstructions: "Prefer high contrast warning silhouettes.",
      metadata: { wave: "alpha" },
      extensions: { owner: "art-director" }
    });
    const task = createDefaultPhenotypeGenerationTask({
      taskId: "task-icon",
      graphId: "graph-ui",
      nodeId: "node-warning",
      phenotypeType: "image-prompt",
      taskBrief: "warning toolbar icon",
      priority: 10
    });

    expect(PhenotypeGenerationPlanSchema.parse(plan)).toMatchObject({
      planId: "plan-graph",
      scopeType: "graph",
      status: "draft",
      versionBinding: { mode: "latest-at-execution" }
    });
    expect(PhenotypeGenerationTaskSchema.parse(task)).toMatchObject({
      taskId: "task-icon",
      status: "planned",
      versionBinding: { mode: "latest-at-execution" },
      generationJobIds: [],
      phenotypeVersionIds: []
    });
  });

  test("models phenotype production slices and structured generation task intent", () => {
    const sliced = createDefaultPhenotype({
      phenotypeId: "phenotype-panel-frame",
      graphId: "graph-ui",
      nodeId: "node-panel",
      phenotypeType: "sprite",
      productionSliceRole: "panel-outer-frame",
      name: "Panel Outer Frame"
    });
    expect(PhenotypeSchema.parse(sliced)).toMatchObject({
      phenotypeId: "phenotype-panel-frame",
      productionSliceRole: "panel-outer-frame"
    });
    expect(() => PhenotypeSchema.parse({ ...sliced, productionSliceRole: "Panel Outer Frame" })).toThrow(
      /productionSliceRole must use lowercase letters, numbers, and hyphens/
    );

    const task = createDefaultPhenotypeGenerationTask({
      taskId: "task-panel-frame",
      graphId: "graph-ui",
      nodeId: "node-panel",
      phenotypeId: sliced.phenotypeId,
      phenotypeType: "sprite",
      taskBrief: "panel frame sprite",
      priority: 1,
      productionIntent: {
        sourceObject: {
          graphId: "graph-ui",
          nodeId: "node-panel",
          phenotypeId: sliced.phenotypeId,
          phenotypeType: "sprite",
          name: "Panel Outer Frame"
        },
        productionSliceRole: "panel-outer-frame",
        intendedUse: "Frame panel boundaries without changing inner content.",
        outputShape: {
          expectedAssetTypes: ["image"],
          framing: "outer frame",
          transparency: "transparent-background",
          runtimeConstraints: ["nine-slice friendly"],
          formatNotes: []
        },
        visualAnchors: ["rounded corners"],
        mustPreserve: ["panel silhouette"],
        mustAvoid: ["filled center"],
        unknowns: ["exact corner radius"]
      }
    });
    expect(PhenotypeGenerationTaskSchema.parse(task)).toMatchObject({
      taskId: "task-panel-frame",
      productionIntent: {
        productionSliceRole: "panel-outer-frame",
        outputShape: { expectedAssetTypes: ["image"] },
        unknowns: ["exact corner radius"]
      }
    });
  });

  test("redacts credential-like values from plan and task notes, preferences, metadata, and extensions", () => {
    const plan = createDefaultPhenotypeGenerationPlan({
      planId: "plan-secure",
      scopeType: "graph",
      scopeId: "graph-secure",
      priority: 1,
      description: "Security check",
      toolPreference: "Bearer runtime-secret",
      providerPreference: "OPENAI_API_KEY=sk-do-not-store",
      llmInstructions: "Use signed URL https://private.example.test/out.png?token=secret",
      operatorNotes: "password=hunter2",
      metadata: { apiKey: "sk-hidden", safe: "kept" },
      extensions: { nested: { private_key: "hidden", model: "safe" } }
    });
    const task = createDefaultPhenotypeGenerationTask({
      taskId: "task-secure",
      graphId: "graph-secure",
      nodeId: "node-secure",
      phenotypeType: "image-prompt",
      taskBrief: "secret OPENAI_API_KEY=sk-task-secret",
      priority: 1,
      productionIntent: {
        sourceObject: { graphId: "graph-secure", nodeId: "node-secure", phenotypeType: "image-prompt" },
        intendedUse: "Use https://private.example.test/reference.png?token=secret",
        outputShape: { expectedAssetTypes: [], runtimeConstraints: [], formatNotes: ["Authorization: Bearer intent-secret"] },
        visualAnchors: ["safe"],
        mustPreserve: ["private_key=hidden"],
        mustAvoid: ["password=hunter2"],
        unknowns: ["OPENAI_API_KEY=sk-intent-secret"]
      },
      llmInstructions: "Authorization: Bearer task-secret",
      operatorNotes: "private_key=hidden",
      metadata: { password: "hidden", width: 1024 },
      extensions: { provider: { token: "hidden", model: "safe" } }
    });

    const serialized = JSON.stringify({ plan, task });
    expect(serialized).not.toContain("sk-do-not-store");
    expect(serialized).not.toContain("sk-hidden");
    expect(serialized).not.toContain("sk-task-secret");
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).not.toContain("Bearer runtime-secret");
    expect(serialized).not.toContain("task-secret");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("private_key");
    expect(serialized).not.toContain("private.example.test/out.png");
    expect(serialized).not.toContain("private.example.test/reference.png");
    expect(serialized).not.toContain("intent-secret");
    expect(serialized).not.toContain("sk-intent-secret");
    expect(plan.metadata).toEqual({ safe: "kept" });
    expect(task.metadata).toEqual({ width: 1024 });
  });
});
