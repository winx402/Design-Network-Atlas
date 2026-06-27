import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
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

function runDnaError(args: string[]) {
  try {
    runDna(args);
    throw new Error("expected command to fail");
  } catch (error) {
    const failure = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    return `${failure.stdout?.toString() ?? ""}${failure.stderr?.toString() ?? ""}${failure.message ?? ""}`;
  }
}

function parseJsonObject(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`no JSON object in output: ${output}`);
  return JSON.parse(output.slice(start, end + 1));
}

function seedGraph(db: string) {
  runDna(["--db", db, "graph", "create", "--id", "graph-gen", "--name", "Generation Graph", "--purpose", "formal generation", "--yes"]);
  runDna([
    "--db",
    db,
    "node",
    "create",
    "--graph",
    "graph-gen",
    "--id",
    "node-gen",
    "--name",
    "Generation Node",
    "--motif",
    "broken-ring",
    "--constraint",
    "color=red",
    "--yes"
  ]);
}

describe("Phase 21 PRD-08 phenotype generation compile artifact path", () => {
  test("previews and applies formal generation with species and phenotype compile artifacts", () => {
    const db = join(tempDir("phase21-generate"), "dna.sqlite");
    seedGraph(db);

    const previewOutput = runDna([
      "--db",
      db,
      "phenotype",
      "generate",
      "--graph",
      "graph-gen",
      "--node",
      "node-gen",
      "--type",
      "ui-icon",
      "--name",
      "Warning Icon",
      "--brief",
      "toolbar warning icon"
    ]);
    expect(previewOutput).toContain("ChangeSet preview");
    const preview = parseJsonObject(previewOutput).payload;
    expect(preview.artifacts.species.artifactId).toMatch(/^sca/);
    expect(preview.artifacts.phenotype.artifactId).toMatch(/^pca/);
    expect(preview.phenotypeVersion.speciesCompileArtifactId).toBe(preview.artifacts.species.artifactId);
    expect(preview.phenotypeVersion.phenotypeCompileArtifactId).toBe(preview.artifacts.phenotype.artifactId);
    expect(preview.job.inputSnapshot).toMatchObject({
      graphId: "graph-gen",
      nodeId: "node-gen",
      taskBrief: "toolbar warning icon",
      phenotypeType: "ui-icon",
      speciesCompileArtifactId: preview.artifacts.species.artifactId,
      phenotypeCompileArtifactId: preview.artifacts.phenotype.artifactId
    });
    expect(runDnaError(["--db", db, "compile", "species", "show", "--id", preview.artifacts.species.artifactId])).toContain(
      "species compile artifact not found"
    );
    expect(runDnaError(["--db", db, "provider", "job", "show", "--id", preview.job.generationJobId])).toContain("generation job not found");

    const applied = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-gen",
        "--node",
        "node-gen",
        "--type",
        "ui-icon",
        "--name",
        "Warning Icon",
        "--brief",
        "toolbar warning icon",
        "--apply"
      ])
    );

    expect(applied.artifacts.species.artifactId).toBe(applied.phenotypeVersion.speciesCompileArtifactId);
    expect(applied.artifacts.phenotype.artifactId).toBe(applied.phenotypeVersion.phenotypeCompileArtifactId);
    expect(applied.phenotypeVersion.compileArtifactSnapshot).toMatchObject({
      speciesCompileArtifactId: applied.artifacts.species.artifactId,
      phenotypeCompileArtifactId: applied.artifacts.phenotype.artifactId
    });
    expect(applied.job.inputSnapshot).toMatchObject({
      graphId: "graph-gen",
      nodeId: "node-gen",
      taskBrief: "toolbar warning icon",
      phenotypeType: "ui-icon",
      speciesCompileArtifactId: applied.artifacts.species.artifactId,
      phenotypeCompileArtifactId: applied.artifacts.phenotype.artifactId
    });
    expect(JSON.parse(runDna(["--db", db, "compile", "phenotype", "show", "--id", applied.artifacts.phenotype.artifactId]))).toMatchObject({
      speciesCompileArtifactId: applied.artifacts.species.artifactId,
      taskBrief: "toolbar warning icon"
    });
    expect(JSON.parse(runDna(["--db", db, "provider", "job", "show", "--id", applied.job.generationJobId]))).toMatchObject({
      inputSnapshot: {
        speciesCompileArtifactId: applied.artifacts.species.artifactId,
        phenotypeCompileArtifactId: applied.artifacts.phenotype.artifactId
      }
    });
  }, 100_000);

  test("validates explicit phenotype artifact matches graph node type and brief", () => {
    const db = join(tempDir("phase21-generate-replay"), "dna.sqlite");
    seedGraph(db);
    runDna([
      "--db",
      db,
      "compile",
      "species",
      "--graph",
      "graph-gen",
      "--node",
      "node-gen",
      "--id",
      "sca-replay",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "compile",
      "phenotype",
      "--graph",
      "graph-gen",
      "--node",
      "node-gen",
      "--type",
      "ui-icon",
      "--brief",
      "toolbar warning icon",
      "--species-artifact",
      "sca-replay",
      "--id",
      "pca-replay",
      "--yes"
    ]);

    expect(
      runDnaError([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-gen",
        "--node",
        "node-gen",
        "--type",
        "ui-icon",
        "--name",
        "Warning Icon",
        "--brief",
        "different brief",
        "--phenotype-artifact",
        "pca-replay"
      ])
    ).toContain("does not match task brief different brief");
  }, 100_000);

  test("CLI formal generation delegates to application services instead of legacy compileSpecies", () => {
    const source = readFileSync(join(projectRoot, "apps/cli/src/index.ts"), "utf8");
    const generateBlock = source.slice(source.indexOf(".command(\"generate\")"), source.indexOf("const asset"));

    expect(generateBlock).toContain("preparePhenotypeGeneration");
    expect(generateBlock).not.toContain("compileSpecies(");
  });
});
