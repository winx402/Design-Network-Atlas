import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultAsset,
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createReviewRecord,
  createDefaultSpeciesNode
} from "@dna/core";
import { createDnaHttpHandler, startDnaHttpServer } from "@dna/server";
import { SqliteDnaStore } from "@dna/sqlite";

function dbPath(name: string) {
  return join(mkdtempSync(join(tmpdir(), `dna-${name}-`)), "dna.sqlite");
}

describe("Phase 15 local HTTP API baseline", () => {
  test("serves health, graph tree, and workbench phenotype data from SQLite", async () => {
    const store = new SqliteDnaStore(dbPath("http-api"));
    store.migrate();
    store.graphs.create(
      createDefaultGraph({
        graphId: "graph-api",
        name: "API Graph",
        purpose: "http api",
        rootNodes: ["node-api"]
      })
    );
    store.nodes.create(createDefaultSpeciesNode({ graphId: "graph-api", nodeId: "node-api", name: "API Species" }));
    store.phenotypes.create(
      createDefaultPhenotype({
        graphId: "graph-api",
        nodeId: "node-api",
        phenotypeId: "ph-api",
        name: "API Phenotype",
        phenotypeType: "image-prompt",
        tags: ["api", "ui"]
      })
    );
    store.phenotypeVersions.create(
      createDefaultPhenotypeVersion({
        graphId: "graph-api",
        nodeId: "node-api",
        phenotypeId: "ph-api",
        phenotypeVersionId: "pv-api",
        nodeVersionId: "node-api@1.0.0",
        promptSnapshot: "API prompt",
        assetIds: ["asset-api"],
        feedback: {
          summary: "Candidate visible in API.",
          items: [
            {
              feedbackId: "fb-api",
              severity: "info",
              source: "human",
              message: "Ready for lifecycle review.",
              createdAt: "2026-06-29T00:00:00.000Z"
            }
          ]
        }
      })
    );
    store.assets.create(
      createDefaultAsset({
        assetId: "asset-api",
        uri: "local://api.png",
        linkedObjectType: "phenotype-version",
        linkedObjectId: "pv-api",
        variantRole: "preview",
        tags: ["preview"]
      })
    );
    store.reviews.create(
      createReviewRecord({
        reviewRecordId: "review-api",
        graphId: "graph-api",
        objectType: "phenotype-version",
        objectId: "pv-api",
        status: "needs-review",
        suggestedActions: ["review through API"]
      })
    );

    const handler = createDnaHttpHandler(store);
    const health = await handler(new Request("http://dna.local/api/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, storage: "sqlite" });

    const tree = await (await handler(new Request("http://dna.local/api/graphs/graph-api/tree"))).json();
    expect(tree.roots.map((root: { nodeId: string }) => root.nodeId)).toEqual(["node-api"]);

    const workbench = await (await handler(new Request("http://dna.local/api/workbench/phenotypes?graphId=graph-api"))).json();
    expect(workbench.phenotypes[0]).toMatchObject({
      id: "ph-api",
      name: "API Phenotype",
      nodeName: "API Species",
      phenotypeType: "image-prompt"
    });
    expect(workbench.phenotypes[0].versions[0].assets[0]).toMatchObject({ id: "asset-api", uri: "local://api.png" });
    expect(workbench.phenotypes[0].versions[0].reviews[0]).toMatchObject({ id: "review-api", status: "needs-review" });
    expect(workbench.phenotypes[0].versions[0].feedback).toMatchObject({
      summary: "Candidate visible in API.",
      items: [{ feedbackId: "fb-api", severity: "info", source: "human" }]
    });

    const webDisabled = await handler(new Request("http://dna.local/"));
    expect(webDisabled.status).toBe(404);

    const webEnabled = await createDnaHttpHandler(store, { webEnabled: true })(new Request("http://dna.local/"));
    expect(webEnabled.status).toBe(200);
    expect(webEnabled.headers.get("content-type")).toContain("text/html");
    const html = await webEnabled.text();
    expect(html).toContain("DNA: Design Network Atlas");
    expect(html).toContain("/api/workbench/snapshot");
    expect(html).toContain("DNA Read-only Explorer");
    expect(html).toContain("Atlas Map");
    expect(html).toContain("Graph Explorer");
    expect(html).toContain("Generation Board");
    expect(html).toContain("Phenotype Library");
    expect(html).toContain("desktop-side-nav");
    expect(html).toContain("scope-bar");
    expect(html).toContain("workspace-grid");
    expect(html).toContain("status-bar");
    expect(html).toContain("mobile-bottom-nav");
    expect(html).toContain("Loading read-only explorer snapshot");
    expect(html).toContain("No DNA records found in this local store.");
    expect(html).toContain("Unable to load explorer data.");
    expect(html).not.toMatch(/\bAccept\b|\bReject\b|\bArchive\b/);
    store.close();
  });

  test("starts a local HTTP server with web page access disabled by default", async () => {
    const store = new SqliteDnaStore(dbPath("http-listen"));
    store.migrate();
    const apiOnly = await startDnaHttpServer(store, { port: 0 });
    try {
      const health = await fetch(`${apiOnly.url}/api/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ ok: true, storage: "sqlite" });
      expect((await fetch(`${apiOnly.url}/`)).status).toBe(404);
    } finally {
      await apiOnly.close();
    }

    const withWeb = await startDnaHttpServer(store, { port: 0, webEnabled: true });
    try {
      const web = await fetch(`${withWeb.url}/`);
      expect(web.status).toBe(200);
      const html = await web.text();
      expect(html).toContain("/api/workbench/snapshot");
      expect(html).not.toMatch(/\bAccept\b|\bReject\b|\bArchive\b/);
    } finally {
      await withWeb.close();
      store.close();
    }
  });
});
