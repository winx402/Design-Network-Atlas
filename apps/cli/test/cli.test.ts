import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 60_000;

function runDna(args: string[], cwd: string) {
  return execFileSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
}

describe("dna CLI", () => {
  test("shows help", () => {
    const output = runDna(["--help"], projectRoot);
    expect(output).toContain("Design Network Atlas");
    expect(output).toContain("Use `dna <command> --help`");
    expect(output).toContain("Write modes");
  }, CLI_TIMEOUT);

  test("runs a local graph-to-phenotype loop with explicit confirmation", () => {
    const projectDir = join(tmpdir(), `dna-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(projectDir, { recursive: true });
    const db = join(projectDir, "dna.sqlite");
    const cwd = projectRoot;

    const preview = runDna(
      ["--db", db, "graph", "create", "--id", "graph-cli", "--name", "CLI Graph", "--purpose", "test"],
      cwd
    );
    expect(preview).toContain("ChangeSet preview");

    runDna(["--db", db, "graph", "create", "--id", "graph-cli", "--name", "CLI Graph", "--purpose", "test", "--yes"], cwd);
    runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-cli",
      "--id",
      "node-cli",
      "--name",
      "CLI Node",
      "--category",
      "icon",
      "--level",
      "root",
      "--motif",
      "broken-ring",
      "--constraint",
      "color=red",
      "--yes"
    ], cwd);

    const generated = runDna([
      "--db",
      db,
      "phenotype",
      "generate",
      "--graph",
      "graph-cli",
      "--node",
      "node-cli",
      "--type",
      "image-prompt",
      "--name",
      "CLI Prompt",
      "--brief",
      "toolbar warning icon",
      "--tool",
      "manual",
      "--yes"
    ], cwd);

    expect(generated).toContain("broken-ring");
    expect(generated).toContain("pending-confirmation");
  }, CLI_TIMEOUT);
});
