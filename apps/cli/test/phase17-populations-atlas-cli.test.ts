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

describe("Phase 17 PRD-01 group and atlas CLI", () => {
  test("creates and displays species groups, group relations, atlases, and graph bridges", () => {
    const db = join(tempDir("phase17-populations-atlas"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-ui", "--name", "UI Graph", "--purpose", "ui", "--yes"]);
    runDna(["--db", db, "graph", "create", "--id", "graph-style", "--name", "Style Graph", "--purpose", "style", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-ui", "--id", "node-icon-root", "--name", "Icon Root", "--yes"]);

    const preview = runDna([
      "--db",
      db,
      "group",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "group-preview",
      "--name",
      "Preview Group"
    ]);
    expect(preview).toContain("ChangeSet preview");

    runDna([
      "--db",
      db,
      "group",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "group-ui",
      "--name",
      "UI Group",
      "--type",
      "domain",
      "--shared-fact",
      "high contrast symbols",
      "--facet-schema",
      "facet-schema-ui",
      "--phenotype-type",
      "ui-icon",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "group",
      "create",
      "--graph",
      "graph-ui",
      "--id",
      "group-icons",
      "--name",
      "Icon Family",
      "--type",
      "family",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "group",
      "member",
      "add",
      "--id",
      "member-icon-root",
      "--graph",
      "graph-ui",
      "--group",
      "group-ui",
      "--node",
      "node-icon-root",
      "--role",
      "primary",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "group",
      "relation",
      "add",
      "--id",
      "rel-ui-icons",
      "--graph",
      "graph-ui",
      "--source",
      "group-ui",
      "--target",
      "group-icons",
      "--type",
      "adapts-from",
      "--description",
      "Icon family adapts UI readability.",
      "--extension",
      "scope=toolbar",
      "--yes"
    ]);

    const groupMap = JSON.parse(runDna(["--db", db, "group", "map", "--graph", "graph-ui", "--format", "json"]));
    expect(groupMap.groups.map((group: { groupId: string }) => group.groupId)).toEqual(["group-ui", "group-icons"]);
    expect(groupMap.memberships.map((membership: { membershipId: string }) => membership.membershipId)).toEqual(["member-icon-root"]);
    expect(groupMap.relations.map((relation: { relationId: string }) => relation.relationId)).toEqual(["rel-ui-icons"]);

    const groupText = runDna(["--db", db, "group", "map", "--graph", "graph-ui"]);
    expect(groupText).toContain("Group Map: UI Graph (graph-ui)");
    expect(groupText).toContain("- UI Group (group-ui) [domain]");
    expect(groupText).toContain("Relations:");
    expect(groupText).toContain("group-ui -> group-icons [adapts-from]");

    runDna([
      "--db",
      db,
      "atlas",
      "create",
      "--id",
      "atlas-ui",
      "--name",
      "UI Atlas",
      "--purpose",
      "multi graph",
      "--graph",
      "graph-ui",
      "--graph",
      "graph-style",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "atlas",
      "bridge",
      "add",
      "--id",
      "bridge-style-ui",
      "--atlas",
      "atlas-ui",
      "--source",
      "graph-style",
      "--target",
      "graph-ui",
      "--type",
      "style-aligned-with",
      "--description",
      "UI graph stays aligned with style graph.",
      "--yes"
    ]);

    const atlasMap = JSON.parse(runDna(["--db", db, "atlas", "map", "--id", "atlas-ui", "--format", "json"]));
    expect(atlasMap.atlas.graphIds).toEqual(["graph-style", "graph-ui"]);
    expect(atlasMap.bridges.map((bridge: { bridgeId: string }) => bridge.bridgeId)).toEqual(["bridge-style-ui"]);

    const atlasText = runDna(["--db", db, "atlas", "map", "--id", "atlas-ui"]);
    expect(atlasText).toContain("Atlas Map: UI Atlas (atlas-ui)");
    expect(atlasText).toContain("graph-style -> graph-ui [style-aligned-with]");

    const groupImpacts = JSON.parse(runDna(["--db", db, "impact", "check", "--graph", "graph-ui", "--group", "group-ui"]));
    expect(groupImpacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "node", objectId: "node-icon-root" }),
        expect.objectContaining({ objectType: "species-group", objectId: "group-icons" })
      ])
    );

    const bridgeImpacts = JSON.parse(runDna(["--db", db, "impact", "check", "--graph", "graph-ui", "--bridge", "bridge-style-ui"]));
    expect(bridgeImpacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "graph", objectId: "graph-ui" }),
        expect.objectContaining({ objectType: "node", objectId: "node-icon-root" })
      ])
    );
  }, 60_000);
});
