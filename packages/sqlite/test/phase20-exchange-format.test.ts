import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createChangeSet,
  createDefaultAsset,
  createDefaultAtlas,
  createDefaultContextAttachment,
  createDefaultContextFact,
  createDefaultContextMotif,
  createDefaultContextPolicy,
  createDefaultContextReference,
  createDefaultContextReviewRubric,
  createDefaultDesignContext,
  createDefaultDesignPrinciple,
  createDefaultDesignRelationship,
  createDefaultFacetAssignment,
  createDefaultFacetDefinition,
  createDefaultFacetSchema,
  createDefaultGraph,
  createDefaultOutputReference,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultProposal,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesNode,
  createGenerationJob,
  createImpactRecord,
  createReviewRecord,
  PROJECT_VERSION
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function seedExchangeProject(store: SqliteDnaStore) {
  const graph = createDefaultGraph({
    graphId: "graph-exchange",
    name: "Exchange Graph",
    purpose: "manifest contract",
    rootNodes: ["node-exchange"]
  });
  const relatedGraph = createDefaultGraph({
    graphId: "graph-exchange-related",
    name: "Related Exchange Graph",
    purpose: "manifest relationship target"
  });
  const node = createDefaultSpeciesNode({
    graphId: graph.graphId,
    nodeId: "node-exchange",
    name: "Exchange Species",
    motifs: ["crescent"],
    constraints: { readability: "high" }
  });
  const phenotype = createDefaultPhenotype({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: "ph-exchange",
    name: "Exchange Phenotype",
    phenotypeType: "image-prompt"
  });
  const phenotypeVersion = createDefaultPhenotypeVersion({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: "pv-exchange",
    nodeVersionId: "node-exchange@1.0.0",
    promptSnapshot: "safe exchange prompt",
    assetIds: ["asset-exchange"]
  });
  const speciesArtifact = compileSpeciesSnapshot({
    artifactId: "sca-exchange",
    graph,
    node,
    nodeVersionId: "node-exchange@1.0.0"
  });
  const phenotypeArtifact = compilePhenotypeGeneration({
    artifactId: "pca-exchange",
    graph,
    node,
    nodeVersionId: "node-exchange@1.0.0",
    phenotypeType: "image-prompt",
    taskBrief: "exchange output",
    speciesArtifact
  });

  store.graphs.create(graph);
  store.graphs.create(relatedGraph);
  store.nodes.create(node);
  store.facetDefinitions.create(createDefaultFacetDefinition({ facetId: "facet-tone", name: "Tone" }));
  store.facetSchemas.create(createDefaultFacetSchema({ facetSchemaId: "facet-schema-ui", name: "UI Facets", facetIds: ["facet-tone"] }));
  store.facetAssignments.create(
    createDefaultFacetAssignment({
      assignmentId: "facet-assignment-node",
      targetType: "species-node",
      targetId: node.nodeId,
      values: { "facet-tone": "restrained" }
    })
  );
  store.speciesGroups.create(createDefaultSpeciesGroup({ groupId: "group-a", graphId: graph.graphId, name: "Group A" }));
  store.speciesGroups.create(createDefaultSpeciesGroup({ groupId: "group-b", graphId: graph.graphId, name: "Group B" }));
  store.speciesGroupMemberships.create(
    createDefaultSpeciesGroupMembership({
      membershipId: "membership-exchange",
      graphId: graph.graphId,
      groupId: "group-a",
      nodeId: node.nodeId
    })
  );
  store.designRelationships.create(
    createDefaultDesignRelationship({
      relationshipId: "relationship-groups-exchange",
      source: { type: "species-group", graphId: graph.graphId, groupId: "group-a" },
      target: { type: "species-group", graphId: graph.graphId, groupId: "group-b" },
      relationshipType: "references"
    })
  );
  store.atlases.create(createDefaultAtlas({ atlasId: "atlas-exchange", name: "Exchange Atlas", purpose: "portable", graphIds: [graph.graphId, relatedGraph.graphId] }));
  store.designRelationships.create(
    createDefaultDesignRelationship({
      relationshipId: "relationship-graph-exchange",
      source: { type: "graph", graphId: graph.graphId },
      target: { type: "graph", graphId: relatedGraph.graphId },
      relationshipType: "references",
      metadata: { atlasId: "atlas-exchange" }
    })
  );
  store.contextFacts.create(createDefaultContextFact({ factId: "fact-exchange", factType: "symbol-rule", statement: "Crescents stay readable." }));
  store.designPrinciples.create(createDefaultDesignPrinciple({ principleId: "principle-exchange", statement: "Favor high contrast." }));
  store.contextMotifs.create(createDefaultContextMotif({ motifId: "motif-exchange", motifType: "visual-motif-ref", statement: "Crescent motif." }));
  store.contextReferences.create(
    createDefaultContextReference({
      referenceId: "reference-exchange",
      referenceType: "source-document",
      sourceRef: { uri: "local://reference.md" }
    })
  );
  store.contextReviewRubrics.create(
    createDefaultContextReviewRubric({
      rubricId: "rubric-exchange",
      dimension: "readability",
      question: "Is the motif readable?"
    })
  );
  store.designContexts.create(
    createDefaultDesignContext({
      contextId: "context-exchange",
      name: "Exchange Context",
      contextType: "art-direction",
      factIds: ["fact-exchange"],
      principleIds: ["principle-exchange"],
      motifIds: ["motif-exchange"],
      referenceIds: ["reference-exchange"],
      reviewRubricIds: ["rubric-exchange"]
    })
  );
  store.contextAttachments.create(
    createDefaultContextAttachment({
      attachmentId: "attachment-exchange",
      contextId: "context-exchange",
      targetType: "species-node",
      targetId: node.nodeId
    })
  );
  store.contextPolicies.create(createDefaultContextPolicy({ policyId: "policy-exchange", contextId: "context-exchange" }));
  store.phenotypes.create(phenotype);
  store.phenotypeVersions.create(phenotypeVersion);
  store.speciesCompileArtifacts.create(speciesArtifact);
  store.phenotypeCompileArtifacts.create(phenotypeArtifact);
  store.assets.create(
    createDefaultAsset({
      assetId: "asset-exchange",
      uri: "local://asset-exchange.png",
      linkedObjectType: "phenotype-version",
      linkedObjectId: phenotypeVersion.phenotypeVersionId
    })
  );
  store.outputReferences.create(
    createDefaultOutputReference({
      outputReferenceId: "oref-exchange",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: phenotypeVersion.phenotypeVersionId,
      uri: "local://asset-exchange.png",
      referenceType: "local-file",
      role: "primary-output"
    })
  );
  store.generationJobs.create(
    createGenerationJob({
      generationJobId: "job-exchange",
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: phenotypeVersion.phenotypeVersionId,
      phenotypeType: phenotype.phenotypeType,
      status: "generated",
      outputSnapshot: { provider: "mock", assetIds: ["asset-exchange"] },
      toolParameters: { model: "mock" }
    })
  );
  store.reviews.create(
    createReviewRecord({
      reviewRecordId: "review-exchange",
      graphId: graph.graphId,
      objectType: "phenotype-version",
      objectId: phenotypeVersion.phenotypeVersionId,
      status: "pass"
    })
  );
  store.impacts.create(
    createImpactRecord({
      impactRecordId: "impact-exchange",
      graphId: graph.graphId,
      changedObjectType: "node",
      changedObjectId: node.nodeId,
      changedVersionId: "node-exchange@2.0.0",
      objectType: "phenotype-version",
      objectId: phenotypeVersion.phenotypeVersionId
    })
  );
  store.changeSets.create(
    createChangeSet({
      mode: "preview-confirm",
      objectType: "node",
      operation: "create",
      summary: "preview exchange node",
      diff: { nodeId: node.nodeId },
      payload: { node }
    })
  );
}

