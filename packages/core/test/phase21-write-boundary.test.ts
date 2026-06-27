import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "../../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 21 PRD-06 write-boundary matrix", () => {
  test("public docs define object-level write boundaries", () => {
    const matrixPath = resolve(root, "docs/design/write-boundary-matrix.md");
    expect(existsSync(matrixPath)).toBe(true);

    const matrix = readFileSync(matrixPath, "utf8");

    for (const phrase of [
      "Formal graph facts",
      "Formal design context facts",
      "Facet taxonomy and assignments",
      "Generated trace artifacts",
      "Generated outputs",
      "External pointers",
      "Governance records",
      "Templates and capability config",
      "preview/change-set",
      "draft-write",
      "direct audit write",
      "changeset-apply"
    ]) {
      expect(matrix).toContain(phrase);
    }

    expect(matrix).toContain("Web remains read-only");
    expect(matrix).toContain("docs/design/concept-registry.md");
  });

  test("entrypoint docs and scenario skills link to the write matrix vocabulary", () => {
    for (const path of [
      "README.md",
      "docs/index.md",
      "docs/design/system-architecture.md",
      "codex-skills/dna-graph-modeling/SKILL.md",
      "codex-skills/dna-graph-editing/SKILL.md",
      "codex-skills/dna-phenotype-generation/SKILL.md"
    ]) {
      const content = readProjectFile(path);
      expect(content).toContain("docs/design/write-boundary-matrix.md");
      expect(content).toContain("direct audit write");
    }
  });
});
