import { EvolutionEdge, Graph, SpeciesGroup, SpeciesGroupMembership, SpeciesGroupRelation, SpeciesNode } from "./schemas.js";

export interface GraphTreeRelation {
  fromNodeId: string;
  toNodeId: string;
  edgeId?: string;
  edgeType?: EvolutionEdge["edgeType"];
  direction?: string;
  parentRole?: SpeciesNode["parentRoles"][string];
  primary: boolean;
}

export interface GraphTreeNode {
  nodeId: string;
  name: string;
  category: string;
  level: string;
  status: SpeciesNode["status"];
  lineageStatus: SpeciesNode["lineageStatus"];
  parentNodes: string[];
  primaryParent?: string | null;
  incomingEdges: string[];
  edgeId?: string;
  edgeType?: EvolutionEdge["edgeType"];
  parentRole?: SpeciesNode["parentRoles"][string];
  children: GraphTreeNode[];
}

export interface GraphTree {
  graph: Pick<Graph, "graphId" | "name" | "purpose" | "rootNodes">;
  roots: GraphTreeNode[];
  relations: GraphTreeRelation[];
  additionalRelations: GraphTreeRelation[];
  missingNodeIds: string[];
}

export interface GraphGroupOverlay {
  groups: SpeciesGroup[];
  memberships: SpeciesGroupMembership[];
  groupRelations: SpeciesGroupRelation[];
  membershipsByNodeId: Record<string, SpeciesGroupMembership[]>;
  ungroupedNodeIds: string[];
}

export interface GraphTreeWithGroupOverlay extends GraphTree {
  groupOverlay: GraphGroupOverlay;
}

export function buildGraphTree(input: { graph: Graph; nodes: SpeciesNode[]; edges: EvolutionEdge[] }): GraphTree {
  const nodes = input.nodes.filter((node) => node.graphId === input.graph.graphId);
  const edges = input.edges.filter((edge) => edge.graphId === input.graph.graphId);
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const nodeOrder = new Map(nodes.map((node, index) => [node.nodeId, index]));
  const relationByPair = new Map<string, GraphTreeRelation>();
  const missingNodeIds = new Set<string>();

  for (const node of nodes) {
    for (const parentId of node.parentNodes) {
      upsertRelation(relationByPair, parentId, node.nodeId, {
        parentRole: node.parentRoles[parentId],
        primary: false
      });
      if (!nodeById.has(parentId)) missingNodeIds.add(parentId);
    }
  }

  for (const edge of edges) {
    upsertRelation(relationByPair, edge.fromNodeId, edge.toNodeId, {
      edgeId: edge.edgeId,
      edgeType: edge.edgeType,
      direction: edge.direction,
      parentRole: nodeById.get(edge.toNodeId)?.parentRoles[edge.fromNodeId],
      primary: false
    });
    if (!nodeById.has(edge.fromNodeId)) missingNodeIds.add(edge.fromNodeId);
    if (!nodeById.has(edge.toNodeId)) missingNodeIds.add(edge.toNodeId);
  }

  const relations = [...relationByPair.values()].filter((relation) => nodeById.has(relation.fromNodeId) && nodeById.has(relation.toNodeId));
  const primaryRelationByChild = new Map<string, GraphTreeRelation>();
  for (const node of nodes) {
    const incoming = relations.filter((relation) => relation.toNodeId === node.nodeId);
    const selected = selectPrimaryRelation(node, incoming);
    if (selected) {
      selected.primary = true;
      primaryRelationByChild.set(node.nodeId, selected);
    }
  }

  const childrenByParent = new Map<string, GraphTreeRelation[]>();
  for (const relation of primaryRelationByChild.values()) {
    const children = childrenByParent.get(relation.fromNodeId) ?? [];
    children.push(relation);
    childrenByParent.set(relation.fromNodeId, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => compareNodeOrder(left.toNodeId, right.toNodeId, nodeOrder));
  }

  const rootIds = selectRootIds(input.graph, nodes, primaryRelationByChild, nodeById, nodeOrder);
  const roots = rootIds.map((nodeId) => buildTreeNode(nodeById.get(nodeId)!, childrenByParent, nodeById, new Set()));
  const additionalRelations = relations
    .filter((relation) => !relation.primary)
    .sort((left, right) => {
      const byTarget = compareNodeOrder(left.toNodeId, right.toNodeId, nodeOrder);
      if (byTarget !== 0) return byTarget;
      return compareNodeOrder(left.fromNodeId, right.fromNodeId, nodeOrder);
    });

  return {
    graph: {
      graphId: input.graph.graphId,
      name: input.graph.name,
      purpose: input.graph.purpose,
      rootNodes: input.graph.rootNodes
    },
    roots,
    relations: relations.sort((left, right) => {
      const bySource = compareNodeOrder(left.fromNodeId, right.fromNodeId, nodeOrder);
      if (bySource !== 0) return bySource;
      return compareNodeOrder(left.toNodeId, right.toNodeId, nodeOrder);
    }),
    additionalRelations,
    missingNodeIds: [...missingNodeIds].sort()
  };
}

