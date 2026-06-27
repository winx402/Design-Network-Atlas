import {
  CURRENT_DNA_CAPABILITIES,
  CURRENT_DNA_SCHEMA_COMPATIBILITY,
  GeneTemplateSchema,
  TemplatePackSchema,
  validateTemplateCompatibility
} from "@dna/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const now = "2026-06-27T00:00:00.000Z";
const root = resolve(__dirname, "../../..");

describe("Phase 21 PRD-12 template compatibility semantics", () => {
  test("template pack and gene template versions are distinct from DNA schema compatibility", () => {
    const pack = TemplatePackSchema.parse({
      templatePackId: "pack-compatible",
      name: "Compatible Pack",
      version: "0.1.0",
      domain: "ui-icon",
      status: "active",
      description: "pack content version",
      compatibility: { dnaSchema: CURRENT_DNA_SCHEMA_COMPATIBILITY, capabilities: ["facets"] },
      facets: {},
      createdAt: now,
      updatedAt: now
    });
    const template = GeneTemplateSchema.parse({
      templateId: "template-compatible",
      templatePackId: pack.templatePackId,
      version: "0.2.0",
      domain: "ui-icon",
      scope: "node",
      extends: [],
      requiredDimensions: ["visual_motif"],
      recommendedDimensions: [],
      optionalDimensions: [],
      forbiddenDimensions: [],
      dimensionSchema: { visual_motif: "motif" },
      propertyResolution: {},
      reviewQuestions: [],
      phenotypeTypeSuggestions: ["image-prompt"],
      compatibility: { dnaSchema: CURRENT_DNA_SCHEMA_COMPATIBILITY, capabilities: ["facets", "phenotype-generation"] },
      status: "active",
      facets: {},
      createdAt: now,
      updatedAt: now
    });

    expect(pack.version).toBe("0.1.0");
    expect(template.version).toBe("0.2.0");
    expect(template.compatibility).not.toHaveProperty("dna");
    expect(validateTemplateCompatibility(template).compatible).toBe(true);
  });

  test("compatibility validation rejects unsupported schema and missing capabilities", () => {
    const unsupported = {
      compatibility: { dnaSchema: "999.x", capabilities: ["facets", "unknown-capability"] }
    };

    const result = validateTemplateCompatibility(unsupported);

    expect(result.compatible).toBe(false);
    expect(result.unsupportedDnaSchema).toBe("999.x");
    expect(result.missingCapabilities).toEqual(["unknown-capability"]);
    expect(CURRENT_DNA_CAPABILITIES).toContain("compile-artifacts");
  });

  test("legacy compatibility.dna is readable but reported as legacy", () => {
    const result = validateTemplateCompatibility({ compatibility: { dna: "0.1.x" } });

    expect(result.compatible).toBe(true);
    expect(result.legacyDnaCompatibility).toBe("0.1.x");
    expect(result.warnings).toContain("legacy compatibility.dna is accepted for reading; write dnaSchema/capabilities instead");
  });

  test("public docs describe template compatibility as schema and capabilities", () => {
    for (const path of ["README.md", "docs/design/system-architecture.md", "docs/design/concept-registry.md"]) {
      const content = readFileSync(resolve(root, path), "utf8");
      expect(content).toContain("TemplatePack.version");
      expect(content).toContain("GeneTemplate.version");
      expect(content).toContain("compatibility.dnaSchema");
      expect(content).toContain("compatibility.capabilities");
      expect(content).toContain("root project version");
    }
  });
});
