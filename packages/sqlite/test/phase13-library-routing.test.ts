import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createDefaultLibraryRoutingPolicy } from "@dna/core";
import { SqliteDnaStore } from "@dna/sqlite";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

describe("Phase 13 SQLite library routing policy storage", () => {
  test("migration creates library routing policy table", () => {
    const store = new SqliteDnaStore(tempDb("phase13-routing-table"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    expect(names.has("library_routing_policies")).toBe(true);
    store.close();
  });

  test("stores routing policies and lists them by library in priority order", () => {
    const store = new SqliteDnaStore(tempDb("phase13-routing-crud"));
    store.migrate();
    const low = createDefaultLibraryRoutingPolicy({
      routingPolicyId: "route-default",
      libraryId: "lib-ui",
      name: "Default",
      priority: 1,
      targetMountId: "mount-nas"
    });
    const high = createDefaultLibraryRoutingPolicy({
      routingPolicyId: "route-preview",
      libraryId: "lib-ui",
      name: "Preview",
      priority: 20,
      match: { outputRole: "preview" },
      targetMountId: "mount-eagle"
    });

    store.libraryRoutingPolicies.create(low);
    store.libraryRoutingPolicies.create(high);

    expect(store.libraryRoutingPolicies.get("route-preview")?.targetMountId).toBe("mount-eagle");
    expect(store.libraryRoutingPolicies.listByLibrary("lib-ui").map((policy) => policy.routingPolicyId)).toEqual([
      "route-preview",
      "route-default"
    ]);
    store.close();
  });
});
