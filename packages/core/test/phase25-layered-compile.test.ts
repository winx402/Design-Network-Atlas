import { describe, expect, test } from "vitest";
import {
  applyCompileDecisionPatches,
  checkCompileArtifactStaleness,
  compileEntityArtifact,
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultContextAttachment,
  createDefaultDesignContext,
  createDefaultDesignRelationship,
  createDefaultFacetAssignment,
  createDefaultFacetDefinition,
  createDefaultFacetSchema,
  createDefaultGeneTemplate,
  createDefaultGraph,
  createDefaultSpeciesGroup,
  createDefaultSpeciesNode,
  EntityCompileArtifactSchema,
  PhenotypeCompileArtifactSchema,
  SpeciesCompileArtifactSchema
} from "../src/index.js";

function normalize(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, inner) => (key === "createdAt" || key === "evaluatedAt" || key === "frameId" ? "<stable>" : inner)));
}

describe("Phase 25 PRD-16 layered compile pipeline", () => {
  test("compiles graph and group entity artifacts with frames, dependency vectors, and no graph mutation", () => {
    const graph = createDefaultGraph({
      graphId: "graph-ui",
      name: "UI Graph",
      purpose: "hud production",
      facets: { domain: "ui" },
      currentVersion: "2.0.0"
    });
    const group = createDefaultSpeciesGroup({
      graphId: graph.graphId,
      groupId: "group-warning",
      name: "Warning Components",
      sharedFacts: ["warning components must read at 32px"],
      facetSchemaIds: ["facet-schema-review"]
    });
    const relationship = createDefaultDesignRelationship({
      relationshipId: "rel-graph-style",
      source: { type: "graph", graphId: "graph-style" },
      target: { type: "graph", graphId: graph.graphId },
      relationshipType: "aligns-with",
      description: "Align HUD visuals with the style graph.",
      designContract: {
        transferRule: "",
        mustPreserve: ["moon-white contrast"],
        mustAvoid: [],
        divergenceRule: "",
        reviewQuestions: []
      }
    });
    const context = createDefaultDesignContext({
      contextId: "ctx-ui",
      name: "UI Context",
      contextType: "production-rationale",
      summary: "HUD warnings must be quick to parse.",
      version: "1.2.0"
    });
    const attachment = createDefaultContextAttachment({
      attachmentId: "att-graph-context",
      contextId: context.contextId,
      targetType: "graph",
      targetId: graph.graphId,
      compileLayer: "graph-context"
    });
    const facet = createDefaultFacetDefinition({ facetId: "facet-tone", name: "Tone", valueType: "enum", allowedValues: ["restrained"] });
    const facetSchema = createDefaultFacetSchema({
      facetSchemaId: "facet-schema-review",
      name: "Review Facets",
      facetIds: [facet.facetId],
      requiredFacetIds: [facet.facetId]
    });
    const assignment = createDefaultFacetAssignment({
      assignmentId: "facet-assignment-graph",
      targetType: "graph",
      targetId: graph.graphId,
      values: { "facet-tone": "restrained" }
    });
    const template = createDefaultGeneTemplate({
      templateId: "template-ui-readability",
      packId: "pack-ui",
      name: "UI Readability",
      dimensions: [{ dimensionId: "readability", prompt: "Readable at small sizes", required: true }]
    });

    const graphArtifact = compileEntityArtifact({
      artifactId: "eca-graph-ui",
      targetLevel: "graph",
      graph,
      designRelationships: [relationship],
      designContexts: [context],
      contextAttachments: [attachment],
      facetDefinitions: [facet],
      facetSchemas: [facetSchema],
      facetAssignments: [assignment],
      geneTemplates: [template]
    });
    const groupArtifact = compileEntityArtifact({
      artifactId: "eca-group-warning",
      targetLevel: "species-group",
      graph,
      group,
      upstreamArtifacts: [graphArtifact],
      designContexts: [context],
      contextAttachments: [
        createDefaultContextAttachment({
          attachmentId: "att-group-context",
          contextId: context.contextId,
          targetType: "species-group",
          targetId: group.groupId,
          compileLayer: "group-context"
        })
      ],
      facetDefinitions: [facet],
      facetSchemas: [facetSchema],
      facetAssignments: [
        createDefaultFacetAssignment({
          assignmentId: "facet-assignment-group",
          targetType: "species-group",
          targetId: group.groupId,
          values: { "facet-tone": "restrained" }
        })
      ]
    });

    expect(EntityCompileArtifactSchema.parse(graphArtifact)).toMatchObject({
      compileTarget: "entity-layer",
      targetLevel: "graph",
      target: { objectType: "graph", objectId: graph.graphId },
      validity: { state: "current" }
    });
    expect(graphArtifact.frames.map((frame) => frame.level)).toEqual(["graph"]);
    expect(graphArtifact.frames[0].relationshipSnapshot).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectId: relationship.relationshipId, summary: expect.stringContaining("Align HUD") })])
    );
    expect(graphArtifact.frames[0].facetSnapshot).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectId: assignment.assignmentId, summary: expect.stringContaining("restrained") })])
    );
    expect(graphArtifact.dependencyVector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "graph", objectId: graph.graphId, versionId: "2.0.0", role: "source" }),
        expect.objectContaining({ objectType: "design-relationship", objectId: relationship.relationshipId, role: "relationship" }),
        expect.objectContaining({ objectType: "facet-assignment", objectId: assignment.assignmentId, role: "facet" }),
        expect.objectContaining({ objectType: "gene-template", objectId: template.templateId, role: "template" })
      ])
    );

    expect(EntityCompileArtifactSchema.parse(groupArtifact)).toMatchObject({
      targetLevel: "species-group",
      target: { objectType: "species-group", objectId: group.groupId, graphId: graph.graphId }
    });
    expect(groupArtifact.frames.map((frame) => frame.level)).toEqual(["graph", "species-group"]);
    expect(groupArtifact.dependencyVector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "entity-compile-artifact", objectId: "eca-graph-ui", role: "inherited" }),
        expect.objectContaining({ objectType: "species-group", objectId: group.groupId, role: "source" })
      ])
    );
    expect(graph.currentVersion).toBe("2.0.0");
  });

  test("species and phenotype compile artifacts emit deterministic layered frames, feedback, and decision patches", () => {
    const graph = createDefaultGraph({ graphId: "graph-ui", name: "UI Graph", purpose: "hud", currentVersion: "1.0.0" });
    const group = createDefaultSpeciesGroup({
      graphId: graph.graphId,
      groupId: "group-warning",
      name: "Warning Components",
      sharedFacts: ["use red only for critical warnings"]
    });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-pressure-meter",
      name: "Corruption Pressure Meter",
      constraints: { color: "amber", readability: "high" },
      motifs: ["cracked-ring"],
      badcases: ["decorative overload"]
    });
    const nodeRelationship = createDefaultDesignRelationship({
      relationshipId: "rel-pressure-derived",
      source: { type: "species-node", graphId: graph.graphId, nodeId: "node-warning-base" },
      target: { type: "species-node", graphId: graph.graphId, nodeId: node.nodeId },
      relationshipType: "derives-from",
      description: "Derived meter keeps warning readability.",
      designContract: {
        transferRule: "preserve warning silhouette",
        mustPreserve: ["readability"],
        mustAvoid: ["visual clutter"],
        divergenceRule: "",
        reviewQuestions: ["Does the meter remain readable at small sizes?"]
      },
      metadata: { deltaGenes: { color: "red", silhouette: "ring" } }
    });
    const context = createDefaultDesignContext({
      contextId: "ctx-warning",
      name: "Warning Context",
      contextType: "production-rationale",
      summary: "Critical warning colors are reserved for emergency states.",
      version: "1.0.0"
    });

    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-pressure",
      graph,
      node,
      nodeVersionId: "node-pressure-meter@1.0.0",
      speciesGroups: [group],
      designRelationships: [nodeRelationship],
      relationshipDeltas: [{ relationshipId: nodeRelationship.relationshipId, delta: { color: "red", silhouette: "ring" } }],
      designContexts: [context],
      contextAttachments: [
        createDefaultContextAttachment({
          attachmentId: "att-node-warning",
          contextId: context.contextId,
          targetType: "species-node",
          targetId: node.nodeId,
          compileLayer: "node-context"
        })
      ]
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-pressure-ui",
      graph,
      node,
      nodeVersionId: "node-pressure-meter@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "make a warning meter but use blue calm state",
      speciesArtifact
    });
    const replayed = applyCompileDecisionPatches(phenotypeArtifact, [
      {
        requestId: phenotypeArtifact.decisionRequests[0].requestId,
        action: "weaken",
        fieldPath: "phenotype.taskBrief",
        valueSummary: "Treat blue calm state as a secondary variant, not the core critical warning state.",
        rationale: "Keeps graph warning semantics while allowing the requested variant.",
        confidence: "high",
        sourceObjectIds: [node.nodeId, nodeRelationship.relationshipId]
      }
    ]);

    expect(SpeciesCompileArtifactSchema.parse(speciesArtifact).frames.map((frame) => frame.level)).toEqual([
      "graph",
      "species-group",
      "species-node"
    ]);
    expect(speciesArtifact.frames.at(-1)?.relationshipSnapshot).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectId: nodeRelationship.relationshipId })])
    );
    expect(speciesArtifact.conflictReport).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "color", layer: "design-relationship-contracts" })])
    );
    expect(speciesArtifact.feedback).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: "warning", targetLevel: "species-node" })])
    );
    expect(PhenotypeCompileArtifactSchema.parse(phenotypeArtifact).frames.map((frame) => frame.level)).toEqual([
      "graph",
      "species-group",
      "species-node",
      "phenotype"
    ]);
    expect(phenotypeArtifact.dependencyVector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "species-compile-artifact", objectId: speciesArtifact.artifactId, role: "inherited" }),
        expect.objectContaining({ objectType: "task-brief", objectId: phenotypeArtifact.artifactId, role: "source" })
      ])
    );
    expect(phenotypeArtifact.decisionRequests[0]).toMatchObject({
      status: "open",
      fieldPath: "phenotype.taskBrief"
    });
    expect(replayed.decisionPatches[0]).toMatchObject({ action: "weaken", confidence: "high" });
    expect(replayed.decisionTrace).toEqual(
      expect.arrayContaining([expect.objectContaining({ objectType: "compile-decision-patch", decision: "manual" })])
    );
    expect(normalize(compileSpeciesSnapshot({ artifactId: "sca-pressure", graph, node, nodeVersionId: "node-pressure-meter@1.0.0", speciesGroups: [group], designRelationships: [nodeRelationship], relationshipDeltas: [{ relationshipId: nodeRelationship.relationshipId, delta: { color: "red", silhouette: "ring" } }], designContexts: [context] }))).toMatchObject(
      normalize(compileSpeciesSnapshot({ artifactId: "sca-pressure", graph, node, nodeVersionId: "node-pressure-meter@1.0.0", speciesGroups: [group], designRelationships: [nodeRelationship], relationshipDeltas: [{ relationshipId: nodeRelationship.relationshipId, delta: { color: "red", silhouette: "ring" } }], designContexts: [context] }))
    );
  });

  test("staleness compares dependency vectors across graph, group, relationship, context, facet, template, node, phenotype, and brief inputs", () => {
    const graph = createDefaultGraph({ graphId: "graph-stale", name: "Stale Graph", purpose: "stale", currentVersion: "1.0.0" });
    const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-stale", name: "Stale Node" });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-stale",
      graph,
      node,
      nodeVersionId: "node-stale@1.0.0",
      speciesGroups: [createDefaultSpeciesGroup({ graphId: graph.graphId, groupId: "group-stale", name: "Stale Group" })],
      designRelationships: [
        createDefaultDesignRelationship({
          relationshipId: "rel-stale",
          source: { type: "species-node", graphId: graph.graphId, nodeId: "node-source" },
          target: { type: "species-node", graphId: graph.graphId, nodeId: node.nodeId },
          relationshipType: "references"
        })
      ],
      designContexts: [createDefaultDesignContext({ contextId: "ctx-stale", name: "Stale Context", contextType: "worldview" })],
      facetDefinitions: [createDefaultFacetDefinition({ facetId: "facet-stale", name: "Stale Facet" })],
      facetSchemas: [createDefaultFacetSchema({ facetSchemaId: "schema-stale", name: "Stale Schema", facetIds: ["facet-stale"] })],
      facetAssignments: [
        createDefaultFacetAssignment({
          assignmentId: "assign-stale",
          targetType: "species-node",
          targetId: node.nodeId,
          values: { "facet-stale": "current" }
        })
      ],
      geneTemplates: [
        createDefaultGeneTemplate({
          templateId: "template-stale",
          packId: "pack-stale",
          name: "Template Stale",
          version: "1.0.0"
        })
      ]
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-stale",
      graph,
      node,
      nodeVersionId: "node-stale@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "current brief",
      speciesArtifact
    });

    expect(checkCompileArtifactStaleness(phenotypeArtifact, phenotypeArtifact.dependencyVector)).toMatchObject({
      state: "current",
      stale: false
    });
    expect(
      checkCompileArtifactStaleness(phenotypeArtifact, [
        ...phenotypeArtifact.dependencyVector,
        { objectType: "graph", objectId: graph.graphId, versionId: "2.0.0", role: "source" }
      ])
    ).toMatchObject({ state: "stale", stale: true, reasons: expect.arrayContaining([expect.stringContaining("graph:graph-stale")]) });
    expect(
      checkCompileArtifactStaleness(
        phenotypeArtifact,
        phenotypeArtifact.dependencyVector.filter((ref) => !(ref.objectType === "task-brief" && ref.objectId === phenotypeArtifact.artifactId))
      )
    ).toMatchObject({ state: "invalid", stale: true, reasons: expect.arrayContaining([expect.stringContaining("task-brief:pca-stale missing")]) });
  });
});
