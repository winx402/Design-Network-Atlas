import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
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

describe("Phase 22 PRD-14 design relationship CLI", () => {
  test("exposes relationship commands without legacy edge or bridge command families", () => {
    const help = runDna(["--help"]);
    expect(help).toContain("relationship");
    expect(help).not.toMatch(/\bedge\b/);
    expect(help).not.toContain("graph bridge");
    expect(help).not.toContain("atlas bridge");

    const relationshipHelp = runDna(["relationship", "--help"]);
    expect(relationshipHelp).toContain("Manage design relationships");
    expect(relationshipHelp).toContain("graph:<graphId>");
    expect(relationshipHelp).toContain("species-group:<graphId>:<groupId>");
    expect(relationshipHelp).toContain("species-node:<graphId>:<nodeId>");
  }, CLI_TIMEOUT);

  test("creates, shows, and renders graph-level design relationship contracts", () => {
    const db = join(tempDir("phase22-relationship-cli"), "dna.sqlite");
    runDna(["--db", db, "graph", "create", "--id", "graph-style", "--name", "Style Graph", "--purpose", "style", "--yes"]);
    runDna(["--db", db, "graph", "create", "--id", "graph-ui", "--name", "UI Graph", "--purpose", "ui", "--yes"]);
    runDna([
      "--db",
      db,
      "atlas",
      "create",
      "--id",
      "atlas-review",
      "--name",
      "Review Atlas",
      "--purpose",
      "cross-graph review",
      "--graph",
      "graph-style",
      "--graph",
      "graph-ui",
      "--yes"
    ]);

    const preview = runDna([
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
      "--direction",
      "bidirectional",
      "--description",
      "UI graph aligns with the style graph.",
      "--transfer-rule",
      "Translate motif language into small icon readability.",
      "--must-preserve",
      "crescent silhouette",
      "--must-avoid",
      "low contrast",
      "--review-question",
      "Does the icon remain readable at small sizes?"
    ]);
    expect(preview).toContain("ChangeSet preview");
    expect(preview).toContain("design relationship");

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
      "--direction",
      "bidirectional",
      "--description",
      "UI graph aligns with the style graph.",
      "--transfer-rule",
      "Translate motif language into small icon readability.",
      "--must-preserve",
      "crescent silhouette",
      "--must-avoid",
      "low contrast",
      "--review-question",
      "Does the icon remain readable at small sizes?",
      "--yes"
    ]);

    const relationship = JSON.parse(runDna(["--db", db, "relationship", "show", "--id", "rel-style-ui", "--format", "json"]));
    expect(relationship).toMatchObject({
      relationshipId: "rel-style-ui",
      source: { type: "graph", graphId: "graph-style" },
      target: { type: "graph", graphId: "graph-ui" },
      designContract: {
        transferRule: "Translate motif language into small icon readability.",
        mustPreserve: ["crescent silhouette"],
        mustAvoid: ["low contrast"]
      }
    });

    const atlasMap = runDna(["--db", db, "atlas", "map", "--id", "atlas-review"]);
    expect(atlasMap).toContain("Design Relationships:");
    expect(atlasMap).toContain("graph:graph-style -> graph:graph-ui [aligns-with]");
    expect(atlasMap).toContain("Transfer Rule: Translate motif language into small icon readability.");
    expect(atlasMap).toContain("Must Preserve: crescent silhouette");
    expect(atlasMap).toContain("Must Avoid: low contrast");
    expect(atlasMap).toContain("Review Questions: Does the icon remain readable at small sizes?");
  }, CLI_TIMEOUT);
});
