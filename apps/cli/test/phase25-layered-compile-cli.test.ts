import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
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

function seedGraph(db: string) {
  runDna(["--db", db, "graph", "create", "--id", "graph-layered", "--name", "Layered Graph", "--purpose", "compile", "--yes"]);
  runDna([
    "--db",
    db,
    "group",
    "create",
    "--graph",
    "graph-layered",
    "--id",
    "group-layered",
    "--name",
    "Layered Group",
    "--shared-fact",
    "all warning components must be readable",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "node",
    "create",
    "--graph",
    "graph-layered",
    "--id",
    "node-layered",
    "--name",
    "Layered Node",
    "--motif",
    "broken-ring",
    "--constraint",
    "readability=high",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "group",
    "member",
    "add",
    "--id",
    "membership-layered",
    "--graph",
    "graph-layered",
    "--group",
    "group-layered",
    "--node",
    "node-layered",
    "--yes"
  ]);
}

describe("Phase 25 PRD-16 layered compile CLI", () => {
  test("previews, persists, and shows layered graph/group/species/phenotype artifacts", () => {
    const db = join(tempDir("phase25-layered-cli"), "dna.sqlite");
    seedGraph(db);

    const graphPreview = runDna(["--db", db, "compile", "graph", "--id", "graph-layered", "--artifact-id", "eca-graph-preview"]);
    expect(graphPreview).toContain("Layered compile: graph");
    expect(graphPreview).toContain("1. graph: graph-layered");
    expect(runDnaError(["--db", db, "compile", "graph", "show", "--id", "eca-graph-preview"])).toContain("entity compile artifact not found");

    const graphArtifact = JSON.parse(
      runDna(["--db", db, "compile", "graph", "--id", "graph-layered", "--artifact-id", "eca-graph", "--format", "json", "--yes"])
    );
    expect(graphArtifact).toMatchObject({
      compileTarget: "entity-layer",
      targetLevel: "graph",
      target: { objectType: "graph", objectId: "graph-layered" }
    });
    expect(graphArtifact.frames.map((frame: { level: string }) => frame.level)).toEqual(["graph"]);

    const groupArtifact = JSON.parse(
      runDna([
        "--db",
        db,
        "compile",
        "group",
        "--graph",
        "graph-layered",
        "--group",
        "group-layered",
        "--artifact-id",
        "eca-group",
        "--format",
        "json",
        "--yes"
      ])
    );
    expect(groupArtifact.frames.map((frame: { level: string }) => frame.level)).toEqual(["graph", "species-group"]);

    const speciesArtifact = JSON.parse(
      runDna([
        "--db",
        db,
        "compile",
        "species",
        "--graph",
        "graph-layered",
        "--node",
        "node-layered",
        "--artifact-id",
        "sca-layered",
        "--format",
        "json",
        "--yes"
      ])
    );
    expect(speciesArtifact.frames.map((frame: { level: string }) => frame.level)).toContain("species-node");

    const phenotypeText = runDna([
      "--db",
      db,
      "compile",
      "phenotype",
      "--graph",
      "graph-layered",
      "--node",
      "node-layered",
      "--type",
      "ui-icon",
      "--brief",
      "small warning icon",
      "--species-artifact",
      "sca-layered",
      "--artifact-id",
      "pca-layered"
    ]);
    expect(phenotypeText).toContain("Layered compile: phenotype-generation");
    expect(phenotypeText).toContain("species-node: node-layered");
    expect(phenotypeText).toContain("phenotype: ui-icon");
    expect(runDnaError(["--db", db, "compile", "phenotype", "show", "--id", "pca-layered"])).toContain("phenotype compile artifact not found");

    const phenotypeArtifact = JSON.parse(
      runDna([
        "--db",
        db,
        "compile",
        "phenotype",
        "--graph",
        "graph-layered",
        "--node",
        "node-layered",
        "--type",
        "ui-icon",
        "--brief",
        "small warning icon",
        "--species-artifact",
        "sca-layered",
        "--artifact-id",
        "pca-layered",
        "--format",
        "json",
        "--yes"
      ])
    );
    expect(phenotypeArtifact.frames.map((frame: { level: string }) => frame.level)).toEqual(["graph", "species-group", "species-node", "phenotype"]);
    expect(JSON.parse(runDna(["--db", db, "compile", "graph", "show", "--id", "eca-graph"])).artifactId).toBe("eca-graph");
    expect(JSON.parse(runDna(["--db", db, "compile", "group", "show", "--id", "eca-group"])).artifactId).toBe("eca-group");
  }, 100_000);

  test("formal generation reports layered compile provenance and blocks stale artifacts without historical replay", () => {
    const db = join(tempDir("phase25-layered-generate-cli"), "dna.sqlite");
    seedGraph(db);

    const preview = runDna([
      "--db",
      db,
      "phenotype",
      "generate",
      "--graph",
      "graph-layered",
      "--node",
      "node-layered",
      "--type",
      "ui-icon",
      "--name",
      "Layered Icon",
      "--brief",
      "small warning icon"
    ]);
    expect(preview).toContain("\"frames\"");
    expect(preview).toContain("\"compileMode\"");

    const applied = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-layered",
        "--node",
        "node-layered",
        "--type",
        "ui-icon",
        "--name",
        "Layered Icon",
        "--brief",
        "small warning icon",
        "--apply"
      ])
    );
    expect(applied.phenotypeVersion.compileArtifactSnapshot).toMatchObject({
      species: { frameCount: expect.any(Number) },
      phenotype: { frameCount: expect.any(Number) }
    });
    expect(applied.job.inputSnapshot).toMatchObject({ compileMode: "current" });
  }, 100_000);
});
