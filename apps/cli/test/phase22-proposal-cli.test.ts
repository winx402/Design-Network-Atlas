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

function extractChangeSetId(output: string) {
  const id = output.match(/"changeSetId": "([^"]+)"/)?.[1];
  if (!id) throw new Error(`changeSetId not found in output: ${output}`);
  return id;
}

describe("Phase 22 proposal CLI", () => {
  test("shows proposal commands in help", () => {
    const help = runDna(["proposal", "--help"]);

    expect(help).toContain("add-change-set");
    expect(help).toContain("review");
    expect(help).toContain("apply");
  });

  test("creates, links, reviews, applies, and discards local proposals", () => {
    const dir = tempDir("phase22-proposal-cli");
    const db = join(dir, "dna.sqlite");

    const graphPreview = runDna([
      "--db",
      db,
      "graph",
      "create",
      "--id",
      "graph-proposal-cli",
      "--name",
      "Proposal CLI Graph",
      "--purpose",
      "proposal workflow"
    ]);
    const graphChangeSetId = extractChangeSetId(graphPreview);
    const nodePreview = runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-proposal-cli",
      "--id",
      "node-proposal-cli",
      "--name",
      "Proposal CLI Node",
      "--category",
      "icon",
      "--level",
      "root"
    ]);
    const nodeChangeSetId = extractChangeSetId(nodePreview);

    expect(
      runDna([
        "--db",
        db,
        "proposal",
        "create",
        "--id",
        "proposal-cli",
        "--title",
        "CLI proposal",
        "--summary",
        "Apply graph and node together"
      ])
    ).toContain('"proposalId": "proposal-cli"');
    runDna(["--db", db, "proposal", "add-change-set", "proposal-cli", "--change-set", graphChangeSetId]);
    runDna(["--db", db, "proposal", "add-change-set", "proposal-cli", "--change-set", nodeChangeSetId]);

    const show = runDna(["--db", db, "proposal", "show", "proposal-cli"]);
    expect(show).toContain(graphChangeSetId);
    expect(show).toContain(nodeChangeSetId);
    expect(runDna(["--db", db, "proposal", "review", "proposal-cli"])).toContain('"status": "ready"');

    runDna(["--db", db, "--yes", "proposal", "apply", "proposal-cli"]);

    expect(runDna(["--db", db, "graph", "show", "--id", "graph-proposal-cli"])).toContain("Proposal CLI Graph");
    expect(runDna(["--db", db, "node", "show", "--id", "node-proposal-cli"])).toContain("Proposal CLI Node");

    const factPreview = runDna([
      "--db",
      db,
      "context",
      "fact",
      "add",
      "--id",
      "fact-proposal-discard-cli",
      "--type",
      "custom",
      "--statement",
      "Discard leaves this child preview"
    ]);
    const factChangeSetId = extractChangeSetId(factPreview);
    runDna([
      "--db",
      db,
      "proposal",
      "create",
      "--id",
      "proposal-discard-cli",
      "--title",
      "Discard",
      "--summary",
      "Discard metadata only"
    ]);
    runDna(["--db", db, "proposal", "add-change-set", "proposal-discard-cli", "--change-set", factChangeSetId]);
    expect(runDna(["--db", db, "proposal", "discard", "proposal-discard-cli"])).toContain('"status": "discarded"');
    expect(runDna(["--db", db, "changeset", "show", factChangeSetId])).toContain('"status": "preview"');
  }, CLI_TIMEOUT);
});
