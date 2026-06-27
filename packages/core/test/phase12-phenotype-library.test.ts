import { describe, expect, test } from "vitest";
import {
  ExternalLibraryMappingSchema,
  OutputReferenceSchema,
  PhenotypeLibraryGraphBindingSchema,
  PhenotypeLibrarySchema,
  StorageMountSchema,
  createDefaultExternalLibraryMapping,
  createDefaultOutputReference,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultStorageMount
} from "@dna/core";

const now = "2026-06-27T00:00:00.000Z";

describe("Phase 12 phenotype library domain model", () => {
  test("output references preserve generated results even when no phenotype library is used", () => {
    const reference = OutputReferenceSchema.parse(
      createDefaultOutputReference({
        outputReferenceId: "out-git-1",
        graphId: "graph-ui",
        phenotypeId: "ph-warning",
        phenotypeVersionId: "pv-warning-1",
        uri: "git://github.com/example/game-assets#ui/warning.svg",
        referenceType: "git",
        role: "primary-output",
        libraryId: undefined,
        metadata: {
          repository: "example/game-assets",
          path: "ui/warning.svg",
          commit: "abc123"
        }
      })
    );

    expect(reference.libraryId).toBeUndefined();
    expect(reference.referenceType).toBe("git");
    expect(reference.metadata).toMatchObject({ path: "ui/warning.svg" });
  });

  test("phenotype libraries are independent resources that can be bound to multiple graphs", () => {
    const library = PhenotypeLibrarySchema.parse(
      createDefaultPhenotypeLibrary({
        libraryId: "lib-shared-ui",
        name: "Shared UI Phenotypes",
        purpose: "Human searchable output catalog for UI variants",
        profile: "media-asset",
        acceptedReferenceTypes: ["local-file", "eagle", "url"]
      })
    );
    const graphBinding = PhenotypeLibraryGraphBindingSchema.parse(
      createDefaultPhenotypeLibraryGraphBinding({
        bindingId: "bind-ui",
        libraryId: library.libraryId,
        graphId: "graph-ui",
        role: "primary-library",
        syncPolicy: { tags: "bidirectional", lifecycle: "dna-authoritative" }
      })
    );
    const gameBinding = PhenotypeLibraryGraphBindingSchema.parse(
      createDefaultPhenotypeLibraryGraphBinding({
        bindingId: "bind-game",
        libraryId: library.libraryId,
        graphId: "graph-game",
        role: "reference-library"
      })
    );

    expect(library.graphIds).toEqual([]);
    expect(graphBinding.libraryId).toBe(library.libraryId);
    expect(gameBinding.libraryId).toBe(library.libraryId);
    expect(new Set([graphBinding.graphId, gameBinding.graphId])).toEqual(new Set(["graph-ui", "graph-game"]));
  });

  test("storage mounts and external mappings isolate adapter fields from normalized search metadata", () => {
    const mount = StorageMountSchema.parse(
      createDefaultStorageMount({
        mountId: "mount-eagle-main",
        libraryId: "lib-shared-ui",
        storageType: "eagle",
        adapterKind: "managed-library",
        displayName: "Eagle Main Library",
        location: "eagle://library/main",
        capabilities: ["preview", "tags", "collections", "rating", "metadata-sync"]
      })
    );
    const mapping = ExternalLibraryMappingSchema.parse(
      createDefaultExternalLibraryMapping({
        mappingId: "map-eagle-main",
        libraryId: "lib-shared-ui",
        mountId: mount.mountId,
        adapterId: "eagle",
        syncMode: "metadata-mirror",
        conflictPolicy: "namespace-split",
        tagMappings: [
          {
            externalTag: "UI/Icon",
            normalizedTag: "ui-icon",
            direction: "bidirectional"
          }
        ],
        fieldMappings: {
          rating: "facets.eagle.rating",
          folders: "facets.eagle.collections"
        },
        externalSchemaSnapshot: {
          source: "eagle",
          fields: ["tags", "folders", "rating", "annotation"]
        },
        createdAt: now,
        updatedAt: now
      })
    );

    expect(mount.capabilities).toContain("preview");
    expect(mapping.tagMappings[0]).toMatchObject({
      externalTag: "UI/Icon",
      normalizedTag: "ui-icon",
      direction: "bidirectional"
    });
    expect(mapping.conflictPolicy).toBe("namespace-split");
    expect(mapping.fieldMappings.rating).toBe("facets.eagle.rating");
  });
});
