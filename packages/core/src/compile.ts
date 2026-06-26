import { Graph, SpeciesNode } from "./schemas.js";

export interface GeneConflict {
  key: string;
  previousValue: unknown;
  nextValue: unknown;
  source: string;
  resolution: "override" | "same-value";
}

export interface CompileSpeciesInput {
  graph: Graph;
  node: SpeciesNode;
  parentSnapshots?: Array<{ nodeVersionId: string; snapshot: Record<string, unknown> }>;
  edgeDeltas?: Array<{ edgeVersionId: string; delta: Record<string, unknown> }>;
  taskBrief: string;
  phenotypeType: string;
}

export interface CompileSpeciesResult {
  compilePolicy: string;
  candidateGenes: Record<string, unknown>;
  conflicts: GeneConflict[];
  resolvedGeneSnapshot: Record<string, unknown>;
  prompt: string;
  brief: string;
  edgeVersionTrace: string[];
}

function mergeWithConflicts(
  target: Record<string, unknown>,
  next: Record<string, unknown>,
  source: string,
  conflicts: GeneConflict[]
) {
  for (const [key, value] of Object.entries(next)) {
    if (key in target && JSON.stringify(target[key]) !== JSON.stringify(value)) {
      conflicts.push({
        key,
        previousValue: target[key],
        nextValue: value,
        source,
        resolution: "override"
      });
    }
    target[key] = value;
  }
}

export function compileSpecies(input: CompileSpeciesInput): CompileSpeciesResult {
  const conflicts: GeneConflict[] = [];
  const resolved: Record<string, unknown> = {};
  const policy = input.node.compilePolicy?.type ?? input.graph.compilePolicy.type;

  for (const parent of input.parentSnapshots ?? []) {
    mergeWithConflicts(resolved, parent.snapshot, `parent:${parent.nodeVersionId}`, conflicts);
  }
  for (const edge of input.edgeDeltas ?? []) {
    mergeWithConflicts(resolved, edge.delta, `edge:${edge.edgeVersionId}`, conflicts);
  }
  mergeWithConflicts(resolved, input.node.constraints, `node:${input.node.nodeId}`, conflicts);
  if (input.node.motifs.length > 0) {
    resolved.motifs = input.node.motifs;
  }
  if (input.node.badcases.length > 0) {
    resolved.badcases = input.node.badcases;
  }

  const motifText = input.node.motifs.length ? `Motifs: ${input.node.motifs.join(", ")}.` : "Motifs: none specified.";
  const constraintText = Object.entries(input.node.constraints)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
  const prompt = [
    `Design Network Atlas phenotype request.`,
    `Type: ${input.phenotypeType}.`,
    `Task: ${input.taskBrief}.`,
    `Species: ${input.node.name}.`,
    motifText,
    constraintText ? `Constraints: ${constraintText}.` : "Constraints: none specified.",
    input.node.badcases.length ? `Avoid: ${input.node.badcases.join(", ")}.` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    compilePolicy: policy,
    candidateGenes: { ...resolved },
    conflicts,
    resolvedGeneSnapshot: resolved,
    prompt,
    brief: `Produce ${input.phenotypeType} for ${input.node.name}: ${input.taskBrief}`,
    edgeVersionTrace: (input.edgeDeltas ?? []).map((edge) => edge.edgeVersionId)
  };
}
