import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 60_000;

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function runDna(args: string[]) {
  return execFileSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
}

function runDnaFailure(args: string[]) {
  const result = spawnSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  expect(result.status).not.toBe(0);
  return `${result.stdout}${result.stderr}`;
}

function extractChangeSetId(output: string) {
  const id = output.match(/"changeSetId": "([^"]+)"/)?.[1];
  if (!id) throw new Error(`changeSetId not found in output: ${output}`);
  return id;
}

describe("Phase 22 proposal CLI", () => {
  test("shows proposal commands in help", () => {
    const help = runDna(["proposal", "--help"]);

    expect(help).toContain("add-change-set");
    expect(help).toContain("import-batch");
    expect(help).toContain("review");
    expect(help).toContain("apply");
  });

  test("creates, links, reviews, applies, and discards local proposals", () => {
    const dir = tempDir("phase22-proposal-cli");
    const db = join(dir, "dna.sqlite");

    const graphPreview = runDna([
      "--db",
      db,
      "graph",
      "create",
      "--id",
      "graph-proposal-cli",
      "--name",
      "Proposal CLI Graph",
      "--purpose",
      "proposal workflow"
    ]);
    const graphChangeSetId = extractChangeSetId(graphPreview);
    const nodePreview = runDna([
      "--db",
      db,
      "node",
      "create",
      "--graph",
      "graph-proposal-cli",
      "--id",
      "node-proposal-cli",
      "--name",
      "Proposal CLI Node",
      "--category",
      "icon",
      "--level",
      "root"
    ]);
    const nodeChangeSetId = extractChangeSetId(nodePreview);

    expect(
      runDna([
        "--db",
        db,
        "proposal",
        "create",
        "--id",
        "proposal-cli",
        "--title",
        "CLI proposal",
        "--summary",
        "Apply graph and node together"
      ])
    ).toContain('"proposalId": "proposal-cli"');
    runDna(["--db", db, "proposal", "add-change-set", "proposal-cli", "--change-set", graphChangeSetId]);
    runDna(["--db", db, "proposal", "add-change-set", "proposal-cli", "--change-set", nodeChangeSetId]);

    const show = runDna(["--db", db, "proposal", "show", "proposal-cli"]);
    expect(show).toContain(graphChangeSetId);
    expect(show).toContain(nodeChangeSetId);
    expect(show).toContain('"reviewStage": "draft"');
    const reviewed = runDna(["--db", db, "proposal", "review", "proposal-cli"]);
    expect(reviewed).toContain('"status": "ready"');
    expect(reviewed).toContain('"reviewStage": "pending-confirmation"');

    expect(runDna(["--db", db, "--yes", "proposal", "apply", "proposal-cli"])).toContain('"reviewStage": "confirmed-applied"');

    expect(runDna(["--db", db, "graph", "show", "--id", "graph-proposal-cli"])).toContain("Proposal CLI Graph");
    expect(runDna(["--db", db, "node", "show", "--id", "node-proposal-cli"])).toContain("Proposal CLI Node");

    const factPreview = runDna([
      "--db",
      db,
      "context",
      "fact",
      "add",
      "--id",
      "fact-proposal-discard-cli",
      "--type",
      "custom",
      "--statement",
      "Discard leaves this child preview"
    ]);
    const factChangeSetId = extractChangeSetId(factPreview);
    runDna([
      "--db",
      db,
      "proposal",
      "create",
      "--id",
      "proposal-discard-cli",
      "--title",
      "Discard",
      "--summary",
      "Discard metadata only"
    ]);
    runDna(["--db", db, "proposal", "add-change-set", "proposal-discard-cli", "--change-set", factChangeSetId]);
    expect(runDna(["--db", db, "proposal", "discard", "proposal-discard-cli"])).toContain('"status": "discarded"');
    expect(runDna(["--db", db, "changeset", "show", factChangeSetId])).toContain('"status": "preview"');
  }, CLI_TIMEOUT);

  test("imports a modeling batch as ordered preview change-sets inside a proposal", () => {
    const dir = tempDir("phase22-proposal-import-batch-cli");
    const db = join(dir, "dna.sqlite");
    const batchFile = join(dir, "batch.json");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-batch-a", name: "Batch A", purpose: "initial modeling" }],
          speciesNodes: [
            { graphId: "graph-batch-a", nodeId: "node-batch-root", name: "Batch Root", category: "icon", level: "root" }
          ],
          speciesGroups: [{ graphId: "graph-batch-a", groupId: "group-batch", name: "Batch Group", groupType: "population" }],
          groupMemberships: [
            { membershipId: "membership-batch", graphId: "graph-batch-a", groupId: "group-batch", nodeId: "node-batch-root", role: "primary" }
          ],
          atlases: [{ atlasId: "atlas-batch", name: "Batch Atlas", purpose: "multi graph", graphIds: ["graph-batch-a"] }],
          phenotypeLibraries: [
            { libraryId: "library-batch", name: "Batch Library", purpose: "outputs", profile: "media-asset", graphIds: ["graph-batch-a"] }
          ],
          storageMounts: [
            {
              mountId: "mount-batch",
              libraryId: "library-batch",
              storageType: "local",
              adapterKind: "folder",
              displayName: "Batch Mount",
              location: "local://batch"
            }
          ],
          externalLibraryMappings: [
            { mappingId: "mapping-batch", libraryId: "library-batch", mountId: "mount-batch", adapterId: "local-folder" }
          ],
          libraryRoutingPolicies: [
            { routingPolicyId: "route-batch", libraryId: "library-batch", name: "Default Route", targetMountId: "mount-batch" }
          ]
        },
        null,
        2
      )}\n`
    );

    const output = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      batchFile,
      "--id",
      "proposal-batch",
      "--title",
      "Batch proposal"
    ]);

    expect(output).toContain("Modeling batch import report");
    expect(output).toContain("Mode: preview-confirm");
    expect(output).toContain("Review stage: draft");
    expect(output).toContain("Proposal: proposal-batch");
    expect(output).toContain("Planned: 9");
    expect(output).toContain("Next: dna proposal show proposal-batch");
    expect(output).not.toContain("changeSetIds");
    expect(output).not.toMatch(/cs-[a-z0-9-]+/);

    const jsonOutput = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      batchFile,
      "--id",
      "proposal-batch-json",
      "--title",
      "Batch proposal JSON",
      "--format",
      "json",
      "--include-ids"
    ]);
    const result = JSON.parse(jsonOutput);

    expect(result.mode).toBe("preview-confirm");
    expect(result.reviewStage).toBe("draft");
    expect(result.proposal.proposalId).toBe("proposal-batch-json");
    expect(result.changeSetIds).toHaveLength(9);
    expect(result.counts.planned).toMatchObject({
      graphs: 1,
      speciesNodes: 1,
      speciesGroups: 1,
      groupMemberships: 1,
      atlases: 1,
      phenotypeLibraries: 1,
      storageMounts: 1,
      externalLibraryMappings: 1,
      libraryRoutingPolicies: 1
    });
    expect(runDna(["--db", db, "graph", "list"])).not.toContain("graph-batch-a");
    expect(runDna(["--db", db, "proposal", "review", "proposal-batch"])).toContain('"status": "ready"');

    runDna(["--db", db, "--yes", "proposal", "apply", "proposal-batch"]);

    expect(runDna(["--db", db, "graph", "show", "--id", "graph-batch-a"])).toContain("Batch A");
    expect(runDna(["--db", db, "group", "list", "--graph", "graph-batch-a"])).toContain("group-batch");
    expect(runDna(["--db", db, "library", "list"])).toContain("library-batch");
  }, CLI_TIMEOUT);

  test("rejects invalid modeling batches without partial writes and keeps changeset-apply out of import modes", () => {
    const dir = tempDir("phase22-proposal-import-batch-invalid-cli");
    const db = join(dir, "dna.sqlite");
    const batchFile = join(dir, "invalid-batch.json");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          speciesNodes: [{ graphId: "missing-graph", nodeId: "node-invalid", name: "Invalid Node" }]
        },
        null,
        2
      )}\n`
    );

    const output = runDnaFailure([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      batchFile,
      "--id",
      "proposal-invalid",
      "--title",
      "Invalid proposal"
    ]);

    expect(output).toContain("speciesNodes[0]");
    expect(output).toContain("graph not found: missing-graph");
    expect(runDna(["--db", db, "proposal", "list"])).not.toContain("proposal-invalid");
    expect(runDna(["--db", db, "changeset", "list"])).not.toContain("node-invalid");
    expect(runDnaFailure(["--db", db, "proposal", "import-batch", "--in", batchFile, "--id", "p", "--title", "P", "--mode", "changeset-apply"])).toContain(
      "changeset-apply is not an import-batch mode"
    );
  }, CLI_TIMEOUT);

  test("imports a modeling batch in explicit draft-write mode through the service boundary without creating a proposal", () => {
    const dir = tempDir("phase22-proposal-import-batch-draft-cli");
    const db = join(dir, "dna.sqlite");
    const batchFile = join(dir, "draft-batch.json");
    writeFileSync(
      batchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-draft-batch", name: "Draft Batch", purpose: "local seed" }]
        },
        null,
        2
      )}\n`
    );

    const output = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      batchFile,
      "--id",
      "proposal-draft-skipped",
      "--title",
      "Draft skipped",
      "--mode",
      "draft-write"
    ]);

    expect(output).toContain("Modeling batch import report");
    expect(output).toContain("Mode: draft-write");
    expect(output).toContain("Review stage: confirmed-applied");
    expect(output).toContain("Warnings:");
    expect(output).toContain("skips proposal review");
    expect(output).toContain("Applied: 1");
    expect(output).not.toContain("changeSetIds");
    expect(output).not.toMatch(/cs-[a-z0-9-]+/);

    const jsonBatchFile = join(dir, "draft-batch-json.json");
    writeFileSync(
      jsonBatchFile,
      `${JSON.stringify(
        {
          format: "dna.modeling-batch.v1",
          graphs: [{ graphId: "graph-draft-batch-json", name: "Draft Batch JSON", purpose: "local seed" }]
        },
        null,
        2
      )}\n`
    );
    const jsonOutput = runDna([
      "--db",
      db,
      "proposal",
      "import-batch",
      "--in",
      jsonBatchFile,
      "--id",
      "proposal-draft-json",
      "--title",
      "Draft JSON",
      "--mode",
      "draft-write",
      "--format",
      "json",
      "--include-ids"
    ]);
    const result = JSON.parse(jsonOutput);
    expect(result.mode).toBe("draft-write");
    expect(result.reviewStage).toBe("confirmed-applied");
    expect(result.warning).toContain("skips proposal review");
    expect(result.proposal).toBeNull();
    expect(result.counts.applied.graphs).toBe(1);
    expect(result.changeSetIds).toHaveLength(1);
    expect(runDna(["--db", db, "graph", "show", "--id", "graph-draft-batch"])).toContain("Draft Batch");
    expect(runDna(["--db", db, "proposal", "list"])).not.toContain("proposal-draft-skipped");
  }, CLI_TIMEOUT);
});
