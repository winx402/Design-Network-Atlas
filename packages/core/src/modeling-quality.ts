import {
  DesignRelationship,
  FacetAssignment,
  FacetDefinition,
  FacetSchema,
  Graph,
  Phenotype,
  SpeciesGroup,
  SpeciesGroupMembership,
  SpeciesNode
} from "./schemas.js";
import { ModelingBatch, ModelingBatchSchema } from "./modeling-batch.js";

export type ModelingQualitySeverity = "blocking" | "warning" | "info";

export interface ModelingQualityIssue {
  objectType: string;
  objectId: string;
  path: string;
  severity: ModelingQualitySeverity;
  reason: string;
  suggestedAction: string;
}

export interface ModelingQualityInput {
  source?: { type: "batch" | "graph" | "proposal"; id?: string };
  graphs?: Graph[];
  speciesNodes?: SpeciesNode[];
  speciesGroups?: SpeciesGroup[];
  groupMemberships?: SpeciesGroupMembership[];
  designRelationships?: DesignRelationship[];
  facetDefinitions?: FacetDefinition[];
  facetSchemas?: FacetSchema[];
  facetAssignments?: FacetAssignment[];
  phenotypes?: Array<
    Pick<Phenotype, "phenotypeId" | "graphId" | "nodeId" | "phenotypeType" | "productionSliceRole" | "name" | "objectBrief" | "outputPlan">
  >;
}

export interface ModelingQualityReport {
  source: { type: "batch" | "graph" | "proposal"; id?: string };
  status: "pass" | "needs-review";
  summary: {
    issueCount: number;
    blocking: number;
    warning: number;
    info: number;
  };
  issues: ModelingQualityIssue[];
}

export function checkModelingBatchQuality(batchInput: unknown): ModelingQualityReport {
  const batch = ModelingBatchSchema.parse(batchInput) as ModelingBatch;
  return checkModelingQuality({
    source: { type: "batch" },
    graphs: batch.graphs as Graph[],
    speciesNodes: batch.speciesNodes as SpeciesNode[],
    speciesGroups: batch.speciesGroups as SpeciesGroup[],
    groupMemberships: batch.groupMemberships as SpeciesGroupMembership[],
    designRelationships: batch.designRelationships as DesignRelationship[],
    facetDefinitions: batch.facetDefinitions as FacetDefinition[],
    facetSchemas: batch.facetSchemas as FacetSchema[],
    facetAssignments: batch.facetAssignments as FacetAssignment[],
    phenotypes: batch.phenotypePlans.map((plan) => ({
      phenotypeId: plan.phenotypeId,
      graphId: plan.graphId,
      nodeId: plan.nodeId,
      phenotypeType: plan.phenotypeType,
      productionSliceRole: plan.productionSliceRole,
      name: plan.name,
      objectBrief: plan.objectBrief ?? "",
      outputPlan: {
        expectedAssetTypes: (plan.expectedAssetTypes ?? []) as Phenotype["outputPlan"]["expectedAssetTypes"],
        routingPolicyId: plan.routingPolicyId,
        reviewRubricIds: plan.reviewRubricIds ?? []
      }
    }))
  });
}

