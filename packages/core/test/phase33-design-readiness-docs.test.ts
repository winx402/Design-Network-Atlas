import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readWorkspace(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 33 PRD-23 design readiness docs and skill contracts", () => {
  test("public docs describe readiness scoring, policy, artifact storage, and self-optimization preview boundaries", () => {
    const readme = readWorkspace("README.md");
    const architecture = readWorkspace("docs/design/system-architecture.md");
    const testing = readWorkspace("docs/testing/test-strategy.md");

    for (const document of [readme, architecture, testing]) {
      expect(document).toContain("Design Readiness");
      expect(document).toContain("off | warn | block");
      expect(document).toContain("Self-Optimization");
      expect(document).toContain("proposal/change-set preview");
    }
    expect(architecture).toContain("readiness is embedded in CompileFrame");
    expect(readme).toContain("readiness assess");
    expect(testing).toContain("secret-like feedback");
  });

  test("skills require local readiness checks without provider credentials or direct writes", () => {
    const modeling = readWorkspace("codex-skills/dna-graph-modeling/SKILL.md");
    const editing = readWorkspace("codex-skills/dna-graph-editing/SKILL.md");
    const generation = readWorkspace("codex-skills/dna-phenotype-generation/SKILL.md");

    expect(modeling).toContain("Design Readiness");
    expect(modeling).toContain("self-optimization candidate");
    expect(editing).toContain("readiness score change");
    expect(editing).toContain("local readiness refresh");
    expect(generation).toContain("readinessPolicy");
    expect(generation).toContain("warn/block");
    for (const skill of [modeling, editing, generation]) {
      expect(skill).not.toMatch(/```(?:bash|sh|shell|sql)[\s\S]*```/i);
      expect(skill).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+|direct SQLite/i);
      expect(skill).not.toMatch(/OPENAI_API_KEY|sk-(?:proj-|[A-Za-z0-9_-]{12,})|Bearer\s+[A-Za-z0-9._-]+|private_key/i);
    }
  });
});
