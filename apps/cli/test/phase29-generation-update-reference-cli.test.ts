import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
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
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function runDnaFail(args: string[]) {
  try {
    runDna(args);
    throw new Error("expected dna command to fail");
  } catch (error) {
    const failure = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
    return `${failure.stdout?.toString() ?? ""}${failure.stderr?.toString() ?? ""}${failure.message ?? ""}`;
  }
}

function seedGraphPlanAndTask(db: string) {
  runDna(["--db", db, "graph", "create", "--id", "graph-ref", "--name", "Reference Graph", "--purpose", "reference generation", "--yes"]);
  runDna(["--db", db, "node", "create", "--graph", "graph-ref", "--id", "node-ref", "--name", "Reference Node", "--yes"]);
  runDna(["--db", db, "group", "create", "--graph", "graph-ref", "--id", "group-ref", "--name", "Reference Group", "--yes"]);
  runDna([
    "--db",
    db,
    "group",
    "member",
    "add",
    "--id",
    "membership-ref",
    "--graph",
    "graph-ref",
    "--group",
    "group-ref",
    "--node",
    "node-ref",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "generation-plan",
    "create",
    "--id",
    "plan-ref",
    "--scope",
    "graph",
    "--scope-id",
    "graph-ref",
    "--priority",
    "5",
    "--description",
    "Initial plan",
    "--requirement",
    "old=value",
    "--tag",
    "old",
    "--apply"
  ]);
  runDna([
    "--db",
    db,
    "generation-task",
    "create",
    "--id",
    "task-ref",
    "--graph",
    "graph-ref",
    "--node",
    "node-ref",
    "--type",
    "icon",
    "--brief",
    "initial icon",
    "--priority",
    "5",
    "--plan",
    "plan-ref",
    "--tag",
    "old",
    "--apply"
  ]);
}

describe("Phase 29 issues #14/#15 generation update and reference generation CLI", () => {
  test("updates generation plan and task metadata through preview/apply commands", () => {
    const dir = tempDir("phase29-generation-update-cli");
    const db = join(dir, "dna.sqlite");
    seedGraphPlanAndTask(db);

    const planPreview = runDna([
      "--db",
      db,
      "generation-plan",
      "update",
      "--id",
      "plan-ref",
      "--description",
      "Updated plan",
      "--set-metadata",
      "owner=review",
      "--remove-requirement",
      "old",
      "--add-tag",
      "review"
    ]);
    expect(planPreview).toContain("Preview generation plan update");
    expect(runDna(["--db", db, "generation-plan", "show", "--id", "plan-ref"])).toContain("Initial plan");

    const appliedPlan = JSON.parse(
      runDna([
        "--db",
        db,
        "generation-plan",
        "update",
        "--id",
        "plan-ref",
        "--description",
        "Updated plan",
        "--set-metadata",
        "owner=review",
        "--remove-requirement",
        "old",
        "--add-tag",
        "review",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(appliedPlan.after).toMatchObject({ description: "Updated plan", metadata: { owner: "review" }, tags: ["old", "review"] });

    const taskPreview = runDna([
      "--db",
      db,
      "generation-task",
      "update",
      "--plan",
      "plan-ref",
      "--status",
      "blocked",
      "--blocking-reason",
      "waiting for graph reference",
      "--set-requirement",
      "referenceGenerationJobIds=job-ref",
      "--add-tag",
      "blocked"
    ]);
    expect(taskPreview).toContain("Preview generation task update");
    expect(taskPreview).toContain("Selected tasks:");
    expect(taskPreview).toContain("task-ref");
    expect(runDna(["--db", db, "generation-task", "show", "--id", "task-ref"])).toContain("Status: planned");

    const appliedTask = JSON.parse(
      runDna([
        "--db",
        db,
        "generation-task",
        "update",
        "--id",
        "task-ref",
        "--status",
        "blocked",
        "--blocking-reason",
        "waiting for graph reference",
        "--set-requirement",
        "referenceGenerationJobIds=job-ref",
        "--add-tag",
        "blocked",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(appliedTask.updatedTasks[0]).toMatchObject({
      taskId: "task-ref",
      status: "blocked",
      blockingReason: "waiting for graph reference",
      requirements: { referenceGenerationJobIds: "job-ref" },
      tags: ["old", "blocked"]
    });
  }, CLI_TIMEOUT);

  test("prepares, runs, and links graph/group scoped reference generation without phenotype records", () => {
    const dir = tempDir("phase29-reference-generation-cli");
    const db = join(dir, "dna.sqlite");
    seedGraphPlanAndTask(db);

    const preview = runDna([
      "--db",
      db,
      "reference-generation",
      "prepare",
      "--scope",
      "graph",
      "--graph",
      "graph-ref",
      "--brief",
      "Create UI graph-wide moodboard",
      "--reference-type",
      "moodboard"
    ]);
    expect(preview).toContain("Preview reference generation");
    expect(preview).toContain("Create UI graph-wide moodboard");
    expect(runDnaFail(["--db", db, "provider", "job", "show", "--id", "job-reference-graph"])).toContain("generation job not found");

    const prepared = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "prepare",
        "--scope",
        "graph",
        "--graph",
        "graph-ref",
        "--brief",
        "Create UI graph-wide moodboard",
        "--reference-type",
        "moodboard",
        "--entity-artifact",
        "eca-reference-graph-cli",
        "--job",
        "job-reference-graph-cli",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(prepared.job).toMatchObject({
      generationKind: "reference",
      generationJobId: "job-reference-graph-cli",
      target: { type: "graph", id: "graph-ref" }
    });
    expect(prepared.job.nodeId).toBeUndefined();
    expect(prepared.job.phenotypeId).toBeUndefined();

    const groupRun = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "run-mock",
        "--scope",
        "species-group",
        "--graph",
        "graph-ref",
        "--group",
        "group-ref",
        "--brief",
        "Create group reference sheet",
        "--reference-type",
        "reference-image",
        "--job",
        "job-reference-group-cli",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(groupRun.job).toMatchObject({ generationKind: "reference", status: "generated" });

    const linked = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "link-asset",
        "--job",
        "job-reference-group-cli",
        "--asset-id",
        "asset-reference-group-cli",
        "--uri",
        "local://references/group-sheet.png",
        "--asset-type",
        "image",
        "--role",
        "reference",
        "--tag",
        "reference",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(linked.asset).toMatchObject({
      assetId: "asset-reference-group-cli",
      linkedObjectType: "generation-job",
      linkedObjectId: "job-reference-group-cli"
    });
    expect(runDna(["--db", db, "generation-task", "show", "--id", "task-ref", "--format", "json"])).not.toContain("local://references/group-sheet.png");
  }, CLI_TIMEOUT);
});
