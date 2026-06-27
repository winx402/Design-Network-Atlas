import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

describe("Phase 22 graph reset CLI", () => {
  test("previews, confirmation-protects, resets, and allows graph id reuse without touching external files", () => {
    const dir = tempDir("phase22-graph-reset-cli");
    const db = join(dir, "dna.sqlite");
    const externalFile = join(dir, "external-output.png");
    writeFileSync(externalFile, "external binary placeholder");

    runDna(["--db", db, "graph", "create", "--id", "graph-reset-cli", "--name", "Reset CLI", "--purpose", "pilot", "--yes"]);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-reset-cli",
      "--id",
      "node-reset-cli",
      "--name",
      "Reset Node",
      "--yes"
    ]);
    runDna(["--db", db, "context", "create", "--id", "ctx-reset-cli", "--name", "Shared Context", "--type", "custom", "--yes"]);
    runDna([
      "--db",
      db,
      "context",
      "attach",
      "--id",
      "attach-reset-cli",
      "--context",
      "ctx-reset-cli",
      "--target-type",
      "graph",
      "--target",
      "graph-reset-cli",
      "--yes"
    ]);
    runDna(["--db", db, "library", "create", "--id", "library-reset-cli", "--name", "Shared Library", "--purpose", "preserve", "--yes"]);
    runDna([
      "--db",
      db,
      "library",
      "bind-graph",
      "--id",
      "binding-reset-cli",
      "--library",
      "library-reset-cli",
      "--graph",
      "graph-reset-cli",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "asset",
      "add",
      "--id",
      "asset-reset-cli",
      "--uri",
      externalFile,
      "--linked-type",
      "node",
      "--linked-id",
      "node-reset-cli",
      "--yes"
    ]);

    const preview = runDna(["--db", db, "graph", "reset", "--id", "graph-reset-cli"]);

    expect(preview).toContain("Graph reset preview");
    expect(preview).toContain('"graphs": 1');
    expect(preview).toContain('"nodes": 1');
    expect(runDna(["--db", db, "graph", "show", "--id", "graph-reset-cli"])).toContain("Reset CLI");
    expect(runDnaFailure(["--db", db, "--yes", "graph", "reset", "--id", "graph-reset-cli"])).toContain("--confirm-reset graph-reset-cli");

    const applied = runDna(["--db", db, "--yes", "graph", "reset", "--id", "graph-reset-cli", "--confirm-reset", "graph-reset-cli"]);

    expect(applied).toContain("reset graph graph-reset-cli");
    expect(runDnaFailure(["--db", db, "graph", "show", "--id", "graph-reset-cli"])).toContain("graph not found");
    expect(runDna(["--db", db, "context", "map", "--id", "ctx-reset-cli"])).toContain("Shared Context");
    expect(runDna(["--db", db, "library", "list"])).toContain("library-reset-cli");
    expect(runDna(["--db", db, "asset", "search", "--linked-id", "node-reset-cli"])).not.toContain("asset-reset-cli");
    expect(existsSync(externalFile)).toBe(true);

    expect(
      runDna(["--db", db, "graph", "create", "--id", "graph-reset-cli", "--name", "Reset Reused", "--purpose", "reuse", "--yes"])
    ).toContain("created graph graph-reset-cli");
  }, CLI_TIMEOUT);
});
