import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RUNTIME_SQLITE_TABLES, SQLITE_COMPATIBILITY_TABLES, SqliteDnaStore } from "@dna/sqlite";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

function extractRuntimeDdlTables() {
  const storeSource = readFileSync(resolve(projectRoot, "packages/sqlite/src/store.ts"), "utf8");
  return [...storeSource.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/g)].map((match) => match[1]).sort();
}

describe("Phase 21 PRD-09 SQLite schema authority", () => {
  test("migrate DDL is the runtime schema authority and matches the documented runtime table list", () => {
    expect(extractRuntimeDdlTables()).toEqual([...RUNTIME_SQLITE_TABLES].sort());

    const store = new SqliteDnaStore(tempDb("schema-authority"));
    store.migrate();
    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const actualTables = rows.map((row) => row.name).sort();

    expect(actualTables).toEqual([...RUNTIME_SQLITE_TABLES].sort());
    store.close();
  });

  test("reference schema and public docs state authority and legacy compatibility status", () => {
    const schemaSource = readFileSync(resolve(projectRoot, "packages/sqlite/src/schema.ts"), "utf8");
    const docs = [
      readFileSync(resolve(projectRoot, "docs/design/system-architecture.md"), "utf8"),
      readFileSync(resolve(projectRoot, "docs/design/write-boundary-matrix.md"), "utf8")
    ].join("\n");

    expect(schemaSource).toContain("reference/type mapping");
    expect(schemaSource).toContain("not the runtime migration authority");
    expect(docs).toContain("SqliteDnaStore.migrate()");
    expect(docs).toContain("runtime schema authority");
    expect(docs).toContain("packages/sqlite/src/schema.ts");

    expect(SQLITE_COMPATIBILITY_TABLES).toEqual(["node_relations", "phenotype_types"]);
    for (const table of SQLITE_COMPATIBILITY_TABLES) {
      expect(RUNTIME_SQLITE_TABLES).toContain(table);
      expect(docs).toContain(`${table}`);
      expect(docs).toContain("deprecated/migration-only compatibility");
    }
  });
});
