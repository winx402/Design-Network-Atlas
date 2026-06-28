import { DesignRelationship } from "./schemas.js";

export interface RelationSetValidationResult {
  valid: boolean;
  issues: string[];
}

export function isCustomRelationType(relationType: string): boolean {
  return relationType.startsWith("custom:");
}

export function isFixedRuleEligibleRelation(relationType: string): boolean {
  return !isCustomRelationType(relationType);
}

export function validateDesignRelationshipSet(
  relationships: DesignRelationship[],
  options: { allowParallel?: boolean } = {}
): RelationSetValidationResult {
  const issues: string[] = [];
  const pairKeys = new Map<string, DesignRelationship>();
  const typedKeys = new Map<string, DesignRelationship>();

  for (const relationship of relationships) {
    const pairKey = `${formatEndpoint(relationship.source)}->${formatEndpoint(relationship.target)}`;
    const typedKey = `${pairKey}:${relationship.relationshipType}`;
    const existingTyped = typedKeys.get(typedKey);
    if (existingTyped) {
      issues.push(
        `duplicate design relationship type ${relationship.relationshipType} for ${pairKey}: ${existingTyped.relationshipId}, ${relationship.relationshipId}`
      );
      continue;
    }
    typedKeys.set(typedKey, relationship);

    const existingPair = pairKeys.get(pairKey);
    if (existingPair && !options.allowParallel) {
      issues.push(
        `parallel design relationship requires explicit allowParallel for ${pairKey}: ${existingPair.relationshipId}, ${relationship.relationshipId}`
      );
    }
    if (!existingPair) pairKeys.set(pairKey, relationship);
  }

  return { valid: issues.length === 0, issues };
}

export function formatEndpoint(endpoint: DesignRelationship["source"]): string {
  if (endpoint.type === "graph") return `graph:${endpoint.graphId}`;
  if (endpoint.type === "species-group") return `species-group:${endpoint.graphId}:${endpoint.groupId}`;
  return `species-node:${endpoint.graphId}:${endpoint.nodeId}`;
}
