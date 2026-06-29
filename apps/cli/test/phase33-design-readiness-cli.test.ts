import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function seedCliStore(db: string) {
  runDna(["--db", db, "graph", "create", "--id", "graph-readiness-cli", "--name", "Readiness CLI Graph", "--purpose", "icon production", "--yes"]);
  runDna(["--db", db, "node", "create", "--graph", "graph-readiness-cli", "--id", "node-readiness-cli", "--name", "Directory Node", "--yes"]);
  runDna([
    "--db",
    db,
    "phenotype",
    "create",
    "--graph",
    "graph-readiness-cli",
    "--node",
    "node-readiness-cli",
    "--type",
    "ui-icon",
    "--name",
    "Readiness Icon",
    "--id",
    "ph-readiness-cli",
    "--apply"
  ]);
}

describe("Phase 33 PRD-23 design readiness CLI", () => {
  test("assesses, persists, shows, and explains design readiness artifacts", () => {
    const db = join(tempDir("phase33-readiness-cli"), "dna.sqlite");
    seedCliStore(db);

    const preview = JSON.parse(
      runDna([
        "--db",
        db,
        "readiness",
        "assess",
        "--target-type",
        "graph",
        "--target",
        "graph-readiness-cli",
        "--artifact-id",
        "eca-readiness-cli-preview",
        "--format",
        "json"
      ])
    );
    expect(preview).toMatchObject({
      persisted: false,
      policyResult: { policy: "warn", allowed: true },
      artifact: { artifactId: "eca-readiness-cli-preview" },
      readiness: { targetLevel: "graph", targetId: "graph-readiness-cli" }
    });
    expect(runDnaError(["--db", db, "readiness", "show", "--target-type", "graph", "--target", "graph-readiness-cli"])).toContain(
      "readiness not found"
    );

    const applied = JSON.parse(
      runDna([
        "--db",
        db,
        "readiness",
        "assess",
        "--target-type",
        "graph",
        "--target",
        "graph-readiness-cli",
        "--artifact-id",
        "eca-readiness-cli",
        "--apply",
        "--format",
        "json"
      ])
    );
    expect(applied.persisted).toBe(true);

    const shown = JSON.parse(runDna(["--db", db, "readiness", "show", "--target-type", "graph", "--target", "graph-readiness-cli", "--format", "json"]));
    expect(shown).toMatchObject({ artifactId: "eca-readiness-cli", readiness: { targetId: "graph-readiness-cli" } });
    const explained = runDna(["--db", db, "readiness", "explain", "--artifact", "eca-readiness-cli"]);
    expect(explained).toContain("Design readiness");
    expect(explained).toContain("graph-readiness-cli");

    const outDir = join(dirname(db), "review-current-export");
    runDna(["--db", db, "export", "--out", outDir, "--profile", "review-current"]);
    const manifest = JSON.parse(readFileSync(join(outDir, "dna.project.json"), "utf8"));
    expect(manifest.review.designReadiness.targets).toEqual(
      expect.arrayContaining([expect.objectContaining({ targetType: "graph", targetId: "graph-readiness-cli", artifactId: "eca-readiness-cli" })])
    );
  }, 100_000);

  test("phenotype generate can warn by default and block under explicit readiness policy", () => {
    const db = join(tempDir("phase33-readiness-generate-cli"), "dna.sqlite");
    seedCliStore(db);

    const warned = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-readiness-cli",
        "--node",
        "node-readiness-cli",
        "--type",
        "ui-icon",
        "--name",
        "Readiness Icon",
        "--phenotype-id",
        "ph-readiness-cli",
        "--brief",
        "small icon",
        "--format",
        "json"
      ])
    );
    expect(warned.payload.job.inputSnapshot).toMatchObject({
      readinessPolicy: "warn",
      designReadiness: {
        species: expect.objectContaining({ level: "blocked" }),
        phenotype: expect.objectContaining({ targetLevel: "phenotype" })
      }
    });

    expect(
      runDnaError([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-readiness-cli",
        "--node",
        "node-readiness-cli",
        "--type",
        "ui-icon",
        "--name",
        "Readiness Icon",
        "--phenotype-id",
        "ph-readiness-cli",
        "--brief",
        "small icon",
        "--readiness-policy",
        "block"
      ])
    ).toContain("design readiness blocked");
  }, 100_000);

  test("self-optimize suggest produces sanitized reviewable candidates without applying facts", () => {
    const db = join(tempDir("phase33-self-optimize-cli"), "dna.sqlite");
    seedCliStore(db);
    const feedbackFile = join(dirname(db), "feedback.txt");
    writeFileSync(
      feedbackFile,
      "Update the phenotype usage guide: must preserve amber shield. Bearer private-token https://private.example.test/out.png?token=secret",
      "utf8"
    );

    const suggestion = JSON.parse(
      runDna([
        "--db",
        db,
        "self-optimize",
        "suggest",
        "--from-feedback",
        feedbackFile,
        "--target-scope",
        "phenotype:ph-readiness-cli",
        "--format",
        "json"
      ])
    );
    expect(suggestion).toMatchObject({
      persisted: false,
      proposal: { status: "draft", changeSetIds: [] },
      candidates: [expect.objectContaining({ suggestedWriteLocation: "PhenotypeUsageGuide", requiresUserConfirmation: true })]
    });
    expect(JSON.stringify(suggestion)).not.toMatch(/Bearer|private-token|private\.example|token=secret/);
    expect(runDna(["--db", db, "proposal", "list"])).not.toContain("self-optimize");

    runDna(["--db", db, "proposal", "create", "--id", "self-optimize-proposal-cli", "--title", "Self optimization review"]);
    const shown = JSON.parse(runDna(["--db", db, "self-optimize", "proposal", "show", "--id", "self-optimize-proposal-cli"]));
    expect(shown.proposal).toMatchObject({ proposalId: "self-optimize-proposal-cli", status: "draft" });
    expect(runDnaError(["--db", db, "self-optimize", "proposal", "apply", "--id", "self-optimize-proposal-cli"])).toContain(
      "self-optimize proposal apply requires --yes"
    );
  }, 100_000);
});
