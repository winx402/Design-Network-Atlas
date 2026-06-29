import { createServer, IncomingHttpHeaders, Server } from "node:http";
import { AddressInfo } from "node:net";
import {
  buildGraphTree,
  ChangeSet,
  createChangeSet,
  Graph,
  PROJECT_VERSION,
  type AssetIndex,
  type DesignRelationship,
  type GenerationJob,
  type OutputReference,
  type Phenotype,
  type PhenotypeGenerationPlan,
  type PhenotypeGenerationTask,
  type PhenotypeLibrary,
  type PhenotypeVersion,
  type SpeciesGroup,
  type SpeciesNode,
  type StorageMount
} from "@dna/core";
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
          relationships: store.designRelationships.listByGraph(graphId)
        })
      );
    }
    if (url.pathname === "/api/workbench/snapshot") {
      const graphId = url.searchParams.get("graphId") ?? undefined;
      if (graphId && !store.graphs.get(graphId)) {
        return missingWorkbenchGraphResponse(graphId);
      }
      return jsonResponse(createReadonlyWorkbenchSnapshot(store, graphId));
    }
    if (url.pathname === "/api/workbench/graph-map") {
      const graphId = url.searchParams.get("graphId") ?? undefined;
      if (graphId && !store.graphs.get(graphId)) return missingWorkbenchGraphResponse(graphId);
      return jsonResponse(createWorkbenchGraphMap(store, graphId));
    }
    const workbenchGraphMatch = url.pathname.match(/^\/api\/workbench\/graphs\/([^/]+)$/);
    if (workbenchGraphMatch) {
      const graphId = decodeURIComponent(workbenchGraphMatch[1]);
      if (!store.graphs.get(graphId)) return missingWorkbenchGraphResponse(graphId);
      return jsonResponse(createWorkbenchGraphExplorerView(store, graphId));
    }
    if (url.pathname === "/api/workbench/generation") {
      const graphId = url.searchParams.get("graphId") ?? undefined;
      if (graphId && !store.graphs.get(graphId)) return missingWorkbenchGraphResponse(graphId);
      return jsonResponse(createWorkbenchGenerationBoard(store, graphId));
    }
    if (url.pathname === "/api/workbench/library") {
      const graphId = url.searchParams.get("graphId") ?? undefined;
      if (graphId && !store.graphs.get(graphId)) return missingWorkbenchGraphResponse(graphId);
      return jsonResponse(createWorkbenchLibraryView(store, graphId));
    }
    if (url.pathname === "/api/workbench/phenotypes") {
      return jsonResponse(createLegacyWorkbenchSnapshot(store, url.searchParams.get("graphId") ?? undefined));
    }
    if (url.pathname === "/api/generation-plans") {
      return jsonResponse({ plans: createGenerationPlanSummaries(store, url.searchParams.get("graphId") ?? undefined) });
    }
    if (url.pathname === "/api/generation-tasks") {
      return jsonResponse({ tasks: createGenerationTaskSummaries(store, url.searchParams.get("graphId") ?? undefined) });
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

function createLegacyWorkbenchSnapshot(store: SqliteDnaStore, graphId: string | undefined) {
  return {
    phenotypes: createWorkbenchPhenotypes(store, graphId),
    generationPlans: createGenerationPlanSummaries(store, graphId),
    generationTasks: createGenerationTaskSummaries(store, graphId)
  };
}

function createReadonlyWorkbenchSnapshot(store: SqliteDnaStore, graphId: string | undefined) {
  const graphs = getScopedGraphs(store, graphId);
  const graphIds = new Set(graphs.map((graph) => graph.graphId));
  const graphPhenotypes = graphs.flatMap((graph) => store.phenotypes.listByGraph(graph.graphId));
  const designRelationships = uniqueById(graphs.flatMap((graph) => store.designRelationships.listByGraph(graph.graphId)), (relationship) => relationship.relationshipId);
  const phenotypeVersions = graphPhenotypes.flatMap((phenotype) => store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId));
  const generationPlans = graphs.flatMap((graph) => store.generationPlans.listByGraph(graph.graphId));
  const generationTasks = graphs.flatMap((graph) => store.generationTasks.listByGraph(graph.graphId));
  const generationJobs = graphs.flatMap((graph) => store.generationJobs.listByGraph(graph.graphId));
  const outputReferences = graphs.flatMap((graph) => store.outputReferences.listByGraph(graph.graphId));
  const assets = uniqueById(graphs.flatMap((graph) => store.assets.search({ graphId: graph.graphId })), (asset) => asset.assetId);
  const currentAssets = assets.filter(isCurrentAssetPointer);
  const libraries = getScopedLibraries(store, graphIds);
  const mounts = libraries.flatMap((library) => store.storageMounts.listByLibrary(library.libraryId));
  const resultPreviews = [
    ...outputReferences.map((reference) => createOutputReferencePreview(store, reference)),
    ...currentAssets.map((asset) => createAssetPreview(store, asset))
  ];

  return {
    overview: {
      counts: {
        graphs: graphs.length,
        activeGraphs: graphs.filter((graph) => graph.status === "active").length,
        speciesGroups: graphs.reduce((count, graph) => count + store.speciesGroups.listByGraph(graph.graphId).length, 0),
        speciesNodes: graphs.reduce((count, graph) => count + store.nodes.listByGraph(graph.graphId).length, 0),
        designRelationships: designRelationships.length,
        phenotypes: graphPhenotypes.length,
        phenotypeVersions: phenotypeVersions.length,
        candidateVersions: phenotypeVersions.filter((version) => version.status === "candidate").length,
        acceptedVersions: phenotypeVersions.filter((version) => version.status === "accepted").length,
        deprecatedOrReplacedVersions: phenotypeVersions.filter((version) => ["deprecated", "replaced", "rolled-back"].includes(version.status)).length,
        generationPlans: generationPlans.length,
        generationTasks: generationTasks.length,
        generationJobs: generationJobs.length,
        failedGenerationJobs: generationJobs.filter((job) => job.status === "failed").length,
        outputReferences: outputReferences.length,
        missingOrStaleOutputReferences: outputReferences.filter((reference) => ["missing", "stale"].includes(reference.status)).length,
        libraries: libraries.length,
        mounts: mounts.length
      },
      anomalies: createWorkbenchAnomalies({ graphs, generationJobs, outputReferences }),
      latest: {
        graphs: graphs.slice(-5).map((graph) => ({ graphId: graph.graphId, name: graph.name, updatedAt: graph.updatedAt })),
        phenotypeVersions: [...phenotypeVersions]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 5)
          .map((version) => ({
            phenotypeVersionId: version.phenotypeVersionId,
            phenotypeId: version.phenotypeId,
            status: version.status,
            createdAt: version.createdAt
          })),
        failedJobs: generationJobs
          .filter((job) => job.status === "failed")
          .slice(-5)
          .map((job) => ({ generationJobId: job.generationJobId, graphId: job.graphId, updatedAt: job.updatedAt }))
      }
    },
    graphs: graphs.map((graph) => createGraphWorkbenchDetail(store, graph)),
    generation: {
      plans: generationPlans.map((plan) => ({
        ...createGenerationPlanSummary(store, plan),
        llmInstructionsSummary: summarizeText(plan.llmInstructions),
        operatorNotesSummary: summarizeText(plan.operatorNotes),
        rawJsonSummary: sanitizeForWorkbench(plan)
      })),
      tasks: generationTasks.map((task) => ({
        ...createGenerationTaskSummary(task),
        trace: {
          planId: task.planId,
          speciesCompileArtifactId: task.speciesCompileArtifactId,
          phenotypeCompileArtifactId: task.phenotypeCompileArtifactId,
          generationJobIds: task.generationJobIds,
          phenotypeVersionIds: task.phenotypeVersionIds
        },
        rawJsonSummary: sanitizeForWorkbench(task)
      })),
      jobs: generationJobs.map((job) => createGenerationJobSummary(job))
    },
    libraries: libraries.map((library) => {
      const libraryMounts = store.storageMounts.listByLibrary(library.libraryId);
      const libraryReferences = outputReferences.filter((reference) => reference.libraryId === library.libraryId);
      const libraryVersionIds = new Set(libraryReferences.map((reference) => reference.phenotypeVersionId));
      return {
        libraryId: library.libraryId,
        name: library.name,
        purpose: library.purpose,
        profile: library.profile,
        status: library.status,
        graphIds: library.graphIds.filter((id) => graphIds.size === 0 || graphIds.has(id)),
        boundGraphCount: library.graphIds.filter((id) => graphIds.size === 0 || graphIds.has(id)).length,
        mountCount: libraryMounts.length,
        routingPolicyCount: store.libraryRoutingPolicies.listByLibrary(library.libraryId).length,
        outputReferenceCount: libraryReferences.length,
        mounts: libraryMounts.map((mount) => createMountSummary(mount)),
        routingPolicies: store.libraryRoutingPolicies.listByLibrary(library.libraryId).map((policy) => sanitizeForWorkbench(policy)),
        results: phenotypeVersions
          .filter((version) => libraryVersionIds.has(version.phenotypeVersionId))
          .sort((left, right) => versionResultPriority(store, left) - versionResultPriority(store, right) || right.createdAt.localeCompare(left.createdAt))
          .map((version) => createLibraryResultSummary(store, version, libraryReferences)),
        gallery: resultPreviews.filter(
          (preview) => preview.libraryId === library.libraryId && (preview.preview.kind === "image" || preview.objectType === "asset")
        ),
        rawJsonSummary: sanitizeForWorkbench(library)
      };
    }),
    outputReferences: outputReferences.map((reference) => createOutputReferenceSummary(store, reference)),
    assets: assets.map((asset) => createAssetSummary(store, asset)),
    resultPreviews
  };
}

