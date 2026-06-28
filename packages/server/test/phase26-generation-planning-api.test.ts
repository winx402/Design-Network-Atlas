import { mkdtempSync } from "node:fs";
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
import { createDnaHttpHandler } from "@dna/server";
import { SqliteDnaStore } from "@dna/sqlite";

function dbPath(name: string) {
  return join(mkdtempSync(join(tmpdir(), `dna-${name}-`)), "dna.sqlite");
}

describe("Phase 26 PRD-17 generation planning HTTP API", () => {
  test("serves read-only generation plans and tasks with trace links", async () => {
    const store = new SqliteDnaStore(dbPath("generation-planning-api"));
    store.migrate();
    const graph = createDefaultGraph({ graphId: "graph-api-planning", name: "Planning API Graph", purpose: "planning api" });
    const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-api-planning", name: "Planning API Node" });
    const phenotype = createDefaultPhenotype({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: "ph-api-planning",
      name: "Planning API Phenotype",
      phenotypeType: "portrait",
      objectBrief: "planned api portrait",
      status: "planned"
    });
    store.graphs.create(graph);
    store.nodes.create(node);
    store.phenotypes.create(phenotype);
    store.generationPlans.create(
      createDefaultPhenotypeGenerationPlan({
        planId: "plan-api-planning",
        graphId: graph.graphId,
        scopeType: "graph",
        scopeId: graph.graphId,
        priority: 1,
        description: "API planning",
        toolPreference: "mock"
      })
    );
    store.generationTasks.create(
      createDefaultPhenotypeGenerationTask({
        taskId: "task-api-planning",
        planId: "plan-api-planning",
        graphId: graph.graphId,
        nodeId: node.nodeId,
        phenotypeId: phenotype.phenotypeId,
        phenotypeType: phenotype.phenotypeType,
        taskBrief: phenotype.objectBrief,
        priority: 1,
        status: "blocked",
        blockingReason: "waiting for art direction",
        speciesCompileArtifactId: "sca-api-planning",
        phenotypeCompileArtifactId: "pca-api-planning",
        generationJobIds: ["job-api-planning"],
        phenotypeVersionIds: ["pv-api-planning"]
      })
    );

    const handler = createDnaHttpHandler(store);
    const plans = await (await handler(new Request("http://dna.local/api/generation-plans?graphId=graph-api-planning"))).json();
    expect(plans.plans[0]).toMatchObject({
      planId: "plan-api-planning",
      scopeType: "graph",
      status: "draft",
      taskCount: 1
    });

    const tasks = await (await handler(new Request("http://dna.local/api/generation-tasks?graphId=graph-api-planning"))).json();
    expect(tasks.tasks[0]).toMatchObject({
      taskId: "task-api-planning",
      status: "blocked",
      blockingReason: "waiting for art direction",
      links: {
        planId: "plan-api-planning",
        speciesCompileArtifactId: "sca-api-planning",
        phenotypeCompileArtifactId: "pca-api-planning",
        generationJobIds: ["job-api-planning"],
        phenotypeVersionIds: ["pv-api-planning"]
      }
    });

    const workbench = await (await handler(new Request("http://dna.local/api/workbench/phenotypes?graphId=graph-api-planning"))).json();
    expect(workbench.generationPlans[0]).toMatchObject({ planId: "plan-api-planning", taskCount: 1 });
    expect(workbench.generationTasks[0]).toMatchObject({ taskId: "task-api-planning", phenotypeId: "ph-api-planning" });
    store.close();
  });
});
