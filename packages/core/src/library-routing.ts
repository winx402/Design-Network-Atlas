import { LibraryRoutingPolicy, OutputReference, StorageMount } from "./schemas.js";

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
  fallbackApplied: boolean;
  requiredMetadata: string[];
  metadataDefaults: Record<string, unknown>;
}

export function resolveLibraryRoutingPolicy(input: {
  policies: LibraryRoutingPolicy[];
  mounts?: StorageMount[];
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
  const targetMountId = resolveTargetMountId(policy, input.mounts);
  return {
    policy,
    targetMountId,
    fallbackApplied: targetMountId !== policy.targetMountId,
    requiredMetadata: policy.requiredMetadata,
    metadataDefaults: policy.metadataDefaults
  };
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

function resolveTargetMountId(policy: LibraryRoutingPolicy, mounts: StorageMount[] | undefined) {
  if (!mounts) return policy.targetMountId;
  if (isMountAvailable(mounts, policy.targetMountId)) return policy.targetMountId;
  if (policy.fallbackMountId && isMountAvailable(mounts, policy.fallbackMountId)) return policy.fallbackMountId;
  return policy.targetMountId;
}

function isMountAvailable(mounts: StorageMount[], mountId: string) {
  return mounts.some((mount) => mount.mountId === mountId && mount.status === "active");
}