export function formatGraphTreeText(tree: GraphTree): string {
  const lines = [`Graph Tree: ${tree.graph.name} (${tree.graph.graphId})`];
  if (tree.roots.length === 0) {
    lines.push("(no species nodes)");
  } else {
    for (const root of tree.roots) {
      appendNodeLines(lines, root, 0);
    }
  }

  if (tree.additionalRelations.length > 0) {
    lines.push("");
    lines.push("Additional parent relations:");
    for (const relation of tree.additionalRelations) {
      lines.push(formatRelationLine(tree, relation));
    }
  }

  if (tree.missingNodeIds.length > 0) {
    lines.push("");
    lines.push(`Missing node references: ${tree.missingNodeIds.join(", ")}`);
  }

  return `${lines.join("\n")}\n`;
}

export function buildGraphGroupOverlay(input: {
  graph: Graph;
  nodes: SpeciesNode[];
  groups: SpeciesGroup[];
  memberships: SpeciesGroupMembership[];
  groupRelations: SpeciesGroupRelation[];
}): GraphGroupOverlay {
  const nodeIds = new Set(input.nodes.filter((node) => node.graphId === input.graph.graphId).map((node) => node.nodeId));
  const groups = input.groups.filter((group) => group.graphId === input.graph.graphId).sort((left, right) => left.groupId.localeCompare(right.groupId));
  const groupIds = new Set(groups.map((group) => group.groupId));
  const memberships = input.memberships
    .filter((membership) => membership.graphId === input.graph.graphId && nodeIds.has(membership.nodeId) && groupIds.has(membership.groupId))
    .sort((left, right) => left.groupId.localeCompare(right.groupId) || left.nodeId.localeCompare(right.nodeId) || left.membershipId.localeCompare(right.membershipId));
  const groupRelations = input.groupRelations
    .filter(
      (relation) =>
        relation.graphId === input.graph.graphId && groupIds.has(relation.sourceGroupId) && groupIds.has(relation.targetGroupId)
    )
    .sort(
      (left, right) =>
        left.sourceGroupId.localeCompare(right.sourceGroupId) ||
        left.targetGroupId.localeCompare(right.targetGroupId) ||
        left.relationId.localeCompare(right.relationId)
    );
  const membershipsByNodeId: Record<string, SpeciesGroupMembership[]> = {};
  for (const membership of memberships) {
    membershipsByNodeId[membership.nodeId] = membershipsByNodeId[membership.nodeId] ?? [];
    membershipsByNodeId[membership.nodeId].push(membership);
  }
  const ungroupedNodeIds = [...nodeIds].filter((nodeId) => !membershipsByNodeId[nodeId]?.length).sort();
  return { groups, memberships, groupRelations, membershipsByNodeId, ungroupedNodeIds };
}

