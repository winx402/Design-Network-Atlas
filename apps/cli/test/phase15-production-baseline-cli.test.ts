import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
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

describe("Phase 15 CLI production baseline", () => {
  test("persists mock provider jobs and supports explicit sync export/import", () => {
    const dir = tempDir("phase15-cli");
    const sourceDb = join(dir, "source.sqlite");
    const targetDb = join(dir, "target.sqlite");
    const out = join(dir, "sync-export");

    runDna(["--db", sourceDb, "graph", "create", "--id", "graph-prod", "--name", "Production", "--purpose", "baseline", "--yes"]);
    runDna(["--db", sourceDb, "node", "create", "--graph", "graph-prod", "--id", "node-prod", "--name", "Prod Species", "--yes"]);
    runDna([
      "--db",
      sourceDb,
      "provider",
      "run-mock",
      "--id",
      "job-prod",
      "--graph",
      "graph-prod",
      "--node",
      "node-prod",
      "--phenotype-type",
      "image-prompt",
      "--brief",
      "Generate production candidate",
      "--prompt",
      "Prompt text",
      "--param",
      "model=mock",
      "--param",
      "apiKey=sk-do-not-store",
      "--yes"
    ]);

    const job = runDna(["--db", sourceDb, "provider", "job", "show", "--id", "job-prod"]);
    expect(job).toContain('"status": "generated"');
    expect(job).toContain('"model": "mock"');
    expect(job).not.toContain("sk-do-not-store");
    expect(job).not.toContain("apiKey");

    runDna(["--db", sourceDb, "sync", "export", "--out", out]);
    expect(existsSync(join(out, "dna.project.json"))).toBe(true);
    runDna(["--db", targetDb, "sync", "import", "--in", out, "--yes"]);
    expect(runDna(["--db", targetDb, "graph", "show", "--id", "graph-prod"])).toContain("Production");
    expect(runDna(["--db", targetDb, "provider", "job", "show", "--id", "job-prod"])).toContain('"status": "generated"');
  }, 60_000);
});