export function checkModelingQuality(input: ModelingQualityInput): ModelingQualityReport {
  const source = input.source ?? { type: "batch" as const };
  const graphs = input.graphs ?? [];
  const nodes = input.speciesNodes ?? [];
  const groups = input.speciesGroups ?? [];
  const memberships = input.groupMemberships ?? [];
  const relationships = input.designRelationships ?? [];
  const facetDefinitions = input.facetDefinitions ?? [];
  const facetSchemas = input.facetSchemas ?? [];
  const facetAssignments = input.facetAssignments ?? [];
  const phenotypes = input.phenotypes ?? [];
  const issues: ModelingQualityIssue[] = [];
  const phenotypesByNode = new Map<string, typeof phenotypes>();

  for (const phenotype of phenotypes) {
    const values = phenotypesByNode.get(phenotype.nodeId) ?? [];
    values.push(phenotype);
    phenotypesByNode.set(phenotype.nodeId, values);
  }

  for (const node of nodes) {
    const plannedPhenotypes = phenotypesByNode.get(node.nodeId) ?? [];
    if (plannedPhenotypes.length === 0 && shouldExpectPhenotype(node)) {
      issues.push({
        objectType: "species-node",
        objectId: node.nodeId,
        path: "phenotypeReadiness",
        severity: "warning",
        reason: "Species node has no planned phenotype surfaces, so generation/review coverage is not explicit.",
        suggestedAction: "Add phenotypePlans for expected outputs such as portrait, icon, sprite, prompt, or review checklist."
      });
    }
    if (looksLikeOutputVariantNode(node)) {
      issues.push({
        objectType: "species-node",
        objectId: node.nodeId,
        path: "speciesBoundary",
        severity: "blocking",
        reason: "Node looks like an output variant or generated surface modeled as a fake species.",
        suggestedAction: "Keep the stable design identity as SpeciesNode and move portrait/icon/sprite/frame/size variants into phenotypePlans."
      });
    }
    if (looksLikeAbstractSystemNode(node)) {
      issues.push({
        objectType: "species-node",
        objectId: node.nodeId,
        path: "domainSplit",
        severity: "warning",
        reason: "Node looks like an abstract system, workflow, or rule container rather than a stable design identity.",
        suggestedAction: "Downgrade abstract rules to context facts, facets, template dimensions, or split them into a dedicated graph if they have a separate reviewer/output path."
      });
    }
  }

  const phenotypeTargetKeys = new Map<string, string>();
  for (const phenotype of phenotypes) {
    if (!phenotype.objectBrief) {
      issues.push({
        objectType: "phenotype",
        objectId: phenotype.phenotypeId,
        path: "objectBrief",
        severity: "warning",
        reason: "Planned phenotype has no object brief, so generation and review intent are underspecified.",
        suggestedAction: "Add a concise objectBrief that describes the output surface and review purpose."
      });
    }
    if (phenotype.outputPlan.expectedAssetTypes.length > 0 && !phenotype.outputPlan.routingPolicyId) {
      issues.push({
        objectType: "phenotype",
        objectId: phenotype.phenotypeId,
        path: "outputPlan.routingPolicyId",
        severity: "info",
        reason: "Planned phenotype declares expected asset types but no routing policy.",
        suggestedAction: "Add routingPolicyId when the output should flow to a known local library or storage mount."
      });
    }
    const slice = phenotype.productionSliceRole ?? "default";
    const key = `${phenotype.graphId}:${phenotype.nodeId}:${phenotype.phenotypeType}:${slice}`;
    const existing = phenotypeTargetKeys.get(key);
    if (existing) {
      issues.push({
        objectType: "phenotype",
        objectId: phenotype.phenotypeId,
        path: "productionSliceRole",
        severity: "blocking",
        reason: `Duplicate planned phenotype target for node/type/slice ${slice} already declared by ${existing}.`,
        suggestedAction:
          "Use one phenotype container per graph/node/type/productionSliceRole; use distinct productionSliceRole values for separate production slices and keep file variants as versions/assets/output references later."
      });
    } else {
      phenotypeTargetKeys.set(key, phenotype.phenotypeId);
    }
  }

  for (const relationship of relationships) {
    if (isWeakRelationship(relationship)) {
      issues.push({
        objectType: "design-relationship",
        objectId: relationship.relationshipId,
        path: "designContract",
        severity: "warning",
        reason: "Relationship reads like product workflow/storage/process coupling or lacks an explicit design-language contract.",
        suggestedAction: "Describe the design-language dependency, translate workflow facts into context, or remove non-design process links."
      });
    }
  }

  for (const group of groups) {
    const memberCount = memberships.filter((membership) => membership.groupId === group.groupId).length;
    if (memberCount === 0 || (group.sharedFacts.length === 0 && group.facetSchemaIds.length === 0 && group.phenotypeTypeSuggestions.length === 0)) {
      issues.push({
        objectType: "species-group",
        objectId: group.groupId,
        path: "groupQuality",
        severity: "info",
        reason: "Group has weak review semantics or no members.",
        suggestedAction: "Add members plus shared facts, facet schemas, phenotype type suggestions, or review policy so the group is reviewable."
      });
    }
  }

  for (const graph of graphs) {
    const graphNodes = nodes.filter((node) => node.graphId === graph.graphId);
    const splitPressure = graphSplitPressure(graphNodes, phenotypes);
    if (splitPressure.length >= 3) {
      issues.push({
        objectType: "graph",
        objectId: graph.graphId,
        path: "graphSplit",
        severity: "warning",
        reason: `Graph mixes reviewer/output/compile boundaries: ${splitPressure.join(", ")}.`,
        suggestedAction: "Consider splitting graphs by design-language boundary, reviewer group, output type, or compile path instead of accumulating unrelated modeling domains."
      });
    }
  }

  if (nodes.length > 2 && facetDefinitions.length === 0 && facetSchemas.length === 0 && facetAssignments.length === 0) {
    issues.push({
      objectType: "batch",
      objectId: source.id ?? "batch",
      path: "facetCoverage",
      severity: "info",
      reason: "Multiple species are modeled without facet definitions, schemas, or assignments.",
      suggestedAction: "Use facets for repeated categorical attributes; keep context facts for narrative or design rationale and node constraints for node-local requirements."
    });
  }

  const summary = {
    issueCount: issues.length,
    blocking: issues.filter((issue) => issue.severity === "blocking").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length
  };
  return {
    source,
    status: issues.length > 0 ? "needs-review" : "pass",
    summary,
    issues
  };
}

