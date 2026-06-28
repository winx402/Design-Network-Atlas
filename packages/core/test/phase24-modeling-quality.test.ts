import { describe, expect, test } from "vitest";
import { checkModelingBatchQuality, ModelingBatchSchema } from "../src/index.js";

describe("Phase 24 modeling quality checks", () => {
  test("flags phenotype readiness, fake output species, weak relationships, and graph split pressure", () => {
    const batch = ModelingBatchSchema.parse({
      format: "dna.modeling-batch.v1",
      graphs: [{ graphId: "graph-overloaded", name: "Overloaded Graph", purpose: "everything in one graph" }],
      speciesNodes: [
        { graphId: "graph-overloaded", nodeId: "species-monster", name: "Monster Actor", category: "monster", level: "species" },
        { graphId: "graph-overloaded", nodeId: "species-ui", name: "Inventory Panel", category: "ui", level: "system" },
        { graphId: "graph-overloaded", nodeId: "species-vfx", name: "Poison VFX Frame 01", category: "vfx", level: "variant" },
        { graphId: "graph-overloaded", nodeId: "species-rule", name: "Damage Formula Rule System", category: "rule-system", level: "system" }
      ],
      designRelationships: [
        {
          relationshipId: "rel-process",
          source: { type: "species-node", graphId: "graph-overloaded", nodeId: "species-monster" },
          target: { type: "species-node", graphId: "graph-overloaded", nodeId: "species-ui" },
          relationshipType: "depends-on",
          description: "product workflow depends on UI route"
        }
      ]
    });

    const report = checkModelingBatchQuality(batch);
    expect(report.status).toBe("needs-review");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "species-node", objectId: "species-monster", severity: "warning" }),
        expect.objectContaining({ objectType: "species-node", objectId: "species-vfx", severity: "blocking" }),
        expect.objectContaining({ objectType: "design-relationship", objectId: "rel-process", severity: "warning" }),
        expect.objectContaining({ objectType: "graph", objectId: "graph-overloaded", path: "graphSplit", severity: "warning" })
      ])
    );
    expect(report.issues.map((issue) => issue.reason).join("\n")).toContain("planned phenotype");
    expect(report.issues.map((issue) => issue.reason).join("\n")).toContain("fake species");
  });

  test("uses planned phenotypes as coverage and blocks duplicate node/type plans", () => {
    const batch = ModelingBatchSchema.parse({
      format: "dna.modeling-batch.v1",
      graphs: [{ graphId: "graph-character", name: "Character Graph", purpose: "character outputs" }],
      speciesNodes: [{ graphId: "graph-character", nodeId: "species-warden", name: "Forest Warden", category: "character", level: "species" }],
      phenotypePlans: [
        {
          phenotypeId: "phenotype-warden-portrait-a",
          graphId: "graph-character",
          nodeId: "species-warden",
          phenotypeType: "portrait",
          name: "Forest Warden Portrait A",
          expectedAssetTypes: ["image"]
        },
        {
          phenotypeId: "phenotype-warden-portrait-b",
          graphId: "graph-character",
          nodeId: "species-warden",
          phenotypeType: "portrait",
          name: "Forest Warden Portrait B",
          objectBrief: "Second duplicate portrait.",
          expectedAssetTypes: ["image"]
        }
      ]
    });

    const report = checkModelingBatchQuality(batch);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "phenotype", objectId: "phenotype-warden-portrait-a", path: "objectBrief", severity: "warning" }),
        expect.objectContaining({ objectType: "phenotype", objectId: "phenotype-warden-portrait-b", path: "phenotypeType", severity: "blocking" })
      ])
    );
    expect(report.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "species-node", objectId: "species-warden", path: "phenotypeReadiness" })])
    );
  });
});
