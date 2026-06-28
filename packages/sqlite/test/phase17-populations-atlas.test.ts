import { mkdirSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultFacetAssignment,
  createDefaultFacetDefinition,
  createDefaultFacetSchema,
  createDefaultGraph,
  createDefaultSpeciesNode
} from "@dna/core";
import { createDnaServices } from "@dna/storage";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempPath(name: string) {
  return join(tmpdir(), `dna-phase17-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function tempDb(name: string) {
  const dbPath = join(tempPath(name), "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

describe("Phase 17 SQLite storage", () => {
  test("migration creates population, atlas, relationship, and facet tables", () => {
    const store = new SqliteDnaStore(tempDb("tables"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    for (const table of [
      "facet_definitions",
      "facet_schemas",
      "facet_assignments",
      "species_groups",
      "species_group_memberships",
      "design_relationships",
      "atlases"
    ]) {
      expect(names.has(table), table).toBe(true);
    }
    store.close();
  });

  test("persists species groups, memberships, design relationships, atlases, and facets", () => {
    const store = new SqliteDnaStore(tempDb("crud"));
    store.migrate();
    const services = createDnaServices(store);

    store.graphs.create(createDefaultGraph({ graphId: "graph-a", name: "Graph A", purpose: "group test" }));
    store.graphs.create(createDefaultGraph({ graphId: "graph-b", name: "Graph B", purpose: "relationship test" }));
    store.nodes.create(createDefaultSpeciesNode({ graphId: "graph-a", nodeId: "node-root", name: "Root" }));

    store.facetDefinitions.create(createDefaultFacetDefinition({ facetId: "facet-density", name: "Density" }));
    store.facetSchemas.create(
      createDefaultFacetSchema({
        facetSchemaId: "facet-schema-ui",
        name: "UI Facets",
        facetIds: ["facet-density"],
        requiredFacetIds: ["facet-density"]
      })
    );
    store.facetAssignments.create(
      createDefaultFacetAssignment({
        assignmentId: "facet-assignment-group-ui",
        targetType: "species-group",
        targetId: "group-ui",
        values: { "facet-density": "high" }
      })
    );

    const preview = services.group.createGroup(
      {
        graphId: "graph-a",
        groupId: "group-ui",
        name: "UI Group",
        sharedFacts: ["high contrast"],
        facetSchemaIds: ["facet-schema-ui"],
        phenotypeTypeSuggestions: ["ui-icon"]
      },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(store.speciesGroups.get("group-ui")).toBeUndefined();

    services.group.createGroup(
      {
        graphId: "graph-a",
        groupId: "group-ui",
        name: "UI Group",
        sharedFacts: ["high contrast"],
        facetSchemaIds: ["facet-schema-ui"],
        phenotypeTypeSuggestions: ["ui-icon"]
      },
      { mode: "preview-confirm", apply: true }
    );
    services.group.createGroup(
      { graphId: "graph-a", groupId: "group-icons", name: "Icon Family", groupType: "family" },
      { mode: "preview-confirm", apply: true }
    );
    services.group.addMember(
      { membershipId: "member-root-ui", graphId: "graph-a", groupId: "group-ui", nodeId: "node-root", role: "primary" },
      { mode: "preview-confirm", apply: true }
    );
    services.relationship.createRelationship(
      {
        relationshipId: "rel-ui-icons",
        source: { type: "species-group", graphId: "graph-a", groupId: "group-ui" },
        target: { type: "species-group", graphId: "graph-a", groupId: "group-icons" },
        relationshipType: "aligns-with",
        description: "Icons align with UI readability.",
        metadata: { scope: "toolbar" }
      },
      { mode: "preview-confirm", apply: true }
    );

    expect(() =>
      services.relationship.createRelationship(
        {
          relationshipId: "rel-ui-icons-extra",
          source: { type: "species-group", graphId: "graph-a", groupId: "group-ui" },
          target: { type: "species-group", graphId: "graph-a", groupId: "group-icons" },
          relationshipType: "references"
        },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow(/parallel design relationship/);

    services.relationship.createRelationship(
      {
        relationshipId: "rel-ui-icons-custom",
        source: { type: "species-group", graphId: "graph-a", groupId: "group-ui" },
        target: { type: "species-group", graphId: "graph-a", groupId: "group-icons" },
        relationshipType: "custom:screen-density",
        allowParallel: true
      },
      { mode: "preview-confirm", apply: true }
    );

    services.atlas.createAtlas(
      { atlasId: "atlas-a", name: "Atlas A", purpose: "multi graph", graphIds: ["graph-a", "graph-b"] },
      { mode: "preview-confirm", apply: true }
    );
    services.relationship.createRelationship(
      {
        relationshipId: "rel-a-b",
        source: { type: "graph", graphId: "graph-a" },
        target: { type: "graph", graphId: "graph-b" },
        relationshipType: "aligns-with",
        description: "Keep graph B aligned with graph A.",
        metadata: { atlasId: "atlas-a" }
      },
      { mode: "preview-confirm", apply: true }
    );

    expect(store.speciesGroups.listByGraph("graph-a").map((group) => group.groupId)).toEqual(["group-ui", "group-icons"]);
    expect(store.speciesGroupMemberships.listByGroup("group-ui").map((membership) => membership.nodeId)).toEqual(["node-root"]);
    expect(store.designRelationships.listByGraph("graph-a").map((relationship) => relationship.relationshipId)).toEqual([
      "rel-ui-icons",
      "rel-ui-icons-custom",
      "rel-a-b"
    ]);
    expect(store.atlases.get("atlas-a")?.graphIds).toEqual(["graph-a", "graph-b"]);
    expect(store.facetAssignments.listByTarget("species-group", "group-ui")).toHaveLength(1);
    store.close();
  });

  test("exports and imports objects through the Git directory format", () => {
    const source = new SqliteDnaStore(tempDb("source"));
    source.migrate();
    const services = createDnaServices(source);

    source.graphs.create(createDefaultGraph({ graphId: "graph-export-a", name: "Export A", purpose: "roundtrip" }));
    source.graphs.create(createDefaultGraph({ graphId: "graph-export-b", name: "Export B", purpose: "roundtrip" }));
    source.nodes.create(createDefaultSpeciesNode({ graphId: "graph-export-a", nodeId: "node-export", name: "Export Node" }));
    source.facetDefinitions.create(createDefaultFacetDefinition({ facetId: "facet-export", name: "Export Facet" }));
    source.facetSchemas.create(createDefaultFacetSchema({ facetSchemaId: "facet-schema-export", name: "Export Schema", facetIds: ["facet-export"] }));
    services.group.createGroup(
      { graphId: "graph-export-a", groupId: "group-export", name: "Export Group", facetSchemaIds: ["facet-schema-export"] },
      { mode: "preview-confirm", apply: true }
    );
    services.group.addMember(
      { membershipId: "member-export", graphId: "graph-export-a", groupId: "group-export", nodeId: "node-export", role: "primary" },
      { mode: "preview-confirm", apply: true }
    );
    services.atlas.createAtlas(
      { atlasId: "atlas-export", name: "Export Atlas", purpose: "roundtrip", graphIds: ["graph-export-a", "graph-export-b"] },
      { mode: "preview-confirm", apply: true }
    );
    source.facetAssignments.create(
      createDefaultFacetAssignment({
        assignmentId: "facet-assignment-atlas-export",
        targetType: "atlas",
        targetId: "atlas-export",
        values: { "facet-export": "atlas-level" }
      })
    );
    services.relationship.createRelationship(
      {
        relationshipId: "rel-export",
        source: { type: "graph", graphId: "graph-export-a" },
        target: { type: "graph", graphId: "graph-export-b" },
        relationshipType: "references"
      },
      { mode: "preview-confirm", apply: true }
    );

    const outDir = tempPath("export-dir");
    exportProject(source, outDir);
    expect(existsSync(join(outDir, "relationships", "rel-export.json"))).toBe(true);

    const target = new SqliteDnaStore(tempDb("target"));
    target.migrate();
    importProject(target, outDir);

    expect(target.facetDefinitions.get("facet-export")?.name).toBe("Export Facet");
    expect(target.speciesGroups.get("group-export")?.facetSchemaIds).toEqual(["facet-schema-export"]);
    expect(target.speciesGroupMemberships.listByGroup("group-export")).toHaveLength(1);
    expect(target.atlases.get("atlas-export")?.graphIds).toEqual(["graph-export-a", "graph-export-b"]);
    expect(target.facetAssignments.listByTarget("atlas", "atlas-export")).toHaveLength(1);
    expect(target.designRelationships.get("rel-export")?.relationshipType).toBe("references");

    source.close();
    target.close();
    rmSync(outDir, { recursive: true, force: true });
  });
});
