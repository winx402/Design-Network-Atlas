import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
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

function runDnaFailure(args: string[]) {
  const result = spawnSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  expect(result.status).not.toBe(0);
  return `${result.stdout}${result.stderr}`;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Phase 23 facet CLI and modeling batch flow", () => {
  test("creates facet definitions, schemas, and assignments through preview/apply commands", () => {
    const dir = tempDir("phase23-facet-cli");
    const db = join(dir, "dna.sqlite");
    const out = join(dir, "review-current");

    runDna(["--db", db, "graph", "create", "--id", "graph-facet-cli", "--name", "Facet CLI", "--purpose", "facet flow", "--yes"]);

    const preview = runDna([
      "--db",
      db,
      "facet",
      "definition",
      "create",
      "--id",
      "facet-tone",
      "--name",
      "Tone",
      "--value-type",
      "enum",
      "--allowed-value",
      "warm",
      "--allowed-value",
      "cool"
    ]);
    expect(preview).toContain("ChangeSet preview");
    expect(runDna(["--db", db, "facet", "definition", "list"])).not.toContain("facet-tone");

    runDna([
      "--db",
      db,
      "facet",
      "definition",
      "create",
      "--id",
      "facet-tone",
      "--name",
      "Tone",
      "--value-type",
      "enum",
      "--allowed-value",
      "warm",
      "--allowed-value",
      "cool",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "facet",
      "schema",
      "create",
      "--id",
      "schema-ui-tone",
      "--name",
      "UI Tone",
      "--facet",
      "facet-tone",
      "--required",
      "facet-tone",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "facet",
      "assignment",
      "create",
      "--id",
      "assign-graph-tone",
      "--target-type",
      "graph",
      "--target",
      "graph-facet-cli",
      "--value",
      "facet-tone=warm",
      "--yes"
    ]);

    expect(JSON.parse(runDna(["--db", db, "facet", "definition", "show", "--id", "facet-tone"]))).toMatchObject({
      facetId: "facet-tone",
      allowedValues: ["warm", "cool"]
    });
    expect(JSON.parse(runDna(["--db", db, "facet", "schema", "show", "--id", "schema-ui-tone"]))).toMatchObject({
      facetSchemaId: "schema-ui-tone",
      requiredFacetIds: ["facet-tone"]
    });
    expect(JSON.parse(runDna(["--db", db, "facet", "assignment", "show", "--id", "assign-graph-tone"]))).toMatchObject({
      targetType: "graph",
      targetId: "graph-facet-cli",
      values: { "facet-tone": "warm" }
    });
    expect(runDnaFailure(["--db", db, "facet", "assignment", "create", "--id", "assign-bad", "--target-type", "graph", "--target", "graph-facet-cli", "--value", "facet-tone=loud", "--yes"])).toContain("not allowed");

    runDna(["--db", db, "export", "--out", out, "--profile", "review-current"]);
    expect(existsSync(join(out, "facets", "definitions", "facet-tone.json"))).toBe(true);
    expect(existsSync(join(out, "facets", "schemas", "schema-ui-tone.json"))).toBe(true);
    expect(existsSync(join(out, "facets", "assignments", "assign-graph-tone.json"))).toBe(true);
    expect(existsSync(join(out, "change-sets"))).toBe(false);
    expect(existsSync(join(out, "proposals"))).toBe(false);
  }, CLI_TIMEOUT);

  test("imports facet objects from modeling batch and rejects invalid facet references all-or-nothing", () => {
    const dir = tempDir("phase23-facet-batch");
    const db = join(dir, "dna.sqlite");
    const batchFile = join(dir, "facet-batch.json");
    const invalidBatchFile = join(dir, "facet-batch-invalid.json");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-facet-batch", name: "Facet Batch", purpose: "facet batch" }],
          facetDefinitions: [{ facetId: "facet-silhouette", name: "Silhouette", valueType: "enum", allowedValues: ["round", "sharp"] }],
          facetSchemas: [{ facetSchemaId: "schema-silhouette", name: "Silhouette Schema", facetIds: ["facet-silhouette"], requiredFacetIds: ["facet-silhouette"] }],
          facetAssignments: [
            {
              assignmentId: "assign-batch-graph",
              targetType: "graph",
              targetId: "graph-facet-batch",
              values: { "facet-silhouette": "round" }
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const jsonOutput = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      batchFile,
      "--id",
      "proposal-facet-batch",
      "--title",
      "Facet batch",
      "--format",
      "json",
      "--include-ids"
    ]);
    const result = JSON.parse(jsonOutput);
    expect(result.counts.planned).toMatchObject({ graphs: 1, facetDefinitions: 1, facetSchemas: 1, facetAssignments: 1 });
    runDna(["--db", db, "--yes", "proposal", "apply", "proposal-facet-batch"]);
    expect(runDna(["--db", db, "facet", "assignment", "show", "--id", "assign-batch-graph"])).toContain('"facet-silhouette": "round"');

    writeFileSync(
      invalidBatchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-invalid-facet-batch", name: "Invalid Facet Batch", purpose: "invalid facet batch" }],
          facetDefinitions: [{ facetId: "facet-state", name: "State", valueType: "enum", allowedValues: ["active"] }],
          facetSchemas: [{ facetSchemaId: "schema-invalid", name: "Invalid Schema", facetIds: ["facet-missing"] }],
          facetAssignments: [{ assignmentId: "assign-invalid", targetType: "graph", targetId: "graph-invalid-facet-batch", values: { "facet-state": "inactive" } }]
        },
        null,
        2
      )}\n`
    );

    const failed = runDnaFailure([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      invalidBatchFile,
      "--id",
      "proposal-invalid-facet-batch",
      "--title",
      "Invalid facet batch"
    ]);
    expect(failed).toContain("facetSchemas[0].facetIds");
    expect(failed).toContain("facetAssignments[0].values.facet-state");
    expect(runDna(["--db", db, "graph", "list"])).not.toContain("graph-invalid-facet-batch");
    expect(runDna(["--db", db, "proposal", "list"])).not.toContain("proposal-invalid-facet-batch");
  }, CLI_TIMEOUT);
});
