export type StatusObjectType = "graph" | "node" | "design-relationship" | "phenotype" | "phenotype-version" | "asset";

const statusTransitions: Record<StatusObjectType, Record<string, string[]>> = {
  graph: {
    draft: ["active", "archived"],
    active: ["archived"],
    archived: []
  },
  node: {
    draft: ["active", "deprecated", "archived"],
    active: ["deprecated", "archived"],
    deprecated: ["archived"],
    archived: []
  },
  "design-relationship": {
    draft: ["active", "deprecated", "archived"],
    active: ["deprecated", "archived"],
    deprecated: ["archived"],
    archived: []
  },
  phenotype: {
    active: ["archived", "deleted"],
    archived: [],
    deleted: []
  },
  "phenotype-version": {
    "pending-confirmation": ["accepted", "rejected", "deleted", "superseded", "archived"],
    accepted: ["superseded", "archived", "deleted"],
    rejected: ["archived", "deleted"],
    deleted: [],
    superseded: ["archived", "deleted"],
    archived: []
  },
  asset: {
    pending: ["active", "rejected", "deleted", "archived"],
    active: ["rejected", "deleted", "archived"],
    rejected: ["archived", "deleted"],
    deleted: [],
    archived: []
  }
};

export function canTransitionStatus(objectType: StatusObjectType, from: string, to: string): boolean {
  if (from === to) return true;
  return statusTransitions[objectType]?.[from]?.includes(to) ?? false;
}

export function assertCanTransitionStatus(objectType: StatusObjectType, from: string, to: string): void {
  if (!canTransitionStatus(objectType, from, to)) {
    throw new Error(`Invalid ${objectType} status transition: ${from} -> ${to}`);
  }
}

export function resolveLineageStatus(input: {
  parentNodes: string[];
  incomingRelationshipIds: string[];
  primaryParent?: string | null;
}): "complete" | "species-first" | "needs-relationship" | "multi-origin" {
  if (input.parentNodes.length === 0) return "species-first";
  if (input.incomingRelationshipIds.length < input.parentNodes.length) return "needs-relationship";
  if (input.parentNodes.length > 1 && !input.primaryParent) return "multi-origin";
  return "complete";
}
