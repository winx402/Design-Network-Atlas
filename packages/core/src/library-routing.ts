import { LibraryRoutingPolicy, OutputReference } from "./schemas.js";

export interface LibraryRoutingRequest {
  libraryId: string;
  phenotypeType?: string;
  outputRole?: OutputReference["role"];
  referenceType?: OutputReference["referenceType"];
  tags?: string[];
}

export interface LibraryRoutingResult {
  policy: LibraryRoutingPolicy;
  targetMountId: string;
}

export function resolveLibraryRoutingPolicy(input: {
  policies: LibraryRoutingPolicy[];
  request: LibraryRoutingRequest;
}): LibraryRoutingResult | undefined {
  const requestTags = new Set(input.request.tags ?? []);
  const matching = input.policies
    .filter((policy) => policy.libraryId === input.request.libraryId)
    .filter((policy) => policy.status === "active")
    .filter((policy) => matches(policy, input.request, requestTags))
    .sort((left, right) => {
      const byPriority = right.priority - left.priority;
      if (byPriority !== 0) return byPriority;
      return left.routingPolicyId.localeCompare(right.routingPolicyId);
    });

  const policy = matching[0];
  if (!policy) return undefined;
  return { policy, targetMountId: policy.targetMountId };
}

function matches(policy: LibraryRoutingPolicy, request: LibraryRoutingRequest, requestTags: Set<string>): boolean {
  if (policy.match.phenotypeType && policy.match.phenotypeType !== request.phenotypeType) return false;
  if (policy.match.outputRole && policy.match.outputRole !== request.outputRole) return false;
  if (policy.match.referenceType && policy.match.referenceType !== request.referenceType) return false;
  for (const tag of policy.match.tags ?? []) {
    if (!requestTags.has(tag)) return false;
  }
  return true;
}
