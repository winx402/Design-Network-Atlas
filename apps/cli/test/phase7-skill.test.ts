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
  test("root dna skill routes users to workflow skills instead of duplicating CLI help", () => {
    const content = readSkill("dna");

    expectFrontmatter(content, "dna");
    expect(content).toContain("dna-graph-modeling");
    expect(content).toContain("dna-graph-editing");
    expect(content).not.toContain("Preview-First Command Recipes");
    expect(content).not.toMatch(/```bash[\s\S]*dna --db/);
  });

  test("graph modeling skill maps a new user scenario into DNA graph concepts and write strategy", () => {
    const content = readSkill("dna-graph-modeling");

    expectFrontmatter(content, "dna-graph-modeling");
    expect(content).toContain("SpeciesNode");
    expect(content).toContain("EvolutionEdge");
    expect(content).toContain("facets");
    expect(content).toContain("Phenotype");
    expect(content).toContain("phenotype library");
    expect(content).toContain("preview-confirm");
    expect(content).toContain("change-set review");
    expect(content).toContain("proposal");
    expect(content).toContain("直接生效");
    expect(content).toContain("待确认问题");
    expect(content).not.toMatch(/```bash[\s\S]*dna --db/);
    expect(content).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+/i);
    expect(content).not.toMatch(/OPENAI_API_KEY|sk-[a-zA-Z0-9_-]{8,}|password\s*=/i);
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
    expect(content).not.toMatch(/```bash[\s\S]*dna --db/);
    expect(content).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+/i);
    expect(content).not.toMatch(/OPENAI_API_KEY|sk-[a-zA-Z0-9_-]{8,}|password\s*=/i);
  });
});
