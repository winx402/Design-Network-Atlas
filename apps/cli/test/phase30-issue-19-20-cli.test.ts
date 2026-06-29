import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 120_000;

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

function seedGraphNodeAndContextRecords(db: string) {
  runDna(["--db", db, "graph", "create", "--id", "graph-mutate", "--name", "Mutation Graph", "--purpose", "initial purpose", "--yes"]);
  runDna([
    "--db",
    db,
    "node",
    "create",
    "--graph",
    "graph-mutate",
    "--id",
    "node-warning",
    "--name",
    "Warning Node",
    "--category",
    "ui",
    "--level",
    "species",
    "--yes"
  ]);
  runDna(["--db", db, "context", "create", "--id", "context-runtime", "--name", "Runtime Context", "--type", "art-direction", "--summary", "initial", "--yes"]);
  runDna([
    "--db",
    db,
    "context",
    "fact",
    "add",
    "--id",
    "fact-readability",
    "--type",
    "custom",
    "--statement",
    "Warning states must stay readable",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "context",
    "principle",
    "add",
    "--id",
    "principle-contrast",
    "--statement",
    "Keep contrast strong",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "context",
    "motif",
    "add",
    "--id",
    "motif-alert",
    "--type",
    "visual-motif-ref",
    "--statement",
    "alert corner shard",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "context",
    "reference",
    "add",
    "--id",
    "reference-sheet",
    "--type",
    "source-document",
    "--source-type",
    "public-doc",
    "--source-id",
    "style-sheet",
    "--yes"
  ]);
  runDna([
    "--db",
    db,
    "context",
    "rubric",
    "add",
    "--id",
    "rubric-readability",
    "--dimension",
    "readability",
    "--question",
    "Is warning readable?",
    "--yes"
  ]);
}

function seedGenerationTask(db: string) {
  seedGraphNodeAndContextRecords(db);
  runDna([
    "--db",
    db,
    "phenotype",
    "create",
    "--id",
    "phenotype-warning",
    "--graph",
    "graph-mutate",
    "--node",
    "node-warning",
    "--type",
    "icon",
    "--name",
    "Warning Icon",
    "--brief",
    "Small warning icon",
    "--apply"
  ]);
  runDna([
    "--db",
    db,
    "generation-task",
    "create",
    "--id",
    "task-warning",
    "--graph",
    "graph-mutate",
    "--node",
    "node-warning",
    "--phenotype",
    "phenotype-warning",
    "--type",
    "icon",
    "--brief",
    "Small warning icon",
    "--priority",
    "1",
    "--apply"
  ]);
}

