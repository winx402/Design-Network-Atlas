import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

describe("Phase 24 modeling quality CLI", () => {
  test("checks modeling batches with stable text and JSON output", () => {
    const dir = tempDir("phase24-modeling-check");
    const batchFile = join(dir, "quality-batch.json");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-quality", name: "Quality Graph", purpose: "initial review" }],
          speciesNodes: [
            { graphId: "graph-quality", nodeId: "species-big", name: "Everything System", category: "system", level: "system" },
            { graphId: "graph-quality", nodeId: "species-icon", name: "Icon 64x64", category: "ui", level: "variant" },
            { graphId: "graph-quality", nodeId: "species-vfx", name: "Hit VFX Frame", category: "vfx", level: "variant" }
          ],
          designRelationships: [
            {
              relationshipId: "rel-flow",
              source: { type: "species-node", graphId: "graph-quality", nodeId: "species-big" },
              target: { type: "species-node", graphId: "graph-quality", nodeId: "species-icon" },
              relationshipType: "workflow-step",
              description: "product workflow flow"
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const text = runDna(["modeling", "check", "--batch", batchFile]);
    expect(text).toContain("Modeling quality report");
    expect(text).toContain("blocking");
    expect(text).toContain("planned phenotype");
    expect(text).toContain("graphSplit");

    const json = JSON.parse(runDna(["modeling", "check", "--batch", batchFile, "--format", "json"]));
    expect(json.status).toBe("needs-review");
    expect(json.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "species-node", objectId: "species-icon" }),
        expect.objectContaining({ objectType: "design-relationship", objectId: "rel-flow" })
      ])
    );
  }, 60_000);

  test("checks persisted graphs and proposals through the same report contract", () => {
    const dir = tempDir("phase24-modeling-check-graph");
    const db = join(dir, "dna.sqlite");
    const batchFile = join(dir, "proposal-quality.json");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-quality-store", name: "Store Quality Graph", purpose: "store review" }],
          speciesNodes: [{ graphId: "graph-quality-store", nodeId: "species-store", name: "Store Species", category: "character", level: "species" }]
        },
        null,
        2
      )}\n`
    );
    runDna(["--db", db, "proposal", "import-batch", "--in", batchFile, "--id", "proposal-quality", "--title", "Quality proposal"]);

    const proposal = JSON.parse(runDna(["--db", db, "modeling", "check", "--proposal", "proposal-quality", "--format", "json"]));
    expect(proposal.source).toMatchObject({ type: "proposal", id: "proposal-quality" });
    expect(proposal.issues).toEqual([expect.objectContaining({ objectType: "species-node", objectId: "species-store" })]);

    runDna(["--db", db, "--yes", "proposal", "apply", "proposal-quality"]);
    const graph = JSON.parse(runDna(["--db", db, "modeling", "check", "--graph", "graph-quality-store", "--format", "json"]));
    expect(graph.source).toMatchObject({ type: "graph", id: "graph-quality-store" });
    expect(graph.issues).toEqual([expect.objectContaining({ objectType: "species-node", objectId: "species-store" })]);
  }, 60_000);
});
