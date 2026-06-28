import {
  checkModelingBatchQuality as checkCoreModelingBatchQuality,
  checkModelingQuality,
  type ChangeSet,
  type DesignRelationship,
  type FacetAssignment,
  type FacetDefinition,
  type FacetSchema,
  type Graph,
  type ModelingQualityReport,
  type Phenotype,
  type SpeciesGroup,
  type SpeciesGroupMembership,
  type SpeciesNode
} from "@dna/core";
import type { DnaServiceStore } from "@dna/storage";

export function checkModelingBatchQuality(batch: unknown): ModelingQualityReport {
  return checkCoreModelingBatchQuality(batch);
}

export function checkGraphModelingQuality(store: DnaServiceStore, graphId: string): ModelingQualityReport {
  const graph = store.graphs.get(graphId);
  if (!graph) throw new Error(`graph not found: ${graphId}`);
  return checkModelingQuality({
    source: { type: "graph", id: graphId },
    graphs: [graph],
    speciesNodes: store.nodes.listByGraph(graphId),
    speciesGroups: store.speciesGroups.listByGraph(graphId),
    groupMemberships: store.speciesGroupMemberships.listByGraph(graphId),
    designRelationships: store.designRelationships.listByGraph(graphId),
    facetDefinitions: store.facetDefinitions.list(),
    facetSchemas: store.facetSchemas.list(),
    facetAssignments: store.facetAssignments.list(),
    phenotypes: store.phenotypes.listByGraph(graphId)
  });
}

export function checkProposalModelingQuality(store: DnaServiceStore, proposalId: string): ModelingQualityReport {
  const proposal = store.proposals.get(proposalId);
  if (!proposal) throw new Error(`proposal not found: ${proposalId}`);
  const graphs: Graph[] = [];
  const speciesNodes: SpeciesNode[] = [];
  const speciesGroups: SpeciesGroup[] = [];
  const groupMemberships: SpeciesGroupMembership[] = [];
  const designRelationships: DesignRelationship[] = [];
  const facetDefinitions: FacetDefinition[] = [];
  const facetSchemas: FacetSchema[] = [];
  const facetAssignments: FacetAssignment[] = [];
  const phenotypes: Phenotype[] = [];

  for (const changeSetId of proposal.changeSetIds) {
    const changeSet = store.changeSets.get(changeSetId);
    if (!changeSet) throw new Error(`proposal ${proposalId} references missing change-set: ${changeSetId}`);
    collectProposalPayload(changeSet, {
      graphs,
      speciesNodes,
      speciesGroups,
      groupMemberships,
      designRelationships,
      facetDefinitions,
      facetSchemas,
      facetAssignments,
      phenotypes
    });
  }

  return checkModelingQuality({
    source: { type: "proposal", id: proposalId },
    graphs,
    speciesNodes,
    speciesGroups,
    groupMemberships,
    designRelationships,
    facetDefinitions,
    facetSchemas,
    facetAssignments,
    phenotypes
  });
}

function collectProposalPayload(
  changeSet: ChangeSet,
  target: {
    graphs: Graph[];
    speciesNodes: SpeciesNode[];
    speciesGroups: SpeciesGroup[];
    groupMemberships: SpeciesGroupMembership[];
    designRelationships: DesignRelationship[];
    facetDefinitions: FacetDefinition[];
    facetSchemas: FacetSchema[];
    facetAssignments: FacetAssignment[];
    phenotypes: Phenotype[];
  }
) {
  const payload = changeSet.payload as Record<string, unknown>;
  if (changeSet.objectType === "graph" && payload.graph) target.graphs.push(payload.graph as Graph);
  if (changeSet.objectType === "node" && payload.node) target.speciesNodes.push(payload.node as SpeciesNode);
  if (changeSet.objectType === "species-group" && payload.group) target.speciesGroups.push(payload.group as SpeciesGroup);
  if (changeSet.objectType === "species-group-membership" && payload.membership) target.groupMemberships.push(payload.membership as SpeciesGroupMembership);
  if (changeSet.objectType === "design-relationship" && payload.relationship) target.designRelationships.push(payload.relationship as DesignRelationship);
  if (changeSet.objectType === "facet-definition" && payload.definition) target.facetDefinitions.push(payload.definition as FacetDefinition);
  if (changeSet.objectType === "facet-schema" && payload.schema) target.facetSchemas.push(payload.schema as FacetSchema);
  if (changeSet.objectType === "facet-assignment" && payload.assignment) target.facetAssignments.push(payload.assignment as FacetAssignment);
  if (changeSet.objectType === "phenotype" && payload.phenotype) target.phenotypes.push(payload.phenotype as Phenotype);
}
