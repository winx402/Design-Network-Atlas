import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultAsset,
  createDefaultContextAttachment,
  createDefaultDesignContext,
  createDefaultGraph,
  createDefaultNodeVersion,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultSpeciesNode
} from "@dna/core";
import { createDnaServices, createInMemoryDnaStore } from "@dna/storage";

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

describe("graph reset service workflow", () => {
  test("previews and applies a graph-scoped metadata reset while preserving shared records and external files", () => {
    const dir = tempDir("graph-reset-service");
    const externalFile = join(dir, "external-output.png");
    writeFileSync(externalFile, "external binary placeholder");
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    store.graphs.create(createDefaultGraph({ graphId: "graph-reset", name: "Reset Graph", purpose: "local pilot" }));
    store.nodes.create(createDefaultSpeciesNode({ graphId: "graph-reset", nodeId: "node-reset", name: "Reset Node" }));
    store.nodeVersions.create(
      createDefaultNodeVersion({
        graphId: "graph-reset",
        nodeId: "node-reset",
        nodeVersionId: "node-reset@1.0.0"
      })
    );
    store.designContexts.create(
      createDefaultDesignContext({
        contextId: "ctx-shared",
        name: "Shared Context",
        contextType: "custom"
      })
    );
    store.contextAttachments.create(
      createDefaultContextAttachment({
        attachmentId: "attach-graph-reset",
        contextId: "ctx-shared",
        targetType: "graph",
        targetId: "graph-reset"
      })
    );
    store.assets.create(
      createDefaultAsset({
        assetId: "asset-reset",
        uri: externalFile,
        linkedObjectType: "node",
        linkedObjectId: "node-reset"
      })
    );
    store.phenotypeLibraries.create(
      createDefaultPhenotypeLibrary({
        libraryId: "library-shared",
        name: "Shared Library",
        purpose: "preserved",
        graphIds: ["graph-reset"]
      })
    );
    store.phenotypeLibraryGraphBindings.create(
      createDefaultPhenotypeLibraryGraphBinding({
        bindingId: "binding-reset",
        libraryId: "library-shared",
        graphId: "graph-reset"
      })
    );

    const preview = services.graph.previewReset("graph-reset");

    expect(preview.counts.graphs).toBe(1);
    expect(preview.counts.nodes).toBe(1);
    expect(preview.counts.assets).toBe(1);
    expect(preview.counts.contextAttachments).toBe(1);
    expect(store.graphs.get("graph-reset")).toBeDefined();

    const applied = services.graph.reset("graph-reset");

    expect(applied.counts.graphs).toBe(1);
    expect(store.graphs.get("graph-reset")).toBeUndefined();
    expect(store.nodes.get("node-reset")).toBeUndefined();
    expect(store.nodeVersions.get("node-reset@1.0.0")).toBeUndefined();
    expect(store.assets.get("asset-reset")).toBeUndefined();
    expect(store.contextAttachments.get("attach-graph-reset")).toBeUndefined();
    expect(store.designContexts.get("ctx-shared")).toBeDefined();
    expect(store.phenotypeLibraries.get("library-shared")?.graphIds).toEqual([]);
    expect(store.phenotypeLibraryGraphBindings.listByGraph("graph-reset")).toEqual([]);
    expect(existsSync(externalFile)).toBe(true);
  });
});
