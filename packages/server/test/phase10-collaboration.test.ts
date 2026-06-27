import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createLocalCollaborationAdapter, createServerCollaborationAdapter } from "@dna/server";
import { SqliteDnaStore } from "@dna/sqlite";

function dbPath(name: string) {
  return join(mkdtempSync(join(tmpdir(), `dna-${name}-`)), "dna.sqlite");
}

describe("Phase 10 dual-mode collaboration adapters", () => {
  test("local and server adapters share the graph creation service contract", () => {
    const local = createLocalCollaborationAdapter(dbPath("local-adapter"));
    const serverStore = new SqliteDnaStore(dbPath("server-adapter"));
    serverStore.migrate();
    const server = createServerCollaborationAdapter({
      store: serverStore,
      actor: { actorId: "editor-1", role: "editor" }
    });

    for (const adapter of [local, server]) {
      const preview = adapter.graph.createGraph(
        { graphId: `graph-${adapter.mode}`, name: `${adapter.mode} graph`, purpose: "contract" },
        { mode: "preview-confirm", apply: false }
      );
      expect(preview.changeSet.status).toBe("preview");
      expect(adapter.store.graphs.get(`graph-${adapter.mode}`)).toBeUndefined();

      const applied = adapter.graph.createGraph(
        { graphId: `graph-${adapter.mode}`, name: `${adapter.mode} graph`, purpose: "contract" },
        { mode: "preview-confirm", apply: true }
      );
      expect(applied.changeSet.status).toBe("applied");
      expect(adapter.store.graphs.get(`graph-${adapter.mode}`)?.name).toBe(`${adapter.mode} graph`);
    }

    local.close();
    server.close();
  });

  test("server viewer can preview but cannot apply durable writes", () => {
    const store = new SqliteDnaStore(dbPath("viewer-adapter"));
    store.migrate();
    const adapter = createServerCollaborationAdapter({
      store,
      actor: { actorId: "viewer-1", role: "viewer" }
    });

    const preview = adapter.graph.createGraph(
      { graphId: "graph-viewer", name: "Viewer", purpose: "permission" },
      { mode: "preview-confirm", apply: false }
    );
    expect(preview.changeSet.status).toBe("preview");
    expect(() =>
      adapter.graph.createGraph(
        { graphId: "graph-viewer", name: "Viewer", purpose: "permission" },
        { mode: "preview-confirm", apply: true }
      )
    ).toThrow("actor viewer-1 cannot apply graph create");
    expect(store.graphs.get("graph-viewer")).toBeUndefined();
    adapter.close();
  });

  test("sync conflict creates a preview change-set instead of overwriting local state", () => {
    const adapter = createLocalCollaborationAdapter(dbPath("sync-conflict"));
    adapter.graph.createGraph(
      { graphId: "graph-sync", name: "Local Graph", purpose: "sync" },
      { mode: "preview-confirm", apply: true }
    );

    const conflict = adapter.sync.createConflictChangeSet({
      objectType: "graph",
      objectId: "graph-sync",
      localVersion: "1.0.0",
      incomingVersion: "2.0.0",
      incomingPayload: { name: "Remote Graph" }
    });

    expect(conflict.status).toBe("preview");
    expect(conflict.preview.summary).toContain("sync conflict");
    expect(adapter.store.graphs.get("graph-sync")?.name).toBe("Local Graph");
    adapter.close();
  });
});
