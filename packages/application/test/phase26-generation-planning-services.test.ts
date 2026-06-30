import {
  createDefaultGraph,
  createDefaultNodeVersion,
  createDefaultPhenotype,
  createDefaultPhenotypeUsageGuide,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesNode
} from "@dna/core";
import {
  createGenerationPlan,
  createGenerationTask,
  expandGenerationPlan,
  persistPhenotypeGeneration,
  preparePhenotypeGenerationForTask
} from "@dna/application";
import { InMemoryDnaStore } from "@dna/storage";
import { describe, expect, test } from "vitest";

function seedPlanningStore() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-plan", name: "Planning Graph", purpose: "generation planning" });
  const root = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-root", name: "Root Icon" });
  const groupNode = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-grouped", name: "Grouped Icon" });
  const other = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-other", name: "Other Icon" });
  const group = createDefaultSpeciesGroup({ graphId: graph.graphId, groupId: "group-ui", name: "UI Group" });

  store.graphs.create(graph);
  for (const node of [root, groupNode, other]) {
    store.nodes.create(node);
    store.nodeVersions.create(
      createDefaultNodeVersion({
        graphId: graph.graphId,
        nodeId: node.nodeId,
        nodeVersionId: `${node.nodeId}@1.0.0`,
        resolvedGeneSnapshot: { name: node.name }
      })
    );
  }
  store.speciesGroups.create(group);
  store.speciesGroupMemberships.create(
    createDefaultSpeciesGroupMembership({
      graphId: graph.graphId,
      groupId: group.groupId,
      nodeId: groupNode.nodeId,
      membershipId: "membership-grouped"
    })
  );
  store.phenotypes.create(
    createDefaultPhenotype({
      phenotypeId: "ph-root",
      graphId: graph.graphId,
      nodeId: root.nodeId,
      name: "Root planned output",
      phenotypeType: "image-prompt",
      objectBrief: "root icon output",
      status: "planned"
    })
  );
  store.phenotypes.create(
    createDefaultPhenotype({
      phenotypeId: "ph-grouped",
      graphId: graph.graphId,
      nodeId: groupNode.nodeId,
      name: "Grouped planned output",
      phenotypeType: "art-brief",
      objectBrief: "grouped icon output",
      status: "planned"
    })
  );
  store.phenotypes.create(
    createDefaultPhenotype({
      phenotypeId: "ph-other",
      graphId: graph.graphId,
      nodeId: other.nodeId,
      name: "Other active output",
      phenotypeType: "image-prompt",
      objectBrief: "already active",
      status: "active"
    })
  );
  return { store, graph, root, groupNode, group };
}