function createWorkbenchGraphMap(store: SqliteDnaStore, graphId: string | undefined) {
  const graphs = getScopedGraphs(store, graphId);
  const graphIds = new Set(graphs.map((graph) => graph.graphId));
  const graphRelationships = store.designRelationships
    .list()
    .filter((relationship) => relationship.source.type === "graph" && relationship.target.type === "graph")
    .filter((relationship) => !graphId || graphIds.has(relationship.source.graphId) || graphIds.has(relationship.target.graphId));

  return {
    graphs: graphs.map((graph) => {
      const detail = createGraphWorkbenchDetail(store, graph);
      return {
        id: graph.graphId,
        graphId: graph.graphId,
        name: graph.name,
        purpose: graph.purpose,
        status: graph.status,
        tags: [graph.currentVersion ? `v${graph.currentVersion}` : undefined, graph.status].filter((value): value is string => Boolean(value)),
        counts: {
          groups: detail.counts.groups,
          species: detail.counts.nodes,
          phenotypes: detail.counts.phenotypes,
          relationships: detail.counts.relationships,
          assets: store.assets.search({ graphId: graph.graphId }).length,
          openTasks: store.generationTasks.listByGraph(graph.graphId).filter((task) => !["completed", "cancelled"].includes(task.status)).length
        }
      };
    }),
    relationships: graphRelationships.map((relationship) => ({
      id: relationship.relationshipId,
      relationshipId: relationship.relationshipId,
      sourceGraphId: relationship.source.graphId,
      targetGraphId: relationship.target.graphId,
      relationshipType: relationship.relationshipType,
      direction: relationship.direction,
      status: relationship.status,
      summary: relationship.description || relationship.designContract.transferRule || relationship.relationshipType,
      designContract: sanitizeForWorkbench(relationship.designContract)
    })),
    legend: {
      node: "Graph board",
      edge: "Graph-level DesignRelationship",
      readOnly: true
    }
  };
}

function createWorkbenchGraphExplorerView(store: SqliteDnaStore, graphId: string) {
  const graph = store.graphs.get(graphId);
  if (!graph) throw new Error(`graph not found: ${graphId}`);
  const detail = createGraphWorkbenchDetail(store, graph);
  const generationLinks = [
    ...store.generationPlans.listByGraph(graphId).map((plan) => ({
      objectType: "plan",
      objectId: plan.planId,
      status: plan.status,
      summary: plan.description,
      scopeType: plan.scopeType,
      scopeId: plan.scopeId
    })),
    ...store.generationTasks.listByGraph(graphId).map((task) => ({
      objectType: "task",
      objectId: task.taskId,
      status: task.status,
      summary: task.taskBrief,
      planId: task.planId,
      phenotypeId: task.phenotypeId
    })),
    ...store.generationJobs.listByGraph(graphId).map((job) => ({
      objectType: "job",
      objectId: job.generationJobId,
      status: job.status,
      summary: job.taskBrief,
      phenotypeId: job.phenotypeId,
      phenotypeVersionId: job.phenotypeVersionId
    }))
  ];
  const assetLinks = createReadonlyWorkbenchSnapshot(store, graphId).resultPreviews.map((preview) => ({
    objectType: preview.objectType,
    objectId: preview.objectId,
    status: preview.status,
    phenotypeId: preview.phenotypeId,
    phenotypeVersionId: preview.phenotypeVersionId,
    preview: preview.preview
  }));

  return {
    graph: {
      graphId: detail.graphId,
      id: detail.graphId,
      name: detail.name,
      purpose: detail.purpose,
      status: detail.status,
      currentVersion: detail.currentVersion,
      counts: detail.counts
    },
    groups: detail.groups,
    species: detail.nodes,
    relationships: detail.relationships,
    boundSemantics: detail.semantics,
    phenotypes: detail.phenotypeOverlay,
    generationLinks,
    assetLinks,
    compileArtifacts: detail.compileTrace.artifacts,
    rawJsonSummary: detail.rawJsonSummary
  };
}

function createWorkbenchGenerationBoard(store: SqliteDnaStore, graphId: string | undefined) {
  const snapshot = createReadonlyWorkbenchSnapshot(store, graphId);
  return {
    traceLegend: "Plan -> Task -> Compile Artifact -> Generation Job -> Phenotype Version -> Output Reference / Asset",
    plans: snapshot.generation.plans,
    tasks: snapshot.generation.tasks.map((task) => ({
      ...task,
      tracePath: createGenerationTaskTracePath(task)
    })),
    jobs: snapshot.generation.jobs,
    results: snapshot.libraries.flatMap((library) =>
      library.results.map((result) => ({
        ...result,
        libraryId: library.libraryId,
        libraryName: library.name
      }))
    )
  };
}

function createWorkbenchLibraryView(store: SqliteDnaStore, graphId: string | undefined) {
  const snapshot = createReadonlyWorkbenchSnapshot(store, graphId);
  return {
    libraries: snapshot.libraries.map((library) => ({
      libraryId: library.libraryId,
      name: library.name,
      purpose: library.purpose,
      profile: library.profile,
      status: library.status,
      graphIds: library.graphIds,
      mountCount: library.mountCount,
      resultCount: library.results.length,
      galleryCount: library.gallery.length
    })),
    gallery: snapshot.resultPreviews.map((preview) => createLibraryGalleryItem(preview)),
    results: snapshot.libraries.flatMap((library) =>
      library.results.map((result) => ({
        ...result,
        libraryId: library.libraryId,
        libraryName: library.name
      }))
    ),
    mounts: snapshot.libraries.flatMap((library) => library.mounts.map((mount) => ({ ...mount, libraryId: library.libraryId })))
  };
}

