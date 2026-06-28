import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  createDefaultSpeciesNode
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Phase 26 PRD-17 SQLite generation planning storage", () => {
  test("migration creates generation plan and task tables", () => {
    const store = new SqliteDnaStore(join(tempDir("phase26-generation-planning-tables"), "dna.sqlite"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    expect(names.has("phenotype_generation_plans")).toBe(true);
    expect(names.has("phenotype_generation_tasks")).toBe(true);
    store.close();
  });

  test("persists and round-trips generation plans and tasks through export/import", () => {
    const dir = tempDir("phase26-generation-planning-exchange");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();

    const graph = createDefaultGraph({ graphId: "graph-planning", name: "Planning Graph", purpose: "generation planning" });
    const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-planning", name: "Planning Node" });
    const phenotype = createDefaultPhenotype({
      phenotypeId: "ph-planning",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      name: "Planning Phenotype",
      phenotypeType: "portrait",
      objectBrief: "planned portrait",
      status: "planned"
    });
    const plan = createDefaultPhenotypeGenerationPlan({
      planId: "plan-planning",
      graphId: graph.graphId,
      scopeType: "graph",
      scopeId: graph.graphId,
      priority: 1,
      description: "Generate planned outputs",
      llmInstructions: "Keep review surfaces consistent.",
      toolPreference: "mock"
    });
    const task = createDefaultPhenotypeGenerationTask({
      taskId: "task-planning",
      graphId: graph.graphId,
      planId: plan.planId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeType: phenotype.phenotypeType,
      taskBrief: phenotype.objectBrief,
      priority: 1,
      llmInstructions: "Keep review surfaces consistent.",
      toolPreference: "mock"
    });

    source.graphs.create(graph);
    source.nodes.create(node);
    source.phenotypes.create(phenotype);
    source.generationPlans.create(plan);
    source.generationTasks.create(task);

    exportProject(source, out);
    expect(existsSync(join(out, "graphs", graph.graphId, "generation-plans", "plan-planning.json"))).toBe(true);
    expect(existsSync(join(out, "graphs", graph.graphId, "generation-tasks", "task-planning.json"))).toBe(true);
    expect(readJson(join(out, "graphs", graph.graphId, "generation-plans", "plan-planning.json"))).toMatchObject({
      planId: "plan-planning",
      scopeType: "graph",
      versionBinding: { mode: "latest-at-execution" }
    });

    importProject(target, out);
    expect(target.generationPlans.get(plan.planId)).toMatchObject({
      planId: plan.planId,
      description: "Generate planned outputs",
      toolPreference: "mock"
    });
    expect(target.generationTasks.get(task.taskId)).toMatchObject({
      taskId: task.taskId,
      planId: plan.planId,
      phenotypeId: phenotype.phenotypeId,
      generationJobIds: [],
      phenotypeVersionIds: []
    });

    source.close();
    target.close();
  });
});