describe("Phase 20 versioned exchange format manifest", () => {
  test("exports a versioned manifest and imports the documented exchange directories", () => {
    const dir = tempDir("exchange-format");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();
    seedExchangeProject(source);

    exportProject(source, out);
    const manifest = readJson(join(out, "dna.project.json"));

    expect(manifest).toMatchObject({
      format: "dna.git-directory",
      version: PROJECT_VERSION,
      projectVersion: PROJECT_VERSION,
      exchangeVersion: "1.0.0"
    });
    expect(manifest.capabilities).toEqual(
      expect.arrayContaining([
        "change-sets",
        "facets",
        "contexts",
        "atlases",
        "design-relationships",
        "species-groups",
        "compile-artifacts",
        "generation-jobs",
        "output-references",
        "reviews",
        "impacts"
      ])
    );
    for (const path of [
      "change-sets",
      "facets/definitions",
      "facets/schemas",
      "facets/assignments",
      "contexts/contexts",
      "contexts/facts",
      "contexts/principles",
      "contexts/motifs",
      "contexts/references",
      "contexts/review-rubrics",
      "contexts/attachments",
      "contexts/policies",
      "relationships",
      "graphs/graph-exchange/groups",
      "graphs/graph-exchange/group-memberships",
      "graphs/graph-exchange/compile/species",
      "graphs/graph-exchange/compile/phenotypes",
      "graphs/graph-exchange/generation-jobs",
      "graphs/graph-exchange/output-references",
      "graphs/graph-exchange/reviews",
      "graphs/graph-exchange/impacts"
    ]) {
      expect(existsSync(join(out, path))).toBe(true);
    }

    importProject(target, out);

    expect(target.graphs.get("graph-exchange")?.name).toBe("Exchange Graph");
    expect(target.facetAssignments.get("facet-assignment-node")?.values).toMatchObject({ "facet-tone": "restrained" });
    expect(target.designContexts.get("context-exchange")?.factIds).toEqual(["fact-exchange"]);
    expect(target.atlases.get("atlas-exchange")?.graphIds).toEqual(["graph-exchange", "graph-exchange-related"]);
    expect(target.speciesGroups.listByGraph("graph-exchange").map((group) => group.groupId).sort()).toEqual(["group-a", "group-b"]);
    expect(target.speciesGroupMemberships.listByGraph("graph-exchange").map((membership) => membership.membershipId)).toEqual([
      "membership-exchange"
    ]);
    expect(target.designRelationships.listByGraph("graph-exchange").map((relationship) => relationship.relationshipId).sort()).toEqual([
      "relationship-graph-exchange",
      "relationship-groups-exchange"
    ]);
    expect(target.speciesCompileArtifacts.get("sca-exchange")?.compileTarget).toBe("species-snapshot");
    expect(target.phenotypeCompileArtifacts.get("pca-exchange")?.speciesCompileArtifactId).toBe("sca-exchange");
    expect(target.generationJobs.get("job-exchange")?.status).toBe("generated");
    expect(target.outputReferences.listByGraph("graph-exchange").map((reference) => reference.outputReferenceId)).toEqual(["oref-exchange"]);
    expect(target.reviews.get("review-exchange")?.status).toBe("pass");
    expect(target.impacts.listByGraph("graph-exchange").map((impact) => impact.impactRecordId)).toEqual(["impact-exchange"]);
    expect(target.changeSets.list()).toHaveLength(1);

    source.close();
    target.close();
  });

  test("rejects unsupported exchange versions with a clear error", () => {
    const dir = tempDir("exchange-version");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();
    seedExchangeProject(source);
    exportProject(source, out);
    const manifestPath = join(out, "dna.project.json");
    const manifest = readJson(manifestPath);
    writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, exchangeVersion: "999.0.0" }, null, 2)}\n`);

    expect(() => importProject(target, out)).toThrow(/unsupported exchangeVersion 999\.0\.0/);

    source.close();
    target.close();
  });

  test("exports review-current packages without change-set and proposal noise", () => {
    const dir = tempDir("exchange-review-current");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    target.migrate();
    seedExchangeProject(source);
    const linkedChangeSetId = source.changeSets.list()[0]?.changeSetId;
    source.proposals.create(
      createDefaultProposal({
        proposalId: "proposal-review-current",
        title: "Review current",
        changeSetIds: linkedChangeSetId ? [linkedChangeSetId] : []
      })
    );

    exportProject(source, out, { profile: "review-current" });
    const manifest = readJson(join(out, "dna.project.json"));

    expect(manifest).toMatchObject({
      exportProfile: "review-current",
      omitted: {
        sections: ["change-sets", "proposals"],
        changeSetCount: 1,
        proposalCount: 1
      }
    });
    expect(existsSync(join(out, "change-sets"))).toBe(false);
    expect(existsSync(join(out, "proposals"))).toBe(false);
    expect(existsSync(join(out, "graphs", "graph-exchange", "graph.json"))).toBe(true);

    importProject(target, out);

    expect(target.graphs.get("graph-exchange")?.name).toBe("Exchange Graph");
    expect(target.changeSets.list()).toHaveLength(0);
    expect(target.proposals.list()).toHaveLength(0);

    source.close();
    target.close();
  });

  test("exports proposal-review packages with only the target proposal and linked change-sets", () => {
    const dir = tempDir("exchange-proposal-review");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    seedExchangeProject(source);
    const targetChangeSetId = source.changeSets.list()[0]?.changeSetId;
    if (!targetChangeSetId) throw new Error("expected seeded change-set");
    const unrelated = createChangeSet({
      mode: "preview-confirm",
      objectType: "graph",
      operation: "create",
      summary: "unrelated preview",
      diff: { graphId: "graph-unrelated" },
      payload: { graphId: "graph-unrelated" }
    });
    source.changeSets.create(unrelated);
    source.proposals.create(
      createDefaultProposal({
        proposalId: "proposal-target",
        title: "Target proposal",
        changeSetIds: [targetChangeSetId]
      })
    );
    source.proposals.create(
      createDefaultProposal({
        proposalId: "proposal-unrelated",
        title: "Unrelated proposal",
        changeSetIds: [unrelated.changeSetId]
      })
    );

    exportProject(source, out, { profile: "proposal-review", proposalId: "proposal-target" });
    const manifest = readJson(join(out, "dna.project.json"));

    expect(manifest).toMatchObject({
      exportProfile: "proposal-review",
      proposalId: "proposal-target",
      omitted: {
        sections: ["unrelated change-sets", "unrelated proposals"],
        changeSetCount: 1,
        proposalCount: 1
      }
    });
    expect(existsSync(join(out, "change-sets", `${targetChangeSetId}.json`))).toBe(true);
    expect(existsSync(join(out, "change-sets", `${unrelated.changeSetId}.json`))).toBe(false);
    expect(existsSync(join(out, "proposals", "proposal-target.json"))).toBe(true);
    expect(existsSync(join(out, "proposals", "proposal-unrelated.json"))).toBe(false);

    source.close();
  });

  test("rejects proposal-review export when a linked change-set is missing", () => {
    const dir = tempDir("exchange-proposal-review-broken");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    const out = join(dir, "export");
    source.migrate();
    seedExchangeProject(source);
    source.proposals.create(
      createDefaultProposal({
        proposalId: "proposal-broken",
        title: "Broken proposal",
        changeSetIds: ["missing-change-set"]
      })
    );

    expect(() => exportProject(source, out, { profile: "proposal-review", proposalId: "proposal-broken" })).toThrow(
      /proposal proposal-broken references missing change-set: missing-change-set/
    );

    source.close();
  });
});