function createGenerationTaskTracePath(task: {
  taskId: string;
  planId?: string;
  trace?: {
    speciesCompileArtifactId?: string;
    phenotypeCompileArtifactId?: string;
    generationJobIds?: string[];
    phenotypeVersionIds?: string[];
  };
  links?: {
    speciesCompileArtifactId?: string;
    phenotypeCompileArtifactId?: string;
    generationJobIds?: string[];
    phenotypeVersionIds?: string[];
  };
}) {
  const links = task.trace ?? task.links ?? {};
  return [
    task.planId ? `Plan: ${task.planId}` : "Standalone Task",
    `Task: ${task.taskId}`,
    links.speciesCompileArtifactId ? `Compile Artifact: ${links.speciesCompileArtifactId}` : undefined,
    links.phenotypeCompileArtifactId ? `Compile Artifact: ${links.phenotypeCompileArtifactId}` : undefined,
    ...(links.generationJobIds ?? []).map((id) => `Generation Job: ${id}`),
    ...(links.phenotypeVersionIds ?? []).map((id) => `Phenotype Version: ${id}`)
  ].filter((value): value is string => Boolean(value));
}

function createLibraryGalleryItem(preview: ReturnType<typeof createOutputReferencePreview> | ReturnType<typeof createAssetPreview>) {
  return {
    id: preview.objectId,
    title: preview.phenotypeName ?? preview.label,
    graphId: preview.graphId,
    speciesId: undefined,
    phenotypeId: preview.phenotypeId,
    phenotypeVersionId: preview.phenotypeVersionId,
    assetType: preview.preview.kind === "image" ? "image" : "unknown",
    role: preview.label,
    tags: preview.tags,
    preview: createLibraryPreview(preview.preview),
    trace: {
      taskId: undefined,
      jobId: undefined,
      compileArtifactId: undefined,
      outputReferenceId: preview.objectType === "output-reference" ? preview.objectId : undefined,
      assetId: preview.objectType === "asset" ? preview.objectId : undefined
    }
  };
}

