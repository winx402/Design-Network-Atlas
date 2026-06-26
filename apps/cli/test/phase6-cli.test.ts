import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const projectRoot = "/Users/bot/Documents/DNA-Design-Network-Atlas";

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

describe("Phase 6 CLI review and impact workflow", () => {
  test("phenotype review and edge impact can be saved and queried", () => {
    const db = join(tempDir("cli-review-impact"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-review", "--name", "Review", "--purpose", "review", "--yes"]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "node-root",
      "--name",
      "Root",
      "--motif",
      "broken-ring",
      "--constraint",
      "color=blue",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "node-warning",
      "--name",
      "Warning",
      "--parent",
      "node-root",
      "--primary-parent",
      "node-root",
      "--motif",
      "broken-ring",
      "--constraint",
      "color=amber",
      "--badcase",
      "photorealistic",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "edge",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "edge-root-warning",
      "--from",
      "node-root",
      "--to",
      "node-warning",
      "--delta",
      "semantic=danger",
      "--yes"
    ]);

    const generated = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-review",
        "--node",
        "node-warning",
        "--type",
        "image-prompt",
        "--name",
        "Warning Prompt",
        "--brief",
        "toolbar warning icon",
        "--tool",
        "manual",
        "--yes"
      ])
    );
    const phenotypeVersionId = generated.phenotypeVersion.phenotypeVersionId;

    const review = runDna([
      "--db",
      db,
      "review",
      "phenotype",
      "--phenotype-version",
      phenotypeVersionId,
      "--required-motif",
      "sharp-corner",
      "--required-constraint",
      "stroke=2px",
      "--forbidden-text",
      "photorealistic",
      "--yes"
    ]);
    expect(review).toContain('"status": "fail"');
    expect(review).toContain("motif:sharp-corner");
    expect(review).toContain("prompt must avoid forbidden text: photorealistic");

    const reviews = runDna(["--db", db, "review", "list", "--type", "phenotype-version", "--id", phenotypeVersionId]);
    expect(reviews).toContain(phenotypeVersionId);
    expect(reviews).toContain('"confirmedByHuman": true');

    const impacts = runDna([
      "--db",
      db,
      "impact",
      "check",
      "--graph",
      "graph-review",
      "--edge",
      "edge-root-warning",
      "--changed-version",
      "edge-root-warning@1.0.0",
      "--yes"
    ]);
    expect(impacts).toContain("node-warning");
    expect(impacts).toContain(phenotypeVersionId);

    const savedImpacts = runDna(["--db", db, "impact", "list", "--type", "edge", "--id", "edge-root-warning"]);
    expect(savedImpacts).toContain("node-warning");
    expect(savedImpacts).toContain(phenotypeVersionId);
    expect(savedImpacts).toContain('"reviewStatus": "pending"');
  }, 20_000);
});
