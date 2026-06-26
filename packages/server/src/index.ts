import { SqliteDnaStore } from "@dna/sqlite";

export interface DnaServerContext {
  store: SqliteDnaStore;
  mode: "local" | "server";
}

export function createLocalServerContext(dbPath: string): DnaServerContext {
  const store = new SqliteDnaStore(dbPath);
  store.migrate();
  return { store, mode: "local" };
}
