import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  compilePhenotypeGeneration,
  compileSpeciesSnapshot,
  createDefaultAsset,
  createDefaultDesignRelationship,
  createDefaultGraph,
  createDefaultLibraryRoutingPolicy,
  createDefaultOutputReference,
  createDefaultPhenotype,
  createDefaultPhenotypeGenerationPlan,
  createDefaultPhenotypeGenerationTask,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesNode,
  createDefaultStorageMount,
  createGenerationJob
} from "@dna/core";
import { createDnaHttpHandler } from "@dna/server";
import { SqliteDnaStore } from "@dna/sqlite";

function dbPath(name: string) {
  return join(mkdtempSync(join(tmpdir(), `dna-${name}-`)), "dna.sqlite");
}

describe("Phase 28 PRD-21 read-only workbench information architecture API", () => {
  test("serves a four-module workbench snapshot with graph, generation, library, and result preview traces", async () => {
    const store = new SqliteDnaStore(dbPath("workbench-ia"));
    store.migrate();

    const graph = createDefaultGraph({
      graphId: "graph-web",
      name: "Web Workbench Graph",
      purpose: "read-only information architecture",
      rootNodes: ["node-web"]
    });
    const group = createDefaultSpeciesGroup({
      graphId: graph.graphId,
      groupId: "group-web",
      name: "Workbench Group",
      sharedFacts: ["small UI assets must preserve sharp silhouettes"],
      phenotypeTypeSuggestions: ["ui-icon"]
    });
    const node = createDefaultSpeciesNode({
      graphId: graph.graphId,
      nodeId: "node-web",
      name: "Workbench Species",
      motifs: ["split diamond"],
      constraints: { readability: "32px" }
    });
    const relationship = createDefaultDesignRelationship({
      relationshipId: "rel-web",
      source: { type: "species-group", graphId: graph.graphId, groupId: group.groupId },
      target: { type: "species-node", graphId: graph.graphId, nodeId: node.nodeId },
      relationshipType: "constrains",
      description: "Group readability constrains the species output.",
      status: "active"
    });
    const phenotype = createDefaultPhenotype({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: "ph-web",
      name: "Workbench Icon",
      phenotypeType: "ui-icon",
      status: "generated",
      currentAcceptedVersion: "pv-web-accepted",
      tags: ["ui", "preview"]
    });
    const speciesArtifact = compileSpeciesSnapshot({
      artifactId: "sca-web",
      graph,
      node,
      nodeVersionId: "node-web@1.0.0",
      speciesGroups: [group],
      designRelationships: [relationship]
    });
    const phenotypeArtifact = compilePhenotypeGeneration({
      artifactId: "pca-web",
      graph,
      node,
      nodeVersionId: "node-web@1.0.0",
      speciesArtifact,
      phenotypeType: phenotype.phenotypeType,
      taskBrief: "safe workbench preview"
    });
    const candidateVersion = createDefaultPhenotypeVersion({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: "pv-web-candidate",
      nodeVersionId: "node-web@1.0.0",
      status: "candidate",
      promptSnapshot: "candidate prompt",
      speciesCompileArtifactId: speciesArtifact.artifactId,
      phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
      assetIds: ["asset-web-private"]
    });
    const acceptedVersion = createDefaultPhenotypeVersion({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: "pv-web-accepted",
      nodeVersionId: "node-web@1.0.0",
      status: "accepted",
      promptSnapshot: "accepted prompt",
      speciesCompileArtifactId: speciesArtifact.artifactId,
      phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
      assetIds: ["asset-web-preview"]
    });
    const library = createDefaultPhenotypeLibrary({
      libraryId: "library-web",
      name: "Workbench Result Library",
      purpose: "read-only previews",
      profile: "media-asset",
      graphIds: [graph.graphId]
    });
    const mount = createDefaultStorageMount({
      mountId: "mount-web",
      libraryId: library.libraryId,
      storageType: "object-storage",
      adapterKind: "custom",
      displayName: "Preview CDN",
      location: "https://cdn.example.invalid/public",
      credentialRef: "configured-runtime-ref"
    });
    const safeReference = createDefaultOutputReference({
      outputReferenceId: "oref-web-safe",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: acceptedVersion.phenotypeVersionId,
      libraryId: library.libraryId,
      storageMountId: mount.mountId,
      uri: "https://cdn.example.invalid/public/icon.png",
      referenceType: "url",
      role: "preview",
      status: "active"
    });
    const privateReference = createDefaultOutputReference({
      outputReferenceId: "oref-web-private",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: candidateVersion.phenotypeVersionId,
      libraryId: library.libraryId,
      storageMountId: mount.mountId,
      uri: "https://cdn.example.invalid/private/icon.png?X-Amz-Signature=raw&token=secret",
      referenceType: "url",
      role: "source",
      status: "missing",
      metadata: {
        rawProviderPayload: "Bearer sk-test should never leave server snapshot"
      }
    });
    const plan = createDefaultPhenotypeGenerationPlan({
      planId: "plan-web",
      graphId: graph.graphId,
      scopeType: "graph",
      scopeId: graph.graphId,
      description: "Workbench generation plan",
      priority: 2,
      llmInstructions: "Generate a bounded workbench preview."
    });
    const task = createDefaultPhenotypeGenerationTask({
      taskId: "task-web",
      planId: plan.planId,
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeType: phenotype.phenotypeType,
      taskBrief: "safe workbench preview",
      priority: 2,
      status: "completed",
      speciesCompileArtifactId: speciesArtifact.artifactId,
      phenotypeCompileArtifactId: phenotypeArtifact.artifactId,
      generationJobIds: ["job-web"],
      phenotypeVersionIds: [acceptedVersion.phenotypeVersionId]
    });

    store.graphs.create(graph);
    store.speciesGroups.create(group);
    store.speciesGroupMemberships.create(
      createDefaultSpeciesGroupMembership({
        membershipId: "membership-web",
        graphId: graph.graphId,
        groupId: group.groupId,
        nodeId: node.nodeId
      })
    );
    store.nodes.create(node);
    store.designRelationships.create(relationship);
    store.phenotypes.create(phenotype);
    store.speciesCompileArtifacts.create(speciesArtifact);
    store.phenotypeCompileArtifacts.create(phenotypeArtifact);
    store.phenotypeVersions.create(candidateVersion);
    store.phenotypeVersions.create(acceptedVersion);
    store.phenotypeLibraries.create(library);
    store.phenotypeLibraryGraphBindings.create(
      createDefaultPhenotypeLibraryGraphBinding({
        bindingId: "binding-web",
        libraryId: library.libraryId,
        graphId: graph.graphId,
        role: "primary-library"
      })
    );
    store.storageMounts.create(mount);
    store.libraryRoutingPolicies.create(
      createDefaultLibraryRoutingPolicy({
        routingPolicyId: "route-web",
        libraryId: library.libraryId,
        name: "Preview route",
        targetMountId: mount.mountId,
        match: { phenotypeType: "ui-icon", outputRole: "preview", referenceType: "url" }
      })
    );
    store.assets.create(
      createDefaultAsset({
        assetId: "asset-web-preview",
        uri: "local://gallery/icon.png",
        linkedObjectType: "phenotype-version",
        linkedObjectId: acceptedVersion.phenotypeVersionId,
        variantRole: "preview",
        status: "active"
      })
    );
    store.assets.create(
      createDefaultAsset({
        assetId: "asset-web-private",
        uri: "/Users/bot/private/project/icon.png",
        linkedObjectType: "phenotype-version",
        linkedObjectId: candidateVersion.phenotypeVersionId,
        variantRole: "source-file",
        status: "pending"
      })
    );
    store.outputReferences.create(safeReference);
    store.outputReferences.create(privateReference);
    store.generationPlans.create(plan);
    store.generationTasks.create(task);
    store.generationJobs.create(
      createGenerationJob({
        generationJobId: "job-web",
        graphId: graph.graphId,
        nodeId: node.nodeId,
        phenotypeId: phenotype.phenotypeId,
        phenotypeVersionId: acceptedVersion.phenotypeVersionId,
        phenotypeType: phenotype.phenotypeType,
        taskBrief: "safe workbench preview",
        status: "generated",
        tool: "mock"
      })
    );

    const handler = createDnaHttpHandler(store);
    const response = await handler(new Request("http://dna.local/api/workbench/snapshot?graphId=graph-web"));
    expect(response.status).toBe(200);
    const snapshot = await response.json();

    expect(snapshot.overview.counts).toMatchObject({
      graphs: 1,
      speciesGroups: 1,
      speciesNodes: 1,
      phenotypes: 1,
      candidateVersions: 1,
      acceptedVersions: 1,
      generationPlans: 1,
      generationTasks: 1,
      generationJobs: 1,
      libraries: 1,
      mounts: 1
    });
    expect(snapshot.graphs[0]).toMatchObject({
      graphId: "graph-web",
      groups: [expect.objectContaining({ groupId: "group-web", memberNodeIds: ["node-web"] })],
      nodes: [expect.objectContaining({ nodeId: "node-web", phenotypeIds: ["ph-web"] })],
      relationships: [expect.objectContaining({ relationshipId: "rel-web", relationshipType: "constrains" })],
      phenotypeOverlay: [expect.objectContaining({ phenotypeId: "ph-web", currentAcceptedVersionId: "pv-web-accepted" })],
      compileTrace: expect.objectContaining({ speciesArtifacts: 1, phenotypeArtifacts: 1 })
    });
    expect(snapshot.generation.tasks[0]).toMatchObject({
      taskId: "task-web",
      trace: expect.objectContaining({
        planId: "plan-web",
        speciesCompileArtifactId: "sca-web",
        phenotypeCompileArtifactId: "pca-web",
        generationJobIds: ["job-web"],
        phenotypeVersionIds: ["pv-web-accepted"]
      })
    });
    expect(snapshot.generation.jobs[0]).toMatchObject({
      generationJobId: "job-web",
      phenotypeVersionId: "pv-web-accepted"
    });
    expect(snapshot.libraries[0]).toMatchObject({
      libraryId: "library-web",
      mounts: [expect.objectContaining({ mountId: "mount-web", credentialStatus: "configured" })],
      routingPolicies: [expect.objectContaining({ routingPolicyId: "route-web" })],
      results: expect.arrayContaining([expect.objectContaining({ phenotypeId: "ph-web", versionId: "pv-web-accepted" })]),
      gallery: expect.arrayContaining([
        expect.objectContaining({ preview: expect.objectContaining({ kind: "image", url: "https://cdn.example.invalid/public/icon.png" }) })
      ])
    });
    expect(snapshot.resultPreviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: "oref-web-safe", preview: expect.objectContaining({ kind: "image" }) }),
        expect.objectContaining({ objectId: "oref-web-private", preview: expect.objectContaining({ kind: "placeholder" }) }),
        expect.objectContaining({ objectId: "asset-web-private", preview: expect.objectContaining({ kind: "placeholder" }) })
      ])
    );

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(/sk-test|OPENAI_API_KEY|password|secret|private_key|Bearer|X-Amz-Signature|\/Users\/bot/);
    expect(serialized).not.toContain("configured-runtime-ref");
    expect(serialized.length).toBeLessThan(60000);
    store.close();
  });

  test("returns read-only empty and missing graph states without mutating the store", async () => {
    const store = new SqliteDnaStore(dbPath("workbench-empty"));
    store.migrate();
    const handler = createDnaHttpHandler(store);

    const empty = await (await handler(new Request("http://dna.local/api/workbench/snapshot"))).json();
    expect(empty.overview.counts).toMatchObject({ graphs: 0, phenotypes: 0, generationTasks: 0, libraries: 0 });
    expect(empty.overview.anomalies).toEqual(expect.arrayContaining([expect.objectContaining({ type: "empty-store" })]));

    const missing = await handler(new Request("http://dna.local/api/workbench/snapshot?graphId=missing-graph"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: "graph not found: missing-graph",
      readOnly: true,
      recoveryHint: "Use the CLI/service boundary to create or inspect graphs; the Web workbench did not modify the DNA store."
    });
    expect(store.graphs.list()).toEqual([]);
    store.close();
  });
});
