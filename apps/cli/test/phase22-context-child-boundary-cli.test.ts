import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
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

function runDnaFailure(args: string[]) {
  const result = spawnSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  expect(result.status).not.toBe(0);
  return `${result.stdout}${result.stderr}`;
}

function extractChangeSetId(output: string) {
  const id = output.match(/"changeSetId": "([^"]+)"/)?.[1];
  if (!id) throw new Error(`changeSetId not found in output: ${output}`);
  return id;
}

describe("Phase 22 context child CLI write boundary", () => {
  test("context fact add previews by default and can be applied by change-set", () => {
    const dir = tempDir("phase22-context-child-cli");
    const db = join(dir, "dna.sqlite");

    runDna([
      "--db",
      db,
      "context",
      "create",
      "--id",
      "ctx-boundary",
      "--name",
      "Boundary Context",
      "--type",
      "custom",
      "--fact",
      "fact-preview",
      "--yes"
    ]);

    const preview = runDna([
      "--db",
      db,
      "context",
      "fact",
      "add",
      "--id",
      "fact-preview",
      "--type",
      "symbol-rule",
      "--statement",
      "Keep ring motifs broken"
    ]);
    const changeSetId = extractChangeSetId(preview);

    expect(preview).toContain("ChangeSet preview");
    expect(preview).toContain('"objectType": "context-fact"');
    expect(runDna(["--db", db, "context", "map", "--id", "ctx-boundary"])).not.toContain("Keep ring motifs broken");
    expect(runDna(["--db", db, "changeset", "review", changeSetId])).toContain('"status": "pass"');

    runDna(["--db", db, "changeset", "apply", changeSetId]);

    expect(runDna(["--db", db, "context", "map", "--id", "ctx-boundary"])).toContain("Keep ring motifs broken");
  }, CLI_TIMEOUT);

  test("context child add commands preview by default and support apply modes", () => {
    const dir = tempDir("phase22-context-child-modes-cli");
    const db = join(dir, "dna.sqlite");

    const commands = [
      [
        "context",
        "principle",
        "add",
        "--id",
        "principle-preview",
        "--statement",
        "Use readable ritual silhouettes",
        '"objectType": "design-principle"'
      ],
      [
        "context",
        "motif",
        "add",
        "--id",
        "motif-preview",
        "--type",
        "symbolic-motif",
        "--statement",
        "Cracked halo",
        '"objectType": "context-motif"'
      ],
      [
        "context",
        "reference",
        "add",
        "--id",
        "reference-preview",
        "--type",
        "source-document",
        "--source-type",
        "design-note",
        "--source-id",
        "note-1",
        '"objectType": "context-reference"'
      ],
      [
        "context",
        "rubric",
        "add",
        "--id",
        "rubric-preview",
        "--dimension",
        "context-consistency",
        "--question",
        "Does the result preserve the ritual boundary?",
        '"objectType": "context-review-rubric"'
      ]
    ];

    for (const command of commands) {
      const expectedObjectType = command.at(-1) ?? "";
      const output = runDna(["--db", db, ...command.slice(0, -1)]);
      expect(output).toContain("ChangeSet preview");
      expect(output).toContain(expectedObjectType);
    }

    expect(
      runDna([
        "--db",
        db,
        "context",
        "fact",
        "add",
        "--id",
        "fact-yes",
        "--type",
        "custom",
        "--statement",
        "Persisted through apply",
        "--yes"
      ])
    ).toContain("created context fact fact-yes");

    const modePreview = runDna([
      "--db",
      db,
      "context",
      "fact",
      "add",
      "--id",
      "fact-mode-apply",
      "--type",
      "custom",
      "--statement",
      "Applied from changeset mode"
    ]);
    const changeSetId = extractChangeSetId(modePreview);

    expect(runDnaFailure(["--db", db, "--mode", "changeset-apply", "context", "fact", "add"])).toContain(
      "change-set id is required"
    );
    expect(
      runDna(["--db", db, "--mode", "changeset-apply", "--change-set", changeSetId, "context", "fact", "add"])
    ).toContain("created context fact fact-mode-apply");
  }, CLI_TIMEOUT);

  test("context child commands no longer direct-write through repositories", () => {
    const source = readFileSync(join(projectRoot, "apps/cli/src/index.ts"), "utf8");

    expect(source).not.toContain("store.contextFacts.create(value)");
    expect(source).not.toContain("store.designPrinciples.create(value)");
    expect(source).not.toContain("store.contextMotifs.create(value)");
    expect(source).not.toContain("store.contextReferences.create(value)");
    expect(source).not.toContain("store.contextReviewRubrics.create(value)");
  });
});
