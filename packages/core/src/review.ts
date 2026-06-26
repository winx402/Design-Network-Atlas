import { SpeciesNode } from "./schemas.js";

export interface NodeReviewResult {
  status: "pass" | "needs-review" | "fail";
  missingDimensions: string[];
  constraintViolations: string[];
  suggestedActions: string[];
}

export function reviewNode(input: { node: SpeciesNode; requiredDimensions: string[] }): NodeReviewResult {
  const missingDimensions = input.requiredDimensions.filter((dimension) => {
    if (dimension === "visual_motif" || dimension === "motif" || dimension === "视觉母题") {
      return input.node.motifs.length === 0;
    }
    return !(dimension in input.node.constraints);
  });
  const constraintViolations = input.node.badcases
    .filter((badcase) => input.node.motifs.includes(badcase))
    .map((badcase) => `motif must avoid badcase: ${badcase}`);
  const status = constraintViolations.length ? "fail" : missingDimensions.length ? "needs-review" : "pass";
  return {
    status,
    missingDimensions,
    constraintViolations,
    suggestedActions: missingDimensions.map((dimension) => `fill required dimension: ${dimension}`)
  };
}

export interface StyleComparable {
  motifs?: string[];
  constraints?: Record<string, unknown>;
}

export interface StyleDistanceResult {
  score: number;
  sharedMotifs: string[];
  differingMotifs: string[];
  differingConstraints: string[];
  summary: string;
}

export function compareStyleDistance(left: StyleComparable, right: StyleComparable): StyleDistanceResult {
  const leftMotifs = new Set(left.motifs ?? []);
  const rightMotifs = new Set(right.motifs ?? []);
  const sharedMotifs = [...leftMotifs].filter((motif) => rightMotifs.has(motif));
  const differingMotifs = [...new Set([...leftMotifs, ...rightMotifs])].filter(
    (motif) => !(leftMotifs.has(motif) && rightMotifs.has(motif))
  );
  const allConstraintKeys = new Set([...Object.keys(left.constraints ?? {}), ...Object.keys(right.constraints ?? {})]);
  const differingConstraints = [...allConstraintKeys].filter(
    (key) => JSON.stringify(left.constraints?.[key]) !== JSON.stringify(right.constraints?.[key])
  );
  const denominator = Math.max(1, leftMotifs.size + rightMotifs.size + allConstraintKeys.size);
  const score = Math.min(1, (differingMotifs.length + differingConstraints.length) / denominator);
  return {
    score,
    sharedMotifs,
    differingMotifs,
    differingConstraints,
    summary: `style distance ${score.toFixed(2)} with ${differingMotifs.length} motif differences and ${differingConstraints.length} constraint differences`
  };
}