describe("Phase 30 issues #19/#20 CLI mutation and JSON generation contracts", () => {
  test("updates context arrays and graph facets through preview/apply write boundaries", () => {
    const dir = tempDir("phase30-context-graph-update");
    const db = join(dir, "dna.sqlite");
    seedGraphNodeAndContextRecords(db);

    const contextPreview = runDna([
      "--db",
      db,
      "context",
      "update",
      "--id",
      "context-runtime",
      "--summary",
      "updated summary",
      "--append-fact",
      "fact-readability",
      "--append-fact",
      "fact-readability",
      "--append-principle",
      "principle-contrast",
      "--append-motif",
      "motif-alert",
      "--append-reference",
      "reference-sheet",
      "--append-rubric",
      "rubric-readability",
      "--append-negative-boundary",
      "do not flatten alert state",
      "--append-source-ref",
      "public-style-sheet"
    ]);
    expect(contextPreview).toContain("ChangeSet preview");
    expect(JSON.parse(runDna(["--db", db, "context", "show", "--id", "context-runtime"]))).toMatchObject({
      summary: "initial",
      factIds: []
    });

    runDna([
      "--db",
      db,
      "context",
      "update",
      "--id",
      "context-runtime",
      "--summary",
      "updated summary",
      "--append-fact",
      "fact-readability",
      "--append-fact",
      "fact-readability",
      "--append-principle",
      "principle-contrast",
      "--append-motif",
      "motif-alert",
      "--append-reference",
      "reference-sheet",
      "--append-rubric",
      "rubric-readability",
      "--append-negative-boundary",
      "do not flatten alert state",
      "--append-source-ref",
      "public-style-sheet",
      "--apply"
    ]);
    expect(JSON.parse(runDna(["--db", db, "context", "show", "--id", "context-runtime"]))).toMatchObject({
      summary: "updated summary",
      factIds: ["fact-readability"],
      principleIds: ["principle-contrast"],
      motifIds: ["motif-alert"],
      referenceIds: ["reference-sheet"],
      reviewRubricIds: ["rubric-readability"],
      negativeBoundaries: ["do not flatten alert state"],
      sourceRefs: ["public-style-sheet"]
    });

    runDna([
      "--db",
      db,
      "context",
      "update",
      "--id",
      "context-runtime",
      "--remove-fact",
      "fact-missing",
      "--remove-source-ref",
      "missing-source",
      "--apply"
    ]);
    expect(JSON.parse(runDna(["--db", db, "context", "show", "--id", "context-runtime"])).factIds).toEqual(["fact-readability"]);
    expect(runDnaFailure(["--db", db, "context", "update", "--id", "context-runtime", "--append-fact", "missing-fact", "--apply"])).toContain(
      "context fact not found: missing-fact"
    );
    expect(runDnaFailure(["--db", db, "context", "update", "--id", "context-runtime", "--append-source-ref", "   ", "--apply"])).toContain(
      "append-source-ref cannot be empty"
    );

    const graphPreview = runDna(["--db", db, "graph", "update", "--id", "graph-mutate", "--name", "Updated Graph", "--set-facet", "slice=runtime-ui", "--set-facet", "responsive=true"]);
    expect(graphPreview).toContain("ChangeSet preview");
    expect(JSON.parse(runDna(["--db", db, "graph", "show", "--id", "graph-mutate"]))).toMatchObject({
      name: "Mutation Graph",
      purpose: "initial purpose",
      facets: {}
    });

    runDna([
      "--db",
      db,
      "graph",
      "update",
      "--id",
      "graph-mutate",
      "--name",
      "Updated Graph",
      "--purpose",
      "updated purpose",
      "--set-facet",
      "slice=runtime-ui",
      "--set-facet",
      "responsive=true",
      "--apply"
    ]);
    expect(JSON.parse(runDna(["--db", db, "graph", "show", "--id", "graph-mutate"]))).toMatchObject({
      name: "Updated Graph",
      purpose: "updated purpose",
      facets: { slice: "runtime-ui", responsive: true }
    });
    runDna(["--db", db, "graph", "update", "--id", "graph-mutate", "--unset-facet", "responsive", "--apply"]);
    expect(JSON.parse(runDna(["--db", db, "graph", "show", "--id", "graph-mutate"])).facets).toEqual({ slice: "runtime-ui" });
  }, CLI_TIMEOUT);

  test("creates planned phenotype containers only and normalizes facet assignment target aliases", () => {
    const dir = tempDir("phase30-phenotype-create");
    const db = join(dir, "dna.sqlite");
    const out = join(dir, "exported");
    seedGraphNodeAndContextRecords(db);

    const phenotypePreview = runDna([
      "--db",
      db,
      "phenotype",
      "create",
      "--id",
      "phenotype-warning",
      "--graph",
      "graph-mutate",
      "--node",
      "node-warning",
      "--type",
      "icon",
      "--name",
      "Warning Icon",
      "--brief",
      "Small warning icon",
      "--tag",
      "hud",
      "--set-facet",
      "state=warning",
      "--expected-asset-type",
      "image",
      "--review-rubric",
      "rubric-readability",
      "--notes",
      "planned only"
    ]);
    expect(phenotypePreview).toContain("ChangeSet preview");
    expect(runDna(["--db", db, "generation-task", "list"])).not.toContain("phenotype-warning");

    runDna([
      "--db",
      db,
      "phenotype",
      "create",
      "--id",
      "phenotype-warning",
      "--graph",
      "graph-mutate",
      "--node",
      "node-warning",
      "--type",
      "icon",
      "--name",
      "Warning Icon",
      "--brief",
      "Small warning icon",
      "--tag",
      "hud",
      "--set-facet",
      "state=warning",
      "--expected-asset-type",
      "image",
      "--review-rubric",
      "rubric-readability",
      "--notes",
      "planned only",
      "--apply"
    ]);
    const phenotype = JSON.parse(runDna(["--db", db, "phenotype", "show", "--id", "phenotype-warning"]));
    expect(phenotype).toMatchObject({
      phenotypeId: "phenotype-warning",
      graphId: "graph-mutate",
      nodeId: "node-warning",
      phenotypeType: "icon",
      status: "planned",
      facets: { state: "warning" },
      outputPlan: { expectedAssetTypes: ["image"], reviewRubricIds: ["rubric-readability"], notes: "planned only" }
    });
    runDna(["--db", db, "export", "--out", out, "--profile", "review-current"]);
    expect(existsSync(join(out, "graphs", "graph-mutate", "phenotypes", "phenotype-warning.json"))).toBe(true);
    expect(existsSync(join(out, "graphs", "graph-mutate", "phenotype-versions"))).toBe(false);
    expect(existsSync(join(out, "generation-jobs"))).toBe(false);

    runDna(["--db", db, "facet", "definition", "create", "--id", "freeform", "--name", "Freeform", "--value-type", "string", "--yes"]);
    runDna([
      "--db",
      db,
      "facet",
      "assignment",
      "create",
      "--id",
      "assign-node-alias",
      "--target-type",
      "node",
      "--target",
      "node-warning",
      "--value",
      "freeform=ok",
      "--yes"
    ]);
    expect(JSON.parse(runDna(["--db", db, "facet", "assignment", "show", "--id", "assign-node-alias"]))).toMatchObject({
      targetType: "species-node",
      targetId: "node-warning"
    });
    const help = runDna(["facet", "assignment", "create", "--help"]);
    expect(help).toContain("species-group");
    expect(help).toContain("species-node");
    expect(help).toContain("design-relationship");
    expect(help).toContain("phenotype-version");
    expect(runDnaFailure(["--db", db, "facet", "assignment", "create", "--id", "assign-bad", "--target-type", "bad-alias", "--target", "node-warning", "--value", "freeform=ok", "--yes"])).toContain(
      "Allowed target types"
    );
  }, CLI_TIMEOUT);

  test("phenotype generate JSON format is a single parseable wrapper without mutating preview", () => {
    const dir = tempDir("phase30-phenotype-generate-json");
    const db = join(dir, "dna.sqlite");
    seedGenerationTask(db);

    const previewRaw = runDna(["--db", db, "phenotype", "generate", "--task", "task-warning", "--format", "json"]);
    expect(previewRaw).not.toContain("ChangeSet preview");
    const preview = JSON.parse(previewRaw);
    expect(preview).toMatchObject({
      mode: "preview-confirm",
      operation: "phenotype.generate",
      summary: "generate phenotype phenotype-warning",
      persisted: false,
      nextAction: "Re-run with --apply or --yes to persist."
    });
    expect(preview.payload).toMatchObject({
      phenotype: { phenotypeId: "phenotype-warning" },
      job: { inputSnapshot: { generationTaskId: "task-warning" } }
    });
    expect(JSON.parse(runDna(["--db", db, "generation-task", "show", "--id", "task-warning", "--format", "json"]))).toMatchObject({
      generationJobIds: [],
      phenotypeVersionIds: []
    });

    const alias = JSON.parse(runDna(["--db", db, "phenotype", "generate", "--task", "task-warning", "--json"]));
    expect(alias.operation).toBe("phenotype.generate");
    expect(alias.persisted).toBe(false);

    const human = runDna(["--db", db, "phenotype", "generate", "--task", "task-warning"]);
    expect(human).toContain("ChangeSet preview");
    expect(human).toContain("Re-run with --yes");

    const applied = JSON.parse(runDna(["--db", db, "phenotype", "generate", "--task", "task-warning", "--apply", "--format", "json"]));
    expect(applied).toMatchObject({
      operation: "phenotype.generate",
      persisted: true
    });
    expect(applied.nextAction === null || applied.nextAction === undefined).toBe(true);
    expect(JSON.parse(runDna(["--db", db, "generation-task", "show", "--id", "task-warning", "--format", "json"]))).toMatchObject({
      status: "generated",
      generationJobIds: [applied.payload.job.generationJobId],
      phenotypeVersionIds: [applied.payload.phenotypeVersion.phenotypeVersionId]
    });
  }, CLI_TIMEOUT);
});
