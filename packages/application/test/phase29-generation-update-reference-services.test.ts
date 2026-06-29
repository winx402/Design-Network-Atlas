import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesNode,
  createDefaultNodeVersion,
  createGenerationJob
} from "@dna/core";
import {
  linkReferenceAsset,
  persistReferenceGeneration,
  prepareReferenceGeneration,
  updateGenerationPlan,
  updateGenerationTasks
} from "@dna/application";
import { InMemoryDnaStore } from "@dna/storage";
import { describe, expect, test } from "vitest";

function seedStore() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-updates", name: "Update Graph", purpose: "generation update tests" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-updates", name: "Update Node" });
  const group = createDefaultSpeciesGroup({ graphId: graph.graphId, groupId: "group-updates", name: "Update Group" });
  const phenotype = createDefaultPhenotype({
    phenotypeId: "ph-updates",
    graphId: graph.graphId,
    nodeId: node.nodeId,
    name: "Update Phenotype",
    phenotypeType: "icon",
    objectBrief: "planned icon",
    status: "planned"
  });
  const plan = createDefaultPhenotypeGenerationPlan({
    planId: "plan-updates",
    scopeType: "graph",
    scopeId: graph.graphId,
    graphId: graph.graphId,
    priority: 10,
    description: "Initial generation plan",
    requirements: { palette: "blue", removeMe: "soon" },
    metadata: { owner: "art", old: "value" },
    extensions: { lane: "draft" },
    tags: ["old-tag"]
  });
  const task = createDefaultPhenotypeGenerationTask({
    taskId: "task-updates",
    graphId: graph.graphId,
    planId: plan.planId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeType: phenotype.phenotypeType,
    taskBrief: phenotype.objectBrief,
    priority: 5,
    requirements: { referenceGenerationJobIds: ["job-reference"], old: "value" },
    tags: ["old-tag"]
  });
  const executedTask = createDefaultPhenotypeGenerationTask({
    taskId: "task-executed",
    graphId: graph.graphId,
    planId: plan.planId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeType: phenotype.phenotypeType,
    taskBrief: "already generated",
    priority: 6,
    generationJobIds: ["job-existing"],
    phenotypeVersionIds: ["pv-existing"],
    tags: ["old-tag"]
  });

  store.graphs.create(graph);
  store.nodes.create(node);
  store.nodeVersions.create(
    createDefaultNodeVersion({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      nodeVersionId: "node-updates@1.0.0",
      resolvedGeneSnapshot: { shape: "rounded" }
    })
  );
  store.speciesGroups.create(group);
  store.speciesGroupMemberships.create(
    createDefaultSpeciesGroupMembership({
      graphId: graph.graphId,
      groupId: group.groupId,
      nodeId: node.nodeId,
      membershipId: "membership-updates"
    })
  );
  store.phenotypes.create(phenotype);
  store.generationPlans.create(plan);
  store.generationTasks.create(task);
  store.generationTasks.create(executedTask);
  store.generationJobs.create(
    createGenerationJob({
      generationJobId: "job-existing",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: "pv-existing",
      phenotypeType: phenotype.phenotypeType,
      taskBrief: "already generated",
      status: "generated"
    })
  );
  return { store, graph, node, group, phenotype, plan, task, executedTask };
}

