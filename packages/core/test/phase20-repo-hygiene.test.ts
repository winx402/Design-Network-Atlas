import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "../../..");

describe("Phase 20 PRD-04 public repo hygiene", () => {
  test("public test scripts fail instead of passing empty critical suites", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.test).not.toContain("--passWithNoTests");
    expect(packageJson.scripts.e2e).not.toContain("--passWithNoTests");
    expect(packageJson.scripts["security:test"]).not.toContain("--passWithNoTests");
  });

  test("public ignore rules do not hide docs or test assets", () => {
    const ignore = readFileSync(resolve(root, ".gitignore"), "utf8");

    expect(ignore).not.toMatch(/^docs\/$/m);
    expect(ignore).not.toMatch(/^\*\*\/test\/$/m);
    expect(ignore).not.toMatch(/^\*\*\/\*\.test\.ts$/m);
    expect(ignore).not.toMatch(/^\*\*\/\*\.spec\.ts$/m);
  });

  test("README exposes the skill boundary without stale version wording", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toContain("codex-skills/dna-phenotype-generation");
    expect(readme).toContain("Skills are scenario workflows");
    expect(readme).toContain("Skill 是复杂场景工作流");
    expect(readme).not.toContain("v0.6.1");
  });
});