function shouldExpectPhenotype(node: SpeciesNode | ModelingBatch["speciesNodes"][number]): boolean {
  const text = `${node.name} ${node.category ?? ""} ${node.level ?? ""}`.toLowerCase();
  return !/(context|principle|rubric|reference|library|storage|mount)/.test(text);
}

function looksLikeOutputVariantNode(node: SpeciesNode | ModelingBatch["speciesNodes"][number]): boolean {
  const text = `${node.name} ${node.category ?? ""} ${node.level ?? ""}`.toLowerCase();
  return /(portrait|icon|sprite|frame|sheet|crop|64x64|128x128|seed|render|variant|vfx frame|output)/.test(text);
}

function looksLikeAbstractSystemNode(node: SpeciesNode | ModelingBatch["speciesNodes"][number]): boolean {
  const text = `${node.name} ${node.category ?? ""} ${node.level ?? ""}`.toLowerCase();
  return /(everything|system|rule|formula|workflow|process|storage|route|pipeline|manager)/.test(text);
}

function isWeakRelationship(relationship: DesignRelationship | ModelingBatch["designRelationships"][number]): boolean {
  const text = `${relationship.relationshipType} ${relationship.description ?? ""}`.toLowerCase();
  const contract = relationship.designContract ?? {};
  return Object.keys(contract).length === 0 || /(workflow|process|storage|route|depends|dependency|product flow|step)/.test(text);
}

function graphSplitPressure(nodes: Array<SpeciesNode | ModelingBatch["speciesNodes"][number]>, phenotypes: ModelingQualityInput["phenotypes"]): string[] {
  const pressure = new Set<string>();
  for (const node of nodes) {
    const text = `${node.name} ${node.category ?? ""} ${node.level ?? ""}`.toLowerCase();
    if (/(ui|interface|button|panel|screen|hud)/.test(text)) pressure.add("ui review");
    if (/(vfx|effect|frame|animation)/.test(text)) pressure.add("vfx output");
    if (/(monster|character|actor|npc|creature)/.test(text)) pressure.add("character review");
    if (/(rule|formula|combat|system)/.test(text)) pressure.add("rule-system boundary");
  }
  for (const phenotype of phenotypes ?? []) {
    const text = `${phenotype.phenotypeType} ${phenotype.name}`.toLowerCase();
    if (/(portrait|sprite|icon|vfx|animation|model|prompt)/.test(text)) pressure.add("phenotype output path");
  }
  return [...pressure].sort();
}