describe("Phase 29 issues #14/#15 generation orchestration services", () => {
  test("updates generation plan metadata through preview/apply without changing immutable identity", () => {
    const { store, plan } = seedStore();

    const preview = updateGenerationPlan(
      store,
      {
        planId: plan.planId,
        patch: {
          description: "Updated generation plan",
          status: "ready",
          priority: 2,
          providerPreference: "Bearer sk-secret should not persist",
          requirements: { set: { palette: "green", referenceAssetIds: ["asset-reference"] }, remove: ["removeMe"] },
          metadata: { set: { owner: "review" }, remove: ["old"] },
          extensions: { clear: true, set: { lane: "review" } },
          tags: { add: ["review", "review"], remove: ["old-tag"] }
        }
      },
      { apply: false }
    );

    expect(preview.persisted).toBe(false);
    expect(preview.before.description).toBe("Initial generation plan");
    expect(preview.after).toMatchObject({
      planId: plan.planId,
      scopeType: plan.scopeType,
      scopeId: plan.scopeId,
      graphId: plan.graphId,
      description: "Updated generation plan",
      status: "ready",
      priority: 2,
      requirements: { palette: "green", referenceAssetIds: ["asset-reference"] },
      metadata: { owner: "review" },
      extensions: { lane: "review" },
      tags: ["review"]
    });
    expect(store.generationPlans.get(plan.planId)?.description).toBe("Initial generation plan");
    expect(JSON.stringify(preview.after)).not.toMatch(/sk-secret|Bearer/);

    const applied = updateGenerationPlan(store, { planId: plan.planId, patch: preview.patch }, { apply: true });
    const stored = store.generationPlans.get(plan.planId);
    expect(applied.persisted).toBe(true);
    expect(stored).toMatchObject({
      planId: plan.planId,
      scopeType: plan.scopeType,
      scopeId: plan.scopeId,
      graphId: plan.graphId,
      description: "Updated generation plan",
      tags: ["review"]
    });
    expect(stored?.createdAt).toBe(plan.createdAt);
    expect(stored?.updatedAt).not.toBe(plan.updatedAt);
    expect(JSON.stringify(stored)).not.toMatch(/sk-secret|Bearer/);
  });

  test("updates generation tasks with selector safeguards and protects executed task trace links", () => {
    const { store, plan, task, executedTask } = seedStore();

    expect(() =>
      updateGenerationTasks(
        store,
        { selector: {}, patch: { status: "ready" } },
        { apply: false }
      )
    ).toThrow(/requires at least one selector/);
    expect(() =>
      updateGenerationTasks(
        store,
        { selector: { id: task.taskId }, patch: { status: "completed" } },
        { apply: false }
      )
    ).toThrow(/result status/);
    expect(() =>
      updateGenerationTasks(
        store,
        { selector: { id: task.taskId }, patch: { blockingReason: "missing source" } },
        { apply: false }
      )
    ).toThrow(/blockingReason requires status blocked/);

    const preview = updateGenerationTasks(
      store,
      {
        selector: { planId: plan.planId },
        patch: {
          status: "blocked",
          blockingReason: "waiting for reference review",
          operatorNotes: "Do not include signed URL https://private.example.invalid/file.png?token=secret",
          requirements: { set: { contextReferenceIds: ["ctx-ref"] }, remove: ["old"] },
          tags: { add: ["blocked"], remove: ["old-tag"] }
        }
      },
      { apply: false }
    );

    expect(preview.persisted).toBe(false);
    expect(preview.selectedTaskIds).toEqual([task.taskId]);
    expect(preview.skippedTaskIds).toEqual([executedTask.taskId]);
    expect(preview.updatedTasks[0]).toMatchObject({
      taskId: task.taskId,
      status: "blocked",
      blockingReason: "waiting for reference review",
      requirements: { referenceGenerationJobIds: ["job-reference"], contextReferenceIds: ["ctx-ref"] },
      tags: ["blocked"]
    });
    expect(store.generationTasks.get(task.taskId)?.status).toBe("planned");
    expect(JSON.stringify(preview.updatedTasks[0])).not.toMatch(/private\.example|token=secret/);

    const applied = updateGenerationTasks(store, { selector: { id: task.taskId }, patch: preview.patch }, { apply: true });
    expect(applied.persisted).toBe(true);
    expect(store.generationTasks.get(task.taskId)).toMatchObject({
      taskId: task.taskId,
      status: "blocked",
      blockingReason: "waiting for reference review",
      tags: ["blocked"]
    });
    expect(store.generationTasks.get(task.taskId)?.createdAt).toBe(task.createdAt);
    expect(store.generationTasks.get(task.taskId)?.updatedAt).not.toBe(task.updatedAt);

    expect(() =>
      updateGenerationTasks(
        store,
        { selector: { id: executedTask.taskId }, patch: { planId: undefined, clearPlanId: true } },
        { apply: false }
      )
    ).toThrow(/cannot change planId after execution links exist/);
  });

  test("prepares and persists graph/group scoped reference generation without synthetic phenotype records", () => {
    const { store, graph, group } = seedStore();

    const preview = prepareReferenceGeneration(store, {
      scope: "graph",
      graphId: graph.graphId,
      brief: "Create a graph-wide UI moodboard reference.",
      referenceType: "moodboard",
      providerPreference: "sk-reference-secret",
      metadata: { source: "creative brief", signedUrl: "https://cdn.example.invalid/ref.png?X-Amz-Signature=secret" },
      ids: { entityArtifactId: "eca-reference-graph", generationJobId: "job-reference-graph" }
    });

    expect(preview.entityArtifact.targetLevel).toBe("graph");
    expect(preview.job).toMatchObject({
      generationJobId: "job-reference-graph",
      generationKind: "reference",
      graphId: graph.graphId,
      target: { type: "graph", id: graph.graphId, graphId: graph.graphId },
      status: "created"
    });
    expect(preview.job.nodeId).toBeUndefined();
    expect(preview.job.phenotypeId).toBeUndefined();
    expect(store.entityCompileArtifacts.get("eca-reference-graph")).toBeUndefined();
    expect(store.generationJobs.get("job-reference-graph")).toBeUndefined();
    expect(store.phenotypes.listByGraph(graph.graphId)).toHaveLength(1);
    expect(JSON.stringify(preview)).not.toMatch(/sk-reference-secret|X-Amz-Signature/);

    const persisted = persistReferenceGeneration(store, preview);
    expect(persisted.persisted).toBe(true);
    expect(store.entityCompileArtifacts.get("eca-reference-graph")).toMatchObject({ targetLevel: "graph" });
    expect(store.generationJobs.get("job-reference-graph")).toMatchObject({ generationKind: "reference" });
    expect(store.phenotypeVersions.listByPhenotype("ph-updates")).toEqual([]);

    const groupPrepared = prepareReferenceGeneration(store, {
      scope: "species-group",
      graphId: graph.graphId,
      groupId: group.groupId,
      brief: "Create group-level style sheet reference.",
      referenceType: "reference-image",
      mock: true,
      ids: { entityArtifactId: "eca-reference-group", generationJobId: "job-reference-group" }
    });
    expect(groupPrepared.entityArtifact.targetLevel).toBe("species-group");
    expect(groupPrepared.job).toMatchObject({
      generationKind: "reference",
      target: { type: "species-group", id: group.groupId, graphId: graph.graphId },
      status: "generated"
    });
    expect(groupPrepared.job.outputSnapshot).toMatchObject({ mockResult: expect.stringContaining("reference-image") });
    expect(() =>
      prepareReferenceGeneration(store, {
        scope: "species-group",
        graphId: "other-graph",
        groupId: group.groupId,
        brief: "bad group",
        referenceType: "reference-image"
      })
    ).toThrow(/does not belong to graph/);
  });

  test("links reference assets to reference generation jobs and rejects private asset pointers", () => {
    const { store, graph } = seedStore();
    const prepared = prepareReferenceGeneration(store, {
      scope: "graph",
      graphId: graph.graphId,
      brief: "Create a safe reference image.",
      referenceType: "reference-image",
      ids: { entityArtifactId: "eca-reference-link", generationJobId: "job-reference-link" }
    });
    persistReferenceGeneration(store, prepared);

    const linked = linkReferenceAsset(
      store,
      {
        generationJobId: "job-reference-link",
        assetId: "asset-reference-link",
        uri: "local://references/ui-board.png",
        assetType: "image",
        role: "reference",
        tags: ["reference", "ui"],
        description: "UI board reference"
      },
      { apply: true }
    );
    expect(linked.persisted).toBe(true);
    expect(store.assets.get("asset-reference-link")).toMatchObject({
      linkedObjectType: "generation-job",
      linkedObjectId: "job-reference-link",
      role: "reference",
      tags: ["reference", "ui"]
    });

    expect(() =>
      linkReferenceAsset(
        store,
        {
          generationJobId: "job-reference-link",
          assetId: "asset-private",
          uri: "https://cdn.example.invalid/private.png?token=secret",
          assetType: "image"
        },
        { apply: false }
      )
    ).toThrow(/private or credential-bearing asset uri/);
  });
});
