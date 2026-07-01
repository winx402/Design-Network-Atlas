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

function seedTask(db: string, dir: string) {
  const batchFile = join(dir, "managed-generation-batch.json");
  writeFileSync(
    batchFile,
    `${JSON.stringify(
      {
        format: "dna.modeling-batch.v1",
        graphs: [{ graphId: "graph-managed-cli", name: "Managed CLI Graph", purpose: "managed generation" }],
        speciesNodes: [{ graphId: "graph-managed-cli", nodeId: "species-managed-cli", name: "Managed Species", category: "ui", level: "species" }],
        phenotypePlans: [
          {
            phenotypeId: "phenotype-managed-cli",
            graphId: "graph-managed-cli",
            nodeId: "species-managed-cli",
            phenotypeType: "icon",
            productionSliceRole: "default",
            name: "Managed Icon",
            objectBrief: "managed evidence icon",
            expectedAssetTypes: ["image"]
          }
        ]
      },
      null,
      2
    )}\n`
  );
  runDna(["--db", db, "proposal", "import-batch", "--in", batchFile, "--id", "proposal-managed-cli", "--title", "Managed proposal"]);
  runDna(["--db", db, "--yes", "proposal", "apply", "proposal-managed-cli"]);
  runDna([
    "--db",
    db,
    "generation-plan",
    "create",
    "--id",
    "plan-managed-cli",
    "--scope",
    "graph",
    "--scope-id",
    "graph-managed-cli",
    "--priority",
    "1",
    "--description",
    "Generate managed candidates",
    "--tool",
    "mock",
    "--apply"
  ]);
  const expansion = JSON.parse(runDna(["--db", db, "generation-plan", "expand", "--id", "plan-managed-cli", "--apply", "--format", "json"]));
  return expansion.createdTasks[0].taskId as string;
}

describe("Phase 33 PRD-24 managed generation CLI", () => {
  test("runs and verifies generation jobs before strict phenotype version acceptance", () => {
    const dir = tempDir("phase33-managed-generation-cli");
    const db = join(dir, "dna.sqlite");
    const taskId = seedTask(db, dir);

    const generated = JSON.parse(runDna(["--db", db, "phenotype", "generate", "--task", taskId, "--apply", "--format", "json"]));
    const generationJobId = generated.payload.job.generationJobId as string;
    const phenotypeVersionId = generated.payload.phenotypeVersion.phenotypeVersionId as string;

    const showText = runDna(["--db", db, "generation-job", "show", "--id", generationJobId]);
    expect(showText).toContain("Provenance: compiled-only");
    expect(showText).toContain("Verification: not-run");

    expect(runDnaFailure(["--db", db, "phenotype-version", "accept", "--id", phenotypeVersionId, "--strict-provenance", "--apply"])).toContain(
      "requires runner-verified generation evidence"
    );

    const runPreview = runDna(["--db", db, "generation-job", "run", "--id", generationJobId, "--runner", "mock-runner"]);
    expect(runPreview).toContain("Preview managed generation run");
    expect(JSON.parse(runDna(["--db", db, "generation-job", "show", "--id", generationJobId, "--format", "json"])).provenanceLevel).toBe("compiled-only");

    const runResult = JSON.parse(runDna(["--db", db, "generation-job", "run", "--id", generationJobId, "--runner", "mock-runner", "--apply", "--format", "json"]));
    expect(runResult.after.status).toBe("generated");
    expect(runResult.after.provenanceLevel).toBe("runner-recorded");
    expect(runResult.outputEvidence.assetIds).toEqual([`asset-${generationJobId}`]);

    const verifyResult = JSON.parse(runDna(["--db", db, "generation-job", "verify", "--id", generationJobId, "--apply", "--format", "json"]));
    expect(verifyResult.after.provenanceLevel).toBe("runner-verified");
    expect(verifyResult.after.verificationSummary.status).toBe("passed");

    const accepted = JSON.parse(runDna(["--db", db, "phenotype-version", "accept", "--id", phenotypeVersionId, "--strict-provenance", "--apply", "--format", "json"]));
    expect(accepted.currentAcceptedVersion.after).toBe(phenotypeVersionId);
  }, CLI_TIMEOUT);

  test("phenotype generate can run managed runner shortcut for task-backed generation", () => {
    const dir = tempDir("phase33-managed-generation-shortcut-cli");
    const db = join(dir, "dna.sqlite");
    const taskId = seedTask(db, dir);

    const generated = JSON.parse(runDna(["--db", db, "phenotype", "generate", "--task", taskId, "--runner", "mock-runner", "--apply", "--format", "json"]));
    expect(generated.payload.managedGeneration.after.provenanceLevel).toBe("runner-recorded");
    expect(generated.payload.managedGeneration.after.status).toBe("generated");
    expect(generated.payload.managedGeneration.outputEvidence.assetIds).toEqual([`asset-${generated.payload.job.generationJobId}`]);
  }, CLI_TIMEOUT);
});
