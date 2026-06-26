import { ChangeSet, createChangeSet, Graph } from "@dna/core";
import { CreateGraphInput, createDnaServices, ServiceResult, WriteOptions } from "@dna/storage";
import { SqliteDnaStore } from "@dna/sqlite";

export type CollaborationMode = "local" | "server";
export type ActorRole = "viewer" | "editor" | "approver" | "admin";

export interface DnaActor {
  actorId: string;
  role: ActorRole;
}

export interface DnaServerContext {
  store: SqliteDnaStore;
  mode: CollaborationMode;
}

export interface SyncConflictInput {
  objectType: string;
  objectId: string;
  localVersion: string;
  incomingVersion: string;
  incomingPayload: Record<string, unknown>;
}

export interface CollaborationAdapter {
  mode: CollaborationMode;
  store: SqliteDnaStore;
  actor?: DnaActor;
  graph: {
    createGraph(input: CreateGraphInput, options: WriteOptions): ServiceResult<Graph>;
  };
  sync: {
    createConflictChangeSet(input: SyncConflictInput): ChangeSet;
  };
  close(): void;
}

export function createLocalServerContext(dbPath: string): DnaServerContext {
  const store = new SqliteDnaStore(dbPath);
  store.migrate();
  return { store, mode: "local" };
}

export function createLocalCollaborationAdapter(dbPath: string): CollaborationAdapter {
  const store = new SqliteDnaStore(dbPath);
  store.migrate();
  return createAdapter({ mode: "local", store });
}

export function createServerCollaborationAdapter(input: { store: SqliteDnaStore; actor: DnaActor }): CollaborationAdapter {
  return createAdapter({ mode: "server", store: input.store, actor: input.actor });
}

function createAdapter(input: { mode: CollaborationMode; store: SqliteDnaStore; actor?: DnaActor }): CollaborationAdapter {
  const services = createDnaServices(input.store);
  return {
    mode: input.mode,
    store: input.store,
    actor: input.actor,
    graph: {
      createGraph(graphInput, options) {
        assertCanWrite(input.actor, options, "graph create");
        return services.graph.createGraph(graphInput, options);
      }
    },
    sync: {
      createConflictChangeSet(conflictInput) {
        const changeSet = createChangeSet({
          mode: "preview-confirm",
          objectType: conflictInput.objectType,
          operation: "update",
          summary: `sync conflict for ${conflictInput.objectType} ${conflictInput.objectId}`,
          diff: {
            objectId: conflictInput.objectId,
            localVersion: conflictInput.localVersion,
            incomingVersion: conflictInput.incomingVersion
          },
          payload: {
            conflict: conflictInput
          }
        });
        input.store.changeSets.create(changeSet);
        return changeSet;
      }
    },
    close() {
      input.store.close();
    }
  };
}

function assertCanWrite(actor: DnaActor | undefined, options: WriteOptions, action: string) {
  if (!isDurableWrite(options)) return;
  if (!actor) return;
  if (actor.role === "viewer") throw new Error(`actor ${actor.actorId} cannot apply ${action}`);
}

function isDurableWrite(options: WriteOptions) {
  return options.apply === true || options.mode === "draft-write" || options.mode === "changeset-apply";
}
