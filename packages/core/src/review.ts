import { PhenotypeVersion, SpeciesNode } from "./schemas.js";

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

export interface PhenotypeReviewInput {
  version: PhenotypeVersion;
  requiredMotifs?: string[];
  requiredConstraints?: Record<string, unknown>;
  forbiddenText?: string[];
}

export function reviewPhenotypeVersion(input: PhenotypeReviewInput): NodeReviewResult {
  const snapshotMotifs = readStringArray(input.version.resolvedGeneSnapshot.motifs);
  const searchableText = [input.version.promptSnapshot, input.version.generationBrief].join("\n").toLowerCase();
  const missingMotifs = (input.requiredMotifs ?? []).filter(
    (motif) => !snapshotMotifs.includes(motif) || !searchableText.includes(motif.toLowerCase())
  );
  const missingConstraints = Object.keys(input.requiredConstraints ?? {}).filter(
    (key) => !(key in input.version.resolvedGeneSnapshot)
  );
  const mismatchedConstraints = Object.entries(input.requiredConstraints ?? {})
    .filter(([key, expected]) => key in input.version.resolvedGeneSnapshot && JSON.stringify(input.version.resolvedGeneSnapshot[key]) !== JSON.stringify(expected))
    .map(
      ([key, expected]) =>
        `constraint ${key} expected ${JSON.stringify(expected)} but received ${JSON.stringify(input.version.resolvedGeneSnapshot[key])}`
    );
  const forbiddenTextViolations = (input.forbiddenText ?? [])
    .filter((text) => searchableText.includes(text.toLowerCase()))
    .map((text) => `prompt must avoid forbidden text: ${text}`);
  const missingDimensions = [
    ...missingMotifs.map((motif) => `motif:${motif}`),
    ...missingConstraints.map((key) => `constraint:${key}`)
  ];
  const constraintViolations = [...mismatchedConstraints, ...forbiddenTextViolations];
  const status = constraintViolations.length ? "fail" : missingDimensions.length ? "needs-review" : "pass";

  return {
    status,
    missingDimensions,
    constraintViolations,
    suggestedActions: [
      ...missingMotifs.map((motif) => `restore required motif: ${motif}`),
      ...missingConstraints.map((key) => `fill required constraint: ${key}`),
      ...mismatchedConstraints.map((violation) => `resolve ${violation}`),
      ...(input.forbiddenText ?? [])
        .filter((text) => searchableText.includes(text.toLowerCase()))
        .map((text) => `remove forbidden prompt text: ${text}`)
    ]
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
