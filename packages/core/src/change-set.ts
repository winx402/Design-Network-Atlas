import { ChangeOperationSchema, ChangeSet, WriteMode } from "./schemas.js";
import { makeId, nowIso } from "./defaults.js";

export interface CreateChangeSetInput {
  mode: WriteMode;
  objectType: string;
  operation: "create" | "update" | "archive" | "delete" | "import";
  summary: string;
  diff: Record<string, unknown>;
  impact?: Record<string, unknown>[];
  payload: Record<string, unknown>;
}

export function createChangeSet(input: CreateChangeSetInput): ChangeSet {
  ChangeOperationSchema.parse(input.operation);
  return {
    changeSetId: makeId("cs"),
    mode: input.mode,
    objectType: input.objectType,
    operation: input.operation,
    status: "preview",
    preview: {
      summary: input.summary,
      diff: input.diff,
      impact: input.impact ?? []
    },
    payload: input.payload,
    createdAt: nowIso()
  };
}

export function markChangeSetApplied(changeSet: ChangeSet): ChangeSet {
  return {
    ...changeSet,
    status: "applied",
    appliedAt: nowIso()
  };
}

export function markChangeSetDiscarded(changeSet: ChangeSet): ChangeSet {
  return {
    ...changeSet,
    status: "discarded"
  };
}
