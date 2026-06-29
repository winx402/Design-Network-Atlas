import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 80_000;

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

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Phase 24 phenotype plans in modeling batch", () => {
  test("imports, reviews, applies, exports, and generates from planned phenotype containers", () => {
    const dir = tempDir("phase24-phenotype-plans");
    const db = join(dir, "dna.sqlite");
    const batchFile = join(dir, "phenotype-plans.json");
    const exportDir = join(dir, "review-current");
    const exportAfterGenerateDir = join(dir, "generated-review");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-character", name: "Character Graph", purpose: "character generation planning" }],
          speciesNodes: [
            {
              graphId: "graph-character",
              nodeId: "species-forest-warden",
              name: "Forest Warden",
              category: "character",
              level: "species",
              badcases: ["portrait crop variants are phenotypes, not species nodes"]
            }
          ],
          phenotypePlans: [
            {
              phenotypeId: "phenotype-warden-portrait",
              graphId: "graph-character",
              nodeId: "species-forest-warden",
              phenotypeType: "portrait",
              name: "Forest Warden Portrait",
              objectBrief: "Front-facing portrait for character review.",
              expectedAssetTypes: ["image"],
              tags: ["review-surface"]
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const importOutput = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      batchFile,
      "--id",
      "proposal-phenotype-plans",
      "--title",
      "Phenotype plan proposal"
    ]);
    expect(importOutput).toContain("phenotypePlans: 1");
    expect(importOutput).toContain("Planned: 3");
    expect(importOutput).not.toContain("changeSetIds");
    expect(runDnaFailure(["--db", db, "graph", "tree", "--id", "graph-character", "--include-phenotypes"])).toContain("graph not found");

    const review = runDna(["--db", db, "proposal", "review", "proposal-phenotype-plans"]);
    expect(review).toContain("phenotype");
    expect(review).toContain("species-forest-warden");
    expect(review).toContain("portrait");

    runDna(["--db", db, "--yes", "proposal", "apply", "proposal-phenotype-plans"]);
    const treeText = runDna(["--db", db, "graph", "tree", "--id", "graph-character", "--include-phenotypes"]);
    expect(treeText).toContain("Planned phenotypes:");
    expect(treeText).toContain("- Forest Warden Portrait (phenotype-warden-portrait) [portrait, planned]");
    const treeJson = JSON.parse(runDna(["--db", db, "graph", "tree", "--id", "graph-character", "--include-phenotypes", "--format", "json"]));
    expect(treeJson.phenotypeOverlay.byNodeId["species-forest-warden"][0]).toMatchObject({
      phenotypeId: "phenotype-warden-portrait",
      phenotypeType: "portrait",
      status: "planned",
      outputPlan: { expectedAssetTypes: ["image"] }
    });

    runDna(["--db", db, "export", "--out", exportDir, "--profile", "review-current"]);
    const plannedPhenotype = readJson(join(exportDir, "graphs", "graph-character", "phenotypes", "phenotype-warden-portrait.json"));
    expect(plannedPhenotype).toMatchObject({
      phenotypeId: "phenotype-warden-portrait",
      status: "planned",
      currentAcceptedVersion: null,
      outputPlan: { expectedAssetTypes: ["image"], reviewRubricIds: [] }
    });
    expect(existsSync(join(exportDir, "graphs", "graph-character", "generation-jobs"))).toBe(false);
    expect(existsSync(join(exportDir, "graphs", "graph-character", "output-references"))).toBe(false);

    const generated = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-character",
        "--node",
        "species-forest-warden",
        "--type",
        "portrait",
        "--phenotype-id",
        "phenotype-warden-portrait",
        "--name",
        "Forest Warden Portrait",
        "--brief",
        "paint a front-facing portrait",
        "--apply"
      ])
    );
    expect(generated.phenotype.phenotypeId).toBe("phenotype-warden-portrait");
    expect(generated.phenotype.status).toBe("planned");
    expect(generated.phenotypeVersion.status).toBe("candidate");

    runDna(["--db", db, "export", "--out", exportAfterGenerateDir, "--profile", "review-current"]);
    const phenotypeFiles = readdirSync(join(exportAfterGenerateDir, "graphs", "graph-character", "phenotypes")).filter((name) =>
      name.startsWith("phenotype-warden-portrait")
    );
    expect(phenotypeFiles).toEqual(["phenotype-warden-portrait.json"]);
    const versionFiles = readdirSync(join(exportAfterGenerateDir, "graphs", "graph-character", "phenotypes")).filter((name) =>
      name.endsWith(".version.json")
    );
    expect(versionFiles).toHaveLength(1);
  }, CLI_TIMEOUT);

  test("validates phenotype plans all-or-nothing and supports explicit draft-write", () => {
    const dir = tempDir("phase24-phenotype-plan-validation");
    const db = join(dir, "dna.sqlite");
    const invalidBatchFile = join(dir, "invalid-phenotype-plans.json");
    const draftBatchFile = join(dir, "draft-phenotype-plans.json");
    writeFileSync(
      invalidBatchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-invalid-plan", name: "Invalid Plan", purpose: "invalid phenotype plan" }],
          speciesNodes: [{ graphId: "graph-invalid-plan", nodeId: "species-invalid", name: "Invalid Species" }],
          phenotypePlans: [
            {
              phenotypeId: "phenotype-duplicate-a",
              graphId: "graph-invalid-plan",
              nodeId: "species-invalid",
              phenotypeType: "portrait",
              name: "Portrait A",
              expectedAssetTypes: ["image"]
            },
            {
              phenotypeId: "phenotype-duplicate-b",
              graphId: "graph-invalid-plan",
              nodeId: "species-invalid",
              phenotypeType: "portrait",
              name: "Portrait B",
              expectedAssetTypes: ["unsupported-binary"]
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const failed = runDnaFailure([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      invalidBatchFile,
      "--id",
      "proposal-invalid-phenotype-plans",
      "--title",
      "Invalid phenotype plans"
    ]);
    expect(failed).toContain("duplicate phenotype plan target");
    expect(failed).toContain("expectedAssetTypes");
    expect(runDna(["--db", db, "graph", "list"])).not.toContain("graph-invalid-plan");
    expect(runDna(["--db", db, "proposal", "list"])).not.toContain("proposal-invalid-phenotype-plans");

    writeFileSync(
      draftBatchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-draft-plan", name: "Draft Plan", purpose: "draft phenotype plan" }],
          speciesNodes: [{ graphId: "graph-draft-plan", nodeId: "species-draft", name: "Draft Species", category: "character", level: "species" }],
          phenotypePlans: [
            {
              phenotypeId: "phenotype-draft-icon",
              graphId: "graph-draft-plan",
              nodeId: "species-draft",
              phenotypeType: "icon",
              name: "Draft Icon",
              expectedAssetTypes: ["image"]
            }
          ]
        },
        null,
        2
      )}\n`
    );
    const draftOutput = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      draftBatchFile,
      "--id",
      "proposal-draft-phenotype-plans",
      "--title",
      "Draft phenotype plans",
      "--mode",
      "draft-write"
    ]);
    expect(draftOutput).toContain("Mode: draft-write");
    expect(draftOutput).toContain("phenotypePlans: 1");
    expect(draftOutput).toContain("Applied: 3");
    const treeText = runDna(["--db", db, "graph", "tree", "--id", "graph-draft-plan", "--include-phenotypes"]);
    expect(treeText).toContain("Draft Icon (phenotype-draft-icon) [icon, planned]");
  }, CLI_TIMEOUT);
});
