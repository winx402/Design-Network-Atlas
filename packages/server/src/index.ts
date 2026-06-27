import { createServer, IncomingHttpHeaders, Server } from "node:http";
import { AddressInfo } from "node:net";
import { buildGraphTree, ChangeSet, createChangeSet, Graph, PROJECT_VERSION } from "@dna/core";
import { CreateGraphInput, createDnaServices, ServiceResult, WriteOptions } from "@dna/storage";
import { SqliteDnaStore } from "@dna/sqlite";

export type CollaborationMode = "local" | "server";
export type ActorRole = "viewer" | "editor" | "approver" | "admin";

export interface DnaActor {
  actorId: string;
  role: ActorRole;
}

export interface DnaServerContext {
  store: SqliteDnaStore;
  mode: CollaborationMode;
}

export interface SyncConflictInput {
  objectType: string;
  objectId: string;
  localVersion: string;
  incomingVersion: string;
  incomingPayload: Record<string, unknown>;
}

export interface CollaborationAdapter {
  mode: CollaborationMode;
  store: SqliteDnaStore;
  actor?: DnaActor;
  graph: {
    createGraph(input: CreateGraphInput, options: WriteOptions): ServiceResult<Graph>;
  };
  sync: {
    createConflictChangeSet(input: SyncConflictInput): ChangeSet;
  };
  close(): void;
}

export interface DnaHttpHandlerOptions {
  webEnabled?: boolean;
}

export interface DnaHttpServerOptions extends DnaHttpHandlerOptions {
  host?: string;
  port?: number;
}

export interface DnaHttpServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export function createDnaHttpHandler(store: SqliteDnaStore, options: DnaHttpHandlerOptions = {}) {
  return async function handleDnaRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET") return jsonResponse({ error: "method not allowed" }, 405);
    if ((url.pathname === "/" || url.pathname === "/index.html") && options.webEnabled === true) {
      return htmlResponse(createWorkbenchHtml());
    }
    if (url.pathname === "/api/health") {
      return jsonResponse({ ok: true, version: PROJECT_VERSION, storage: "sqlite" });
    }
    if (url.pathname === "/api/graphs") {
      return jsonResponse({ graphs: store.graphs.list() });
    }
    const graphTreeMatch = url.pathname.match(/^\/api\/graphs\/([^/]+)\/tree$/);
    if (graphTreeMatch) {
      const graphId = decodeURIComponent(graphTreeMatch[1]);
      const graph = store.graphs.get(graphId);
      if (!graph) return jsonResponse({ error: `graph not found: ${graphId}` }, 404);
      return jsonResponse(
        buildGraphTree({
          graph,
          nodes: store.nodes.listByGraph(graphId),
          edges: store.edges.listByGraph(graphId)
        })
      );
    }
    if (url.pathname === "/api/workbench/phenotypes") {
      return jsonResponse({ phenotypes: createWorkbenchPhenotypes(store, url.searchParams.get("graphId") ?? undefined) });
    }
    return jsonResponse({ error: "not found" }, 404);
  };
}

