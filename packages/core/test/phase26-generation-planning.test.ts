import { describe, expect, test } from "vitest";
import {
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
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
    expect(plan.metadata).toEqual({ safe: "kept" });
    expect(task.metadata).toEqual({ width: 1024 });
  });
});
