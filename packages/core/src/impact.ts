export interface ImpactNodeInput {
  nodeId: string;
  phenotypeVersionIds: string[];
}

export interface ImpactEdgeInput {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface CollectImpactInput {
  changed: { type: "node" | "edge"; id: string; versionId: string };
  nodes: ImpactNodeInput[];
  edges: ImpactEdgeInput[];
}

export interface ImpactSummary {
  objectType: "node" | "phenotype-version";
  objectId: string;
  reason: string;
  suggestedAction: "review-or-regenerate";
}

export function collectImpact(input: CollectImpactInput): ImpactSummary[] {
  const startNode =
    input.changed.type === "node"
      ? input.changed.id
      : input.edges.find((edge) => edge.edgeId === input.changed.id)?.toNodeId;
  if (!startNode) return [];

  const nodeById = new Map(input.nodes.map((node) => [node.nodeId, node]));
  const outgoing = new Map<string, ImpactEdgeInput[]>();
  for (const edge of input.edges) {
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge]);
  }

  const result: ImpactSummary[] = [];
  const visited = new Set<string>();
  const queue = [...(outgoing.get(startNode) ?? []).map((edge) => edge.toNodeId)];

  while (queue.length) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    result.push({
      objectType: "node",
      objectId: nodeId,
      reason: `${nodeId} is downstream of changed ${input.changed.type} ${input.changed.id}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const phenotypeVersionId of nodeById.get(nodeId)?.phenotypeVersionIds ?? []) {
      result.push({
        objectType: "phenotype-version",
        objectId: phenotypeVersionId,
        reason: `${phenotypeVersionId} was generated from downstream node ${nodeId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
    queue.push(...(outgoing.get(nodeId) ?? []).map((edge) => edge.toNodeId));
  }

  return result;
}
