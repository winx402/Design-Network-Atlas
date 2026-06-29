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
        return jsonResponse(
          {
            error: `graph not found: ${graphId}`,
            readOnly: true,
            recoveryHint: "Use the CLI/service boundary to create or inspect graphs; the Web workbench did not modify the DNA store."
          },
          404
        );
      }
      return jsonResponse(createReadonlyWorkbenchSnapshot(store, graphId));
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
  const phenotypeVersions = graphPhenotypes.flatMap((phenotype) => store.phenotypeVersions.listByPhenotype(phenotype.phenotypeId));
  const generationPlans = graphs.flatMap((graph) => store.generationPlans.listByGraph(graph.graphId));
  const generationTasks = graphs.flatMap((graph) => store.generationTasks.listByGraph(graph.graphId));
  const generationJobs = graphs.flatMap((graph) => store.generationJobs.listByGraph(graph.graphId));
  const outputReferences = graphs.flatMap((graph) => store.outputReferences.listByGraph(graph.graphId));
  const assets = uniqueById(graphs.flatMap((graph) => store.assets.search({ graphId: graph.graphId })), (asset) => asset.assetId);
  const libraries = getScopedLibraries(store, graphIds);
  const mounts = libraries.flatMap((library) => store.storageMounts.listByLibrary(library.libraryId));
  const resultPreviews = [
    ...outputReferences.map((reference) => createOutputReferencePreview(store, reference)),
    ...assets.map((asset) => createAssetPreview(store, asset))
  ];

  return {
    overview: {
      counts: {
        graphs: graphs.length,
        activeGraphs: graphs.filter((graph) => graph.status === "active").length,
        speciesGroups: graphs.reduce((count, graph) => count + store.speciesGroups.listByGraph(graph.graphId).length, 0),
        speciesNodes: graphs.reduce((count, graph) => count + store.nodes.listByGraph(graph.graphId).length, 0),
        designRelationships: graphs.reduce((count, graph) => count + store.designRelationships.listByGraph(graph.graphId).length, 0),
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
      message: "No DNA records found in the current read-only workbench scope."
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
    assetCount: assets.length,
    latestStatus: versionReferences.some((reference) => reference.status === "missing" || reference.status === "stale")
      ? "needs-review"
      : version.status,
    preview: selectBestPreview([
      ...versionReferences.map((reference) => createOutputReferencePreview(store, reference)),
      ...assets.map((asset) => createAssetPreview(store, asset))
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
          <h1>DNA Read-only Workbench</h1>
        </div>
        <dl class="metrics" aria-label="Workbench metrics">
          <div><dt>Graphs</dt><dd id="metric-graphs">0</dd></div>
          <div><dt>Phenotypes</dt><dd id="metric-phenotypes">0</dd></div>
          <div><dt>Tasks</dt><dd id="metric-tasks">0</dd></div>
        </dl>
      </header>
      <section id="state" class="state" aria-live="polite">Loading read-only workbench snapshot from /api/workbench/snapshot...</section>
      <section class="workspace" aria-label="Read-only DNA workbench">
        <aside id="list" class="list" aria-label="Graphs"></aside>
        <section id="detail" class="panel empty" aria-label="Workbench detail">
          <h2>No object selected</h2>
          <p class="muted">Workbench data is loaded from the local DNA API. Durable writes stay in CLI/service boundaries.</p>
        </section>
      </section>
    </main>
    <script>
      const endpoint = "/api/workbench/snapshot";
      const state = document.getElementById("state");
      const list = document.getElementById("list");
      const detail = document.getElementById("detail");
      const metricGraphs = document.getElementById("metric-graphs");
      const metricPhenotypes = document.getElementById("metric-phenotypes");
      const metricTasks = document.getElementById("metric-tasks");

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

      function renderGraphDetail(graph) {
        detail.className = "panel";
        detail.innerHTML =
          '<div><p class="product-name">Graph</p><h2>' + escapeHtml(graph.name) + '</h2>' +
          '<p class="muted">' + escapeHtml(graph.graphId) + ' - ' + escapeHtml(graph.status) + '</p></div>' +
          '<section><h3>Structure</h3><p class="muted">' + escapeHtml(graph.counts?.groups ?? 0) + ' groups, ' + escapeHtml(graph.counts?.nodes ?? 0) + ' nodes, ' + escapeHtml(graph.counts?.relationships ?? 0) + ' design relationships.</p></section>' +
          '<section><h3>Phenotype overlay</h3><p class="muted">' + escapeHtml(graph.counts?.phenotypes ?? 0) + ' phenotype containers in this graph.</p></section>' +
          '<section><h3>Trace</h3><pre>' + escapeHtml(JSON.stringify(graph.compileTrace ?? {}, null, 2)) + '</pre></section>';
      }

      function render(body) {
        const counts = body?.overview?.counts ?? {};
        const graphs = Array.isArray(body?.graphs) ? body.graphs : [];
        const phenotypes = Array.isArray(body?.phenotypes) ? body.phenotypes : [];
        metricGraphs.textContent = String(counts.graphs ?? graphs.length);
        metricPhenotypes.textContent = String(counts.phenotypes ?? phenotypes.length);
        metricTasks.textContent = String(counts.generationTasks ?? body?.generationTasks?.length ?? body?.generation?.tasks?.length ?? 0);
        if (graphs.length === 0 && phenotypes.length === 0) {
          state.className = "state";
          state.textContent = "No DNA records found in this local store.";
          list.innerHTML = '<div class="row"><span><strong>No DNA records found</strong><small>Use the CLI/service boundary, then refresh this read-only workbench.</small></span></div>';
          detail.className = "panel empty";
          detail.innerHTML = '<h2>No DNA records found</h2><p class="muted">This read-only page did not modify the DNA store.</p>';
          return;
        }
        state.className = "state";
        state.textContent = "Loaded read-only DNA workbench snapshot from the local API.";
        list.innerHTML = graphs.length ? graphs.map((graph, index) =>
          '<button class="row" type="button" data-index="' + index + '"><span><strong>' + escapeHtml(graph.name) + '</strong><small>' + escapeHtml(graph.graphId) + '</small></span><span class="chip">' + escapeHtml(graph.status ?? 'unknown') + '</span></button>'
        ).join('') : phenotypes.map((phenotype, index) => {
          const version = selectedVersion(phenotype);
          return '<button class="row" type="button" data-index="' + index + '"><span><strong>' + escapeHtml(phenotype.name) + '</strong><small>' + escapeHtml(phenotype.nodeName) + '</small></span><span class="chip">' + escapeHtml(version?.status ?? 'no-version') + '</span></button>';
        }).join('');
        for (const row of list.querySelectorAll('button[data-index]')) {
          row.addEventListener('click', () => graphs.length ? renderGraphDetail(graphs[Number(row.dataset.index)]) : renderDetail(phenotypes[Number(row.dataset.index)]));
        }
        graphs.length ? renderGraphDetail(graphs[0]) : renderDetail(phenotypes[0]);
      }

      fetch(endpoint)
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then((body) => render(body))
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
