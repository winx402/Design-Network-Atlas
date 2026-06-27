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

describe("Phase 19 PRD-03 compile CLI", () => {
  test("creates species and phenotype compile artifacts from graph data", () => {
    const db = join(tempDir("phase19-compile-cli"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-ui", "--name", "UI Graph", "--purpose", "ui", "--yes"]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "node-icon",
      "--name",
      "Faction Icon",
      "--motif",
      "broken-ring",
      "--constraint",
      "readability=high",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "context",
      "reference",
      "add",
      "--id",
      "ref-badcase",
      "--type",
      "badcase",
      "--source-type",
      "asset-index",
      "--source-id",
      "asset-noisy",
      "--role",
      "negative",
      "--do-not-use-for",
      "dense ornament",
      "--do-not-use-for",
      "exact silhouette"
    ]);
    runDna([
      "--db",
      db,
      "context",
      "rubric",
      "add",
      "--id",
      "rubric-context",
      "--dimension",
      "context-consistency",
      "--question",
      "是否保留阵营识别并避免 UI 噪音？",
      "--severity",
      "warning"
    ]);
    runDna([
      "--db",
      db,
      "context",
      "create",
      "--id",
      "ctx-worldview",
      "--name",
      "Worldview",
      "--type",
      "worldview",
      "--summary",
      "月蚀阵营语境",
      "--reference",
      "ref-badcase",
      "--rubric",
      "rubric-context",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "context",
      "attach",
      "--id",
      "att-node-context",
      "--context",
      "ctx-worldview",
      "--target-type",
      "species-node",
      "--target",
      "node-icon",
      "--role",
      "constraint",
      "--compile-layer",
      "node-context",
      "--yes"
    ]);

    const preview = runDna(["--db", db, "compile", "species", "--graph", "graph-ui", "--node", "node-icon", "--id", "sca-preview"]);
    expect(preview).toContain("ChangeSet preview");

    const speciesArtifact = JSON.parse(
      runDna(["--db", db, "compile", "species", "--graph", "graph-ui", "--node", "node-icon", "--id", "sca-node-icon", "--yes"])
    );
    expect(speciesArtifact.compileTarget).toBe("species-snapshot");
    expect(speciesArtifact.contextTrace.map((entry: { objectId: string }) => entry.objectId)).toContain("ctx-worldview");

    const phenotypeArtifact = JSON.parse(
      runDna([
        "--db",
        db,
        "compile",
        "phenotype",
        "--graph",
        "graph-ui",
        "--node",
        "node-icon",
        "--id",
        "pca-node-icon-ui",
        "--species-artifact",
        "sca-node-icon",
        "--type",
        "ui-icon",
        "--brief",
        "small HUD icon",
        "--reference",
        "ref-badcase",
        "--rubric",
        "rubric-context",
        "--yes"
      ])
    );
    expect(phenotypeArtifact.prompt).toContain("small-size readability");
    expect(phenotypeArtifact.negativePrompt).toContain("dense ornament");
    expect(phenotypeArtifact.reviewChecklist).toEqual(
      expect.arrayContaining([expect.objectContaining({ rubricId: "rubric-context" })])
    );

    const stored = JSON.parse(runDna(["--db", db, "compile", "phenotype", "show", "--id", "pca-node-icon-ui"]));
    expect(stored.speciesCompileArtifactId).toBe("sca-node-icon");
  }, 100_000);
});
