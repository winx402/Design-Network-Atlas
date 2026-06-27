import { GraphBridge, SpeciesGroupRelation } from "./schemas.js";

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

export function validateSpeciesGroupRelationSet(
  relations: SpeciesGroupRelation[],
  options: { allowParallel?: boolean } = {}
): RelationSetValidationResult {
  const issues: string[] = [];
  const pairKeys = new Map<string, SpeciesGroupRelation>();
  const typedKeys = new Map<string, SpeciesGroupRelation>();

  for (const relation of relations) {
    const pairKey = `${relation.graphId}:${relation.sourceGroupId}->${relation.targetGroupId}`;
    const typedKey = `${pairKey}:${relation.relationType}`;
    const existingTyped = typedKeys.get(typedKey);
    if (existingTyped) {
      issues.push(
        `duplicate relation type ${relation.relationType} for ${relation.sourceGroupId} -> ${relation.targetGroupId}: ${existingTyped.relationId}, ${relation.relationId}`
      );
      continue;
    }
    typedKeys.set(typedKey, relation);

    const existingPair = pairKeys.get(pairKey);
    if (existingPair && !options.allowParallel) {
      issues.push(
        `parallel group relation requires explicit allowParallel for ${relation.sourceGroupId} -> ${relation.targetGroupId}: ${existingPair.relationId}, ${relation.relationId}`
      );
    }
    if (!existingPair) pairKeys.set(pairKey, relation);
  }

  return { valid: issues.length === 0, issues };
}

export function validateGraphBridgeSet(bridges: GraphBridge[], options: { allowParallel?: boolean } = {}): RelationSetValidationResult {
  const issues: string[] = [];
  const pairKeys = new Map<string, GraphBridge>();
  const typedKeys = new Map<string, GraphBridge>();

  for (const bridge of bridges) {
    const pairKey = `${bridge.atlasId}:${bridge.sourceGraphId}->${bridge.targetGraphId}`;
    const typedKey = `${pairKey}:${bridge.bridgeType}`;
    const existingTyped = typedKeys.get(typedKey);
    if (existingTyped) {
      issues.push(
        `duplicate bridge type ${bridge.bridgeType} for ${bridge.sourceGraphId} -> ${bridge.targetGraphId}: ${existingTyped.bridgeId}, ${bridge.bridgeId}`
      );
      continue;
    }
    typedKeys.set(typedKey, bridge);

    const existingPair = pairKeys.get(pairKey);
    if (existingPair && !options.allowParallel) {
      issues.push(
        `parallel graph bridge requires explicit allowParallel for ${bridge.sourceGraphId} -> ${bridge.targetGraphId}: ${existingPair.bridgeId}, ${bridge.bridgeId}`
      );
    }
    if (!existingPair) pairKeys.set(pairKey, bridge);
  }

  return { valid: issues.length === 0, issues };
}
