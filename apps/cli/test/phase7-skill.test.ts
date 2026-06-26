import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const skillPath = join(projectRoot, "codex-skills", "dna", "SKILL.md");

function dnaCommandLines() {
  return readFileSync(skillPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("dna "));
}

function expectPreviewAndApplyPair(commandToken: string) {
  const lines = dnaCommandLines().filter((line) => line.includes(commandToken));
  const previewIndex = lines.findIndex((line) => !line.includes("--yes"));
  const applyIndex = lines.findIndex((line) => line.includes("--yes"));

  expect(previewIndex, `${commandToken} should include a preview command`).toBeGreaterThanOrEqual(0);
  expect(applyIndex, `${commandToken} should include an apply command`).toBeGreaterThanOrEqual(0);
  expect(previewIndex, `${commandToken} preview should be shown before apply`).toBeLessThan(applyIndex);
}

describe("Phase 7 Codex skill command recipes", () => {
  test("skill documents preview-first CLI recipes for graph, lineage, phenotype, review, impact, and import", () => {
    expectPreviewAndApplyPair("graph create");
    expectPreviewAndApplyPair("node create");
    expectPreviewAndApplyPair("edge create");
    expectPreviewAndApplyPair("phenotype generate");
    expectPreviewAndApplyPair("review phenotype");
    expectPreviewAndApplyPair("impact check");
    expectPreviewAndApplyPair("import");
  });

  test("skill keeps writes behind the CLI and excludes secret material", () => {
    const content = readFileSync(skillPath, "utf8");

    expect(content).toContain("Treat the CLI as the write boundary");
    expect(content).toContain("Re-run with `--yes` only after the user accepts the preview");
    expect(content).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+/i);
    expect(content).not.toMatch(/OPENAI_API_KEY|sk-[a-zA-Z0-9_-]{8,}|password\s*=/i);
  });
});
