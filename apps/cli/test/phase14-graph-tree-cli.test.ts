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

describe("Phase 14 graph tree CLI", () => {
  test("prints a species tree and a JSON graph tree view", () => {
    const db = join(tempDir("phase14-graph-tree"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-tree", "--name", "Tree Graph", "--purpose", "tree", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-tree", "--id", "node-root", "--name", "Root Style", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-tree", "--id", "node-accent", "--name", "Accent Motif", "--yes"]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-tree",
      "--id",
      "node-child",
      "--name",
      "Child Icon",
      "--parent",
      "node-root",
      "--primary-parent",
      "node-root",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-tree",
      "--id",
      "node-hybrid",
      "--name",
      "Hybrid Icon",
      "--parent",
      "node-root",
      "--parent",
      "node-accent",
      "--primary-parent",
      "node-root",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "edge",
      "create",
      "--graph",
      "graph-tree",
      "--id",
      "edge-root-child",
      "--from",
      "node-root",
      "--to",
      "node-child",
      "--type",
      "specialize",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "edge",
      "create",
      "--graph",
      "graph-tree",
      "--id",
      "edge-root-hybrid",
      "--from",
      "node-root",
      "--to",
      "node-hybrid",
      "--type",
      "inherit",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "edge",
      "create",
      "--graph",
      "graph-tree",
      "--id",
      "edge-accent-hybrid",
      "--from",
      "node-accent",
      "--to",
      "node-hybrid",
      "--type",
      "fusion",
      "--yes"
    ]);

    const text = runDna(["--db", db, "graph", "tree", "--id", "graph-tree"]);
    expect(text).toContain("Graph Tree: Tree Graph (graph-tree)");
    expect(text).toContain("- Root Style (node-root)");
    expect(text).toContain("  - Child Icon (node-child)");
    expect(text).toContain("  - Hybrid Icon (node-hybrid)");
    expect(text).toContain("Additional parent relations:");
    expect(text).toContain("- Accent Motif (node-accent) -> Hybrid Icon (node-hybrid) [fusion, edge-accent-hybrid]");

    const json = JSON.parse(runDna(["--db", db, "graph", "tree", "--id", "graph-tree", "--format", "json"]));
    expect(json.roots.map((root: { nodeId: string }) => root.nodeId)).toEqual(["node-root", "node-accent"]);
    expect(json.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromNodeId: "node-root", toNodeId: "node-child", edgeType: "specialize" }),
        expect.objectContaining({ fromNodeId: "node-accent", toNodeId: "node-hybrid", edgeType: "fusion" })
      ])
    );
  }, 60_000);
});
