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
      status: "created",
      target: { type: "graph", id: "graph-ref" }
    });
    expect(prepared.job.nodeId).toBeUndefined();
    expect(prepared.job.phenotypeId).toBeUndefined();
    expect(runDnaFail(["--db", db, "reference-generation", "complete", "--job", "job-reference-graph-cli", "--apply"])).toContain("output evidence");

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
      linkedObjectId: "job-reference-group-cli",
      storageType: "local"
    });
    const linkedEagle = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "link-asset",
        "--job",
        "job-reference-group-cli",
        "--asset-id",
        "asset-reference-group-eagle-cli",
        "--uri",
        "eagle://item/group-sheet",
        "--storage-type",
        "eagle",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(linkedEagle.asset).toMatchObject({ storageType: "eagle" });
    expect(
      runDnaFail([
        "--db",
        db,
        "reference-generation",
        "link-asset",
        "--job",
        "job-reference-group-cli",
        "--asset-id",
        "asset-reference-group-conflict-cli",
        "--uri",
        "eagle://item/group-conflict",
        "--storage-type",
        "local",
        "--apply"
      ])
    ).toContain("storage type local conflicts with inferred storage type eagle");
    expect(runDna(["--db", db, "generation-task", "show", "--id", "task-ref", "--format", "json"])).not.toContain("local://references/group-sheet.png");

    runDna([
      "--db",
      db,
      "reference-generation",
      "link-asset",
      "--job",
      "job-reference-graph-cli",
      "--asset-id",
      "asset-reference-graph-cli",
      "--uri",
      "local://references/graph-board.png",
      "--asset-type",
      "image",
      "--role",
      "reference",
      "--apply"
    ]);
    const completePreview = runDna([
      "--db",
      db,
      "reference-generation",
      "complete",
      "--job",
      "job-reference-graph-cli",
      "--note",
      "external board complete with Bearer sk-secret-token",
      "--external-tool",
      "board tool"
    ]);
    expect(completePreview).toContain("Preview reference generation completion");
    expect(completePreview).toContain("Status: created -> generated");
    expect(completePreview).not.toMatch(/sk-secret|Bearer/);
    expect(JSON.parse(runDna(["--db", db, "provider", "job", "show", "--id", "job-reference-graph-cli"])).status).toBe("created");

    const completed = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "complete",
        "--job",
        "job-reference-graph-cli",
        "--note",
        "external board complete with Bearer sk-secret-token",
        "--external-tool",
        "board tool",
        "--metadata",
        "reviewer=lead",
        "--metadata",
        "signedUrl=https://cdn.example.invalid/ref.png?X-Amz-Signature=secret",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(completed.after).toMatchObject({
      generationJobId: "job-reference-graph-cli",
      status: "generated",
      outputSnapshot: {
        referenceCompletion: {
          linkedAssetIds: ["asset-reference-graph-cli"],
          note: "external board complete with [redacted]",
          externalTool: "board tool",
          metadata: { reviewer: "lead" }
        }
      }
    });
    expect(JSON.stringify(completed.after)).not.toMatch(/sk-secret|Bearer|X-Amz-Signature|signedUrl/);

    const atomicPrepared = JSON.parse(
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
        "Create graph-wide atomic reference",
        "--reference-type",
        "moodboard",
        "--entity-artifact",
        "eca-reference-atomic-cli",
        "--job",
        "job-reference-atomic-cli",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(atomicPrepared.job.status).toBe("created");
    const atomic = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "link-asset",
        "--job",
        "job-reference-atomic-cli",
        "--asset-id",
        "asset-reference-atomic-cli",
        "--uri",
        "local://references/atomic-board.png",
        "--asset-type",
        "image",
        "--mark-generated",
        "--note",
        "done",
        "--external-tool",
        "board tool",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(atomic.markedGenerated).toBe(true);
    expect(atomic.completedJob).toMatchObject({ generationJobId: "job-reference-atomic-cli", status: "generated" });
    expect(JSON.parse(runDna(["--db", db, "provider", "job", "show", "--id", "job-reference-atomic-cli"]))).toMatchObject({
      generationKind: "reference",
      status: "generated",
      outputSnapshot: {
        referenceCompletion: {
          linkedAssetIds: ["asset-reference-atomic-cli"],
          note: "done",
          externalTool: "board tool"
        }
      }
    });
  }, CLI_TIMEOUT);

  test("migrates reference asset pointers to Eagle through replace-asset", () => {
    const dir = tempDir("phase29-reference-asset-migration-cli");
    const db = join(dir, "dna.sqlite");
    seedGraphPlanAndTask(db);

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
      "Create graph-wide reference for Eagle migration",
      "--reference-type",
      "moodboard",
      "--entity-artifact",
      "eca-reference-migrate-cli",
      "--job",
      "job-reference-migrate-cli",
      "--apply"
    ]);
    runDna([
      "--db",
      db,
      "reference-generation",
      "link-asset",
      "--job",
      "job-reference-migrate-cli",
      "--asset-id",
      "asset-reference-local-cli",
      "--uri",
      "local://references/migrate.png",
      "--apply"
    ]);
    runDna([
      "--db",
      db,
      "reference-generation",
      "complete",
      "--job",
      "job-reference-migrate-cli",
      "--asset",
      "asset-reference-local-cli",
      "--note",
      "accepted local result",
      "--apply"
    ]);

    const preview = runDna([
      "--db",
      db,
      "reference-generation",
      "replace-asset",
      "--job",
      "job-reference-migrate-cli",
      "--old-asset",
      "asset-reference-local-cli",
      "--new-asset-id",
      "asset-reference-eagle-cli",
      "--uri",
      "eagle://item/reference-migrate",
      "--note",
      "migrated with Bearer sk-secret-token"
    ]);
    expect(preview).toContain("Preview reference asset replacement");
    expect(preview).toContain("Old asset: asset-reference-local-cli pending -> archived");
    expect(preview).toContain("New asset: asset-reference-eagle-cli active");
    expect(preview).toContain("Migration: asset-reference-local-cli -> asset-reference-eagle-cli");
    expect(preview).toContain("Storage type: eagle");
    expect(preview).not.toMatch(/sk-secret|Bearer/);
    expect(JSON.parse(runDna(["--db", db, "asset", "search", "--linked-id", "job-reference-migrate-cli"]))).toHaveLength(1);

    const applied = JSON.parse(
      runDna([
        "--db",
        db,
        "reference-generation",
        "replace-asset",
        "--job",
        "job-reference-migrate-cli",
        "--old-asset",
        "asset-reference-local-cli",
        "--new-asset-id",
        "asset-reference-eagle-cli",
        "--uri",
        "eagle://item/reference-migrate",
        "--storage-type",
        "eagle",
        "--note",
        "migrated with Bearer sk-secret-token",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(applied.oldAssetAfter).toMatchObject({
      assetId: "asset-reference-local-cli",
      status: "archived",
      facets: {
        referenceAssetMigration: {
          supersededByAssetId: "asset-reference-eagle-cli"
        }
      }
    });
    expect(applied.newAsset).toMatchObject({
      assetId: "asset-reference-eagle-cli",
      storageType: "eagle",
      status: "active",
      facets: {
        referenceAssetMigration: {
          supersedesAssetId: "asset-reference-local-cli"
        }
      }
    });
    const assets = JSON.parse(runDna(["--db", db, "asset", "search", "--linked-id", "job-reference-migrate-cli"]));
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "asset-reference-local-cli", status: "archived" }),
        expect.objectContaining({ assetId: "asset-reference-eagle-cli", status: "active", storageType: "eagle" })
      ])
    );
    expect(JSON.parse(runDna(["--db", db, "provider", "job", "show", "--id", "job-reference-migrate-cli"]))).toMatchObject({
      status: "generated",
      outputSnapshot: {
        referenceCompletion: {
          linkedAssetIds: ["asset-reference-eagle-cli"]
        }
      }
    });
    expect(
      runDnaFail([
        "--db",
        db,
        "reference-generation",
        "replace-asset",
        "--job",
        "job-reference-migrate-cli",
        "--old-asset",
        "asset-reference-local-cli",
        "--new-asset-id",
        "asset-reference-conflict-cli",
        "--uri",
        "eagle://item/conflict",
        "--storage-type",
        "local"
      ])
    ).toContain("storage type local conflicts with inferred storage type eagle");
  }, CLI_TIMEOUT);
});
