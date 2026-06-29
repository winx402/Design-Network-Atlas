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
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: CLI_TIMEOUT
  });
}

function runDnaFailure(args: string[]) {
  try {
    runDna(args);
    throw new Error("Expected command to fail");
  } catch (error) {
    const failure = error as { stdout?: Buffer | string; stderr?: Buffer | string; message: string };
    return `${failure.stdout?.toString() ?? ""}${failure.stderr?.toString() ?? ""}${failure.message}`;
  }
}

function seedPlannedPhenotype(db: string, dir: string) {
  const batchFile = join(dir, "planned-generation.json");
  writeFileSync(
    batchFile,
    `${JSON.stringify(
      {
        format: "dna.modeling-batch.v1",
        graphs: [{ graphId: "graph-life-cli", name: "Lifecycle CLI Graph", purpose: "version lifecycle" }],
        speciesNodes: [{ graphId: "graph-life-cli", nodeId: "species-life-cli", name: "Lifecycle Species", category: "ui", level: "species" }],
        phenotypePlans: [
          {
            phenotypeId: "phenotype-life-cli",
            graphId: "graph-life-cli",
            nodeId: "species-life-cli",
            phenotypeType: "icon",
            name: "Lifecycle Icon",
            objectBrief: "small lifecycle icon",
            expectedAssetTypes: ["image"]
          }
        ]
      },
      null,
      2
    )}\n`
  );
  runDna(["--db", db, "proposal", "import-batch", "--in", batchFile, "--id", "proposal-life-cli", "--title", "Lifecycle proposal"]);
  runDna(["--db", db, "--yes", "proposal", "apply", "proposal-life-cli"]);
  runDna([
    "--db",
    db,
    "generation-plan",
    "create",
    "--id",
    "plan-life-cli",
    "--scope",
    "graph",
    "--scope-id",
    "graph-life-cli",
    "--priority",
    "1",
    "--description",
    "Generate lifecycle candidates",
    "--tool",
    "mock",
    "--apply"
  ]);
  const expansion = JSON.parse(runDna(["--db", db, "generation-plan", "expand", "--id", "plan-life-cli", "--apply", "--format", "json"]));
  return expansion.createdTasks[0].taskId as string;
}

function runTask(db: string, taskId: string) {
  const result = JSON.parse(runDna(["--db", db, "generation-task", "run-mock", "--id", taskId, "--apply", "--format", "json"]));
  return result.phenotypeVersion.phenotypeVersionId as string;
}

describe("Phase 27 PRD-18 phenotype version lifecycle CLI", () => {
  test("previews and applies accept, replace, rollback, and feedback commands", () => {
    const dir = tempDir("phase27-phenotype-version-lifecycle-cli");
    const db = join(dir, "dna.sqlite");
    const taskId = seedPlannedPhenotype(db, dir);
    const firstVersionId = runTask(db, taskId);
    const firstBefore = JSON.parse(runDna(["--db", db, "phenotype-version", "show", "--id", firstVersionId, "--format", "json"]));
    expect(firstBefore.status).toBe("candidate");
    expect(firstBefore.provenance.generationTaskIds).toEqual([taskId]);

    const preview = runDna(["--db", db, "phenotype-version", "accept", "--id", firstVersionId, "--feedback", "Accepted for production."]);
    expect(preview).toContain("Preview phenotype version lifecycle");
    expect(preview).toContain(`candidate -> accepted`);
    expect(JSON.parse(runDna(["--db", db, "phenotype-version", "show", "--id", firstVersionId, "--format", "json"])).status).toBe("candidate");

    const accepted = JSON.parse(
      runDna(["--db", db, "phenotype-version", "accept", "--id", firstVersionId, "--feedback", "Accepted for production.", "--apply", "--format", "json"])
    );
    expect(accepted.currentAcceptedVersion.after).toBe(firstVersionId);

    const secondVersionId = runTask(db, taskId);
    expect(runDnaFailure(["--db", db, "phenotype-version", "accept", "--id", secondVersionId, "--apply"])).toContain("replace or rollback");

    const replaced = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype-version",
        "replace",
        "--old",
        firstVersionId,
        "--new",
        secondVersionId,
        "--feedback",
        "Cleaner replacement.",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(replaced.statusChanges).toEqual([
      { phenotypeVersionId: firstVersionId, from: "accepted", to: "replaced" },
      { phenotypeVersionId: secondVersionId, from: "candidate", to: "accepted" }
    ]);

    const feedback = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype-version",
        "feedback",
        "add",
        "--id",
        firstVersionId,
        "--message",
        "Keep as fallback, but do not store OPENAI_API_KEY=sk-secret",
        "--severity",
        "warning",
        "--source",
        "agent",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(JSON.stringify(feedback)).not.toContain("sk-secret");
    expect(JSON.stringify(feedback)).not.toContain("OPENAI_API_KEY");

    runDna([
      "--db",
      db,
      "phenotype-version",
      "feedback",
      "summary",
      "--id",
      firstVersionId,
      "--summary",
      "Fallback version after replacement.",
      "--apply"
    ]);

    const rolledBack = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype-version",
        "rollback",
        "--phenotype",
        "phenotype-life-cli",
        "--to",
        firstVersionId,
        "--feedback",
        "Rollback to first accepted output.",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(rolledBack.currentAcceptedVersion.after).toBe(firstVersionId);

    const finalFirst = JSON.parse(runDna(["--db", db, "phenotype-version", "show", "--id", firstVersionId, "--format", "json"]));
    const finalSecond = JSON.parse(runDna(["--db", db, "phenotype-version", "show", "--id", secondVersionId, "--format", "json"]));
    expect(finalFirst.status).toBe("accepted");
    expect(finalFirst.feedback.summary).toBe("Fallback version after replacement.");
    expect(finalSecond.status).toBe("rolled-back");
    expect(finalFirst.promptSnapshot).toBe(firstBefore.promptSnapshot);
    expect(finalFirst.generationRecipe).toEqual(firstBefore.generationRecipe);
    expect(finalFirst.createdAt).toBe(firstBefore.createdAt);
  }, CLI_TIMEOUT);
});
