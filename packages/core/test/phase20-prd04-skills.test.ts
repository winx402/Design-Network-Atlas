import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "../../..");

function skill(name: string): string {
  return readFileSync(resolve(root, "codex-skills", name, "SKILL.md"), "utf8");
}

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("Phase 20 PRD-04 skill contracts", () => {
  test("graph modeling skill covers scenario mapping gates and reviewable write outputs", () => {
    const source = skill("dna-graph-modeling");
    for (const phrase of [
      "Scenario Lens",
      "Domain Split",
      "Group Organization",
      "Phenotype Readiness",
      "Relationship Semantics",
      "Review Shape",
      "First Slice Strategy",
      "Write Strategy",
      "Case Patterns",
      "domain-boundary gate",
      "group gate",
      "relationship gate",
      "relationship contract gate",
      "context gate",
      "facet gate",
      "compile gate",
      "clarity gate",
      "execution gate",
      "assumptions",
      "blockingQuestions",
      "nonBlockingQuestions",
      "draftFields",
      "confidence",
      "SpeciesCompileArtifact",
      "PhenotypeCompileArtifact",
      "reviewOutline",
      "firstSliceStrategy",
      "source evidence",
      "planned phenotype coverage",
      "phenotypePlans",
      "modeling quality checks",
      "drawable visual signal",
      "negative boundary",
      "abstract system downgrade",
      "visual language",
      "page framework",
      "storage directory",
      "fake inheritance",
      "game UI / icon system",
      "character / weapon",
      "monster / ecology",
      "VFX / signal / audio",
      "brand / product visual family",
      "storage-heavy scenario"
    ]) {
      expect(source).toContain(phrase);
    }
    expect(count(source, "dna --help")).toBeLessThanOrEqual(1);
    expect(source).not.toContain("Usage:");
    expect(source).not.toMatch(/```(?:bash|sh|shell|sql)[\s\S]*```/i);
    expect(source).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+|direct SQLite/i);
    expect(source).not.toMatch(/OPENAI_API_KEY\s*=|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|password\s*=|Bearer\s+[A-Za-z0-9._-]+/i);
  });

  test("graph editing skill grades impact scope across graph, context, compile, and routing changes", () => {
    const source = skill("dna-graph-editing");
    for (const phrase of [
      "single-node",
      "single-group",
      "multi-group",
      "cross-graph",
      "context",
      "compile-policy",
      "storage-routing",
      "Shared Design Invariants",
      "phenotype readiness",
      "abstraction downgrade",
      "inheritance safety",
      "storage decoupling",
      "impact analysis",
      "editInvariantCheck",
      "compile artifact",
      "ContextReference",
      "ContextReviewRubric",
      "PhenotypeVersion outdated",
      "blockingQuestions"
    ]) {
      expect(source).toContain(phrase);
    }
    expect(count(source, "dna --help")).toBeLessThanOrEqual(1);
    expect(source).not.toContain("Usage:");
    expect(source).not.toMatch(/```(?:bash|sh|shell|sql)[\s\S]*```/i);
    expect(source).not.toMatch(/\bsqlite3\b|better-sqlite3|INSERT INTO|UPDATE\s+\w+|direct SQLite/i);
    expect(source).not.toMatch(/OPENAI_API_KEY\s*=|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|password\s*=|Bearer\s+[A-Za-z0-9._-]+/i);
  });

  test("phenotype generation skill orchestrates existing graph outputs without inventing source facts", () => {
    const skillPath = resolve(root, "codex-skills/dna-phenotype-generation/SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
    const source = readFileSync(skillPath, "utf8");
    for (const phrase of [
      "name: dna-phenotype-generation",
      "SpeciesCompileArtifact",
      "PhenotypeCompileArtifact",
      "GenerationJob",
      "PhenotypeVersion",
      "OutputReference",
      "PhenotypeLibrary",
      "PhenotypeGenerationPlan",
      "PhenotypeGenerationTask",
      "formal MVP scenario skill",
      "planning gate",
      "planningMode",
      "planOrTaskProposal",
      "latest-at-execution",
      "versionBinding",
      "historical replay",
      "llmInstructions",
      "operatorNotes",
      "metadata",
      "extensions",
      "missing compile artifact",
      "blocking question",
      "blocking open questions",
      "generationPlan",
      "registrationPlan",
      "writeStrategy",
      "Agent host",
      "manual",
      "mock",
      "external tool",
      "candidate",
      "do not invent",
      "provider credentials"
    ]) {
      expect(source).toContain(phrase);
    }
    expect(count(source, "dna --help")).toBeLessThanOrEqual(1);
    expect(source).not.toContain("Usage:");
  });
});
