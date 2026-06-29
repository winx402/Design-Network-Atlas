import { describe, expect, test } from "vitest";
import {
  acceptOutputReference,
  archiveOutputReference,
  replaceOutputReference,
  syncOutputReferencesForPhenotypeVersion
} from "@dna/application";
import {
  createDefaultGraph,
  createDefaultOutputReference,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode
} from "@dna/core";
import { InMemoryDnaStore } from "@dna/storage";

function seedStore() {
  const store = new InMemoryDnaStore();
  const graph = createDefaultGraph({ graphId: "graph-output", name: "Output Graph", purpose: "output lifecycle" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-output", name: "Output Species" });
  const phenotype = createDefaultPhenotype({
    phenotypeId: "phenotype-output",
    graphId: graph.graphId,
    nodeId: node.nodeId,
    name: "Output Phenotype",
    phenotypeType: "image"
  });
  const version = createDefaultPhenotypeVersion({
    phenotypeVersionId: "pv-output",
    phenotypeId: phenotype.phenotypeId,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    status: "accepted",
    promptSnapshot: "stable prompt",
    generationRecipe: { seed: 42 }
  });
  const pending = createDefaultOutputReference({
    outputReferenceId: "out-pending",
    graphId: graph.graphId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: version.phenotypeVersionId,
    uri: "eagle://item/pending",
    referenceType: "eagle",
    role: "candidate",
    metadata: { keep: "value" }
  });
  const stale = createDefaultOutputReference({
    outputReferenceId: "out-stale",
    graphId: graph.graphId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: version.phenotypeVersionId,
    uri: "git://repo/export.png",
    referenceType: "git",
    role: "primary-output",
    status: "stale"
  });
  const supporting = createDefaultOutputReference({
    outputReferenceId: "out-source",
    graphId: graph.graphId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: version.phenotypeVersionId,
    uri: "git://repo/source.psd",
    referenceType: "git",
    role: "source",
    status: "pending"
  });

  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  store.phenotypeVersions.create(version);
  store.outputReferences.create(pending);
  store.outputReferences.create(stale);
  store.outputReferences.create(supporting);
  return { store, version, pending, stale, supporting };
}

describe("Phase 32 output reference lifecycle application service", () => {
  test("previews and applies lifecycle status updates without mutating generated provenance", () => {
    const { store, version, pending } = seedStore();
    const secretEnvName = ["OPENAI", "API", "KEY"].join("_");
    const secretLikeReason = `accept after human review ${secretEnvName}=placeholder`;

    const preview = acceptOutputReference(store, {
      outputReferenceId: pending.outputReferenceId,
      reason: secretLikeReason
    });
    expect(preview.persisted).toBe(false);
    expect(preview.changes).toEqual([
      expect.objectContaining({ outputReferenceId: pending.outputReferenceId, from: "pending", to: "active" })
    ]);
    expect(store.outputReferences.get(pending.outputReferenceId)?.status).toBe("pending");

    const applied = acceptOutputReference(store, {
      outputReferenceId: pending.outputReferenceId,
      reason: secretLikeReason,
      apply: true
    });
    const updated = store.outputReferences.get(pending.outputReferenceId);
    const unchangedVersion = store.phenotypeVersions.get(version.phenotypeVersionId);

    expect(applied.persisted).toBe(true);
    expect(updated?.status).toBe("active");
    expect(updated?.metadata.keep).toBe("value");
    expect(JSON.stringify(updated?.metadata.lifecycle)).not.toContain("placeholder");
    expect(JSON.stringify(updated?.metadata.lifecycle)).not.toContain(secretEnvName);
    expect(unchangedVersion?.promptSnapshot).toBe(version.promptSnapshot);
    expect(unchangedVersion?.generationRecipe).toEqual(version.generationRecipe);
    expect(unchangedVersion?.status).toBe("accepted");
  });

  test("replaces references atomically and preserves unrelated metadata", () => {
    const { store } = seedStore();
    const oldReference = store.outputReferences.get("out-pending")!;
    const newReference = createDefaultOutputReference({
      outputReferenceId: "out-new",
      graphId: oldReference.graphId,
      phenotypeId: oldReference.phenotypeId,
      phenotypeVersionId: oldReference.phenotypeVersionId,
      uri: "eagle://item/new",
      referenceType: "eagle",
      role: "candidate",
      metadata: { newKeep: true }
    });
    store.outputReferences.create(newReference);

    const preview = replaceOutputReference(store, {
      oldOutputReferenceId: oldReference.outputReferenceId,
      newOutputReferenceId: newReference.outputReferenceId,
      reason: "replacement accepted"
    });
    expect(preview.persisted).toBe(false);
    expect(store.outputReferences.get(oldReference.outputReferenceId)?.status).toBe("pending");
    expect(store.outputReferences.get(newReference.outputReferenceId)?.status).toBe("pending");

    const applied = replaceOutputReference(store, {
      oldOutputReferenceId: oldReference.outputReferenceId,
      newOutputReferenceId: newReference.outputReferenceId,
      reason: "replacement accepted",
      apply: true
    });
    expect(applied.changes.map((change) => [change.outputReferenceId, change.from, change.to])).toEqual([
      [oldReference.outputReferenceId, "pending", "archived"],
      [newReference.outputReferenceId, "pending", "active"]
    ]);
    expect(store.outputReferences.get(oldReference.outputReferenceId)?.metadata.lifecycle).toMatchObject({
      action: "replace",
      replacedBy: newReference.outputReferenceId,
      reason: "replacement accepted"
    });
    expect(store.outputReferences.get(newReference.outputReferenceId)?.metadata.lifecycle).toMatchObject({
      action: "replace",
      replaces: oldReference.outputReferenceId,
      reason: "replacement accepted"
    });
    expect(store.outputReferences.get(newReference.outputReferenceId)?.metadata.newKeep).toBe(true);
  });

  test("sync only promotes generated-output roles for accepted versions", () => {
    const { store, supporting } = seedStore();
    archiveOutputReference(store, { outputReferenceId: "out-stale", apply: true });

    const sync = syncOutputReferencesForPhenotypeVersion(store, {
      phenotypeVersionId: "pv-output",
      apply: true
    });
    expect(sync.changes.map((change) => [change.outputReferenceId, change.from, change.to])).toEqual([
      ["out-pending", "pending", "active"]
    ]);
    expect(store.outputReferences.get("out-pending")?.status).toBe("active");
    expect(store.outputReferences.get("out-stale")?.status).toBe("archived");
    expect(store.outputReferences.get(supporting.outputReferenceId)?.status).toBe("pending");
  });

  test("replace validates graph and phenotype-version identity before writing", () => {
    const { store } = seedStore();
    store.outputReferences.create(
      createDefaultOutputReference({
        outputReferenceId: "out-other",
        graphId: "graph-other",
        phenotypeVersionId: "pv-output",
        uri: "eagle://item/other",
        referenceType: "eagle",
        role: "candidate"
      })
    );

    expect(() =>
      replaceOutputReference(store, {
        oldOutputReferenceId: "out-pending",
        newOutputReferenceId: "out-other",
        apply: true
      })
    ).toThrow(/same graph/);
    expect(store.outputReferences.get("out-pending")?.status).toBe("pending");
    expect(store.outputReferences.get("out-other")?.status).toBe("pending");
  });
});
