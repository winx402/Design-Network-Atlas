import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  createDefaultSpeciesGroup,
  createDefaultSpeciesNode
} from "@dna/core";
import {
  linkReferenceAsset,
  persistReferenceGeneration,
  prepareReferenceGeneration,
  updateGenerationPlan,
  updateGenerationTasks
} from "@dna/application";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function readAllFiles(root: string): string {
  const chunks: string[] = [];
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) {
      for (const child of readdirSync(path)) walk(join(path, child));
      return;
    }
    chunks.push(readFileSync(path, "utf8"));
  };
  walk(root);
  return chunks.join("\n");
}

function seedStore(store: SqliteDnaStore) {
  const graph = createDefaultGraph({ graphId: "graph-storage-ref", name: "Storage Reference", purpose: "reference generation" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-storage-ref", name: "Storage Node" });
  const group = createDefaultSpeciesGroup({ graphId: graph.graphId, groupId: "group-storage-ref", name: "Storage Group" });
  const phenotype = createDefaultPhenotype({
    phenotypeId: "ph-storage-ref",
    graphId: graph.graphId,
    nodeId: node.nodeId,
    name: "Storage Phenotype",
    phenotypeType: "icon",
    objectBrief: "storage icon",
    status: "planned"
  });
  const plan = createDefaultPhenotypeGenerationPlan({
    planId: "plan-storage-ref",
    scopeType: "graph",
    scopeId: graph.graphId,
    graphId: graph.graphId,
    priority: 1,
    description: "Initial storage plan"
  });
  const task = createDefaultPhenotypeGenerationTask({
    taskId: "task-storage-ref",
    graphId: graph.graphId,
    planId: plan.planId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeType: phenotype.phenotypeType,
    taskBrief: phenotype.objectBrief,
    priority: 1
  });

  store.graphs.create(graph);
  store.nodes.create(node);
  store.speciesGroups.create(group);
  store.phenotypes.create(phenotype);
  store.generationPlans.create(plan);
  store.generationTasks.create(task);
  return { graph, group, plan, task };
}

describe("Phase 29 issues #14/#15 generation update and reference storage", () => {
  test("round-trips updated generation records, scoped reference jobs, and linked reference assets", () => {
    const dir = tempDir("phase29-generation-update-reference-storage");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();
    const { graph, group, plan, task } = seedStore(source);

    updateGenerationPlan(
      source,
      {
        planId: plan.planId,
        patch: {
          description: "Updated storage plan",
          metadata: { set: { reviewer: "lead" } },
          tags: { add: ["review"] }
        }
      },
      { apply: true }
    );
    updateGenerationTasks(
      source,
      {
        selector: { id: task.taskId },
        patch: {
          requirements: { set: { referenceGenerationJobIds: ["job-storage-reference"], referenceAssetIds: ["asset-storage-reference"] } },
          tags: { add: ["reference-ready"] }
        }
      },
      { apply: true }
    );
    const reference = prepareReferenceGeneration(source, {
      scope: "species-group",
      graphId: graph.graphId,
      groupId: group.groupId,
      brief: "Create storage-safe group reference.",
      referenceType: "reference-image",
      providerPreference: "sk-storage-secret",
      metadata: { privateLink: "https://private.example.invalid/file.png" },
      ids: { entityArtifactId: "eca-storage-reference", generationJobId: "job-storage-reference" }
    });
    persistReferenceGeneration(source, reference);
    linkReferenceAsset(
      source,
      {
        generationJobId: "job-storage-reference",
        assetId: "asset-storage-reference",
        uri: "local://references/storage-reference.png",
        assetType: "image",
        role: "reference",
        tags: ["reference"]
      },
      { apply: true }
    );

    exportProject(source, out);
    expect(existsSync(join(out, "graphs", graph.graphId, "generation-plans", `${plan.planId}.json`))).toBe(true);
    expect(existsSync(join(out, "graphs", graph.graphId, "generation-tasks", `${task.taskId}.json`))).toBe(true);
    expect(existsSync(join(out, "graphs", graph.graphId, "generation-jobs", "job-storage-reference.json"))).toBe(true);
    expect(existsSync(join(out, "graphs", graph.graphId, "assets", "asset-storage-reference.json"))).toBe(true);
    const exported = readAllFiles(out);
    expect(exported).not.toMatch(/sk-storage-secret|private\.example|privateLink/);

    importProject(target, out);
    expect(target.generationPlans.get(plan.planId)).toMatchObject({ description: "Updated storage plan", tags: ["review"] });
    expect(target.generationTasks.get(task.taskId)).toMatchObject({
      requirements: { referenceGenerationJobIds: ["job-storage-reference"], referenceAssetIds: ["asset-storage-reference"] },
      tags: ["reference-ready"]
    });
    expect(target.generationJobs.get("job-storage-reference")).toMatchObject({
      generationKind: "reference",
      target: { type: "species-group", id: group.groupId, graphId: graph.graphId }
    });
    expect(target.assets.get("asset-storage-reference")).toMatchObject({
      linkedObjectType: "generation-job",
      linkedObjectId: "job-storage-reference"
    });

    source.close();
    target.close();
  });
});
