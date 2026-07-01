import { describe, expect, test } from "vitest";
import {
  acceptPhenotypeVersion,
  prepareManagedGeneration,
  runManagedGenerationJob,
  verifyGenerationOutput,
  linkReferenceAsset,
  prepareReferenceGeneration,
  persistReferenceGeneration
} from "@dna/application";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode,
  createGenerationJob
} from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";

function seedPhenotypeJob() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-managed", name: "Managed Graph", purpose: "runner evidence" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-managed", name: "Managed Species" });
  const phenotype = createDefaultPhenotype({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: "ph-managed",
    name: "Managed Phenotype",
    phenotypeType: "image"
  });
  const version = createDefaultPhenotypeVersion({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: "pv-managed",
    promptSnapshot: "candidate prompt",
    speciesCompileArtifactId: "sca-managed",
    phenotypeCompileArtifactId: "pca-managed",
    compileArtifactSnapshot: { artifact: "pca-managed" },
    generationRecipe: { generationJobId: "job-managed" }
  });
  const job = createGenerationJob({
    generationJobId: "job-managed",
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: version.phenotypeVersionId,
    phenotypeType: phenotype.phenotypeType,
    taskBrief: "Managed generation request",
    compilePolicy: graph.compilePolicy,
    inputSnapshot: { speciesCompileArtifactId: "sca-managed", phenotypeCompileArtifactId: "pca-managed" },
    outputSnapshot: {
      prompt: "Safe managed prompt with no private links.",
      negativePrompt: "No text."
    },
    status: "created"
  });

  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  store.phenotypeVersions.create(version);
  store.generationJobs.create(job);
  return { store, graph, node, phenotype, version, job };
}

describe("Phase 33 PRD-24 managed generation application services", () => {
  test("prepares and runs mock-runner without writing in preview and records evidence on apply", () => {
    const { store } = seedPhenotypeJob();

    const prepared = prepareManagedGeneration(store, {
      generationJobId: "job-managed",
      runnerId: "mock-runner",
      parameters: { size: "1024x1024", apiKey: "sk-do-not-store" }
    });
    expect(prepared.persisted).toBe(false);
    expect(prepared.runnerInput).toMatchObject({
      generationJobId: "job-managed",
      runnerId: "mock-runner"
    });
    expect(prepared.runnerInput.compiledPromptHash).toMatch(/^sha256:/);
    expect(JSON.stringify(prepared)).not.toMatch(/sk-do-not-store/);

    const preview = runManagedGenerationJob(store, {
      generationJobId: "job-managed",
      runnerId: "mock-runner",
      parameters: { size: "1024x1024", rawProviderPayload: "Bearer secret" }
    });
    expect(preview.persisted).toBe(false);
    expect(store.generationJobs.get("job-managed")?.status).toBe("created");
    expect(preview.after).toMatchObject({
      status: "generated",
      executionMode: "managed-runner",
      provenanceLevel: "runner-recorded",
      requestEvidence: {
        runnerId: "mock-runner"
      },
      outputEvidence: {
        assetIds: ["asset-job-managed"],
        mimeType: "image/png",
        width: 512,
        height: 512
      },
      verificationSummary: { status: "not-run" }
    });
    expect(preview.asset?.linkedObjectId).toBe("job-managed");
    expect(JSON.stringify(preview.after)).not.toMatch(/Bearer secret|rawProviderPayload/);

    const applied = runManagedGenerationJob(store, {
      generationJobId: "job-managed",
      runnerId: "mock-runner",
      parameters: { seed: 42 }
    }, { apply: true });
    expect(applied.persisted).toBe(true);
    expect(store.assets.get("asset-job-managed")).toMatchObject({ linkedObjectType: "generation-job", linkedObjectId: "job-managed" });
    expect(store.generationJobs.get("job-managed")).toMatchObject({
      status: "generated",
      provenanceLevel: "runner-recorded",
      outputEvidence: { assetIds: ["asset-job-managed"] }
    });
  });

  test("verification promotes only non-blocking runner output to runner-verified", () => {
    const { store } = seedPhenotypeJob();
    runManagedGenerationJob(store, { generationJobId: "job-managed", runnerId: "mock-runner" }, { apply: true });

    const verified = verifyGenerationOutput(store, { generationJobId: "job-managed", checkedBy: "system" }, { apply: true });
    expect(verified.after).toMatchObject({
      provenanceLevel: "runner-verified",
      verificationSummary: {
        status: "passed",
        blockingReasons: [],
        checkedBy: "system"
      }
    });

    const failedJob = createGenerationJob({
      ...store.generationJobs.get("job-managed"),
      generationJobId: "job-blocked",
      provenanceLevel: "runner-recorded",
      verificationSummary: { status: "not-run" },
      outputEvidence: { assetIds: ["asset-job-managed"] }
    });
    store.generationJobs.create(failedJob);
    const failed = verifyGenerationOutput(
      store,
      {
        generationJobId: "job-blocked",
        checks: [
          {
            checkId: "semantic-road",
            source: "manual",
            severity: "blocking",
            status: "failed",
            reason: "Road appears in the background."
          }
        ]
      },
      { apply: true }
    );
    expect(failed.after).toMatchObject({
      provenanceLevel: "runner-recorded",
      verificationSummary: { status: "failed", blockingReasons: ["Road appears in the background."] }
    });
  });

  test("strict acceptance requires a runner-verified linked job while warn mode reports a warning", () => {
    const { store, version } = seedPhenotypeJob();

    expect(() => acceptPhenotypeVersion(store, { phenotypeVersionId: version.phenotypeVersionId, provenanceMode: "strict" })).toThrow(
      /requires runner-verified generation evidence/
    );

    const warnPreview = acceptPhenotypeVersion(store, { phenotypeVersionId: version.phenotypeVersionId, provenanceMode: "warn" });
    expect(warnPreview.persisted).toBe(false);
    expect(warnPreview.provenanceWarnings[0]).toContain("runner-verified");

    runManagedGenerationJob(store, { generationJobId: "job-managed", runnerId: "mock-runner" }, { apply: true });
    verifyGenerationOutput(store, { generationJobId: "job-managed" }, { apply: true });
    expect(() =>
      acceptPhenotypeVersion(store, { phenotypeVersionId: version.phenotypeVersionId, provenanceMode: "strict" })
    ).not.toThrow();
  });

  test("external reference asset links only raise provenance to external-linked", () => {
    const { store, graph } = seedPhenotypeJob();
    const prepared = prepareReferenceGeneration(store, {
      scope: "graph",
      graphId: graph.graphId,
      referenceType: "moodboard",
      brief: "reference board",
      ids: { generationJobId: "job-reference-external", entityArtifactId: "eca-reference-external" }
    });
    persistReferenceGeneration(store, prepared);

    const linked = linkReferenceAsset(
      store,
      {
        generationJobId: "job-reference-external",
        assetId: "asset-reference-external",
        uri: "eagle://item/reference-external"
      },
      { apply: true }
    );

    expect(linked.persisted).toBe(true);
    expect(store.generationJobs.get("job-reference-external")).toMatchObject({
      executionMode: "external-linked",
      provenanceLevel: "external-linked"
    });
  });
});
