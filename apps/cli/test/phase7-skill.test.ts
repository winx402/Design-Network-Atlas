import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const skillRoot = join(projectRoot, "codex-skills");

function readSkill(skillName: string) {
  const skillPath = join(skillRoot, skillName, "SKILL.md");
  expect(existsSync(skillPath), `${skillName} should exist`).toBe(true);
  return readFileSync(skillPath, "utf8");
}

function expectFrontmatter(content: string, skillName: string) {
  expect(content).toContain(`name: ${skillName}`);
  expect(content).toMatch(/^---\n[\s\S]*description: .+\n---/);
}

describe("Phase 7 Codex scenario skills", () => {
  test("does not keep a shallow root dna skill for CLI help or routing", () => {
    expect(existsSync(join(skillRoot, "dna", "SKILL.md"))).toBe(false);
  });

  test("graph modeling skill maps a new user scenario into DNA graph concepts and write strategy", () => {
    const content = readSkill("dna-graph-modeling");

    expectFrontmatter(content, "dna-graph-modeling");
    expect(content).toContain("SpeciesNode");
    expect(content).toContain("DesignRelationship");
    expect(content).toContain("facets");
    expect(content).toContain("Phenotype");
    expect(content).toContain("phenotype library");
    expect(content).toContain("preview-confirm");
    expect(content).toContain("change-set review");
    expect(content).toContain("proposal");
    expect(content).toContain("直接生效");
    expect(content).toContain("待确认问题");
    expect(content).toContain("Decision Gates");
    expect(content).toContain("Classification Matrix");
    for (const heading of [
      "## Scenario Lens",
      "## Domain Split",
      "## Group Organization",
      "## Phenotype Readiness",
      "## Relationship Semantics",
      "## Review Shape",
      "## First Slice Strategy",
      "## Write Strategy",
      "## Case Patterns"
    ]) {
      expect(content).toContain(heading);
    }
    for (const phrase of [
      "Module question:",
      "Evidence to inspect:",
      "Decision boundary:",
      "Positive pattern:",
      "Counterexample:",
      "Output contribution:"
    ]) {
      expect(content).toContain(phrase);
    }
    expect(content).toContain("Can an artist or generator start drawing this object immediately?");
    expect(content).toContain("expected first phenotype type");
    expect(content).toContain("planned phenotype coverage");
    expect(content).toContain("phenotypePlans");
    expect(content).toContain("modeling quality checks");
    expect(content).toContain("abstract system downgrade");
    expect(content).toContain("fake inheritance");
    expect(content).toContain("reviewOutline");
    expect(content).toContain("firstSliceStrategy");
    expect(content).toContain("game UI / icon system");
    expect(content).toContain("storage-heavy scenario");
    expect(content).toContain("Quality Bar");
    expect(content).toContain("Use `dna --help`");
    expect(content).not.toMatch(/```bash[\s\S]*dna --db/);
    expect(content).not.toMatch(/```(?:bash|sh|shell|sql)[\s\S]*```/i);
    expect(content).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+|direct SQLite/i);
    expect(content).not.toMatch(/OPENAI_API_KEY\s*=|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|password\s*=|Bearer\s+[A-Za-z0-9._-]+/i);
  });

  test("graph editing skill evaluates existing graph changes with impact and risk guidance", () => {
    const content = readSkill("dna-graph-editing");

    expectFrontmatter(content, "dna-graph-editing");
    expect(content).toContain("当前图谱");
    expect(content).toContain("合理性");
    expect(content).toContain("影响分析");
    expect(content).toContain("风险等级");
    expect(content).toContain("outdated");
    expect(content).toContain("change-set review");
    expect(content).toContain("proposal");
    expect(content).toContain("impact check");
    expect(content).toContain("替代方案");
    expect(content).toContain("Decision Gates");
    expect(content).toContain("Edit Classification Matrix");
    expect(content).toContain("Shared Design Invariants");
    expect(content).toContain("phenotype readiness");
    expect(content).toContain("abstraction downgrade");
    expect(content).toContain("inheritance safety");
    expect(content).toContain("storage decoupling");
    expect(content).toContain("impact analysis");
    expect(content).toContain("editInvariantCheck");
    expect(content).toContain("Quality Bar");
    expect(content).toContain("Use `dna --help`");
    expect(content).not.toMatch(/```bash[\s\S]*dna --db/);
    expect(content).not.toMatch(/```(?:bash|sh|shell|sql)[\s\S]*```/i);
    expect(content).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+|direct SQLite/i);
    expect(content).not.toMatch(/OPENAI_API_KEY\s*=|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|password\s*=|Bearer\s+[A-Za-z0-9._-]+/i);
  });

  test("phenotype generation skill covers generation planning without becoming CLI help", () => {
    const content = readSkill("dna-phenotype-generation");

    expectFrontmatter(content, "dna-phenotype-generation");
    for (const phrase of [
      "PhenotypeGenerationPlan",
      "PhenotypeGenerationTask",
      "planning gate",
      "planningMode",
      "planOrTaskProposal",
      "latest-at-execution",
      "versionBinding",
      "historical replay",
      "llmInstructions",
      "operatorNotes",
      "GenerationJob.inputSnapshot",
      "provider credentials"
    ]) {
      expect(content).toContain(phrase);
    }
    expect(content).not.toMatch(/```(?:bash|sh|shell|sql)[\s\S]*```/i);
    expect(content).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+|direct SQLite/i);
    expect(content).not.toMatch(/OPENAI_API_KEY\s*=|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|password\s*=|Bearer\s+[A-Za-z0-9._-]+/i);
  });
});
