import { execFileSync, spawnSync } from "node:child_process";
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

function runDnaFailure(args: string[]) {
  const result = spawnSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  expect(result.status).not.toBe(0);
  return `${result.stdout}${result.stderr}`;
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
      "relationship",
      "create",
      "--id",
      "rel-root-child",
      "--source",
      "species-node:graph-tree:node-root",
      "--target",
      "species-node:graph-tree:node-child",
      "--type",
      "derives-from",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "relationship",
      "create",
      "--id",
      "rel-root-hybrid",
      "--source",
      "species-node:graph-tree:node-root",
      "--target",
      "species-node:graph-tree:node-hybrid",
      "--type",
      "derives-from",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "relationship",
      "create",
      "--id",
      "rel-accent-hybrid",
      "--source",
      "species-node:graph-tree:node-accent",
      "--target",
      "species-node:graph-tree:node-hybrid",
      "--type",
      "translates-to",
      "--yes"
    ]);

    const text = runDna(["--db", db, "graph", "tree", "--id", "graph-tree"]);
    expect(text).toContain("Graph Tree: Tree Graph (graph-tree)");
    expect(text).toContain("- Root Style (node-root)");
    expect(text).toContain("  - Child Icon (node-child)");
    expect(text).toContain("  - Hybrid Icon (node-hybrid)");
    expect(text).toContain("Additional parent relations:");
    expect(text).toContain("- Accent Motif (node-accent) -> Hybrid Icon (node-hybrid) [translates-to, rel-accent-hybrid]");

    const json = JSON.parse(runDna(["--db", db, "graph", "tree", "--id", "graph-tree", "--format", "json"]));
    expect(json.roots.map((root: { nodeId: string }) => root.nodeId)).toEqual(["node-root", "node-accent"]);
    expect(json.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromNodeId: "node-root", toNodeId: "node-child", relationshipType: "derives-from" }),
        expect.objectContaining({ fromNodeId: "node-accent", toNodeId: "node-hybrid", relationshipType: "translates-to" })
      ])
    );
  }, 60_000);

  test("adds an optional species group overlay without changing default tree output", () => {
    const db = join(tempDir("phase14-graph-tree-groups"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-groups", "--name", "Grouped Graph", "--purpose", "group overlay", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-groups", "--id", "node-root", "--name", "Root", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-groups", "--id", "node-grouped", "--name", "Grouped Node", "--parent", "node-root", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-groups", "--id", "node-ungrouped", "--name", "Ungrouped Node", "--yes"]);
    runDna(["--db", db, "group", "create", "--graph", "graph-groups", "--id", "group-main", "--name", "Main Group", "--type", "population", "--yes"]);
    runDna(["--db", db, "group", "create", "--graph", "graph-groups", "--id", "group-secondary", "--name", "Secondary Group", "--type", "domain", "--yes"]);
    runDna([
      "--db",
      db,
      "group",
      "member",
      "add",
      "--graph",
      "graph-groups",
      "--group",
      "group-main",
      "--node",
      "node-grouped",
      "--id",
      "membership-main",
      "--role",
      "primary",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "group",
      "member",
      "add",
      "--graph",
      "graph-groups",
      "--group",
      "group-secondary",
      "--node",
      "node-grouped",
      "--id",
      "membership-secondary",
      "--role",
      "reference",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "relationship",
      "create",
      "--id",
      "rel-groups",
      "--source",
      "species-group:graph-groups:group-main",
      "--target",
      "species-group:graph-groups:group-secondary",
      "--type",
      "references",
      "--description",
      "main references secondary",
      "--yes"
    ]);

    const defaultText = runDna(["--db", db, "graph", "tree", "--id", "graph-groups"]);
    expect(defaultText).not.toContain("Groups:");
    expect(defaultText.match(/Grouped Node/g) ?? []).toHaveLength(1);
    const defaultJson = JSON.parse(runDna(["--db", db, "graph", "tree", "--id", "graph-groups", "--format", "json"]));
    expect(defaultJson.groupOverlay).toBeUndefined();

    const text = runDna(["--db", db, "graph", "tree", "--id", "graph-groups", "--include-groups"]);
    expect(text).toContain("Groups:");
    expect(text).toContain("- Main Group (group-main) [population, draft]");
    expect(text).toContain("  - Grouped Node (node-grouped) [primary, membership-main]");
    expect(text).toContain("- Secondary Group (group-secondary) [domain, draft]");
    expect(text).toContain("  - Grouped Node (node-grouped) [reference, membership-secondary]");
    expect(text).toContain("Ungrouped nodes:");
    expect(text).toContain("- Root (node-root)");
    expect(text).toContain("- Ungrouped Node (node-ungrouped)");
    expect(text).toContain("Group relations:");
    expect(text).toContain("- Main Group (group-main) -> Secondary Group (group-secondary) [references, rel-groups] main references secondary");
    expect(text.match(/^  - Grouped Node \(node-grouped\)/gm) ?? []).toHaveLength(3);

    const json = JSON.parse(runDna(["--db", db, "graph", "tree", "--id", "graph-groups", "--include-groups", "--format", "json"]));
    expect(json.groupOverlay.groups.map((group: { groupId: string }) => group.groupId)).toEqual(["group-main", "group-secondary"]);
    expect(json.groupOverlay.membershipsByNodeId["node-grouped"].map((membership: { membershipId: string }) => membership.membershipId)).toEqual([
      "membership-main",
      "membership-secondary"
    ]);
    expect(json.groupOverlay.ungroupedNodeIds).toEqual(["node-root", "node-ungrouped"]);
    expect(json.groupOverlay.groupRelations).toEqual([expect.objectContaining({ relationshipId: "rel-groups" })]);
  }, 60_000);

  test("adds recovery guidance for unknown graph ids in direct graph commands", () => {
    const db = join(tempDir("phase14-graph-missing"), "dna.sqlite");

    for (const args of [
      ["--db", db, "graph", "tree", "--id", "missing-id"],
      ["--db", db, "graph", "show", "--id", "missing-id"],
      ["--db", db, "graph", "archive", "--id", "missing-id"]
    ]) {
      const output = runDnaFailure(args);
      expect(output).toContain("graph not found: missing-id");
      expect(output).toContain("Run dna graph list to see available graph ids.");
    }
  }, 60_000);
});