export function formatGraphTreeWithGroupsText(tree: GraphTree, overlay: GraphGroupOverlay): string {
  const lines = formatGraphTreeText(tree).trimEnd().split("\n");
  const nodeById = collectTreeNodes(tree);
  const groupById = new Map(overlay.groups.map((group) => [group.groupId, group]));
  const membershipsByGroupId = new Map<string, SpeciesGroupMembership[]>();
  for (const membership of overlay.memberships) {
    const memberships = membershipsByGroupId.get(membership.groupId) ?? [];
    memberships.push(membership);
    membershipsByGroupId.set(membership.groupId, memberships);
  }

  lines.push("");
  lines.push("Groups:");
  if (overlay.groups.length === 0) {
    lines.push("- none");
  } else {
    for (const group of overlay.groups) {
      const details = [group.groupType, group.status].filter(Boolean).join(", ");
      const summary = group.sharedFacts.length ? ` - ${group.sharedFacts.join("; ")}` : "";
      lines.push(`- ${group.name} (${group.groupId}) [${details}]${summary}`);
      const memberships = membershipsByGroupId.get(group.groupId) ?? [];
      if (memberships.length === 0) {
        lines.push("  - no members");
      } else {
        for (const membership of memberships) {
          const node = nodeById.get(membership.nodeId);
          lines.push(`  - ${node?.name ?? membership.nodeId} (${membership.nodeId}) [${membership.role}, ${membership.membershipId}]`);
        }
      }
    }
  }

  lines.push("");
  lines.push("Ungrouped nodes:");
  if (overlay.ungroupedNodeIds.length === 0) {
    lines.push("- none");
  } else {
    for (const nodeId of overlay.ungroupedNodeIds) {
      const node = nodeById.get(nodeId);
      lines.push(`- ${node?.name ?? nodeId} (${nodeId})`);
    }
  }

  lines.push("");
  lines.push("Group relations:");
  if (overlay.groupRelations.length === 0) {
    lines.push("- none");
  } else {
    for (const relation of overlay.groupRelations) {
      const source = groupById.get(relation.sourceGroupId);
      const target = groupById.get(relation.targetGroupId);
      const description = relation.description ? ` ${relation.description}` : "";
      lines.push(
        `- ${source?.name ?? relation.sourceGroupId} (${relation.sourceGroupId}) -> ${target?.name ?? relation.targetGroupId} (${relation.targetGroupId}) [${relation.relationType}, ${relation.relationId}]${description}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function upsertRelation(
  relationByPair: Map<string, GraphTreeRelation>,
  fromNodeId: string,
  toNodeId: string,
  patch: Partial<GraphTreeRelation>
) {
  const key = `${fromNodeId}->${toNodeId}`;
  const existing = relationByPair.get(key);
  relationByPair.set(key, {
    fromNodeId,
    toNodeId,
    edgeId: patch.edgeId ?? existing?.edgeId,
    edgeType: patch.edgeType ?? existing?.edgeType,
    direction: patch.direction ?? existing?.direction,
    parentRole: patch.parentRole ?? existing?.parentRole,
    primary: existing?.primary ?? patch.primary ?? false
  });
}

function selectPrimaryRelation(node: SpeciesNode, incoming: GraphTreeRelation[]) {
  if (incoming.length === 0) return undefined;
  if (node.primaryParent) {
    const primary = incoming.find((relation) => relation.fromNodeId === node.primaryParent);
    if (primary) return primary;
  }
  const firstParent = node.parentNodes[0];
  if (firstParent) {
    const first = incoming.find((relation) => relation.fromNodeId === firstParent);
    if (first) return first;
  }
  return incoming[0];
}

function selectRootIds(
  graph: Graph,
  nodes: SpeciesNode[],
  primaryRelationByChild: Map<string, GraphTreeRelation>,
  nodeById: Map<string, SpeciesNode>,
  nodeOrder: Map<string, number>
) {
  const rootIds = new Set<string>();
  for (const rootId of graph.rootNodes) {
    if (nodeById.has(rootId)) rootIds.add(rootId);
  }
  for (const node of nodes) {
    if (!primaryRelationByChild.has(node.nodeId)) rootIds.add(node.nodeId);
  }
  return [...rootIds].sort((left, right) => compareNodeOrder(left, right, nodeOrder));
}

function buildTreeNode(
  node: SpeciesNode,
  childrenByParent: Map<string, GraphTreeRelation[]>,
  nodeById: Map<string, SpeciesNode>,
  ancestors: Set<string>
): GraphTreeNode {
  const childRelations = ancestors.has(node.nodeId) ? [] : childrenByParent.get(node.nodeId) ?? [];
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(node.nodeId);
  const children: GraphTreeNode[] = [];
  for (const relation of childRelations) {
    const child = nodeById.get(relation.toNodeId);
    if (!child) continue;
    children.push({
      ...buildTreeNode(child, childrenByParent, nodeById, nextAncestors),
      edgeId: relation.edgeId,
      edgeType: relation.edgeType,
      parentRole: relation.parentRole
    });
  }
  return {
    nodeId: node.nodeId,
    name: node.name,
    category: node.category,
    level: node.level,
    status: node.status,
    lineageStatus: node.lineageStatus,
    parentNodes: node.parentNodes,
    primaryParent: node.primaryParent,
    incomingEdges: node.incomingEdges,
    children
  };
}

function appendNodeLines(lines: string[], node: GraphTreeNode, depth: number) {
  const indent = "  ".repeat(depth);
  const details = node.lineageStatus === "species-first" ? "" : ` [${node.lineageStatus}]`;
  lines.push(`${indent}- ${node.name} (${node.nodeId})${details}`);
  for (const child of node.children) {
    appendNodeLines(lines, child, depth + 1);
  }
}

function formatRelationLine(tree: GraphTree, relation: GraphTreeRelation) {
  const from = findTreeNode(tree.roots, relation.fromNodeId);
  const to = findTreeNode(tree.roots, relation.toNodeId);
  const labels = [relation.edgeType ?? relation.parentRole, relation.edgeId].filter((value): value is string => Boolean(value));
  const suffix = labels.length ? ` [${labels.join(", ")}]` : "";
  return `- ${from?.name ?? relation.fromNodeId} (${relation.fromNodeId}) -> ${to?.name ?? relation.toNodeId} (${relation.toNodeId})${suffix}`;
}

function findTreeNode(nodes: GraphTreeNode[], nodeId: string): GraphTreeNode | undefined {
  for (const node of nodes) {
    if (node.nodeId === nodeId) return node;
    const child = findTreeNode(node.children, nodeId);
    if (child) return child;
  }
  return undefined;
}

function collectTreeNodes(tree: GraphTree): Map<string, GraphTreeNode> {
  const nodes = new Map<string, GraphTreeNode>();
  for (const root of tree.roots) collectTreeNode(root, nodes);
  return nodes;
}

function collectTreeNode(node: GraphTreeNode, nodes: Map<string, GraphTreeNode>) {
  nodes.set(node.nodeId, node);
  for (const child of node.children) collectTreeNode(child, nodes);
}

function compareNodeOrder(left: string, right: string, nodeOrder: Map<string, number>) {
  return (nodeOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (nodeOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right);
}