function createLibraryPreview(preview: { kind: string; url?: string; reason?: string; displayUri?: string }) {
  if (preview.kind === "image") {
    return {
      kind: "image",
      url: preview.url,
      reason: undefined
    };
  }
  if (preview.reason === "unsupported-type") {
    return {
      kind: "unsupported",
      reason: "Preview unavailable: unsupported asset type."
    };
  }
  return {
    kind: "missing",
    reason: preview.reason === "redacted-or-unavailable" ? "Preview unavailable: redacted or unavailable." : "Preview unavailable."
  };
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
          feedback: version.feedback,
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

function createGenerationPlanSummaries(store: SqliteDnaStore, graphId: string | undefined) {
  const plans = graphId ? store.generationPlans.listByGraph(graphId) : store.generationPlans.list();
  return plans.map((plan) => createGenerationPlanSummary(store, plan));
}

function createGenerationPlanSummary(store: SqliteDnaStore, plan: PhenotypeGenerationPlan) {
  return {
    planId: plan.planId,
    graphId: plan.graphId,
    scopeType: plan.scopeType,
    scopeId: plan.scopeId,
    priority: plan.priority,
    description: plan.description,
    status: plan.status,
    versionBinding: plan.versionBinding,
    toolPreference: plan.toolPreference,
    taskCount: store.generationTasks.listByPlan(plan.planId).length,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}

function createGenerationTaskSummaries(store: SqliteDnaStore, graphId: string | undefined) {
  const tasks = graphId ? store.generationTasks.listByGraph(graphId) : store.generationTasks.list();
  return tasks.map((task) => createGenerationTaskSummary(task));
}

function createGenerationTaskSummary(task: PhenotypeGenerationTask) {
  return {
    taskId: task.taskId,
    planId: task.planId,
    graphId: task.graphId,
    nodeId: task.nodeId,
    phenotypeId: task.phenotypeId,
    phenotypeType: task.phenotypeType,
    taskBrief: task.taskBrief,
    priority: task.priority,
    status: task.status,
    blockingReason: task.blockingReason,
    versionBinding: task.versionBinding,
    toolPreference: task.toolPreference,
    links: {
      planId: task.planId,
      speciesCompileArtifactId: task.speciesCompileArtifactId,
      phenotypeCompileArtifactId: task.phenotypeCompileArtifactId,
      generationJobIds: task.generationJobIds,
      phenotypeVersionIds: task.phenotypeVersionIds
    },
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function getScopedGraphs(store: SqliteDnaStore, graphId: string | undefined) {
  return graphId ? [store.graphs.get(graphId)].filter((graph): graph is Graph => Boolean(graph)) : store.graphs.list();
}

function getScopedLibraries(store: SqliteDnaStore, graphIds: Set<string>): PhenotypeLibrary[] {
  const libraries = store.phenotypeLibraries.list();
  if (graphIds.size === 0) return libraries;
  const libraryIdsFromBindings = new Set(
    [...graphIds].flatMap((graphId) => store.phenotypeLibraryGraphBindings.listByGraph(graphId).map((binding) => binding.libraryId))
  );
  return libraries.filter((library) => library.graphIds.some((id) => graphIds.has(id)) || libraryIdsFromBindings.has(library.libraryId));
}

function createWorkbenchAnomalies(input: { graphs: Graph[]; generationJobs: GenerationJob[]; outputReferences: OutputReference[] }) {
  const anomalies: Array<{ type: string; severity: "info" | "warning"; count?: number; message: string }> = [];
  if (input.graphs.length === 0) {
    anomalies.push({
      type: "empty-store",
      severity: "info",
      message: "No DNA records found in the current read-only Explorer scope."
    });
  }
  const failedJobs = input.generationJobs.filter((job) => job.status === "failed").length;
  if (failedJobs > 0) {
    anomalies.push({ type: "failed-generation-jobs", severity: "warning", count: failedJobs, message: "Generation jobs need review." });
  }
  const missingReferences = input.outputReferences.filter((reference) => ["missing", "stale"].includes(reference.status)).length;
  if (missingReferences > 0) {
    anomalies.push({
      type: "missing-or-stale-output-references",
      severity: "warning",
      count: missingReferences,
      message: "Some output references are missing or stale."
    });
  }
  return anomalies;
}

function createGraphWorkbenchDetail(store: SqliteDnaStore, graph: Graph) {
  const groups = store.speciesGroups.listByGraph(graph.graphId);
  const memberships = store.speciesGroupMemberships.listByGraph(graph.graphId);
  const nodes = store.nodes.listByGraph(graph.graphId);
  const relationships = store.designRelationships.listByGraph(graph.graphId);
  const phenotypes = store.phenotypes.listByGraph(graph.graphId);
  const versions = phenotypes.flatMap((phenotype) => store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId));
  const facetAssignments = [
    ...store.facetAssignments.listByTarget("graph", graph.graphId),
    ...groups.flatMap((group) => store.facetAssignments.listByTarget("species-group", group.groupId)),
    ...nodes.flatMap((node) => store.facetAssignments.listByTarget("species-node", node.nodeId)),
    ...phenotypes.flatMap((phenotype) => store.facetAssignments.listByTarget("phenotype", phenotype.phenotypeId))
  ];
  return {
    graphId: graph.graphId,
    name: graph.name,
    purpose: graph.purpose,
    status: graph.status,
    currentVersion: graph.currentVersion,
    counts: {
      groups: groups.length,
      nodes: nodes.length,
      relationships: relationships.length,
      phenotypes: phenotypes.length,
      candidateVersions: versions.filter((version) => version.status === "candidate").length,
      acceptedVersions: versions.filter((version) => version.status === "accepted").length
    },
    groups: groups.map((group) => createGroupSummary(store, group, memberships, phenotypes)),
    nodes: nodes.map((node) => createNodeSummary(store, node, memberships, relationships, phenotypes)),
    relationships: relationships.map((relationship) => createRelationshipSummary(relationship)),
    semantics: {
      contextAttachments: [
        ...store.contextAttachments.listByTarget("graph", graph.graphId),
        ...groups.flatMap((group) => store.contextAttachments.listByTarget("species-group", group.groupId)),
        ...nodes.flatMap((node) => store.contextAttachments.listByTarget("species-node", node.nodeId))
      ].map((attachment) => sanitizeForWorkbench(attachment)),
      facetAssignments: facetAssignments.map((assignment) => ({
        assignmentId: assignment.assignmentId,
        targetType: assignment.targetType,
        targetId: assignment.targetId,
        status: assignment.status,
        values: sanitizeForWorkbench(assignment.values)
      }))
    },
    phenotypeOverlay: phenotypes.map((phenotype) => ({
      phenotypeId: phenotype.phenotypeId,
      name: phenotype.name,
      nodeId: phenotype.nodeId,
      phenotypeType: phenotype.phenotypeType,
      status: phenotype.status,
      currentAcceptedVersionId: phenotype.currentAcceptedVersion,
      versions: store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId).map((version) => ({
        phenotypeVersionId: version.phenotypeVersionId,
        status: version.status,
        speciesCompileArtifactId: version.speciesCompileArtifactId,
        phenotypeCompileArtifactId: version.phenotypeCompileArtifactId,
        createdAt: version.createdAt
      }))
    })),
    compileTrace: {
      entityArtifacts: store.entityCompileArtifacts.listByGraph(graph.graphId).length,
      speciesArtifacts: store.speciesCompileArtifacts.listByGraph(graph.graphId).length,
      phenotypeArtifacts: store.phenotypeCompileArtifacts.listByGraph(graph.graphId).length,
      artifacts: [
        ...store.entityCompileArtifacts.listByGraph(graph.graphId).map((artifact) => ({
          artifactId: artifact.artifactId,
          targetLevel: artifact.targetLevel,
          objectId: artifact.target.objectId,
          validity: artifact.validity,
          dependencyCount: artifact.dependencyVector.length,
          feedbackCount: artifact.feedback.length,
          openQuestionCount: artifact.frames.reduce((count, frame) => count + frame.openQuestions.length, 0)
        })),
        ...store.speciesCompileArtifacts.listByGraph(graph.graphId).map((artifact) => ({
          artifactId: artifact.artifactId,
          targetLevel: "species-node",
          objectId: artifact.speciesNodeId,
          validity: artifact.validity,
          dependencyCount: artifact.dependencyVector.length,
          feedbackCount: artifact.feedback.length,
          openQuestionCount: artifact.openQuestions.length
        })),
        ...store.phenotypeCompileArtifacts.listByGraph(graph.graphId).map((artifact) => ({
          artifactId: artifact.artifactId,
          targetLevel: "phenotype",
          objectId: artifact.speciesNodeId,
          phenotypeType: artifact.phenotypeType,
          validity: artifact.validity,
          dependencyCount: artifact.dependencyVector.length,
          feedbackCount: artifact.feedback.length,
          openQuestionCount: artifact.openQuestions.length
        }))
      ].slice(0, 24)
    },
    rawJsonSummary: sanitizeForWorkbench(graph)
  };
}

function createGroupSummary(
  store: SqliteDnaStore,
  group: SpeciesGroup,
  memberships: ReturnType<SqliteDnaStore["speciesGroupMemberships"]["listByGraph"]>,
  phenotypes: Phenotype[]
) {
  const memberNodeIds = memberships.filter((membership) => membership.groupId === group.groupId).map((membership) => membership.nodeId);
  return {
    groupId: group.groupId,
    name: group.name,
    groupType: group.groupType,
    status: group.status,
    memberNodeIds,
    sharedFacts: group.sharedFacts,
    phenotypeTypeSuggestions: group.phenotypeTypeSuggestions,
    relationshipIds: store.designRelationships
      .listByEndpoint("species-group", group.groupId)
      .map((relationship) => relationship.relationshipId),
    phenotypeIds: phenotypes.filter((phenotype) => memberNodeIds.includes(phenotype.nodeId)).map((phenotype) => phenotype.phenotypeId)
  };
}

function createNodeSummary(
  store: SqliteDnaStore,
  node: SpeciesNode,
  memberships: ReturnType<SqliteDnaStore["speciesGroupMemberships"]["listByGraph"]>,
  relationships: DesignRelationship[],
  phenotypes: Phenotype[]
) {
  return {
    nodeId: node.nodeId,
    name: node.name,
    category: node.category,
    level: node.level,
    status: node.status,
    lineageStatus: node.lineageStatus,
    currentVersion: node.currentVersion,
    groupIds: memberships.filter((membership) => membership.nodeId === node.nodeId).map((membership) => membership.groupId),
    parentNodes: node.parentNodes,
    motifs: node.motifs,
    constraintSummary: sanitizeForWorkbench(node.constraints),
    relationshipIds: relationships
      .filter((relationship) => endpointMatchesNode(relationship.source, node.nodeId) || endpointMatchesNode(relationship.target, node.nodeId))
      .map((relationship) => relationship.relationshipId),
    phenotypeIds: phenotypes.filter((phenotype) => phenotype.nodeId === node.nodeId).map((phenotype) => phenotype.phenotypeId),
    latestCompileArtifactId: store.speciesCompileArtifacts.listByNode(node.nodeId).slice(-1)[0]?.artifactId
  };
}

function createRelationshipSummary(relationship: DesignRelationship) {
  return {
    relationshipId: relationship.relationshipId,
    relationshipType: relationship.relationshipType,
    direction: relationship.direction,
    status: relationship.status,
    summary: relationship.description || relationship.designContract.transferRule || relationship.relationshipType,
    source: createEndpointSummary(relationship.source),
    target: createEndpointSummary(relationship.target),
    designContract: {
      transferRule: relationship.designContract.transferRule,
      mustPreserve: relationship.designContract.mustPreserve,
      mustAvoid: relationship.designContract.mustAvoid,
      divergenceRule: relationship.designContract.divergenceRule,
      reviewQuestions: relationship.designContract.reviewQuestions
    }
  };
}

function createGenerationJobSummary(job: GenerationJob) {
  return {
    generationJobId: job.generationJobId,
    graphId: job.graphId,
    nodeId: job.nodeId,
    phenotypeId: job.phenotypeId,
    phenotypeVersionId: job.phenotypeVersionId,
    phenotypeType: job.phenotypeType,
    taskBrief: summarizeText(job.taskBrief, 160),
    status: job.status,
    tool: job.tool,
    errorSummary: job.errorMessage ? sanitizeText(job.errorMessage) : undefined,
    inputSnapshotSummary: sanitizeForWorkbench(job.inputSnapshot),
    outputSnapshotSummary: sanitizeForWorkbench(job.outputSnapshot),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    rawJsonSummary: sanitizeForWorkbench(job)
  };
}

function createMountSummary(mount: StorageMount) {
  return {
    mountId: mount.mountId,
    libraryId: mount.libraryId,
    storageType: mount.storageType,
    adapterKind: mount.adapterKind,
    displayName: mount.displayName,
    status: mount.status,
    capabilities: mount.capabilities,
    credentialStatus: mount.credentialRef ? "configured" : "not configured",
    displayLocation: sanitizeUriDisplay(mount.location),
    metadataSummary: sanitizeForWorkbench(mount.metadata)
  };
}

function createLibraryResultSummary(store: SqliteDnaStore, version: PhenotypeVersion, references: OutputReference[]) {
  const phenotype = store.phenotypes.get(version.phenotypeId);
  const node = store.nodes.get(version.nodeId);
  const versionReferences = references.filter((reference) => reference.phenotypeVersionId === version.phenotypeVersionId);
  const assets = version.assetIds
    .map((assetId) => store.assets.get(assetId))
    .filter((asset): asset is AssetIndex => Boolean(asset));
  const currentAssets = assets.filter(isCurrentAssetPointer);
  return {
    phenotypeId: version.phenotypeId,
    phenotypeName: phenotype?.name ?? version.phenotypeId,
    versionId: version.phenotypeVersionId,
    versionStatus: version.status,
    graphId: version.graphId,
    nodeId: version.nodeId,
    nodeName: node?.name ?? version.nodeId,
    phenotypeType: phenotype?.phenotypeType ?? "",
    outputRoles: [...new Set(versionReferences.map((reference) => reference.role))],
    referenceCount: versionReferences.length,
    assetCount: currentAssets.length,
    latestStatus: versionReferences.some((reference) => reference.status === "missing" || reference.status === "stale")
      ? "needs-review"
      : version.status,
    preview: selectBestPreview([
      ...versionReferences.map((reference) => createOutputReferencePreview(store, reference)),
      ...currentAssets.map((asset) => createAssetPreview(store, asset))
    ])?.preview ?? createPlaceholderPreview("no-preview")
  };
}

function versionResultPriority(store: SqliteDnaStore, version: PhenotypeVersion) {
  const phenotype = store.phenotypes.get(version.phenotypeId);
  if (phenotype?.currentAcceptedVersion === version.phenotypeVersionId) return 0;
  if (version.status === "accepted") return 1;
  if (version.status === "candidate") return 2;
  return 3;
}

function createOutputReferenceSummary(store: SqliteDnaStore, reference: OutputReference) {
  const phenotype = reference.phenotypeId ? store.phenotypes.get(reference.phenotypeId) : undefined;
  return {
    outputReferenceId: reference.outputReferenceId,
    graphId: reference.graphId,
    phenotypeId: reference.phenotypeId,
    phenotypeName: phenotype?.name,
    phenotypeVersionId: reference.phenotypeVersionId,
    libraryId: reference.libraryId,
    storageMountId: reference.storageMountId,
    externalId: sanitizeText(reference.externalId),
    referenceType: reference.referenceType,
    role: reference.role,
    status: reference.status,
    tags: reference.tags,
    normalizedTags: reference.normalizedTags,
    displayUri: sanitizeUriDisplay(reference.uri),
    checksum: summarizeChecksum(reference.checksum),
    metadataSummary: sanitizeForWorkbench(reference.metadata),
    externalMetadataSummary: sanitizeForWorkbench(reference.externalMetadata),
    preview: createPreviewForUri(reference.uri, { assetType: inferAssetType(reference.uri), status: reference.status })
  };
}

function createAssetSummary(store: SqliteDnaStore, asset: AssetIndex) {
  const version = asset.linkedObjectType === "phenotype-version" ? store.phenotypeVersions.get(asset.linkedObjectId) : undefined;
  return {
    assetId: asset.assetId,
    graphId: version?.graphId,
    linkedObjectType: asset.linkedObjectType,
    linkedObjectId: asset.linkedObjectId,
    phenotypeVersionId: version?.phenotypeVersionId,
    assetType: asset.assetType,
    role: asset.role,
    variantRole: asset.variantRole,
    status: asset.status,
    tags: asset.tags,
    displayUri: sanitizeUriDisplay(asset.uri),
    checksum: summarizeChecksum(asset.checksum),
    preview: createPreviewForUri(asset.uri, { assetType: asset.assetType, status: asset.status }),
    rawJsonSummary: sanitizeForWorkbench(asset)
  };
}

function createOutputReferencePreview(store: SqliteDnaStore, reference: OutputReference) {
  const version = store.phenotypeVersions.get(reference.phenotypeVersionId);
  const phenotype = reference.phenotypeId ? store.phenotypes.get(reference.phenotypeId) : version ? store.phenotypes.get(version.phenotypeId) : undefined;
  return {
    objectType: "output-reference" as const,
    objectId: reference.outputReferenceId,
    graphId: reference.graphId,
    phenotypeId: reference.phenotypeId ?? version?.phenotypeId,
    phenotypeName: phenotype?.name,
    phenotypeVersionId: reference.phenotypeVersionId,
    libraryId: reference.libraryId,
    storageMountId: reference.storageMountId,
    label: `${reference.role} ${reference.referenceType}`,
    status: reference.status,
    tags: reference.tags,
    preview: createPreviewForUri(reference.uri, { assetType: inferAssetType(reference.uri), status: reference.status }),
    metadataSummary: sanitizeForWorkbench(reference.metadata)
  };
}

function createAssetPreview(store: SqliteDnaStore, asset: AssetIndex) {
  const version = asset.linkedObjectType === "phenotype-version" ? store.phenotypeVersions.get(asset.linkedObjectId) : undefined;
  const phenotype = version ? store.phenotypes.get(version.phenotypeId) : undefined;
  const reference = version ? store.outputReferences.listByPhenotypeVersion(version.phenotypeVersionId)[0] : undefined;
  return {
    objectType: "asset" as const,
    objectId: asset.assetId,
    graphId: version?.graphId,
    phenotypeId: version?.phenotypeId,
    phenotypeName: phenotype?.name,
    phenotypeVersionId: version?.phenotypeVersionId,
    libraryId: reference?.libraryId,
    storageMountId: reference?.storageMountId,
    label: asset.description || asset.assetId,
    status: asset.status,
    tags: asset.tags,
    preview: createPreviewForUri(asset.uri, { assetType: asset.assetType, status: asset.status }),
    metadataSummary: sanitizeForWorkbench({ role: asset.role, variantRole: asset.variantRole, notes: asset.notes, facets: asset.facets })
  };
}

function selectBestPreview<T extends { preview: { kind: string } }>(previews: T[]) {
  return previews.find((preview) => preview.preview.kind === "image") ?? previews[0];
}

function createPreviewForUri(uri: string | undefined, input: { assetType: string; status: string }) {
  if (!uri || input.status === "missing" || input.status === "deleted") return createPlaceholderPreview("unavailable");
  if (input.assetType !== "image" && !looksLikeImageUri(uri)) return createPlaceholderPreview("unsupported-type");
  if (!isSafePreviewUri(uri)) return createPlaceholderPreview("redacted-or-unavailable");
  return {
    kind: "image" as const,
    url: uri,
    displayUri: sanitizeUriDisplay(uri)
  };
}

function createPlaceholderPreview(reason: string) {
  return {
    kind: "placeholder" as const,
    reason,
    displayUri: "[redacted-or-unavailable]"
  };
}

function createEndpointSummary(endpoint: DesignRelationship["source"]) {
  return {
    type: endpoint.type,
    graphId: endpoint.graphId,
    id: getEndpointObjectId(endpoint)
  };
}

function getEndpointObjectId(endpoint: DesignRelationship["source"]) {
  if (endpoint.type === "graph") return endpoint.graphId;
  if (endpoint.type === "species-group") return endpoint.groupId;
  return endpoint.nodeId;
}

function endpointMatchesNode(endpoint: DesignRelationship["source"], nodeId: string) {
  return endpoint.type === "species-node" && endpoint.nodeId === nodeId;
}

function uniqueById<T>(items: T[], getId: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = getId(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isCurrentAssetPointer(asset: AssetIndex) {
  return asset.status !== "archived" && asset.status !== "deleted";
}

function inferAssetType(uri: string) {
  return looksLikeImageUri(uri) ? "image" : "other";
}

function looksLikeImageUri(uri: string) {
  return /\.(png|jpe?g|webp|gif|svg)(?:$|[?#])/i.test(uri);
}

function isSafePreviewUri(uri: string) {
  if (isSensitiveString(uri)) return false;
  if (uri.startsWith("local://")) return true;
  if (uri.startsWith("/") || uri.startsWith("file://")) return false;
  try {
    const parsed = new URL(uri);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const sensitiveParams = ["x-amz-signature", "signature", "sig", "token", "access_token", "credential", "expires", "key"];
    for (const name of parsed.searchParams.keys()) {
      if (sensitiveParams.includes(name.toLowerCase())) return false;
    }
    if (/(^|\/)(private|signed|credential)(\/|$)/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizeUriDisplay(uri: string | undefined) {
  if (!uri) return undefined;
  if (!isSafePreviewUri(uri)) return "[redacted]";
  return uri.length > 180 ? `${uri.slice(0, 177)}...` : uri;
}

function sanitizeForWorkbench(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[bounded]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitizeForWorkbench(item, depth + 1));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 24);
    return Object.fromEntries(
      entries.map(([key, item]) => [key, isSensitiveKey(key) ? "[redacted]" : sanitizeForWorkbench(item, depth + 1)])
    );
  }
  return String(value);
}

function sanitizeText(value: string | undefined) {
  if (!value) return value;
  if (isSensitiveString(value)) return "[redacted]";
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function summarizeText(value: string | undefined, max = 120) {
  const sanitized = sanitizeText(value);
  if (!sanitized) return undefined;
  return sanitized.length > max ? `${sanitized.slice(0, max - 3)}...` : sanitized;
}

function isSensitiveKey(key: string) {
  return /(credential|password|secret|private[_-]?key|token|authorization|providerpayload|rawproviderpayload|runtime)/i.test(key);
}

function isSensitiveString(value: string) {
  return /(sk-[A-Za-z0-9_-]+|OPENAI_API_KEY|password|secret|private_key|Bearer\s+[A-Za-z0-9._-]+|X-Amz-Signature|\/Users\/|token=|signature=|access_token=|credential=)/i.test(
    value
  );
}

function summarizeChecksum(checksum: string | undefined) {
  if (!checksum) return undefined;
  return checksum.length > 16 ? `${checksum.slice(0, 12)}...` : checksum;
}

function missingWorkbenchGraphResponse(graphId: string) {
  return jsonResponse(
    {
      error: `graph not found: ${graphId}`,
      readOnly: true,
      recoveryHint: "Use the CLI/service boundary to create or inspect graphs; the Web Explorer did not modify the DNA store."
    },
    404
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
    <title>DNA Read-only Explorer</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1b2530; background: #f4f6f3; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; background: linear-gradient(180deg, #f7f8f4, #edf2f0); }
      main.explorer-shell { width: min(1440px, calc(100vw - 28px)); margin: 0 auto; display: grid; grid-template-columns: 238px minmax(0, 1fr); gap: 16px; padding: 16px 0 22px; }
      h1, h2, h3, p { margin-top: 0; }
      h1 { margin-bottom: 6px; font-size: 30px; line-height: 1.12; letter-spacing: 0; }
      h2 { margin-bottom: 6px; font-size: 22px; line-height: 1.2; letter-spacing: 0; }
      h3 { margin-bottom: 0; font-size: 14px; line-height: 1.3; letter-spacing: 0; }
      button { font: inherit; cursor: pointer; }
      .product-name { margin: 0 0 5px; color: #5e6f6a; font-size: 12px; font-weight: 760; text-transform: uppercase; }
      .muted { color: #60716f; font-size: 13px; line-height: 1.45; }
      .desktop-side-nav, .scope-bar, .status-bar, .panel, .map-node, .route, .card, .state, .inspector, .desktop-module-nav button, .mobile-bottom-nav button { border: 1px solid #cfd8d5; border-radius: 8px; background: #fff; }
      .desktop-side-nav { position: sticky; top: 16px; display: grid; align-content: start; gap: 16px; min-width: 0; height: calc(100vh - 32px); padding: 16px; }
      .workspace-shell { display: grid; gap: 12px; min-width: 0; }
      .scope-bar { position: sticky; top: 16px; z-index: 12; display: grid; grid-template-columns: minmax(230px, .7fr) minmax(460px, 1fr) minmax(392px, .85fr); gap: 12px; align-items: end; padding: 12px; }
      .scope-bar .filter-sheet { display: grid; grid-template-columns: minmax(160px, .8fr) minmax(190px, 1fr) minmax(120px, .62fr); gap: 8px; align-items: end; }
      .scope-bar label { display: grid; gap: 6px; color: #4f625e; font-size: 12px; font-weight: 760; }
      .scope-bar input, .scope-bar select { width: 100%; min-height: 40px; border: 1px solid #aebfba; border-radius: 7px; padding: 0 10px; background: #fff; }
      .desktop-module-nav { display: grid; gap: 8px; }
      .desktop-module-nav button, .mobile-bottom-nav button { min-height: 42px; color: #33423f; font-weight: 780; }
      .desktop-module-nav button { width: 100%; padding: 0 10px; text-align: left; }
      .desktop-module-nav button.active, .mobile-bottom-nav button.active { border-color: #1e766c; color: #103f39; background: #dff1ed; }
      .mobile-bottom-nav { display: none; }
      .side-note, .status-bar { color: #4f625e; font-size: 12px; line-height: 1.4; }
      .side-note { display: grid; gap: 8px; align-self: end; }
      .status-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 36px; padding: 8px 10px; }
      .state { display: grid; gap: 4px; margin: 10px 0; padding: 12px 14px; font-size: 14px; line-height: 1.45; }
      .state.error { border-color: #d29292; color: #842c31; background: #fff2f2; }
      .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; align-items: start; }
      .surface { display: grid; gap: 12px; min-width: 0; }
      .panel, .inspector { display: grid; gap: 11px; min-width: 0; padding: 14px; }
      .map { position: relative; min-height: 390px; overflow: hidden; border: 1px solid #c7d5d0; border-radius: 8px; background: linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(238 245 241 / 88%)); }
      .map svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
      .map line { stroke: #2c8276; stroke-width: 1.8; }
      .nodes { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(2, minmax(210px, 1fr)); gap: 18px; padding: 36px; }
      .map-node, .card, .route { width: 100%; display: grid; gap: 7px; min-width: 0; padding: 11px; color: inherit; text-align: left; }
      .map-node { min-height: 160px; box-shadow: 0 18px 42px rgb(35 54 49 / 10%); }
      .map-node:hover, .card:hover, .route:hover { border-color: #7caea6; background: #f2f8f6; }
      .routes, .columns, .gallery, .support { display: grid; gap: 10px; }
      .support { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .columns { grid-template-columns: repeat(4, minmax(160px, 1fr)); align-items: start; }
      .gallery { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
      .preview { display: grid; place-items: center; width: 100%; aspect-ratio: 4 / 3; border: 1px solid #dce4e1; border-radius: 7px; color: #60716f; background: #eef4f1; text-align: center; }
      .chip { display: inline-flex; width: max-content; min-height: 24px; border-radius: 999px; padding: 3px 9px; color: #146145; background: #ddf3e9; font-size: 12px; font-weight: 780; }
      .meta { display: flex; flex-wrap: wrap; gap: 7px; }
      .meta span { min-height: 28px; border: 1px solid #d8e0dd; border-radius: 999px; padding: 5px 9px; color: #435753; background: #f8faf8; font-size: 12px; font-weight: 760; overflow-wrap: anywhere; }
      .inspector { position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow: auto; }
      details { border-top: 1px solid #e1e7e4; padding-top: 9px; }
      summary { min-height: 32px; font-weight: 780; cursor: pointer; }
      pre { max-height: 200px; overflow: auto; margin: 8px 0 0; padding: 12px; border: 1px solid #e1e7e4; border-radius: 7px; background: #f8faf8; white-space: pre-wrap; overflow-wrap: anywhere; }
      strong, span, small, code { min-width: 0; overflow-wrap: anywhere; }
      @media (max-width: 880px) {
        main.explorer-shell { width: min(100vw - 18px, 760px); grid-template-columns: 1fr; padding-bottom: 430px; }
        .desktop-side-nav { display: none; }
        .scope-bar, .workspace-grid, .support, .columns, .nodes, .scope-bar .filter-sheet { grid-template-columns: 1fr; }
        .scope-bar { position: static; }
        .mobile-bottom-nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: fixed; right: 9px; bottom: 9px; left: 9px; z-index: 20; gap: 8px; padding: 7px; border: 1px solid #bfcbc7; border-radius: 10px; background: #fff; box-shadow: 0 10px 28px rgb(29 45 58 / 18%); }
        .mobile-bottom-nav button { min-height: 46px; font-size: 12px; }
        .nodes { padding: 12px; }
        .gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .inspector { position: fixed; top: auto; right: 9px; bottom: 74px; left: 9px; z-index: 18; max-height: 24vh; overflow: auto; border-radius: 10px 10px 0 0; box-shadow: 0 -10px 28px rgb(29 45 58 / 16%); }
      }
    </style>
  </head>
  <body>
    <main class="explorer-shell">
      <aside class="desktop-side-nav" aria-label="Desktop Explorer navigation">
        <div>
          <p class="product-name">DNA: Design Network Atlas</p>
          <h1>DNA Read-only Explorer</h1>
          <p class="muted">Map-first local view of design graphs, generation traces, and phenotype results.</p>
        </div>
        <nav class="desktop-module-nav" aria-label="Explorer modules">
          <button class="active" type="button" data-module="map">Atlas Map</button>
          <button type="button" data-module="graph">Graph Explorer</button>
          <button type="button" data-module="generation">Generation Board</button>
          <button type="button" data-module="library">Phenotype Library</button>
        </nav>
        <div class="side-note">
          <span class="chip">read-only</span>
          <span>No Web write actions. Durable writes stay behind CLI/service boundaries.</span>
        </div>
      </aside>
      <section class="workspace-shell">
        <header class="scope-bar" aria-label="Explorer scope and filters">
          <div>
            <p class="product-name">Current Scope</p>
            <h2 id="scope-title">Atlas scope</h2>
            <p class="muted">Snapshot source: local API /api/workbench/snapshot</p>
          </div>
          <section class="filter-sheet" aria-label="Read-only filters">
            <label><span>Graph scope</span><select id="graph-scope"><option value="">No graph scope</option></select></label>
            <label><span>Search objects</span><input id="object-search" placeholder="graph, group, species, task, result, asset" /></label>
            <label><span>Status</span><select id="status-filter"><option>All statuses</option><option>active</option><option>candidate</option><option>accepted</option><option>blocked</option><option>missing</option><option>stale</option></select></label>
          </section>
          <p class="muted" id="snapshot-status">Loading /api/workbench/snapshot...</p>
        </header>
        <section id="state" class="state" aria-live="polite">Loading read-only explorer snapshot from the local DNA API...</section>
        <section class="workspace-grid">
          <section id="surface" class="surface" aria-label="Explorer content"></section>
          <aside id="inspector" class="inspector" aria-label="Inspector"></aside>
        </section>
        <footer class="status-bar" aria-label="Explorer status">
          <span>Read-only</span><span>API-backed snapshot</span><span id="load-status">loading</span><span id="error-status">0 errors</span><span>Credentials and private paths are redacted before display.</span>
        </footer>
      </section>
      <nav class="mobile-bottom-nav" aria-label="Explorer modules">
        <button class="active" type="button" data-module="map">Atlas Map</button>
        <button type="button" data-module="graph">Graph Explorer</button>
        <button type="button" data-module="generation">Generation Board</button>
        <button type="button" data-module="library">Phenotype Library</button>
      </nav>
    </main>
    <script>
      const endpoint = "/api/workbench/snapshot";
      const state = document.getElementById("state");
      const surface = document.getElementById("surface");
      const inspector = document.getElementById("inspector");
      const snapshotStatus = document.getElementById("snapshot-status");
      const graphScope = document.getElementById("graph-scope");
      const scopeTitle = document.getElementById("scope-title");
      const loadStatus = document.getElementById("load-status");
      const errorStatus = document.getElementById("error-status");
      let snapshot = null;
      let selectedGraph = null;
      let activeModule = "map";

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
      }
      function chip(value) { return '<span class="chip">' + escapeHtml(value ?? "read-only") + '</span>'; }
      function inspect(type, id, status, summary, raw) {
        inspector.innerHTML = '<h2>Inspector</h2>' + chip(status) +
          '<section><h3>Identity</h3><p>' + escapeHtml(type) + '</p><p>' + escapeHtml(id) + '</p></section>' +
          '<section><h3>Summary</h3><p>' + escapeHtml(summary ?? "No summary recorded.") + '</p></section>' +
          '<section><h3>Bound Semantics</h3><p>Context, facts, principles, motifs, facets, and rubrics appear when present.</p></section>' +
          '<section><h3>Relationships</h3><p>Incoming and outgoing endpoints appear when present.</p></section>' +
          '<section><h3>Generation Links</h3><p>Plans, tasks, jobs, and compile artifacts appear when present.</p></section>' +
          '<section><h3>Phenotype / Assets</h3><p>Phenotype versions, output references, and asset previews appear when present.</p></section>' +
          '<section><h3>External pointers</h3><p>External pointers are redacted and never expose credentials.</p></section>' +
          '<details><summary>Raw JSON</summary><pre>' + escapeHtml(JSON.stringify(raw ?? {}, null, 2)) + '</pre></details>';
      }
      function graphRelationships() {
        const seen = new Set();
        return (snapshot?.graphs ?? []).flatMap((graph) => graph.relationships ?? []).filter((relationship) => {
          if (relationship?.source?.type !== "graph" || relationship?.target?.type !== "graph") return false;
          if (seen.has(relationship.relationshipId)) return false;
          seen.add(relationship.relationshipId);
          return true;
        });
      }
      function renderMap() {
        const graphs = snapshot?.graphs ?? [];
        const relationships = graphRelationships();
        surface.innerHTML = '<h2>Atlas Map</h2><p class="muted">Graph relationship map for design-language translation, influence, and review navigation.</p>' +
          '<section class="map" aria-label="Graph relationship map">' +
          (relationships.length ? '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' + relationships.map((relationship, index) => '<line x1="14" y1="' + (24 + index * 12) + '" x2="82" y2="' + (62 - index * 8) + '"></line>').join('') + '</svg>' : '<p class="muted" style="padding:24px">No graph-level relationships yet</p>') +
          '<div class="nodes">' + graphs.map((graph, index) =>
            '<button class="map-node" type="button" data-graph="' + escapeHtml(graph.graphId) + '"><span class="product-name">Graph</span><strong>' + escapeHtml(graph.name) + '</strong><span class="muted">' + escapeHtml(graph.purpose) + '</span><div class="meta"><span>' + escapeHtml(graph.counts?.groups ?? 0) + ' groups</span><span>' + escapeHtml(graph.counts?.nodes ?? 0) + ' species</span><span>' + escapeHtml(graph.counts?.phenotypes ?? 0) + ' phenotypes</span></div>' + chip(graph.status) + '</button>'
          ).join('') + '</div></section>' +
          '<section class="support"><div class="panel"><h3>Legend</h3><p class="muted">Solid lines represent graph-level DesignRelationship contracts.</p></div><div class="panel routes"><h3>Graph relationship routes</h3>' +
          (relationships.length ? relationships.map((relationship) => '<button class="route" type="button" data-rel="' + escapeHtml(relationship.relationshipId) + '"><strong>' + escapeHtml(relationship.source.graphId) + ' -> ' + escapeHtml(relationship.target.graphId) + '</strong><span>' + escapeHtml(relationship.relationshipType) + '</span><small>' + escapeHtml(relationship.summary) + '</small></button>').join('') : '<p class="muted">Graph boards remain clickable; internal graph structure is still available.</p>') + '</div></section>';
        for (const button of surface.querySelectorAll("[data-graph]")) {
          button.addEventListener("click", () => { selectedGraph = graphs.find((graph) => graph.graphId === button.getAttribute("data-graph")); activeModule = "graph"; syncNav(); renderGraph(); });
        }
        for (const button of surface.querySelectorAll("[data-rel]")) {
          button.addEventListener("click", () => {
            const relationship = relationships.find((item) => item.relationshipId === button.getAttribute("data-rel"));
            inspect("DesignRelationship", relationship?.relationshipId, relationship?.status, relationship?.summary, relationship);
          });
        }
        if (graphs[0]) inspect("Graph", graphs[0].graphId, graphs[0].status, graphs[0].purpose, graphs[0]);
      }
      function renderGraph() {
        const graph = selectedGraph ?? (snapshot?.graphs ?? []).find((item) => (item.groups ?? []).length || (item.nodes ?? []).length) ?? (snapshot?.graphs ?? [])[0];
        if (!graph) { surface.innerHTML = '<section class="panel"><h2>No graph selected</h2><p class="muted">This read-only page did not modify the DNA store.</p></section>'; return; }
        selectedGraph = graph;
        surface.innerHTML = '<h2>Graph Explorer</h2><p class="muted">' + escapeHtml(graph.purpose) + '</p><div class="meta"><span>Groups</span><span>Species</span><span>Relationships</span><span>Semantics</span><span>Phenotypes</span><span>Compile Trace</span></div>' +
          '<section class="support">' +
          '<div class="panel"><h3>Groups</h3>' + (graph.groups ?? []).map((group) => '<button class="card" type="button" data-group="' + escapeHtml(group.groupId) + '"><strong>' + escapeHtml(group.name) + '</strong><span>' + escapeHtml((group.memberNodeIds ?? []).length) + ' members</span></button>').join('') + '</div>' +
          '<div class="panel"><h3>Species</h3>' + (graph.nodes ?? []).map((node) => '<button class="card" type="button" data-node="' + escapeHtml(node.nodeId) + '"><strong>' + escapeHtml(node.name) + '</strong><span>' + escapeHtml((node.phenotypeIds ?? []).length) + ' phenotypes</span></button>').join('') + '</div>' +
          '<div class="panel"><h3>Design relationships</h3>' + (graph.relationships ?? []).map((relationship) => '<button class="card" type="button" data-rel="' + escapeHtml(relationship.relationshipId) + '"><strong>' + escapeHtml(relationship.relationshipType) + '</strong><span>' + escapeHtml(relationship.summary) + '</span></button>').join('') + '</div>' +
          '<div class="panel"><h3>Phenotype overlay</h3>' + (graph.phenotypeOverlay ?? []).map((phenotype) => '<button class="card" type="button" data-ph="' + escapeHtml(phenotype.phenotypeId) + '"><strong>' + escapeHtml(phenotype.name) + '</strong><span>' + escapeHtml(phenotype.versions?.length ?? 0) + ' versions</span></button>').join('') + '</div></section>';
        for (const button of surface.querySelectorAll("button")) {
          button.addEventListener("click", () => inspect("Graph object", button.textContent, "read-only", "Selected graph object", graph));
        }
        inspect("Graph", graph.graphId, graph.status, graph.purpose, graph);
      }
      function renderGeneration() {
        const generation = snapshot?.generation ?? { plans: [], tasks: [], jobs: [] };
        const results = (snapshot?.libraries ?? []).flatMap((library) => library.results ?? []);
        surface.innerHTML = '<h2>Generation Board</h2><section class="state">Plan -> Task -> Compile Artifact -> Generation Job -> Phenotype Version -> Output Reference / Asset</section><section class="columns">' +
          ['plans', 'tasks', 'jobs', 'results'].map((lane) => '<div class="panel"><h3>' + lane + '</h3>' +
            (lane === 'plans' ? generation.plans : lane === 'tasks' ? generation.tasks : lane === 'jobs' ? generation.jobs : results).map((item) => '<button class="card" type="button"><strong>' + escapeHtml(item.description ?? item.taskBrief ?? item.generationJobId ?? item.phenotypeName ?? item.versionId) + '</strong>' + chip(item.status ?? item.versionStatus ?? 'read-only') + '</button>').join('') + '</div>').join('') + '</section>';
        inspect("Generation Board", "current", "read-only", "Plans, tasks, jobs, and result traces.", generation);
      }
      function renderLibrary() {
        const previews = (snapshot?.libraries ?? []).flatMap((library) => library.gallery ?? []);
        surface.innerHTML = '<h2>Phenotype Library</h2><p class="muted">Gallery-first read-only view of phenotype results and asset pointers.</p><section class="gallery">' +
          previews.map((preview) => '<button class="card" type="button"><div class="preview">' + (preview.preview?.kind === 'image' ? '<img alt="" style="width:100%;height:100%;object-fit:cover" src="' + escapeHtml(preview.preview.url) + '">' : 'Preview unavailable') + '</div><strong>' + escapeHtml(preview.phenotypeName ?? preview.label) + '</strong><span>' + escapeHtml(preview.label) + '</span>' + chip(preview.status) + '</button>').join('') + '</section>';
        inspect("Phenotype Library", "current", "read-only", "Output references, assets, and library mounts.", snapshot?.libraries ?? []);
      }
      function syncNav() {
        for (const button of document.querySelectorAll("nav button")) button.classList.toggle("active", button.getAttribute("data-module") === activeModule);
      }
      function render() {
        syncNav();
        if (activeModule === "map") renderMap();
        if (activeModule === "graph") renderGraph();
        if (activeModule === "generation") renderGeneration();
        if (activeModule === "library") renderLibrary();
      }
      for (const button of document.querySelectorAll("nav button")) {
        button.addEventListener("click", () => { activeModule = button.getAttribute("data-module"); render(); });
      }
      graphScope.addEventListener("change", () => {
        selectedGraph = (snapshot?.graphs ?? []).find((graph) => graph.graphId === graphScope.value) ?? selectedGraph;
        scopeTitle.textContent = selectedGraph?.name ?? "Atlas scope";
        inspect("Graph", selectedGraph?.graphId, selectedGraph?.status, selectedGraph?.purpose, selectedGraph);
      });
      fetch(endpoint).then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); }).then((body) => {
        snapshot = body;
        selectedGraph = (body.graphs ?? []).find((graph) => (graph.groups ?? []).length || (graph.nodes ?? []).length) ?? (body.graphs ?? [])[0];
        graphScope.innerHTML = (body.graphs ?? []).length ? (body.graphs ?? []).map((graph) => '<option value="' + escapeHtml(graph.graphId) + '">' + escapeHtml(graph.name) + '</option>').join('') : '<option value="">No graph scope</option>';
        graphScope.value = selectedGraph?.graphId ?? "";
        scopeTitle.textContent = selectedGraph?.name ?? "Atlas scope";
        state.textContent = (body.graphs ?? []).length ? "Loaded read-only DNA Explorer snapshot from the local API." : "No DNA records found in this local store.";
        snapshotStatus.textContent = String(body.overview?.counts?.graphs ?? 0) + " graphs, " + String(body.overview?.counts?.phenotypes ?? 0) + " phenotypes, " + String(body.overview?.counts?.generationTasks ?? 0) + " tasks";
        loadStatus.textContent = "ready";
        errorStatus.textContent = "0 errors";
        render();
      }).catch((error) => {
        state.className = "state error";
        state.innerHTML = '<strong>Unable to load explorer data.</strong><span>' + escapeHtml(error.message || error) + '</span><span>No durable DNA records were changed by this read-only page.</span>';
        surface.innerHTML = '<section class="panel"><h2>Unable to load explorer data.</h2><p class="muted">No durable DNA records were changed by this read-only page.</p></section>';
        loadStatus.textContent = "error";
        errorStatus.textContent = "1 error";
      });
    </script>
  </body>
</html>`;
}
