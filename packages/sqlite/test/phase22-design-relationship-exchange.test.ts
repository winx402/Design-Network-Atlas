import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import * as core from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Phase 22 PRD-14 SQLite design relationship exchange", () => {
  test("persists and round-trips unified design relationships for graph, group, and species levels", () => {
    const dir = tempDir("design-relationship-exchange");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();

    source.graphs.create(core.createDefaultGraph({ graphId: "graph-style", name: "Style Graph", purpose: "style language" }));
    source.graphs.create(core.createDefaultGraph({ graphId: "graph-ui", name: "UI Graph", purpose: "ui language" }));
    source.speciesGroups.create(core.createDefaultSpeciesGroup({ graphId: "graph-ui", groupId: "group-icons", name: "Icons" }));
    source.speciesGroups.create(core.createDefaultSpeciesGroup({ graphId: "graph-ui", groupId: "group-hud", name: "HUD" }));
    source.nodes.create(core.createDefaultSpeciesNode({ graphId: "graph-ui", nodeId: "node-root", name: "Root Icon" }));
    source.nodes.create(core.createDefaultSpeciesNode({ graphId: "graph-ui", nodeId: "node-alert", name: "Alert Icon" }));

    const relationships = [
      (core as any).createDefaultDesignRelationship({
        relationshipId: "rel-graph-style-ui",
        source: { type: "graph", graphId: "graph-style" },
        target: { type: "graph", graphId: "graph-ui" },
        relationshipType: "aligns-with",
        direction: "bidirectional",
        description: "UI graph aligns with the style graph.",
        designContract: {
          transferRule: "Translate shared motifs into small-state readability.",
          mustPreserve: ["crescent silhouette"],
          mustAvoid: ["low contrast"]
        }
      }),
      (core as any).createDefaultDesignRelationship({
        relationshipId: "rel-group-icons-hud",
        source: { type: "species-group", graphId: "graph-ui", groupId: "group-icons" },
        target: { type: "species-group", graphId: "graph-ui", groupId: "group-hud" },
        relationshipType: "translates-to",
        description: "Icon rules translate to HUD markers."
      }),
      (core as any).createDefaultDesignRelationship({
        relationshipId: "rel-node-root-alert",
        source: { type: "species-node", graphId: "graph-ui", nodeId: "node-root" },
        target: { type: "species-node", graphId: "graph-ui", nodeId: "node-alert" },
        relationshipType: "derives-from",
        description: "Alert icon derives from root icon."
      })
    ];

    for (const relationship of relationships) (source as any).designRelationships.create(relationship);

    expect((source as any).designRelationships.listByGraph("graph-ui").map((relationship: any) => relationship.relationshipId)).toEqual([
      "rel-graph-style-ui",
      "rel-group-icons-hud",
      "rel-node-root-alert"
    ]);

    exportProject(source, out);
    expect(existsSync(join(out, "relationships", "rel-graph-style-ui.json"))).toBe(true);
    expect(existsSync(join(out, "graphs", "graph-ui", "edges"))).toBe(false);
    expect(existsSync(join(out, "graphs", "graph-ui", "group-relations"))).toBe(false);
    expect(existsSync(join(out, "atlases"))).toBe(false);

    const exported = readJson(join(out, "relationships", "rel-graph-style-ui.json"));
    expect(exported).toMatchObject({
      relationshipId: "rel-graph-style-ui",
      relationshipType: "aligns-with",
      designContract: {
        mustPreserve: ["crescent silhouette"],
        mustAvoid: ["low contrast"]
      }
    });

    importProject(target, out);
    expect((target as any).designRelationships.get("rel-node-root-alert")).toMatchObject({
      relationshipType: "derives-from",
      source: { type: "species-node", nodeId: "node-root" },
      target: { type: "species-node", nodeId: "node-alert" }
    });
  });
});
