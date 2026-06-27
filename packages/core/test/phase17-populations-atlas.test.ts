import { describe, expect, test } from "vitest";
import {
  AtlasSchema,
  FacetAssignmentSchema,
  FacetDefinitionSchema,
  FacetSchemaSchema,
  GraphBridgeSchema,
  SpeciesGroupMembershipSchema,
  SpeciesGroupRelationSchema,
  SpeciesGroupSchema,
  compileSpecies,
  createDefaultGraph,
  createDefaultSpeciesGroup,
  createDefaultSpeciesNode,
  validateSpeciesGroupRelationSet
} from "@dna/core";

const now = "2026-06-27T00:00:00.000Z";

describe("Phase 17 PRD-01 core schemas", () => {
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

  test("allows built-in and custom group relation types without rule-engine fields", () => {
    const builtIn = SpeciesGroupRelationSchema.parse({
      relationId: "rel-ui-icon",
      graphId: "graph-butian",
      sourceGroupId: "group-ui",
      targetGroupId: "group-icons",
      relationType: "adapts-from",
      description: "Icon group adapts UI readability rules.",
      status: "active",
      extensions: { rationale: "same screen surface" },
      createdAt: now,
      updatedAt: now
    });
    const custom = SpeciesGroupRelationSchema.parse({
      ...builtIn,
      relationId: "rel-ui-icon-custom",
      relationType: "custom:shares-screen-density"
    });

    expect(builtIn).not.toHaveProperty("compileParticipation");
    expect(custom.relationType).toBe("custom:shares-screen-density");
    expect(() => SpeciesGroupRelationSchema.parse({ ...builtIn, relationType: "custom:" })).toThrow();
  });

  test("defaults to one primary relation per source and target unless parallel semantics are explicit", () => {
    const relations = [
      SpeciesGroupRelationSchema.parse({
        relationId: "rel-primary",
        graphId: "graph-butian",
        sourceGroupId: "group-character",
        targetGroupId: "group-icon",
        relationType: "adapts-from",
        description: "Icons adapt character identity.",
        status: "active",
        extensions: {},
        createdAt: now,
        updatedAt: now
      }),
      SpeciesGroupRelationSchema.parse({
        relationId: "rel-duplicate",
        graphId: "graph-butian",
        sourceGroupId: "group-character",
        targetGroupId: "group-icon",
        relationType: "references",
        description: "Extra note that should be description unless allowed.",
        status: "active",
        extensions: {},
        createdAt: now,
        updatedAt: now
      })
    ];

    expect(validateSpeciesGroupRelationSet(relations, { allowParallel: false }).valid).toBe(false);
    expect(validateSpeciesGroupRelationSet(relations, { allowParallel: true }).valid).toBe(true);
    expect(validateSpeciesGroupRelationSet([relations[0]!, { ...relations[0]!, relationId: "rel-same-type" }], { allowParallel: true }).valid).toBe(
      false
    );
  });

  test("models atlases and graph bridges with built-in and custom bridge types", () => {
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
    const bridge = GraphBridgeSchema.parse({
      bridgeId: "bridge-character-ui",
      atlasId: atlas.atlasId,
      sourceGraphId: "graph-character",
      targetGraphId: "graph-ui",
      bridgeType: "references-species",
      description: "UI icons reference character visual identity.",
      status: "active",
      extensions: { sourceTrace: "character graph" },
      createdAt: now,
      updatedAt: now
    });

    expect(atlas.graphIds).toEqual(["graph-character", "graph-ui"]);
    expect(bridge.bridgeType).toBe("references-species");
    expect(GraphBridgeSchema.parse({ ...bridge, bridgeId: "bridge-custom", bridgeType: "custom:campaign-link" }).bridgeType).toBe(
      "custom:campaign-link"
    );
    expect(() => GraphBridgeSchema.parse({ ...bridge, bridgeType: "custom:" })).toThrow();
  });
});

describe("Phase 17 PRD-01 compile context hooks", () => {
  test("adds group relations and graph bridges to compile context without treating custom relations as fixed rules", () => {
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
    const relation = SpeciesGroupRelationSchema.parse({
      relationId: "rel-custom",
      graphId: graph.graphId,
      sourceGroupId: "group-world",
      targetGroupId: "group-ui",
      relationType: "custom:inherits-worldview-symbols",
      description: "Use world-view symbols as LLM context only.",
      status: "active",
      extensions: {},
      createdAt: now,
      updatedAt: now
    });
    const bridge = GraphBridgeSchema.parse({
      bridgeId: "bridge-style",
      atlasId: "atlas-butian",
      sourceGraphId: "graph-style",
      targetGraphId: graph.graphId,
      bridgeType: "style-aligned-with",
      description: "Align UI graph with the visual foundation graph.",
      status: "active",
      extensions: {},
      createdAt: now,
      updatedAt: now
    });

    const compiled = compileSpecies({
      graph,
      node,
      parentSnapshots: [],
      edgeDeltas: [],
      taskBrief: "create a warning icon",
      phenotypeType: "ui-icon",
      speciesGroups: [group],
      groupRelations: [relation],
      graphBridges: [bridge]
    });

    expect(compiled.contextTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: "species-group", sourceId: "group-ui", fixedRuleEligible: true }),
        expect.objectContaining({ sourceType: "species-group-relation", sourceId: "rel-custom", fixedRuleEligible: false }),
        expect.objectContaining({ sourceType: "graph-bridge", sourceId: "bridge-style", fixedRuleEligible: true })
      ])
    );
    expect(compiled.prompt).toContain("Use world-view symbols as LLM context only.");
    expect(compiled.prompt).toContain("all UI symbols use high contrast");
  });
});
