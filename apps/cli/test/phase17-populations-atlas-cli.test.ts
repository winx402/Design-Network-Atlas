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
  test("creates and displays species groups, design relationships, and atlases", () => {
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
      "relationship",
      "create",
      "--id",
      "rel-ui-icons",
      "--source",
      "species-group:graph-ui:group-ui",
      "--target",
      "species-group:graph-ui:group-icons",
      "--type",
      "aligns-with",
      "--description",
      "Icon family adapts UI readability.",
      "--metadata",
      "scope=toolbar",
      "--yes"
    ]);

    const groupMap = JSON.parse(runDna(["--db", db, "group", "map", "--graph", "graph-ui", "--format", "json"]));
    expect(groupMap.groups.map((group: { groupId: string }) => group.groupId)).toEqual(["group-ui", "group-icons"]);
    expect(groupMap.memberships.map((membership: { membershipId: string }) => membership.membershipId)).toEqual(["member-icon-root"]);
    expect(groupMap.relationships.map((relationship: { relationshipId: string }) => relationship.relationshipId)).toEqual(["rel-ui-icons"]);

    const groupText = runDna(["--db", db, "group", "map", "--graph", "graph-ui"]);
    expect(groupText).toContain("Group Map: UI Graph (graph-ui)");
    expect(groupText).toContain("- UI Group (group-ui) [domain]");
    expect(groupText).toContain("Design Relationships:");
    expect(groupText).toContain("group-ui -> group-icons [aligns-with]");

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
      "relationship",
      "create",
      "--id",
      "rel-style-ui",
      "--source",
      "graph:graph-style",
      "--target",
      "graph:graph-ui",
      "--type",
      "aligns-with",
      "--description",
      "UI graph stays aligned with style graph.",
      "--metadata",
      "atlasId=atlas-ui",
      "--yes"
    ]);

    const atlasMap = JSON.parse(runDna(["--db", db, "atlas", "map", "--id", "atlas-ui", "--format", "json"]));
    expect(atlasMap.atlas.graphIds).toEqual(["graph-style", "graph-ui"]);
    expect(atlasMap.relationships.map((relationship: { relationshipId: string }) => relationship.relationshipId)).toEqual(["rel-style-ui"]);

    const atlasText = runDna(["--db", db, "atlas", "map", "--id", "atlas-ui"]);
    expect(atlasText).toContain("Atlas Map: UI Atlas (atlas-ui)");
    expect(atlasText).toContain("graph:graph-style -> graph:graph-ui [aligns-with]");

    const groupImpacts = JSON.parse(runDna(["--db", db, "impact", "check", "--graph", "graph-ui", "--group", "group-ui"]));
    expect(groupImpacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "node", objectId: "node-icon-root" }),
        expect.objectContaining({ objectType: "species-group", objectId: "group-icons" })
      ])
    );

    const relationshipImpacts = JSON.parse(runDna(["--db", db, "impact", "check", "--graph", "graph-ui", "--relationship", "rel-style-ui"]));
    expect(relationshipImpacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "graph", objectId: "graph-ui" }),
        expect.objectContaining({ objectType: "node", objectId: "node-icon-root" })
      ])
    );
  }, 60_000);
});