export async function startDnaHttpServer(store: SqliteDnaStore, options: DnaHttpServerOptions = {}): Promise<DnaHttpServer> {
  const handler = createDnaHttpHandler(store, { webEnabled: options.webEnabled === true });
  const server = createServer(async (incoming, outgoing) => {
    try {
      const requestUrl = new URL(incoming.url ?? "/", `http://${incoming.headers.host ?? "127.0.0.1"}`);
      const response = await handler(
        new Request(requestUrl, {
          method: incoming.method ?? "GET",
          headers: toRequestHeaders(incoming.headers)
        })
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3042;
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("DNA HTTP server did not expose a TCP address");
  return {
    server,
    url: `http://${formatHost(address)}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

export function createLocalServerContext(dbPath: string): DnaServerContext {
  const store = new SqliteDnaStore(dbPath);
  store.migrate();
  return { store, mode: "local" };
}

export function createLocalCollaborationAdapter(dbPath: string): CollaborationAdapter {
  const store = new SqliteDnaStore(dbPath);
  store.migrate();
  return createAdapter({ mode: "local", store });
}

export function createServerCollaborationAdapter(input: { store: SqliteDnaStore; actor: DnaActor }): CollaborationAdapter {
  return createAdapter({ mode: "server", store: input.store, actor: input.actor });
}

function createAdapter(input: { mode: CollaborationMode; store: SqliteDnaStore; actor?: DnaActor }): CollaborationAdapter {
  const services = createDnaServices(input.store);
  return {
    mode: input.mode,
    store: input.store,
    actor: input.actor,
    graph: {
      createGraph(graphInput, options) {
        assertCanWrite(input.actor, options, "graph create");
        return services.graph.createGraph(graphInput, options);
      }
    },
    sync: {
      createConflictChangeSet(conflictInput) {
        const changeSet = createChangeSet({
          mode: "preview-confirm",
          objectType: conflictInput.objectType,
          operation: "update",
          summary: `sync conflict for ${conflictInput.objectType} ${conflictInput.objectId}`,
          diff: {
            objectId: conflictInput.objectId,
            localVersion: conflictInput.localVersion,
            incomingVersion: conflictInput.incomingVersion
          },
          payload: {
            conflict: conflictInput
          }
        });
        input.store.changeSets.create(changeSet);
        return changeSet;
      }
    },
    close() {
      input.store.close();
    }
  };
}

function assertCanWrite(actor: DnaActor | undefined, options: WriteOptions, action: string) {
  if (!isDurableWrite(options)) return;
  if (!actor) return;
  if (actor.role === "viewer") throw new Error(`actor ${actor.actorId} cannot apply ${action}`);
}

function isDurableWrite(options: WriteOptions) {
  return options.apply === true || options.mode === "draft-write" || options.mode === "changeset-apply";
}

function createWorkbenchPhenotypes(store: SqliteDnaStore, graphId: string | undefined) {
  const graphs = graphId ? [store.graphs.get(graphId)].filter((graph): graph is Graph => Boolean(graph)) : store.graphs.list();
  return graphs.flatMap((graph) =>
    store.phenotypes.listByGraph(graph.graphId).map((phenotype) => {
      const node = store.nodes.get(phenotype.nodeId);
      const versions = store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId);
      const latestSpeciesVersion = node ? `${node.nodeId}@${node.currentVersion}` : "";
      const newestVersion = [...versions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      const currentSpeciesVersion = newestVersion?.nodeVersionId ?? latestSpeciesVersion;
      return {
        id: phenotype.phenotypeId,
        name: phenotype.name,
        nodeName: node?.name ?? phenotype.nodeId,
        phenotypeType: phenotype.phenotypeType,
        tags: phenotype.tags,
        outdated: Boolean(currentSpeciesVersion && latestSpeciesVersion && currentSpeciesVersion !== latestSpeciesVersion),
        currentSpeciesVersion,
        latestSpeciesVersion,
        currentAcceptedVersionId: phenotype.currentAcceptedVersion,
        versions: versions.map((version) => ({
          id: version.phenotypeVersionId,
          speciesVersion: version.nodeVersionId,
          createdAt: version.createdAt,
          status: version.status,
          promptSnapshot: version.promptSnapshot,
          assets: version.assetIds
            .map((assetId) => store.assets.get(assetId))
            .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
            .map((asset) => ({
              id: asset.assetId,
              label: asset.description || asset.assetId,
              uri: asset.uri,
              variantRole: asset.variantRole ?? "source-file",
              status: asset.status,
              tags: asset.tags
            })),
          reviews: store.reviews.listByObject("phenotype-version", version.phenotypeVersionId).map((review) => ({
            id: review.reviewRecordId,
            status: review.status,
            summary: review.suggestedActions[0] ?? review.status,
            missingDimensions: review.missingDimensions,
            constraintViolations: review.constraintViolations,
            suggestedActions: review.suggestedActions
          }))
        }))
      };
    })
  );
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function htmlResponse(value: string, status = 200) {
  return new Response(value, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function toRequestHeaders(incomingHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

function formatHost(address: AddressInfo): string {
  if (address.family === "IPv6" || address.address.includes(":")) return `[${address.address}]`;
  return address.address;
}

function createWorkbenchHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DNA: Design Network Atlas</title>
    <style>
      :root {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17212b;
        background: #f5f7f8;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; background: #f5f7f8; }
      main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 36px; }
      header { display: flex; justify-content: space-between; align-items: end; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid #d5dde3; }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 0; font-size: 32px; line-height: 1.15; letter-spacing: 0; }
      h2 { margin-bottom: 6px; font-size: 24px; line-height: 1.2; letter-spacing: 0; }
      h3 { margin-bottom: 8px; font-size: 14px; line-height: 1.3; letter-spacing: 0; }
      .product-name { margin: 0 0 6px; color: #577084; font-size: 13px; line-height: 1.3; }
      .state { display: grid; gap: 4px; margin-top: 16px; padding: 12px 14px; border: 1px solid #b9c6cf; border-radius: 8px; background: #ffffff; font-size: 14px; line-height: 1.45; }
      .state.error { border-color: #d58d91; color: #842c31; background: #fff2f2; }
      .metrics { display: grid; grid-template-columns: repeat(3, minmax(88px, 1fr)); gap: 10px; margin: 0; }
      .metrics div, .panel, .list { border: 1px solid #d5dde3; border-radius: 8px; background: #ffffff; }
      .metrics div { padding: 10px 12px; }
      .metrics dt { color: #657888; font-size: 12px; }
      .metrics dd { margin: 2px 0 0; font-size: 22px; font-weight: 700; }
      .workspace { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px; align-items: start; margin-top: 18px; }
      .list { overflow: hidden; }
      .row { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; min-height: 64px; padding: 12px 14px; border-bottom: 1px solid #e4e9ed; background: #ffffff; }
      .row:last-child { border-bottom: 0; }
      .row strong, .row small { display: block; overflow-wrap: anywhere; }
      .row small, .muted { color: #657888; font-size: 13px; line-height: 1.35; }
      .panel { display: grid; gap: 14px; min-width: 0; padding: 18px; }
      .empty { min-height: 240px; align-content: center; justify-items: center; text-align: center; }
      .chip { display: inline-flex; align-items: center; min-height: 24px; border-radius: 999px; padding: 3px 9px; color: #4f6475; background: #e7edf1; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .asset-grid { display: grid; gap: 8px; }
      .asset { display: grid; grid-template-columns: minmax(0, 1fr) minmax(120px, 0.45fr); gap: 12px; padding: 10px; border: 1px solid #e4e9ed; border-radius: 7px; font-size: 13px; }
      code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      code { overflow-wrap: anywhere; color: #415669; }
      pre { overflow: auto; margin: 0; padding: 12px; border: 1px solid #e4e9ed; border-radius: 7px; background: #f7f9fa; white-space: pre-wrap; }
      @media (max-width: 820px) {
        main { width: min(100vw - 20px, 760px); padding-top: 18px; }
        header, .workspace { display: grid; grid-template-columns: 1fr; align-items: start; }
        .metrics { grid-template-columns: 1fr; }
        .asset { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="product-name">DNA: Design Network Atlas</p>
          <h1>Read-only Workbench</h1>
        </div>
        <dl class="metrics" aria-label="Workbench metrics">
          <div><dt>Phenotypes</dt><dd id="metric-phenotypes">0</dd></div>
          <div><dt>Pending</dt><dd id="metric-pending">0</dd></div>
          <div><dt>Outdated</dt><dd id="metric-outdated">0</dd></div>
        </dl>
      </header>
      <section id="state" class="state" aria-live="polite">Loading phenotype workbench from /api/workbench/phenotypes...</section>
      <section class="workspace" aria-label="Read-only phenotype workbench">
        <aside id="list" class="list" aria-label="Phenotypes"></aside>
        <section id="detail" class="panel empty" aria-label="Phenotype detail">
          <h2>No phenotype selected</h2>
          <p class="muted">Workbench data is loaded from the local DNA API. Durable writes stay in CLI/service boundaries.</p>
        </section>
      </section>
    </main>
    <script>
      const endpoint = "/api/workbench/phenotypes";
      const state = document.getElementById("state");
      const list = document.getElementById("list");
      const detail = document.getElementById("detail");
      const metricPhenotypes = document.getElementById("metric-phenotypes");
      const metricPending = document.getElementById("metric-pending");
      const metricOutdated = document.getElementById("metric-outdated");

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[character]);
      }

      function selectedVersion(phenotype) {
        if (!phenotype?.versions?.length) return undefined;
        if (phenotype.currentAcceptedVersionId) {
          const accepted = phenotype.versions.find((version) => version.id === phenotype.currentAcceptedVersionId);
          if (accepted) return accepted;
        }
        return [...phenotype.versions].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
      }

      function renderDetail(phenotype) {
        const version = selectedVersion(phenotype);
        const review = version?.reviews?.[0];
        const assets = version?.assets ?? [];
        detail.className = "panel";
        detail.innerHTML =
          '<div><p class="product-name">' + escapeHtml(phenotype.phenotypeType) + '</p><h2>' + escapeHtml(phenotype.name) + '</h2>' +
          '<p class="muted">' + escapeHtml(phenotype.nodeName) + ' - ' + escapeHtml(version?.speciesVersion ?? "no version") + '</p></div>' +
          (phenotype.outdated ? '<div class="state">Current species snapshot is ' + escapeHtml(phenotype.currentSpeciesVersion) + '; latest is ' + escapeHtml(phenotype.latestSpeciesVersion) + '.</div>' : '') +
          '<section><h3>Assets and output references</h3><div class="asset-grid">' +
          (assets.length ? assets.map((asset) => '<div class="asset"><strong>' + escapeHtml(asset.label) + '</strong><code>' + escapeHtml(asset.uri) + '</code></div>').join('') : '<p class="muted">No assets or output references are registered for this version.</p>') +
          '</div></section>' +
          '<section><h3>Review</h3><p>' + escapeHtml(review?.summary ?? 'No review record yet.') + '</p></section>' +
          '<section><h3>Prompt Snapshot</h3><pre>' + escapeHtml(version?.promptSnapshot ?? 'No prompt snapshot recorded.') + '</pre></section>';
      }

      function render(phenotypes) {
        metricPhenotypes.textContent = String(phenotypes.length);
        metricPending.textContent = String(phenotypes.filter((phenotype) => selectedVersion(phenotype)?.status === "pending-confirmation").length);
        metricOutdated.textContent = String(phenotypes.filter((phenotype) => phenotype.outdated).length);
        if (phenotypes.length === 0) {
          state.className = "state";
          state.textContent = "No phenotypes found in this local store.";
          list.innerHTML = '<div class="row"><span><strong>No phenotypes found</strong><small>Create phenotypes through the CLI/service boundary, then refresh this read-only workbench.</small></span></div>';
          detail.className = "panel empty";
          detail.innerHTML = '<h2>No phenotypes found</h2><p class="muted">This read-only page did not modify the DNA store.</p>';
          return;
        }
        state.className = "state";
        state.textContent = "Loaded " + phenotypes.length + " phenotype record(s) from the local API.";
        list.innerHTML = phenotypes.map((phenotype, index) => {
          const version = selectedVersion(phenotype);
          return '<button class="row" type="button" data-index="' + index + '"><span><strong>' + escapeHtml(phenotype.name) + '</strong><small>' + escapeHtml(phenotype.nodeName) + '</small></span><span class="chip">' + escapeHtml(version?.status ?? 'no-version') + '</span></button>';
        }).join('');
        for (const row of list.querySelectorAll('button[data-index]')) {
          row.addEventListener('click', () => renderDetail(phenotypes[Number(row.dataset.index)]));
        }
        renderDetail(phenotypes[0]);
      }

      fetch(endpoint)
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then((body) => render(Array.isArray(body.phenotypes) ? body.phenotypes : []))
        .catch((error) => {
          state.className = "state error";
          state.innerHTML = '<strong>Unable to load workbench data.</strong><span>' + escapeHtml(error.message || error) + '</span>';
          list.innerHTML = '';
          detail.className = "panel empty";
          detail.innerHTML = '<h2>Unable to load workbench data.</h2><p class="muted">No durable DNA records were changed by this read-only page.</p>';
        });
    </script>
  </body>
</html>`;
}