describe("Phase 26 PRD-17 generation planning services", () => {
  test("creates graph plans and expands planned phenotypes idempotently", () => {
    const { store, graph } = seedPlanningStore();

    const preview = createGenerationPlan(
      store,
      {
        planId: "plan-preview",
        scopeType: "graph",
        scopeId: graph.graphId,
        graphId: graph.graphId,
        priority: 5,
        description: "Preview graph generation",
        toolPreference: "mock",
        llmInstructions: "Keep UI warning language consistent."
      },
      { apply: false }
    );
    expect(preview.persisted).toBe(false);
    expect(store.generationPlans.list()).toEqual([]);

    const created = createGenerationPlan(
      store,
      {
        planId: "plan-graph",
        scopeType: "graph",
        scopeId: graph.graphId,
        graphId: graph.graphId,
        priority: 5,
        description: "Graph generation",
        toolPreference: "mock",
        llmInstructions: "Keep UI warning language consistent."
      },
      { apply: true }
    );

    expect(created.persisted).toBe(true);
    const expansionPreview = expandGenerationPlan(store, { planId: "plan-graph" }, { apply: false });
    expect(expansionPreview.createdTasks.map((task) => task.phenotypeId)).toEqual(["ph-grouped", "ph-root"]);
    expect(store.generationTasks.listByPlan("plan-graph")).toEqual([]);

    const expansion = expandGenerationPlan(store, { planId: "plan-graph" }, { apply: true });
    expect(expansion.createdTasks.map((task) => task.phenotypeId)).toEqual(["ph-grouped", "ph-root"]);
    expect(expansion.skippedExistingTaskIds).toEqual([]);
    expect(store.generationTasks.listByPlan("plan-graph")).toHaveLength(2);
    expect(store.generationTasks.listByPlan("plan-graph")[0]).toMatchObject({
      planId: "plan-graph",
      priority: 5,
      toolPreference: "mock",
      llmInstructions: "Keep UI warning language consistent.",
      versionBinding: { mode: "latest-at-execution" }
    });

    const secondExpansion = expandGenerationPlan(store, { planId: "plan-graph" }, { apply: true });
    expect(secondExpansion.createdTasks).toEqual([]);
    expect(secondExpansion.skippedExistingTaskIds).toHaveLength(2);
    expect(store.generationTasks.listByPlan("plan-graph")).toHaveLength(2);
  });

  test("expands species-group, species-node, and phenotype scoped plans to the correct planned targets", () => {
    const { store, graph, root, groupNode, group } = seedPlanningStore();

    for (const input of [
      { planId: "plan-group", scopeType: "species-group" as const, scopeId: group.groupId, graphId: graph.graphId },
      { planId: "plan-node", scopeType: "species-node" as const, scopeId: root.nodeId, graphId: graph.graphId },
      { planId: "plan-phenotype", scopeType: "phenotype" as const, scopeId: "ph-grouped", graphId: graph.graphId }
    ]) {
      createGenerationPlan(
        store,
        { ...input, priority: 1, description: input.planId, toolPreference: "manual" },
        { apply: true }
      );
    }

    expect(expandGenerationPlan(store, { planId: "plan-group" }, { apply: true }).createdTasks.map((task) => task.nodeId)).toEqual([
      groupNode.nodeId
    ]);
    expect(expandGenerationPlan(store, { planId: "plan-node" }, { apply: true }).createdTasks.map((task) => task.nodeId)).toEqual([
      root.nodeId
    ]);
    expect(expandGenerationPlan(store, { planId: "plan-phenotype" }, { apply: true }).createdTasks.map((task) => task.phenotypeId)).toEqual([
      "ph-grouped"
    ]);
  });

  test("creates standalone tasks and links generated artifacts, jobs, and versions back to the task", () => {
    const { store, graph, root } = seedPlanningStore();
    const task = createGenerationTask(
      store,
      {
        taskId: "task-standalone",
        graphId: graph.graphId,
        nodeId: root.nodeId,
        phenotypeId: "ph-root",
        phenotypeType: "image-prompt",
        taskBrief: "root icon output",
        priority: 2,
        versionBinding: { mode: "latest-at-execution" },
        toolPreference: "mock"
      },
      { apply: true }
    ).task;

    const prepared = preparePhenotypeGenerationForTask(store, { taskId: task.taskId, tool: "mock" });
    persistPhenotypeGeneration(store, prepared, { taskId: task.taskId });

    const updated = store.generationTasks.get(task.taskId);
    expect(updated).toMatchObject({
      status: "generated",
      speciesCompileArtifactId: prepared.speciesArtifact.artifactId,
      phenotypeCompileArtifactId: prepared.phenotypeArtifact.artifactId,
      generationJobIds: [prepared.job.generationJobId],
      phenotypeVersionIds: [prepared.phenotypeVersion.phenotypeVersionId]
    });
    expect(store.generationJobs.get(prepared.job.generationJobId)?.inputSnapshot).toMatchObject({
      generationTaskId: task.taskId,
      generationPlanId: undefined,
      versionBinding: { mode: "latest-at-execution" }
    });
  });

  test("synthesizes production intent and compact task briefs from planned phenotype context", () => {
    const { store, graph, root } = seedPlanningStore();
    const rootPhenotype = store.phenotypes.get("ph-root")!;
    store.phenotypes.update({
      ...rootPhenotype,
      name: "Warning Toolbar Icon",
      objectBrief: "warning icon for toolbar alerts",
      productionSliceRole: "toolbar-warning-icon",
      outputPlan: {
        expectedAssetTypes: ["image"],
        reviewRubricIds: [],
        notes: "transparent icon, readable at small size"
      },
      facets: { framing: "tight-symbol" },
      tags: ["toolbar", "warning"]
    });
    store.phenotypeUsageGuides.create(
      createDefaultPhenotypeUsageGuide({
        usageGuideId: "guide-warning-toolbar",
        phenotypeId: "ph-root",
        graphId: graph.graphId,
        nodeId: root.nodeId,
        phenotypeType: "image-prompt",
        status: "active",
        title: "Warning toolbar usage",
        summary: "Used anywhere the toolbar needs a compact warning signal.",
        usageScenarios: [
          {
            scenarioId: "scenario-toolbar-alert",
            name: "Toolbar alert",
            designIntent: "Signal risk without overpowering the surrounding controls.",
            implementationRole: "status signal",
            priority: "primary"
          }
        ],
        usageInstructions: {
          primaryUse: "Small toolbar alert indicator",
          placement: "inside action bars",
          composition: "simple silhouette",
          stateBehavior: "must remain legible in disabled and hover states",
          doNotUseFor: ["large modal illustrations"]
        },
        designSemantics: {
          mustPreserve: ["sharp warning silhouette"],
          mustAvoid: ["decorative noise"]
        },
        productionHints: {
          suggestedAssetTypes: ["image"],
          suggestedTransparency: "required",
          deliveryNotes: "keep transparent background"
        },
        reviewChecklist: [
          {
            checklistId: "check-small-size",
            question: "Is the warning shape readable at toolbar size?",
            severity: "warning"
          }
        ]
      })
    );
    const plan = createGenerationPlan(
      store,
      {
        planId: "plan-intent",
        scopeType: "phenotype",
        scopeId: "ph-root",
        graphId: graph.graphId,
        priority: 1,
        description: "Generate warning toolbar icon",
        requirements: { colorDiscipline: "high contrast" },
        llmInstructions: "Respect semantic warning language.",
        operatorNotes: "Review against toolbar context.",
        toolPreference: "mock"
      },
      { apply: true }
    ).plan;

    const expansion = expandGenerationPlan(store, { planId: plan.planId }, { apply: true });
    expect(expansion.createdTasks).toHaveLength(1);
    const task = expansion.createdTasks[0];
    expect(task).toMatchObject({
      phenotypeId: "ph-root",
      productionIntent: {
        productionSliceRole: "toolbar-warning-icon",
        intendedUse: expect.stringContaining("Small toolbar alert indicator"),
        outputShape: {
          expectedAssetTypes: ["image"],
          transparency: "required"
        },
        visualAnchors: expect.arrayContaining(["Root Icon", "Warning Toolbar Icon"]),
        mustPreserve: expect.arrayContaining(["sharp warning silhouette"]),
        mustAvoid: expect.arrayContaining(["large modal illustrations", "decorative noise"]),
        unknowns: []
      }
    });
    expect(task.taskBrief).toContain("Warning Toolbar Icon");
    expect(task.taskBrief).toContain("slice toolbar-warning-icon");
    expect(task.taskBrief).toContain("image");

    const prepared = preparePhenotypeGenerationForTask(store, { taskId: task.taskId, tool: "mock" });
    expect(prepared.job.inputSnapshot).toMatchObject({
      generationTaskId: task.taskId,
      productionIntent: task.productionIntent
    });
    expect(prepared.phenotypeVersion.generationRecipe).toMatchObject({
      productionIntent: task.productionIntent
    });
    expect(prepared.phenotypeArtifact.inputSummary).toMatchObject({
      productionIntent: task.productionIntent
    });
    expect(prepared.phenotypeArtifact.prompt).toContain("Production intent:");
  });
});
