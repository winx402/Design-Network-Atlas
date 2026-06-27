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

describe("Phase 22 context map text review metadata", () => {
  test("text output includes source refs, negative boundaries, confidence, status, owner, and version", () => {
    const dir = tempDir("phase22-context-map-text");
    const db = join(dir, "dna.sqlite");

    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "create",
      "--id",
      "ctx-review-text",
      "--name",
      "Reviewer Context",
      "--type",
      "worldview",
      "--summary",
      "Visible review metadata",
      "--status",
      "active",
      "--confidence",
      "confirmed",
      "--owner",
      "art-direction",
      "--negative-boundary",
      "avoid modern military realism",
      "--source-ref",
      "docs/safe-review-source.md"
    ]);

    const text = runDna(["--db", db, "context", "map", "--id", "ctx-review-text", "--format", "text"]);

    expect(text).toContain("Summary: Visible review metadata");
    expect(text).toContain("Status: active");
    expect(text).toContain("Confidence: confirmed");
    expect(text).toContain("Owner: art-direction");
    expect(text).toContain("Version: 1.0.0");
    expect(text).toContain("Source Refs:\n- docs/safe-review-source.md");
    expect(text).toContain("Negative Boundaries:\n- avoid modern military realism");

    const json = JSON.parse(runDna(["--db", db, "context", "map", "--id", "ctx-review-text", "--format", "json"]));
    expect(json.context.sourceRefs).toEqual(["docs/safe-review-source.md"]);
    expect(json.context.negativeBoundaries).toEqual(["avoid modern military realism"]);
    expect(json.context.confidence).toBe("confirmed");
  }, CLI_TIMEOUT);

  test("text output renders empty source refs and negative boundaries as none", () => {
    const dir = tempDir("phase22-context-map-empty-text");
    const db = join(dir, "dna.sqlite");

    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "create",
      "--id",
      "ctx-empty-review-text",
      "--name",
      "Empty Review Context",
      "--type",
      "custom",
      "--summary",
      "Empty lists are visible"
    ]);

    const text = runDna(["--db", db, "context", "map", "--id", "ctx-empty-review-text", "--format", "text"]);

    expect(text).toContain("Confidence: draft");
    expect(text).toContain("Owner: none");
    expect(text).toContain("Source Refs:\n- none");
    expect(text).toContain("Negative Boundaries:\n- none");
  }, CLI_TIMEOUT);
});
