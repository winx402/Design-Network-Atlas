import { describe, expect, test } from "vitest";
import {
  AtlasSchema,
  DesignRelationshipSchema,
  FacetAssignmentSchema,
  FacetDefinitionSchema,
  FacetSchemaSchema,
  SpeciesGroupMembershipSchema,
  SpeciesGroupSchema,
  compileSpecies,
  createDefaultDesignRelationship,
  createDefaultGraph,
  createDefaultSpeciesGroup,
  createDefaultSpeciesNode,
  validateDesignRelationshipSet
} from "@dna/core";

const now = "2026-06-27T00:00:00.000Z";

describe("Phase 17 core schemas", () => {
  test("models a species group with shared facts and referenced facet schemas", () => {
    const group = SpeciesGroupSchema.parse({
      groupId: "group-ui",
      graphId: "graph-butian",
      name: "UI Design",
      groupType: "domain",
      parentGroupIds: [],
      templateIds: ["tpl-ui-icon"],
      sharedFacts: ["shattered-jade motif", "thin bronze outline"],
      facetSchemaIds: ["facet-schema-ui"],
      phenotypeTypeSuggestions: ["ui-icon", "ui-state-sheet"],
      compilePolicy: { type: "system-rule-first", conflictResolution: "mixed" },
      reviewPolicy: { requiredDimensions: ["readability", "state"] },
      owner: "ui-art",
      status: "active",
      extensions: { workflow: "review-before-commit" },
      createdAt: now,
      updatedAt: now
    });

    expect(group.facetSchemaIds).toEqual(["facet-schema-ui"]);
    expect(group.sharedFacts).toContain("shattered-jade motif");
    expect(group).not.toHaveProperty("facets");
  });

  test("keeps facet definitions, schemas, and assignments as independent objects", () => {
    const definition = FacetDefinitionSchema.parse({
      facetId: "facet-faction",
      name: "Faction",
      description: "Narrative faction or camp",
      valueType: "string",
      allowedValues: ["heaven", "earth"],
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    const schema = FacetSchemaSchema.parse({
      facetSchemaId: "facet-schema-character",
      name: "Character Facets",
      facetIds: [definition.facetId],
      requiredFacetIds: [definition.facetId],
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    const assignment = FacetAssignmentSchema.parse({
      assignmentId: "facet-assign-node-hero",
      targetType: "species-node",
      targetId: "node-hero",
      values: { "facet-faction": "heaven" },
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    expect(schema.requiredFacetIds).toEqual(["facet-faction"]);
    expect(assignment.values).toEqual({ "facet-faction": "heaven" });
  });

  test("models group membership roles and rejects unsupported roles", () => {
    const membership = SpeciesGroupMembershipSchema.parse({
      membershipId: "member-ui-root",
      graphId: "graph-butian",
      groupId: "group-ui",
      nodeId: "node-ui-root",
      role: "primary",
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    expect(membership.role).toBe("primary");
    expect(() => SpeciesGroupMembershipSchema.parse({ ...membership, role: "owner" })).toThrow();
  });

  test("models design relationships at graph, group, and node levels", () => {
    const atlas = AtlasSchema.parse({
      atlasId: "atlas-butian",
      name: "Butian Design Atlas",
      purpose: "Coordinate multiple design graphs",
      graphIds: ["graph-character", "graph-ui"],
      status: "active",
      metadata: { project: "butian" },
      createdAt: now,
      updatedAt: now
    });
    const graphRelationship = DesignRelationshipSchema.parse({
      relationshipId: "rel-character-ui",
      source: { type: "graph", graphId: "graph-character" },
      target: { type: "graph", graphId: "graph-ui" },
      relationshipType: "translates-to",
      direction: "source-to-target",
      description: "UI icons translate character visual identity.",
      designContract: { mustPreserve: ["faction silhouette"], mustAvoid: [], reviewQuestions: [] },
      status: "active",
      metadata: { atlasId: atlas.atlasId },
      createdAt: now,
      updatedAt: now
    });
    const groupRelationship = DesignRelationshipSchema.parse({
      ...graphRelationship,
      relationshipId: "rel-ui-icons",
      source: { type: "species-group", graphId: "graph-ui", groupId: "group-ui" },
      target: { type: "species-group", graphId: "graph-ui", groupId: "group-icons" },
      relationshipType: "aligns-with"
    });
    const nodeRelationship = DesignRelationshipSchema.parse({
      ...graphRelationship,
      relationshipId: "rel-icon-root",
      source: { type: "species-node", graphId: "graph-ui", nodeId: "node-icon" },
      target: { type: "species-node", graphId: "graph-ui", nodeId: "node-root" },
      relationshipType: "derives-from"
    });

    expect(graphRelationship.relationshipType).toBe("translates-to");
    expect(groupRelationship.source.type).toBe("species-group");
    expect(nodeRelationship.designContract.mustPreserve).toEqual(["faction silhouette"]);
    expect(() =>
      DesignRelationshipSchema.parse({
        ...nodeRelationship,
        target: { type: "species-group", graphId: "graph-ui", groupId: "group-icons" }
      })
    ).toThrow();
  });

  test("defaults to one relationship per source, target, and type unless parallel semantics are explicit", () => {
    const relationships = [
      createDefaultDesignRelationship({
        relationshipId: "rel-primary",
        source: { type: "species-group", graphId: "graph-butian", groupId: "group-character" },
        target: { type: "species-group", graphId: "graph-butian", groupId: "group-icon" },
        relationshipType: "references"
      }),
      createDefaultDesignRelationship({
        relationshipId: "rel-duplicate",
        source: { type: "species-group", graphId: "graph-butian", groupId: "group-character" },
        target: { type: "species-group", graphId: "graph-butian", groupId: "group-icon" },
        relationshipType: "aligns-with"
      })
    ];

    expect(validateDesignRelationshipSet(relationships, { allowParallel: false }).valid).toBe(false);
    expect(validateDesignRelationshipSet(relationships, { allowParallel: true }).valid).toBe(true);
    expect(validateDesignRelationshipSet([relationships[0]!, { ...relationships[0]!, relationshipId: "rel-same-type" }], { allowParallel: true }).valid).toBe(false);
  });
});

describe("Phase 17 compile context hooks", () => {
  test("adds design relationships to compile context without treating custom relations as fixed rules", () => {
    const graph = createDefaultGraph({ graphId: "graph-ui", name: "UI Graph", purpose: "ui production" });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-icon",
      name: "Icon Species",
      motifs: ["shattered-jade"],
      constraints: { stroke: "thin" }
    });
    const group = createDefaultSpeciesGroup({
      groupId: "group-ui",
      graphId: graph.graphId,
      name: "UI Group",
      sharedFacts: ["all UI symbols use high contrast"],
      facetSchemaIds: ["facet-schema-ui"],
      phenotypeTypeSuggestions: ["ui-icon"]
    });
    const relationship = createDefaultDesignRelationship({
      relationshipId: "rel-custom",
      source: { type: "species-group", graphId: graph.graphId, groupId: "group-world" },
      target: { type: "species-group", graphId: graph.graphId, groupId: "group-ui" },
      relationshipType: "custom:inherits-worldview-symbols",
      description: "Use world-view symbols as LLM context only."
    });
    const graphRelationship = createDefaultDesignRelationship({
      relationshipId: "rel-style",
      source: { type: "graph", graphId: "graph-style" },
      target: { type: "graph", graphId: graph.graphId },
      relationshipType: "aligns-with",
      description: "Align UI graph with the visual foundation graph."
    });

    const compiled = compileSpecies({
      graph,
      node,
      parentSnapshots: [],
      relationshipDeltas: [],
      taskBrief: "create a warning icon",
      phenotypeType: "ui-icon",
      speciesGroups: [group],
      designRelationships: [relationship, graphRelationship]
    });

    expect(compiled.contextTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: "species-group", sourceId: "group-ui", fixedRuleEligible: true }),
        expect.objectContaining({ sourceType: "design-relationship", sourceId: "rel-custom", fixedRuleEligible: false }),
        expect.objectContaining({ sourceType: "design-relationship", sourceId: "rel-style", fixedRuleEligible: true })
      ])
    );
    expect(compiled.prompt).toContain("Use world-view symbols as LLM context only.");
    expect(compiled.prompt).toContain("all UI symbols use high contrast");
  });
});
