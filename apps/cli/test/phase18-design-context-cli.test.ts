import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
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

describe("Phase 18 PRD-02 design context CLI", () => {
  test("context create --version writes the domain context version instead of printing CLI version", () => {
    const db = join(tempDir("phase18-context-version"), "dna.sqlite");

    const created = runDna([
      "--db",
      db,
      "--yes",
      "context",
      "create",
      "--id",
      "ctx-versioned",
      "--name",
      "Versioned Context",
      "--type",
      "worldview",
      "--version",
      "0.5.0"
    ]);
    expect(created).toContain("created design context ctx-versioned");

    const context = JSON.parse(runDna(["--db", db, "context", "show", "--id", "ctx-versioned"]));
    expect(context.version).toBe("0.5.0");
    expect(runDna(["--cli-version"]).trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(runDna(["--help"])).toContain("--cli-version");
  }, 80_000);

  test("creates, maps, attaches, and impact-checks design context objects", () => {
    const db = join(tempDir("phase18-design-context"), "dna.sqlite");

    runDna(["--db", db, "graph", "create", "--id", "graph-ui", "--name", "UI Graph", "--purpose", "ui", "--yes"]);
    runDna(["--db", db, "node", "create", "--graph", "graph-ui", "--id", "node-faction-icon", "--name", "Faction Icon", "--yes"]);

    const preview = runDna([
      "--db",
      db,
      "context",
      "create",
      "--id",
      "ctx-preview",
      "--name",
      "Preview Context",
      "--type",
      "worldview"
    ]);
    expect(preview).toContain("ChangeSet preview");

    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "fact",
      "add",
      "--id",
      "fact-faction",
      "--type",
      "faction",
      "--statement",
      "月蚀阵营使用残月符号",
      "--strength",
      "hard",
      "--behavior",
      "include"
    ]);
    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "principle",
      "add",
      "--id",
      "principle-ui",
      "--statement",
      "UI 先可读再保留世界观识别",
      "--experience-intent",
      "快速识别阵营",
      "--readability-goal",
      "small icon readable"
    ]);
    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "motif",
      "add",
      "--id",
      "motif-ring",
      "--type",
      "symbolic-motif",
      "--statement",
      "断环代表破碎誓约"
    ]);
    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "reference",
      "add",
      "--id",
      "ref-board",
      "--type",
      "moodboard",
      "--source-type",
      "asset-index",
      "--source-id",
      "asset-board",
      "--role",
      "mood",
      "--use-for",
      "emotion",
      "--do-not-use-for",
      "exact silhouette"
    ]);
    runDna([
      "--db",
      db,
      "--yes",
      "context",
      "rubric",
      "add",
      "--id",
      "rubric-consistency",
      "--dimension",
      "context-consistency",
      "--question",
      "是否符合世界观？",
      "--severity",
      "warning"
    ]);
    runDna([
      "--db",
      db,
      "context",
      "create",
      "--id",
      "ctx-worldview",
      "--name",
      "Worldview",
      "--type",
      "worldview",
      "--summary",
      "月蚀阵营、异境禁忌和 UI 降噪原则",
      "--fact",
      "fact-faction",
      "--principle",
      "principle-ui",
      "--motif",
      "motif-ring",
      "--reference",
      "ref-board",
      "--rubric",
      "rubric-consistency",
      "--confidence",
      "confirmed",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "context",
      "attach",
      "--id",
      "att-node-context",
      "--context",
      "ctx-worldview",
      "--target-type",
      "species-node",
      "--target",
      "node-faction-icon",
      "--role",
      "constraint",
      "--strength",
      "soft",
      "--compile-layer",
      "node-context",
      "--yes"
    ]);

    const contextMap = JSON.parse(runDna(["--db", db, "context", "map", "--id", "ctx-worldview", "--format", "json"]));
    expect(contextMap.context.contextId).toBe("ctx-worldview");
    expect(contextMap.facts.map((fact: { factId: string }) => fact.factId)).toEqual(["fact-faction"]);
    expect(contextMap.principles.map((principle: { principleId: string }) => principle.principleId)).toEqual(["principle-ui"]);
    expect(contextMap.motifs.map((motif: { motifId: string }) => motif.motifId)).toEqual(["motif-ring"]);
    expect(contextMap.references.map((reference: { referenceId: string }) => reference.referenceId)).toEqual(["ref-board"]);
    expect(contextMap.rubrics.map((rubric: { rubricId: string }) => rubric.rubricId)).toEqual(["rubric-consistency"]);
    expect(contextMap.attachments.map((attachment: { attachmentId: string }) => attachment.attachmentId)).toEqual(["att-node-context"]);

    const contextText = runDna(["--db", db, "context", "map", "--id", "ctx-worldview"]);
    expect(contextText).toContain("Design Context: Worldview (ctx-worldview)");
    expect(contextText).toContain("Facts:");
    expect(contextText).toContain("fact-faction [faction]");
    expect(contextText).toContain("Attachments:");
    expect(contextText).toContain("species-node:node-faction-icon [constraint]");

    const impacts = JSON.parse(runDna(["--db", db, "impact", "check", "--graph", "graph-ui", "--context", "ctx-worldview"]));
    expect(impacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "node", objectId: "node-faction-icon" })])
    );
  }, 80_000);
});
