import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
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

describe("Phase 11 full system acceptance", () => {
  test("runs the PRD v0.1 graph-to-asset lifecycle from an empty project", () => {
    const dir = tempDir("phase11-e2e");
    const db = join(dir, "source.sqlite");
    const importedDb = join(dir, "imported.sqlite");
    const out = join(dir, "export");

    runDna(["--db", db, "template", "install-builtins", "--yes"]);
    runDna([
      "--db",
      db,
      "graph",
      "create",
      "--id",
      "graph-ui",
      "--name",
      "UI Graph",
      "--purpose",
      "ui icons",
      "--template",
      "ui-icon-asset",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "graph",
      "create",
      "--id",
      "graph-game",
      "--name",
      "Game Graph",
      "--purpose",
      "game art",
      "--template",
      "game-art-asset",
      "--yes"
    ]);

    runDna(["--db", db, "node", "create", "--graph", "graph-ui", "--id", "node-root-a", "--name", "Root A", "--motif", "broken-ring", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-ui", "--id", "node-root-b", "--name", "Root B", "--motif", "sharp-corner", "--yes"]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "node-warning",
      "--name",
      "Warning Icon",
      "--parent",
      "node-root-a",
      "--primary-parent",
      "node-root-a",
      "--motif",
      "broken-ring",
      "--constraint",
      "color=amber",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "node-fusion",
      "--name",
      "Fusion Icon",
      "--parent",
      "node-root-a",
      "--parent",
      "node-root-b",
      "--primary-parent",
      "node-root-a",
      "--constraint",
      "stroke=2px",
      "--yes"
    ]);

    const beforeEdge = runDna(["--db", db, "node", "show", "--id", "node-warning"]);
    expect(beforeEdge).toContain('"lineageStatus": "needs-edge"');

    runDna([
      "--db",
      db,
      "edge",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "edge-root-warning",
      "--from",
      "node-root-a",
      "--to",
      "node-warning",
      "--type",
      "specialize",
      "--direction",
      "warning specialization",
      "--operation",
      "override",
      "--delta",
      "semantic=danger",
      "--value-resolution",
      "color=override",
      "--preserve",
      "broken-ring",
      "--avoid",
      "photorealistic",
      "--yes"
    ]);
    const edge = runDna(["--db", db, "edge", "show", "--id", "edge-root-warning"]);
    expect(edge).toContain("warning specialization");
    expect(edge).toContain("broken-ring");
    expect(edge).toContain("photorealistic");

    const generatedOne = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-ui",
        "--node",
        "node-warning",
        "--type",
        "image-prompt",
        "--name",
        "Warning Icon Prompt",
        "--brief",
        "toolbar warning icon",
        "--tool",
        "manual",
        "--yes"
      ])
    );
    const phenotypeId = generatedOne.phenotype.phenotypeId;
    const generatedTwo = JSON.parse(
      runDna([
        "--db",
        db,
        "phenotype",
        "generate",
        "--graph",
        "graph-ui",
        "--node",
        "node-warning",
        "--phenotype-id",
        phenotypeId,
        "--type",
        "image-prompt",
        "--name",
        "Warning Icon Prompt",
        "--brief",
        "toolbar warning icon variation",
        "--tool",
        "manual",
        "--yes"
      ])
    );
    const phenotypeVersionId = generatedTwo.phenotypeVersion.phenotypeVersionId;

    runDna([
      "--db",
      db,
      "asset",
      "add",
      "--id",
      "asset-warning-64",
      "--uri",
      "local://warning-64.png",
      "--linked-type",
      "phenotype-version",
      "--linked-id",
      phenotypeVersionId,
      "--tag",
      "ui",
      "--variant-role",
      "size-variant",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "asset",
      "add",
      "--id",
      "asset-warning-angle",
      "--uri",
      "local://warning-angle.png",
      "--linked-type",
      "phenotype-version",
      "--linked-id",
      phenotypeVersionId,
      "--tag",
      "ui",
      "--variant-role",
      "angle-variant",
      "--yes"
    ]);

    const review = runDna([
      "--db",
      db,
      "review",
      "phenotype",
      "--phenotype-version",
      phenotypeVersionId,
      "--required-motif",
      "broken-ring",
      "--required-constraint",
      "color=amber",
      "--yes"
    ]);
    expect(review).toContain('"status": "pass"');

    const impact = runDna([
      "--db",
      db,
      "impact",
      "check",
      "--graph",
      "graph-ui",
      "--node",
      "node-root-a",
      "--changed-version",
      "node-root-a@2.0.0",
      "--yes"
    ]);
    expect(impact).toContain("node-warning");
    expect(impact).toContain(phenotypeVersionId);

    const assets = runDna([
      "--db",
      db,
      "asset",
      "search",
      "--graph",
      "graph-ui",
      "--node",
      "node-warning",
      "--phenotype-type",
      "image-prompt",
      "--tag",
      "ui",
      "--status",
      "pending"
    ]);
    expect(assets).toContain("asset-warning-64");
    expect(assets).toContain("asset-warning-angle");

    runDna(["--db", db, "export", "--out", out]);
    expect(existsSync(join(out, "dna.project.json"))).toBe(true);
    runDna(["--db", importedDb, "import", "--in", out, "--yes"]);
    expect(runDna(["--db", importedDb, "graph", "show", "--id", "graph-ui"])).toContain("UI Graph");

    runDna(["--db", db, "graph", "archive", "--id", "graph-ui", "--yes"]);
    expect(runDna(["--db", db, "graph", "show", "--id", "graph-ui"])).toContain('"status": "archived"');
    expect(runDna(["--db", db, "node", "versions", "--id", "node-warning"])).toContain("node-warning@1.0.0");
  }, 60_000);
});
