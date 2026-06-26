import {
  ChangeSet,
  createChangeSet,
  createDefaultGraph,
  createDefaultEvolutionEdge,
  createDefaultNodeVersion,
  createDefaultSpeciesNode,
  EdgeVersion,
  EvolutionEdge,
  Graph,
  markChangeSetApplied,
  markChangeSetDiscarded,
  nowIso,
  resolveLineageStatus,
  SpeciesNode,
  WriteMode
} from "@dna/core";
import { DnaServiceStore } from "./memory.js";

export interface WriteOptions {
  mode: WriteMode;
  apply?: boolean;
  changeSetId?: string;
}

export interface ServiceResult<T> {
  value: T;
  changeSet: ChangeSet;
}

export interface ChangeSetFilter {
  status?: ChangeSet["status"];
  objectType?: string;
}

export interface ChangeSetReviewResult {
  changeSetId: string;
  objectType: string;
  operation: ChangeSet["operation"];
  status: "pass" | "needs-review" | "fail";
  missingDimensions: string[];
  constraintViolations: string[];
  suggestedActions: string[];
  previewSummary: string;
}

export interface CreateGraphInput {
  graphId: string;
  name: string;
  purpose: string;
  status?: Graph["status"];
  templateIds?: string[];
}

export interface CreateNodeInput {
  graphId: string;
  nodeId: string;
  name: string;
  category: string;
  level: string;
  parentNodes?: string[];
  primaryParent?: string;
  parentRoles?: SpeciesNode["parentRoles"];
  motifs?: string[];
  constraints?: Record<string, unknown>;
  badcases?: string[];
}

export interface CreateEdgeInput {
  graphId: string;
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType?: EvolutionEdge["edgeType"];
  direction?: string;
  operation?: string;
  deltaGenes?: Record<string, unknown>;
  valueResolution?: Record<string, unknown>;
  mustPreserve?: string[];
  mustAvoid?: string[];
}

