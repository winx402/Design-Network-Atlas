import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 120_000;

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function runDna(args: string[]) {
  return execFileSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
}

function seedPlannedPhenotype(db: string, dir: string) {
  const batchFile = join(dir, "planned-generation.json");
  writeFileSync(
    batchFile,
    `${JSON.stringify(
      {
        format: "dna.modeling-batch.v1",
        graphs: [{ graphId: "graph-generation", name: "Generation Graph", purpose: "generation planning" }],
        speciesNodes: [{ graphId: "graph-generation", nodeId: "species-warning", name: "Warning Species", category: "ui", level: "species" }],
        phenotypePlans: [
          {
            phenotypeId: "phenotype-warning-icon",
            graphId: "graph-generation",
            nodeId: "species-warning",
            phenotypeType: "icon",
            productionSliceRole: "toolbar-warning-icon",
            name: "Warning Icon",
            objectBrief: "small warning icon",
            expectedAssetTypes: ["image"]
          }
        ]
      },
      null,
      2
    )}\n`
  );
  runDna([
    "--db",
    db,
    "proposal",
    "import-batch",
    "--in",
    batchFile,
    "--id",
    "proposal-generation",
    "--title",
    "Generation proposal"
  ]);
  runDna(["--db", db, "--yes", "proposal", "apply", "proposal-generation"]);
}

describe("Phase 26 PRD-17 generation planning CLI", () => {
  test("creates plans, expands idempotent tasks, and generates from a task", () => {
    const dir = tempDir("phase26-generation-planning-cli");
    const db = join(dir, "dna.sqlite");
    seedPlannedPhenotype(db, dir);

    const preview = runDna([
      "--db",
      db,
      "generation-plan",
      "create",
      "--id",
      "plan-generation",
      "--scope",
      "graph",
      "--scope-id",
      "graph-generation",
      "--priority",
      "1",
      "--description",
      "Generate planned warning outputs",
      "--tool",
      "mock",
      "--llm-instructions",
      "Keep warning silhouettes readable."
    ]);
    expect(preview).toContain("Preview generation plan");
    expect(runDna(["--db", db, "generation-plan", "list"])).not.toContain("plan-generation");

    const createdPlan = JSON.parse(
      runDna([
        "--db",
        db,
        "generation-plan",
        "create",
        "--id",
        "plan-generation",
        "--scope",
        "graph",
        "--scope-id",
        "graph-generation",
        "--priority",
        "1",
        "--description",
        "Generate planned warning outputs",
        "--tool",
        "mock",
        "--llm-instructions",
        "Keep warning silhouettes readable.",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(createdPlan.plan).toMatchObject({
      planId: "plan-generation",
      scopeType: "graph",
      versionBinding: { mode: "latest-at-execution" }
    });

    const expansionPreview = runDna(["--db", db, "generation-plan", "expand", "--id", "plan-generation"]);
    expect(expansionPreview).toContain("Preview generation tasks");
    expect(expansionPreview).toContain("planned: 1");
    expect(runDna(["--db", db, "generation-task", "list"])).not.toContain("phenotype-warning-icon");

    const expansion = JSON.parse(
      runDna(["--db", db, "generation-plan", "expand", "--id", "plan-generation", "--apply", "--format", "json"])
    );
    expect(expansion.createdTasks).toHaveLength(1);
    const taskId = expansion.createdTasks[0].taskId as string;
    expect(expansion.createdTasks[0]).toMatchObject({
      planId: "plan-generation",
      phenotypeId: "phenotype-warning-icon",
      toolPreference: "mock",
      productionIntent: {
        productionSliceRole: "toolbar-warning-icon",
        outputShape: { expectedAssetTypes: ["image"] }
      }
    });

    const secondExpansion = JSON.parse(
      runDna(["--db", db, "generation-plan", "expand", "--id", "plan-generation", "--apply", "--format", "json"])
    );
    expect(secondExpansion.createdTasks).toEqual([]);
    expect(secondExpansion.skippedExistingTaskIds).toEqual([taskId]);

    const shownTask = JSON.parse(runDna(["--db", db, "generation-task", "show", "--id", taskId, "--format", "json"]));
    expect(shownTask).toMatchObject({
      taskId,
      status: "planned",
      versionBinding: { mode: "latest-at-execution" },
      productionIntent: {
        productionSliceRole: "toolbar-warning-icon"
      }
    });
    expect(runDna(["--db", db, "generation-task", "show", "--id", taskId])).toContain("Production slice: toolbar-warning-icon");

    const generated = JSON.parse(runDna(["--db", db, "phenotype", "generate", "--task", taskId, "--apply"]));
    expect(generated.job.inputSnapshot).toMatchObject({
      generationTaskId: taskId,
      generationPlanId: "plan-generation",
      versionBinding: { mode: "latest-at-execution" }
    });

    const generatedTask = JSON.parse(runDna(["--db", db, "generation-task", "show", "--id", taskId, "--format", "json"]));
    expect(generatedTask).toMatchObject({
      taskId,
      status: "generated",
      generationJobIds: [generated.job.generationJobId],
      phenotypeVersionIds: [generated.phenotypeVersion.phenotypeVersionId],
      speciesCompileArtifactId: generated.speciesArtifact.artifactId,
      phenotypeCompileArtifactId: generated.phenotypeArtifact.artifactId
    });
  }, CLI_TIMEOUT);

  test("creates standalone tasks and exposes planning command help", () => {
    const dir = tempDir("phase26-generation-task-cli");
    const db = join(dir, "dna.sqlite");
    seedPlannedPhenotype(db, dir);

    const task = JSON.parse(
      runDna([
        "--db",
        db,
        "generation-task",
        "create",
        "--id",
        "task-standalone",
        "--graph",
        "graph-generation",
        "--node",
        "species-warning",
        "--phenotype",
        "phenotype-warning-icon",
        "--type",
        "icon",
        "--brief",
        "small warning icon",
        "--production-intent",
        JSON.stringify({
          sourceObject: { graphId: "graph-generation", nodeId: "species-warning", phenotypeId: "phenotype-warning-icon", phenotypeType: "icon" },
          productionSliceRole: "toolbar-warning-icon",
          intendedUse: "Standalone toolbar warning task",
          outputShape: { expectedAssetTypes: ["image"], transparency: "required" },
          visualAnchors: ["warning silhouette"],
          mustPreserve: ["small-size readability"],
          mustAvoid: ["busy background"],
          unknowns: []
        }),
        "--priority",
        "2",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(task.task).toMatchObject({
      taskId: "task-standalone",
      versionBinding: { mode: "latest-at-execution" },
      productionIntent: {
        productionSliceRole: "toolbar-warning-icon",
        intendedUse: "Standalone toolbar warning task"
      }
    });
    expect(task.task.planId).toBeUndefined();
    expect(runDna(["generation-plan", "--help"])).toContain("create");
    expect(runDna(["generation-task", "--help"])).toContain("run-mock");
    expect(runDna(["phenotype", "generate", "--help"])).toContain("--task");
  }, CLI_TIMEOUT);
});
