import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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

function runDnaFailure(args: string[]) {
  const result = spawnSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  expect(result.status).not.toBe(0);
  return `${result.stdout}${result.stderr}`;
}

function seedPhenotype(db: string) {
  runDna(["--db", db, "graph", "create", "--id", "graph-guide-cli", "--name", "Guide CLI", "--purpose", "guide cli", "--yes"]);
  runDna([
    "--db",
    db,
    "node",
    "create",
    "--graph",
    "graph-guide-cli",
    "--id",
    "node-guide-cli",
    "--name",
    "Guide CLI Species",
    "--category",
    "ui",
    "--level",
    "species",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "phenotype",
    "create",
    "--id",
    "ph-guide-cli",
    "--graph",
    "graph-guide-cli",
    "--node",
    "node-guide-cli",
    "--type",
    "ui-icon",
    "--name",
    "Guide CLI Phenotype",
    "--brief",
    "Planned guide output",
    "--apply"
  ]);
}

function guideInputFile(dir: string) {
  const file = join(dir, "guide.json");
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        usageGuideId: "guide-cli",
        title: "CLI usage guide",
        summary: "Guide created by CLI.",
        usageScenarios: [{ scenarioId: "primary", name: "Primary", designIntent: "Explain usage.", priority: "primary" }],
        usageInstructions: { primaryUse: "Use where this phenotype is planned." },
        designSemantics: { mustPreserve: ["meaning"], mustAvoid: ["private paths"] },
        variantPlan: [{ variantId: "default", name: "Default", purpose: "baseline", required: true }],
        productionHints: { suggestedAssetTypes: ["image"] },
        reviewChecklist: [{ checklistId: "check-cli", question: "Useful?", severity: "warning" }],
        sourceSummary: "CLI input."
      },
      null,
      2
    )}\n`
  );
  return file;
}

describe("Phase 31 PRD-22 phenotype guide CLI", () => {
  test("prepares, creates, updates, renders, lists, and archives guides with preview/apply", () => {
    const dir = tempDir("phase31-phenotype-guide-cli");
    const db = join(dir, "dna.sqlite");
    seedPhenotype(db);
    const input = guideInputFile(dir);

    const prepareText = runDna(["--db", db, "phenotype", "guide", "prepare", "--phenotype", "ph-guide-cli"]);
    expect(prepareText).toContain("CLI usage guide template");
    expect(prepareText).toContain("Do not invent missing graph");
    expect(prepareText).not.toMatch(/OPENAI_API_KEY|sk-proj|Bearer|\/Users\/bot|Cocos/);

    const preview = runDna(["--db", db, "phenotype", "guide", "create", "--phenotype", "ph-guide-cli", "--input", input]);
    expect(preview).toContain("ChangeSet preview");
    expect(runDnaFailure(["--db", db, "phenotype", "guide", "show", "--phenotype", "ph-guide-cli"])).toContain(
      "usage guide not found for phenotype: ph-guide-cli"
    );

    runDna(["--db", db, "phenotype", "guide", "create", "--phenotype", "ph-guide-cli", "--input", input, "--apply"]);
    expect(JSON.parse(runDna(["--db", db, "phenotype", "guide", "show", "--phenotype", "ph-guide-cli", "--format", "json"]))).toMatchObject({
      usageGuideId: "guide-cli",
      revision: 1,
      status: "active"
    });
    expect(runDna(["--db", db, "phenotype", "guide", "render", "--phenotype", "ph-guide-cli", "--format", "markdown"])).toContain(
      "# CLI usage guide 使用说明"
    );
    expect(runDna(["--db", db, "phenotype", "guide", "list", "--node", "node-guide-cli"])).toContain("guide-cli");

    writeFileSync(input, readFileSync(input, "utf8").replace("Guide created by CLI.", "Updated by CLI."));
    runDna(["--db", db, "phenotype", "guide", "update", "--guide", "guide-cli", "--input", input, "--apply"]);
    expect(JSON.parse(runDna(["--db", db, "phenotype", "guide", "show", "--phenotype", "ph-guide-cli", "--format", "json"]))).toMatchObject({
      summary: "Updated by CLI.",
      revision: 2
    });

    runDna(["--db", db, "phenotype", "guide", "archive", "--guide", "guide-cli", "--apply"]);
    const archived = runDnaFailure(["--db", db, "phenotype", "guide", "show", "--phenotype", "ph-guide-cli"]);
    expect(archived).toContain("usage guide not found for phenotype: ph-guide-cli");
  }, 20000);

  test("phenotype generate JSON output includes usage guide trace and does not rewrite the guide", () => {
    const dir = tempDir("phase31-phenotype-guide-generate");
    const db = join(dir, "dna.sqlite");
    seedPhenotype(db);
    const input = guideInputFile(dir);
    runDna(["--db", db, "phenotype", "guide", "create", "--phenotype", "ph-guide-cli", "--input", input, "--apply"]);

    const output = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-guide-cli",
        "--node",
        "node-guide-cli",
        "--type",
        "ui-icon",
        "--name",
        "Guide CLI Phenotype",
        "--brief",
        "Generate with guide",
        "--phenotype-id",
        "ph-guide-cli",
        "--format",
        "json"
      ])
    );

    expect(output.persisted).toBe(false);
    expect(output.payload.job.inputSnapshot).toMatchObject({ usageGuideId: "guide-cli", usageGuideRevision: 1 });
    expect(output.payload.phenotypeArtifact.usageGuideSnapshot).toMatchObject({ usageGuideId: "guide-cli", usageGuideRevision: 1 });
    expect(JSON.parse(runDna(["--db", db, "phenotype", "guide", "show", "--phenotype", "ph-guide-cli", "--format", "json"]))).toMatchObject({
      usageGuideId: "guide-cli",
      revision: 1
    });

    const exportDir = join(dir, "review-current");
    runDna(["--db", db, "export", "--out", exportDir, "--profile", "review-current"]);
    expect(existsSync(join(exportDir, "graphs", "graph-guide-cli", "phenotypes", "ph-guide-cli", "usage-guide.md"))).toBe(true);
  }, 20000);
});
