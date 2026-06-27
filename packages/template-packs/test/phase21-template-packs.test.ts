import { builtInTemplates, installBuiltInTemplatePacks } from "@dna/template-packs";
import { InMemoryDnaStore } from "@dna/storage";
import { describe, expect, test } from "vitest";

describe("Phase 21 PRD-12 built-in template compatibility", () => {
  test("built-in templates use dnaSchema and capability compatibility", () => {
    for (const template of builtInTemplates) {
      expect(template.compatibility).toHaveProperty("dnaSchema");
      expect(template.compatibility).toHaveProperty("capabilities");
      expect(template.compatibility).not.toHaveProperty("dna");
    }
  });

  test("installing current built-ins reports compatible templates", () => {
    const store = new InMemoryDnaStore();

    const report = installBuiltInTemplatePacks(store);

    expect(report.installedTemplates).toEqual(["game-art-visual-asset", "ui-icon-asset"]);
    expect(report.warnings).toEqual([]);
    expect(store.templates.listTemplates()).toHaveLength(2);
  });
});
