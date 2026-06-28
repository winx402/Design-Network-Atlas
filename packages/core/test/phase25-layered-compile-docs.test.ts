import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readWorkspace(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 25 PRD-16 layered compile docs and skills", () => {
  test("public docs describe layered compile frames, entity artifacts, dependency vectors, and historical replay", () => {
    const conceptRegistry = readWorkspace("docs/design/concept-registry.md");
    const architecture = readWorkspace("docs/design/system-architecture.md");
    const writeBoundary = readWorkspace("docs/design/write-boundary-matrix.md");
    const readme = readWorkspace("README.md");

    for (const document of [conceptRegistry, architecture, writeBoundary, readme]) {
      expect(document).toContain("layered");
      expect(document).toContain("dependency");
    }
    expect(conceptRegistry).toContain("CompileFrame");
    expect(conceptRegistry).toContain("EntityCompileArtifact");
    expect(architecture).toContain("atlas -> graph -> species-group -> species-node -> phenotype");
    expect(writeBoundary).toContain("compile never mutates graph");
    expect(readme).toContain("historical replay");
  });

  test("skills require layered artifact review without provider credentials or direct storage writes", () => {
    const modeling = readWorkspace("codex-skills/dna-graph-modeling/SKILL.md");
    const editing = readWorkspace("codex-skills/dna-graph-editing/SKILL.md");
    const generation = readWorkspace("codex-skills/dna-phenotype-generation/SKILL.md");

    expect(modeling).toContain("CompileFrame");
    expect(modeling).toContain("replayable decision patches");
    expect(editing).toContain("dependency-vector staleness");
    expect(generation).toContain("frame order");
    expect(generation).toContain("historical replay");

    for (const skill of [modeling, editing, generation]) {
      expect(skill).not.toMatch(/```bash/);
      expect(skill).not.toMatch(/\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i);
      expect(skill).not.toMatch(/OPENAI_API_KEY|sk-(?:proj-|[A-Za-z0-9_-]{12,})|Bearer\s+[A-Za-z0-9._-]+|private_key/i);
    }
  });
});
