import { describe, expect, test } from "vitest";
import {
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultGraph,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode,
  PhenotypeCompileArtifactSchema,
  PhenotypeVersionSchema,
  SpeciesCompileArtifactSchema
} from "../src/index.js";

describe("Phase 20 PRD-04 compile metadata compatibility", () => {
  test("species and phenotype compile artifacts record agent-assist metadata without storing full host output", () => {
    const graph = createDefaultGraph({ graphId: "graph-ui", name: "UI Graph", purpose: "ui" });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-icon",
      name: "Faction Icon",
      constraints: { readability: "high" },
      motifs: ["broken-ring"]
    });

    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-node-icon",
      graph,
      node,
      nodeVersionId: "node-icon@1.0.0",
      assistantSuggestions: [{ fieldPath: "constraints.color", valueSummary: "Agent suggested stronger moon-white palette" }],
      assistantContributionSummary: "Agent host model suggested one conflict-resolution question.",
      inputSummary: { graphId: graph.graphId, nodeId: node.nodeId, source: "skill-preview" }
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-node-icon-ui",
      graph,
      node,
      nodeVersionId: "node-icon@1.0.0",
      phenotypeType: "ui-icon",
      taskBrief: "small HUD faction icon",
      speciesArtifact,
      assistantContributionSummary: "Agent host model drafted prompt wording from accepted trace.",
      inputSummary: { speciesCompileArtifactId: speciesArtifact.artifactId, hostTool: "manual" }
    });

    expect(SpeciesCompileArtifactSchema.parse(speciesArtifact)).toMatchObject({
      compileMode: "agent-assisted",
      compiledBy: "agent-skill",
      assistantContributionSummary: "Agent host model suggested one conflict-resolution question.",
      inputSummary: { graphId: "graph-ui", nodeId: "node-icon", source: "skill-preview" }
    });
    expect(speciesArtifact.decisionTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectType: "agent-suggestion",
          decision: "llm-suggested",
          priority: 0,
          overridable: true,
          resolutionRule: "llm-review"
        })
      ])
    );
    expect(JSON.stringify(speciesArtifact)).not.toContain("rawHostResponse");

    expect(PhenotypeCompileArtifactSchema.parse(phenotypeArtifact)).toMatchObject({
      compileMode: "agent-assisted",
      compiledBy: "agent-skill",
      assistantContributionSummary: "Agent host model drafted prompt wording from accepted trace.",
      inputSummary: { speciesCompileArtifactId: "sca-node-icon", hostTool: "manual" }
    });
  });

  test("phenotype versions can reference compile artifacts and preserve a bounded snapshot", () => {
    const version = createDefaultPhenotypeVersion({
      phenotypeVersionId: "pv-node-icon@1.0.0",
      phenotypeId: "ph-node-icon",
      graphId: "graph-ui",
      nodeId: "node-icon",
      nodeVersionId: "node-icon@1.0.0",
      speciesCompileArtifactId: "sca-node-icon",
      phenotypeCompileArtifactId: "pca-node-icon-ui",
      compileArtifactSnapshot: {
        speciesCompileArtifactId: "sca-node-icon",
        phenotypeCompileArtifactId: "pca-node-icon-ui",
        promptDigest: "small HUD faction icon"
      }
    });

    expect(PhenotypeVersionSchema.parse(version)).toMatchObject({
      speciesCompileArtifactId: "sca-node-icon",
      phenotypeCompileArtifactId: "pca-node-icon-ui",
      compileArtifactSnapshot: {
        promptDigest: "small HUD faction icon"
      }
    });
  });
});
