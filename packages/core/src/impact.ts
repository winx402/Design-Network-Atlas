import { createImpactRecord } from "./defaults.js";
import { ImpactRecord } from "./schemas.js";

export interface ImpactNodeInput {
  nodeId: string;
  phenotypeVersionIds: string[];
}

export interface ImpactRelationshipInput {
  relationshipId: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface CollectImpactInput {
  changed: { type: "node" | "design-relationship"; id: string; versionId: string };
  nodes: ImpactNodeInput[];
  relationships: ImpactRelationshipInput[];
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
      : input.relationships.find((relationship) => relationship.relationshipId === input.changed.id)?.toNodeId;
  if (!startNode) return [];

  const nodeById = new Map(input.nodes.map((node) => [node.nodeId, node]));
  const outgoing = new Map<string, ImpactRelationshipInput[]>();
  for (const relationship of input.relationships) {
    outgoing.set(relationship.fromNodeId, [...(outgoing.get(relationship.fromNodeId) ?? []), relationship]);
  }

  const result: ImpactSummary[] = [];
  const visited = new Set<string>();
  const queue =
    input.changed.type === "design-relationship"
      ? [startNode]
      : [...(outgoing.get(startNode) ?? []).map((relationship) => relationship.toNodeId)];

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
    queue.push(...(outgoing.get(nodeId) ?? []).map((relationship) => relationship.toNodeId));
  }

  return result;
}

export interface CreateImpactRecordsInput {
  graphId: string;
  changed: CollectImpactInput["changed"];
  impacts: ImpactSummary[];
  createdAt?: string;
}

export function createImpactRecords(input: CreateImpactRecordsInput): ImpactRecord[] {
  return input.impacts.map((impact, index) =>
    createImpactRecord({
      impactRecordId: `impact-${stableIdPart(input.changed.id)}-${stableIdPart(impact.objectId)}-${index}`,
      graphId: input.graphId,
      changedObjectType: input.changed.type,
      changedObjectId: input.changed.id,
      changedVersionId: input.changed.versionId,
      objectType: impact.objectType,
      objectId: impact.objectId,
      reason: impact.reason,
      suggestedAction: impact.suggestedAction,
      reviewStatus: "pending",
      createdAt: input.createdAt
    })
  );
}

function stableIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
