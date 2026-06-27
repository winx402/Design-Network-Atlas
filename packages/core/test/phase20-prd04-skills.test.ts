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
      "domain-boundary gate",
      "group gate",
      "bridge gate",
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
      "PhenotypeCompileArtifact"
    ]) {
      expect(source).toContain(phrase);
    }
    expect(count(source, "dna --help")).toBeLessThanOrEqual(1);
    expect(source).not.toContain("Usage:");
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
      "formal MVP scenario skill",
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
      "pending-confirmation",
      "do not invent",
      "provider credentials"
    ]) {
      expect(source).toContain(phrase);
    }
    expect(count(source, "dna --help")).toBeLessThanOrEqual(1);
    expect(source).not.toContain("Usage:");
  });
});