export function createDnaServices(store: DnaServiceStore) {
  return {
    graph: {
      createGraph(input: CreateGraphInput, options: WriteOptions): ServiceResult<Graph> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyGraphChangeSet(store, existing);
        }
        const graph = createDefaultGraph({
          graphId: input.graphId,
          name: input.name,
          purpose: input.purpose,
          status: options.mode === "draft-write" ? "draft" : input.status ?? "draft",
          templateIds: input.templateIds ?? []
        });
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "graph",
          operation: "create",
          summary: `create graph ${graph.graphId}`,
          diff: { graphId: graph.graphId, name: graph.name, status: graph.status },
          payload: { graph }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyGraphChangeSet(store, changeSet);
        }
        return { value: graph, changeSet };
      }
    },
    lineage: {
      createNode(input: CreateNodeInput, options: WriteOptions): ServiceResult<{ node: SpeciesNode; nodeVersionId: string }> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyNodeChangeSet(store, existing);
        }
        const node = createDefaultSpeciesNode({
          graphId: input.graphId,
          nodeId: input.nodeId,
          name: input.name,
          category: input.category,
          level: input.level,
          parentNodes: input.parentNodes ?? [],
          primaryParent: input.primaryParent,
          parentRoles: input.parentRoles ?? {},
          motifs: input.motifs ?? [],
          constraints: input.constraints ?? {},
          badcases: input.badcases ?? []
        });
        const version = createDefaultNodeVersion({
          graphId: node.graphId,
          nodeId: node.nodeId,
          nodeVersionId: `${node.nodeId}@${node.currentVersion}`,
          ownGeneDelta: node.constraints,
          resolvedGeneSnapshot: { ...node.constraints, motifs: node.motifs, badcases: node.badcases },
          constraintSnapshot: node.constraints,
          compileSnapshot: node.compilePolicy ?? { type: "system-rule-first" }
        });
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "node",
          operation: "create",
          summary: `create node ${node.nodeId}`,
          diff: { nodeId: node.nodeId, graphId: node.graphId, version: version.nodeVersionId },
          payload: { node, version }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyNodeChangeSet(store, changeSet);
        }
        return { value: { node, nodeVersionId: version.nodeVersionId }, changeSet };
      },
      createEdge(input: CreateEdgeInput, options: WriteOptions): ServiceResult<{ edge: EvolutionEdge; edgeVersionId: string }> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyEdgeChangeSet(store, existing);
        }
        const edge = createDefaultEvolutionEdge({
          graphId: input.graphId,
          edgeId: input.edgeId,
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          edgeType: input.edgeType ?? "inherit",
          direction: input.direction ?? "inherits visual identity",
          operation: input.operation ?? "merge",
          deltaGenes: input.deltaGenes ?? {},
          valueResolution: input.valueResolution ?? { default: "override" },
          mustPreserve: input.mustPreserve ?? [],
          mustAvoid: input.mustAvoid ?? []
        });
        const version: EdgeVersion = {
          edgeVersionId: `${edge.edgeId}@${edge.currentVersion}`,
          edgeId: edge.edgeId,
          graphId: edge.graphId,
          version: edge.currentVersion,
          deltaGenes: edge.deltaGenes,
          valueResolution: edge.valueResolution,
          mustPreserve: edge.mustPreserve,
          mustAvoid: edge.mustAvoid,
          changeSummary: `create edge ${edge.edgeId}`,
          createdAt: edge.createdAt
        };
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "edge",
          operation: "create",
          summary: `create edge ${edge.edgeId}`,
          diff: { edgeId: edge.edgeId, graphId: edge.graphId, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
          payload: { edge, version }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyEdgeChangeSet(store, changeSet);
        }
        return { value: { edge, edgeVersionId: version.edgeVersionId }, changeSet };
      }
    },
    changeSet: {
      list(filter: ChangeSetFilter = {}): ChangeSet[] {
        return store.changeSets.list().filter((changeSet) => {
          if (filter.status && changeSet.status !== filter.status) return false;
          if (filter.objectType && changeSet.objectType !== filter.objectType) return false;
          return true;
        });
      },
      get(changeSetId: string): ChangeSet | undefined {
        return store.changeSets.get(changeSetId);
      },
      apply(changeSetId: string): ServiceResult<unknown> {
        return applyChangeSet(store, requireExistingChangeSet(store, changeSetId));
      },
      discard(changeSetId: string): ChangeSet {
        const existing = requireExistingChangeSet(store, changeSetId);
        const discarded = markChangeSetDiscarded(existing);
        store.changeSets.update(discarded);
        return discarded;
      },
      review(changeSetId: string): ChangeSetReviewResult {
        const existing = requireChangeSet(store, changeSetId);
        return reviewChangeSet(store, existing);
      }
    }
  };
}

function shouldApply(options: WriteOptions): boolean {
  return options.apply === true || options.mode === "draft-write";
}

function requireExistingChangeSet(store: DnaServiceStore, changeSetId: string | undefined): ChangeSet {
  if (!changeSetId) throw new Error("change-set id is required for changeset-apply");
  const existing = requireChangeSet(store, changeSetId);
  if (existing.status !== "preview") throw new Error(`change-set is not preview: ${changeSetId}`);
  return existing;
}

function requireChangeSet(store: DnaServiceStore, changeSetId: string | undefined): ChangeSet {
  if (!changeSetId) throw new Error("change-set id is required");
  const existing = store.changeSets.get(changeSetId);
  if (!existing) throw new Error(`change-set not found: ${changeSetId}`);
  return existing;
}

function applyChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<unknown> {
  if (changeSet.objectType === "graph") return applyGraphChangeSet(store, changeSet);
  if (changeSet.objectType === "node") return applyNodeChangeSet(store, changeSet);
  if (changeSet.objectType === "edge") return applyEdgeChangeSet(store, changeSet);
  throw new Error(`unsupported change-set object type: ${changeSet.objectType}`);
}

function reviewChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ChangeSetReviewResult {
  const missingDimensions: string[] = [];
  const constraintViolations: string[] = [];
  const suggestedActions: string[] = [];
  if (changeSet.status !== "preview") {
    suggestedActions.push(`change-set is ${changeSet.status}; review is informational only`);
  }
  if (changeSet.objectType === "graph") {
    const graph = changeSet.payload.graph as Graph | undefined;
    if (!graph) constraintViolations.push("change-set payload missing graph");
    if (graph && !graph.purpose) missingDimensions.push("graph.purpose");
  } else if (changeSet.objectType === "node") {
    const node = changeSet.payload.node as SpeciesNode | undefined;
    if (!node) {
      constraintViolations.push("change-set payload missing node");
    } else {
      if (!store.graphs.get(node.graphId)) constraintViolations.push(`graph not found: ${node.graphId}`);
      if (!node.category) missingDimensions.push("node.category");
      if (!node.level) missingDimensions.push("node.level");
    }
  } else if (changeSet.objectType === "edge") {
    const edge = changeSet.payload.edge as EvolutionEdge | undefined;
    if (!edge) {
      constraintViolations.push("change-set payload missing edge");
    } else {
      if (!store.graphs.get(edge.graphId)) constraintViolations.push(`graph not found: ${edge.graphId}`);
      if (!store.nodes.get(edge.fromNodeId)) constraintViolations.push(`source node not found: ${edge.fromNodeId}`);
      if (!store.nodes.get(edge.toNodeId)) constraintViolations.push(`target node not found: ${edge.toNodeId}`);
    }
  } else {
    suggestedActions.push(`manual review required for unsupported object type: ${changeSet.objectType}`);
  }
  if (missingDimensions.length === 0 && constraintViolations.length === 0) {
    suggestedActions.push("change-set can be applied or discarded after human review");
  }
  return {
    changeSetId: changeSet.changeSetId,
    objectType: changeSet.objectType,
    operation: changeSet.operation,
    status: constraintViolations.length > 0 ? "fail" : missingDimensions.length > 0 ? "needs-review" : "pass",
    missingDimensions,
    constraintViolations,
    suggestedActions,
    previewSummary: changeSet.preview.summary
  };
}

function applyGraphChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<Graph> {
  const graph = changeSet.payload.graph as Graph | undefined;
  if (!graph) throw new Error("change-set payload missing graph");
  const applied = store.transaction(() => {
    store.graphs.create(graph);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: graph, changeSet: applied };
}

function applyNodeChangeSet(
  store: DnaServiceStore,
  changeSet: ChangeSet
): ServiceResult<{ node: SpeciesNode; nodeVersionId: string }> {
  const node = changeSet.payload.node as SpeciesNode | undefined;
  const version = changeSet.payload.version as ReturnType<typeof createDefaultNodeVersion> | undefined;
  if (!node || !version) throw new Error("change-set payload missing node or version");
  const applied = store.transaction(() => {
    const graph = store.graphs.get(node.graphId);
    if (!graph) throw new Error(`graph not found: ${node.graphId}`);
    store.nodes.create(node);
    store.nodeVersions.create(version);
    if (node.parentNodes.length === 0 && !graph.rootNodes.includes(node.nodeId)) {
      store.graphs.update({ ...graph, rootNodes: [...graph.rootNodes, node.nodeId], updatedAt: nowIso() });
    }
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: { node, nodeVersionId: version.nodeVersionId }, changeSet: applied };
}

function applyEdgeChangeSet(
  store: DnaServiceStore,
  changeSet: ChangeSet
): ServiceResult<{ edge: EvolutionEdge; edgeVersionId: string }> {
  const edge = changeSet.payload.edge as EvolutionEdge | undefined;
  const version = changeSet.payload.version as EdgeVersion | undefined;
  if (!edge || !version) throw new Error("change-set payload missing edge or version");
  const applied = store.transaction(() => {
    const graph = store.graphs.get(edge.graphId);
    if (!graph) throw new Error(`graph not found: ${edge.graphId}`);
    const target = store.nodes.get(edge.toNodeId);
    if (!target) throw new Error(`target node not found: ${edge.toNodeId}`);
    store.edges.create(edge);
    store.edgeVersions.create(version);
    const incomingEdges = target.incomingEdges.includes(edge.edgeId)
      ? target.incomingEdges
      : [...target.incomingEdges, edge.edgeId];
    store.nodes.update({
      ...target,
      incomingEdges,
      lineageStatus: resolveLineageStatus({
        parentNodes: target.parentNodes,
        incomingEdges,
        primaryParent: target.primaryParent
      }),
      updatedAt: nowIso()
    });
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: { edge, edgeVersionId: version.edgeVersionId }, changeSet: applied };
}
