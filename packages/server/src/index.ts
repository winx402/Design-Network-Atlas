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
  </head>
  <body>
    <main id="root">
      <h1>DNA: Design Network Atlas</h1>
      <p>Local HTTP API is enabled. Web access is disabled by default and must be explicitly enabled.</p>
    </main>
  </body>
</html>`;
}
