import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultExternalLibraryMapping,
  createDefaultOutputReference,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultStorageMount
} from "@dna/core";
import { exportProject, SqliteDnaStore } from "@dna/sqlite";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

describe("Phase 12 SQLite phenotype library storage", () => {
  test("migration creates phenotype library adapter tables", () => {
    const store = new SqliteDnaStore(tempDb("phase12-tables"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    expect(names.has("output_references")).toBe(true);
    expect(names.has("phenotype_libraries")).toBe(true);
    expect(names.has("storage_mounts")).toBe(true);
    expect(names.has("phenotype_library_graph_bindings")).toBe(true);
    expect(names.has("external_library_mappings")).toBe(true);
    store.close();
  });

  test("stores output references without requiring a phenotype library", () => {
    const store = new SqliteDnaStore(tempDb("phase12-output-reference"));
    store.migrate();
    const primary = createDefaultOutputReference({
      outputReferenceId: "out-primary",
      graphId: "graph-ui",
      phenotypeId: "ph-warning",
      phenotypeVersionId: "pv-warning-1",
      uri: "git://repo/ui/warning.svg",
      referenceType: "git",
      role: "primary-output",
      tags: ["ui", "warning"]
    });
    const preview = createDefaultOutputReference({
      outputReferenceId: "out-preview",
      graphId: "graph-ui",
      phenotypeId: "ph-warning",
      phenotypeVersionId: "pv-warning-1",
      uri: "https://cdn.example.test/warning-preview.png",
      referenceType: "url",
      role: "preview",
      tags: ["ui", "preview"]
    });

    store.outputReferences.create(primary);
    store.outputReferences.create(preview);

    expect(store.outputReferences.listByPhenotypeVersion("pv-warning-1").map((item) => item.outputReferenceId)).toEqual([
      "out-primary",
      "out-preview"
    ]);
    expect(store.outputReferences.search({ tag: "preview" }).map((item) => item.outputReferenceId)).toEqual(["out-preview"]);
    store.close();
  });

  test("stores many-to-many graph bindings and external adapter mappings", () => {
    const store = new SqliteDnaStore(tempDb("phase12-library"));
    store.migrate();
    const library = createDefaultPhenotypeLibrary({
      libraryId: "lib-shared",
      name: "Shared Phenotypes",
      purpose: "shared output catalog",
      profile: "media-asset"
    });
    const mount = createDefaultStorageMount({
      mountId: "mount-eagle",
      libraryId: library.libraryId,
      storageType: "eagle",
      adapterKind: "managed-library",
      displayName: "Eagle Library",
      location: "eagle://library/main",
      capabilities: ["preview", "tags", "collections"]
    });
    const uiBinding = createDefaultPhenotypeLibraryGraphBinding({
      bindingId: "bind-ui",
      libraryId: library.libraryId,
      graphId: "graph-ui",
      role: "primary-library"
    });
    const gameBinding = createDefaultPhenotypeLibraryGraphBinding({
      bindingId: "bind-game",
      libraryId: library.libraryId,
      graphId: "graph-game",
      role: "reference-library"
    });
    const mapping = createDefaultExternalLibraryMapping({
      mappingId: "map-eagle",
      libraryId: library.libraryId,
      mountId: mount.mountId,
      adapterId: "eagle",
      syncMode: "metadata-mirror",
      conflictPolicy: "namespace-split",
      tagMappings: [{ externalTag: "UI/Icon", normalizedTag: "ui-icon", direction: "bidirectional" }],
      fieldMappings: { rating: "facets.eagle.rating" }
    });

    store.phenotypeLibraries.create(library);
    store.storageMounts.create(mount);
    store.phenotypeLibraryGraphBindings.create(uiBinding);
    store.phenotypeLibraryGraphBindings.create(gameBinding);
    store.externalLibraryMappings.create(mapping);

    expect(store.phenotypeLibraries.list().map((item) => item.libraryId)).toEqual(["lib-shared"]);
    expect(store.storageMounts.listByLibrary("lib-shared").map((item) => item.mountId)).toEqual(["mount-eagle"]);
    expect(store.phenotypeLibraryGraphBindings.listByGraph("graph-ui").map((item) => item.libraryId)).toEqual(["lib-shared"]);
    expect(store.phenotypeLibraryGraphBindings.listByLibrary("lib-shared").map((item) => item.graphId)).toEqual([
      "graph-game",
      "graph-ui"
    ]);
    expect(store.externalLibraryMappings.listByLibrary("lib-shared")[0].tagMappings[0].normalizedTag).toBe("ui-icon");
    store.close();
  });

  test("migration backfills library graphIds from historical graph bindings", () => {
    const db = tempDb("phase12-library-graphids-repair");
    const exportDir = join(db, "..", "export");
    const oldStore = new SqliteDnaStore(db);
    oldStore.migrate();
    const library = createDefaultPhenotypeLibrary({
      libraryId: "lib-historical",
      name: "Historical Library",
      purpose: "historical migration",
      profile: "media-asset",
      graphIds: []
    });
    const binding = createDefaultPhenotypeLibraryGraphBinding({
      bindingId: "bind-historical",
      libraryId: library.libraryId,
      graphId: "graph-historical",
      role: "primary-library"
    });

    oldStore.phenotypeLibraries.create(library);
    oldStore.db
      .prepare(
        "INSERT INTO phenotype_library_graph_bindings (binding_id, library_id, graph_id, role, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        binding.bindingId,
        binding.libraryId,
        binding.graphId,
        binding.role,
        binding.status,
        JSON.stringify(binding),
        binding.createdAt,
        binding.updatedAt
      );
    oldStore.close();

    const migratedStore = new SqliteDnaStore(db);
    migratedStore.migrate();

    expect(migratedStore.phenotypeLibraries.get("lib-historical")?.graphIds).toEqual(["graph-historical"]);
    exportProject(migratedStore, exportDir);
    const exportedLibrary = JSON.parse(readFileSync(join(exportDir, "libraries", "lib-historical", "library.json"), "utf8"));
    expect(exportedLibrary.graphIds).toEqual(["graph-historical"]);
    migratedStore.close();
  });
});
