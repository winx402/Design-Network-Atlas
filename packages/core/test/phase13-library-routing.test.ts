import { describe, expect, test } from "vitest";
import {
  LibraryRoutingPolicySchema,
  createDefaultLibraryRoutingPolicy,
  resolveLibraryRoutingPolicy
} from "@dna/core";

describe("Phase 13 library routing policy domain model", () => {
  test("library routing policy targets a storage mount based on output traits", () => {
    const policy = LibraryRoutingPolicySchema.parse(
      createDefaultLibraryRoutingPolicy({
        routingPolicyId: "route-ui-preview",
        libraryId: "lib-ui",
        name: "UI previews to Eagle",
        priority: 50,
        match: {
          outputRole: "preview",
          referenceType: "eagle",
          tags: ["ui"]
        },
        targetMountId: "mount-eagle",
        fallbackMountId: "mount-nas",
        syncMode: "metadata-mirror",
        requiredMetadata: ["license"]
      })
    );

    expect(policy.match).toMatchObject({ outputRole: "preview", referenceType: "eagle", tags: ["ui"] });
    expect(policy.targetMountId).toBe("mount-eagle");
    expect(policy.fallbackMountId).toBe("mount-nas");
  });

  test("routing resolver chooses the highest priority active matching policy", () => {
    const policies = [
      createDefaultLibraryRoutingPolicy({
        routingPolicyId: "route-default",
        libraryId: "lib-ui",
        name: "Default NAS",
        priority: 1,
        match: {},
        targetMountId: "mount-nas"
      }),
      createDefaultLibraryRoutingPolicy({
        routingPolicyId: "route-preview-eagle",
        libraryId: "lib-ui",
        name: "Preview Eagle",
        priority: 20,
        match: { outputRole: "preview", tags: ["ui"] },
        targetMountId: "mount-eagle"
      }),
      createDefaultLibraryRoutingPolicy({
        routingPolicyId: "route-archived",
        libraryId: "lib-ui",
        name: "Archived",
        priority: 100,
        status: "archived",
        match: { outputRole: "preview" },
        targetMountId: "mount-archived"
      })
    ];

    const result = resolveLibraryRoutingPolicy({
      policies,
      request: {
        libraryId: "lib-ui",
        outputRole: "preview",
        referenceType: "eagle",
        tags: ["ui", "warning"]
      }
    });

    expect(result?.policy.routingPolicyId).toBe("route-preview-eagle");
    expect(result?.targetMountId).toBe("mount-eagle");
  });

  test("routing resolver returns undefined when no policy matches the library", () => {
    const result = resolveLibraryRoutingPolicy({
      policies: [
        createDefaultLibraryRoutingPolicy({
          routingPolicyId: "route-other",
          libraryId: "lib-other",
          name: "Other library",
          targetMountId: "mount-other"
        })
      ],
      request: {
        libraryId: "lib-ui",
        outputRole: "primary-output",
        referenceType: "git",
        tags: []
      }
    });

    expect(result).toBeUndefined();
  });
});
