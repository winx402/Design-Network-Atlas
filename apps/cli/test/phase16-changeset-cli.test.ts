import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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

describe("Phase 16 change-set review workflow CLI", () => {
  test("lists, reviews, applies, discards, and exports preview change-sets", () => {
    const dir = tempDir("phase16-changeset-cli");
    const sourceDb = join(dir, "source.sqlite");
    const targetDb = join(dir, "target.sqlite");
    const out = join(dir, "dna-export");

    runDna(["--db", sourceDb, "graph", "create", "--id", "graph-review", "--name", "Review", "--purpose", "changeset", "--yes"]);

    const preview = runDna([
      "--db",
      sourceDb,
      "node",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "node-pending",
      "--name",
      "Pending Node",
      "--motif",
      "broken-ring"
    ]);
    const changeSetId = extractChangeSetId(preview);

    expect(runDna(["--db", sourceDb, "node", "list", "--graph", "graph-review"])).not.toContain("node-pending");
    expect(runDna(["--db", sourceDb, "changeset", "list", "--status", "preview"])).toContain(changeSetId);
    expect(runDna(["--db", sourceDb, "changeset", "show", changeSetId])).toContain("create node node-pending");
    expect(runDna(["--db", sourceDb, "changeset", "review", changeSetId])).toContain('"status": "pass"');

    runDna(["--db", sourceDb, "changeset", "apply", changeSetId]);
    expect(runDna(["--db", sourceDb, "node", "show", "--id", "node-pending"])).toContain("Pending Node");
    expect(runDna(["--db", sourceDb, "changeset", "show", changeSetId])).toContain('"status": "applied"');

    const secondPreview = runDna([
      "--db",
      sourceDb,
      "node",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "node-discarded",
      "--name",
      "Discarded Node"
    ]);
    const discardedChangeSetId = extractChangeSetId(secondPreview);
    runDna(["--db", sourceDb, "changeset", "discard", discardedChangeSetId]);
    expect(runDnaFailure(["--db", sourceDb, "changeset", "apply", discardedChangeSetId])).toContain("change-set is not preview");
    expect(runDna(["--db", sourceDb, "node", "list", "--graph", "graph-review"])).not.toContain("node-discarded");

    const thirdPreview = runDna([
      "--db",
      sourceDb,
      "node",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "node-mode-apply",
      "--name",
      "Mode Apply Node"
    ]);
    const modeApplyChangeSetId = extractChangeSetId(thirdPreview);
    runDna(["--db", sourceDb, "--mode", "changeset-apply", "--change-set", modeApplyChangeSetId, "node", "create"]);
    expect(runDna(["--db", sourceDb, "node", "show", "--id", "node-mode-apply"])).toContain("Mode Apply Node");

    const exportPreview = runDna([
      "--db",
      sourceDb,
      "node",
      "create",
      "--graph",
      "graph-review",
      "--id",
      "node-exported-preview",
      "--name",
      "Exported Preview Node"
    ]);
    const exportedChangeSetId = extractChangeSetId(exportPreview);
    runDna(["--db", sourceDb, "export", "--out", out]);

    const exportedChangeSetPath = join(out, "change-sets", `${exportedChangeSetId}.json`);
    expect(existsSync(exportedChangeSetPath)).toBe(true);
    expect(JSON.parse(readFileSync(exportedChangeSetPath, "utf8")).status).toBe("preview");

    runDna(["--db", targetDb, "import", "--in", out, "--yes"]);
    expect(runDna(["--db", targetDb, "changeset", "show", exportedChangeSetId])).toContain("Exported Preview Node");
  }, CLI_TIMEOUT);
});
