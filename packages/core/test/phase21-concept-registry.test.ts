import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "../../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 21 PRD-07 concept registry", () => {
  test("public docs expose the canonical DNA concept registry", () => {
    const registryPath = resolve(root, "docs/design/concept-registry.md");
    expect(existsSync(registryPath)).toBe(true);

    const registry = readFileSync(registryPath, "utf8");

    for (const heading of ["Owner", "Purpose", "Lifecycle", "Write entrypoint", "Export path", "Related concepts"]) {
      expect(registry).toContain(heading);
    }

    for (const boundary of [
      "SpeciesNode.motifs",
      "ContextMotif",
      "AssetIndex",
      "OutputReference",
      "PhenotypeLibrary.graphIds",
      "PhenotypeLibraryGraphBinding",
      "DesignRelationship",
      "same-level core entities",
      "GenerationJob",
      "PhenotypeVersion.generationRecipe",
      "ReviewRecord",
      "ContextReviewRubric",
      "FacetDefinition",
      "GeneTemplate.dimensionSchema",
      "SpeciesNode.constraints"
    ]) {
      expect(registry).toContain(boundary);
    }

    expect(registry).toContain("packages/core");
    expect(registry).toContain("durable design facts");
    expect(registry).toContain("compiled views");
    expect(registry).toContain("runtime jobs");
    expect(registry).toContain("external pointers");
  });

  test("entrypoint docs and skills link to the registry", () => {
    for (const path of [
      "README.md",
      "docs/index.md",
      "docs/design/system-architecture.md",
      "codex-skills/dna-graph-modeling/SKILL.md",
      "codex-skills/dna-graph-editing/SKILL.md",
      "codex-skills/dna-phenotype-generation/SKILL.md"
    ]) {
      expect(readProjectFile(path)).toContain("docs/design/concept-registry.md");
    }
  });
});
