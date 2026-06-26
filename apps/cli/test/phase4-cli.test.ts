import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 60_000;

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

describe("Phase 4 CLI local workflow", () => {
  test("preview mode does not write a graph", () => {
    const dir = tempDir("cli-preview");
    const db = join(dir, "dna.sqlite");

    const preview = runDna(["--db", db, "graph", "create", "--id", "graph-preview", "--name", "Preview", "--purpose", "preview"]);
    const list = runDna(["--db", db, "graph", "list"]);

    expect(preview).toContain("ChangeSet preview");
    expect(list).not.toContain("graph-preview");
  }, CLI_TIMEOUT);

  test("graph create, show, and archive commands complete the graph lifecycle", () => {
    const db = join(tempDir("cli-graph"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-life", "--name", "Lifecycle", "--purpose", "lifecycle", "--yes"]);
    const shown = runDna(["--db", db, "graph", "show", "--id", "graph-life"]);
    expect(shown).toContain("Lifecycle");

    runDna(["--db", db, "graph", "archive", "--id", "graph-life", "--yes"]);
    const archived = runDna(["--db", db, "graph", "show", "--id", "graph-life"]);
    expect(archived).toContain('"status": "archived"');
  }, CLI_TIMEOUT);

  test("template built-ins can be installed and listed", () => {
    const db = join(tempDir("cli-template"), "dna.sqlite");

    runDna(["--db", db, "template", "install-builtins", "--yes"]);
    const list = runDna(["--db", db, "template", "list"]);

    expect(list).toContain("game-art-assets");
    expect(list).toContain("ui-icon-assets");
    expect(list).toContain("ui-icon-asset");
  }, CLI_TIMEOUT);

  test("species-first node can be completed by adding a parent edge", () => {
    const db = join(tempDir("cli-lineage"), "dna.sqlite");
    runDna(["--db", db, "graph", "create", "--id", "graph-lineage", "--name", "Lineage", "--purpose", "lineage", "--yes"]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-lineage",
      "--id",
      "node-root",
      "--name",
      "Root",
      "--motif",
      "broken-ring",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-lineage",
      "--id",
      "node-child",
      "--name",
      "Child",
      "--parent",
      "node-root",
      "--primary-parent",
      "node-root",
      "--yes"
    ]);

    const beforeEdge = runDna(["--db", db, "node", "show", "--id", "node-child"]);
    expect(beforeEdge).toContain('"lineageStatus": "needs-edge"');

    runDna([
      "--db",
      db,
      "edge",
      "create",
      "--graph",
      "graph-lineage",
      "--id",
      "edge-root-child",
      "--from",
      "node-root",
      "--to",
      "node-child",
      "--type",
      "inherit",
      "--delta",
      "color=red",
      "--yes"
    ]);
    const afterEdge = runDna(["--db", db, "node", "show", "--id", "node-child"]);
    expect(afterEdge).toContain('"lineageStatus": "complete"');
    expect(afterEdge).toContain("edge-root-child");
  }, CLI_TIMEOUT);

  test("exported Git directory can be imported into a fresh database", () => {
    const dir = tempDir("cli-export");
    const sourceDb = join(dir, "source.sqlite");
    const targetDb = join(dir, "target.sqlite");
    const out = join(dir, "dna-export");

    runDna(["--db", sourceDb, "graph", "create", "--id", "graph-portable", "--name", "Portable", "--purpose", "export", "--yes"]);
    runDna(["--db", sourceDb, "node", "create", "--graph", "graph-portable", "--id", "node-portable", "--name", "Portable Node", "--yes"]);
    runDna(["--db", sourceDb, "export", "--out", out]);

    expect(existsSync(join(out, "dna.project.json"))).toBe(true);

    runDna(["--db", targetDb, "import", "--in", out, "--yes"]);
    const shown = runDna(["--db", targetDb, "graph", "show", "--id", "graph-portable"]);
    expect(shown).toContain("Portable");
  }, CLI_TIMEOUT);
});
