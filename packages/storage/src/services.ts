import {
  ChangeSet,
  createChangeSet,
  createDefaultGraph,
  createDefaultNodeVersion,
  createDefaultSpeciesNode,
  Graph,
  markChangeSetApplied,
  nowIso,
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

export interface CreateGraphInput {
  graphId: string;
  name: string;
  purpose: string;
  status?: Graph["status"];
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
          status: options.mode === "draft-write" ? "draft" : input.status ?? "draft"
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
      }
    }
  };
}

function shouldApply(options: WriteOptions): boolean {
  return options.apply === true || options.mode === "draft-write";
}

function requireExistingChangeSet(store: DnaServiceStore, changeSetId: string | undefined): ChangeSet {
  if (!changeSetId) throw new Error("change-set id is required for changeset-apply");
  const existing = store.changeSets.get(changeSetId);
  if (!existing) throw new Error(`change-set not found: ${changeSetId}`);
  if (existing.status !== "preview") throw new Error(`change-set is not preview: ${changeSetId}`);
  return existing;
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
