import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultOutputReference,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode
} from "@dna/core";
import { SqliteDnaStore } from "@dna/sqlite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 120_000;

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function runDna(args: string[]) {
  return execFileSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: CLI_TIMEOUT
  });
}

function runDnaFailure(args: string[]) {
  try {
    runDna(args);
    throw new Error("Expected command to fail");
  } catch (error) {
    const failure = error as { stdout?: Buffer | string; stderr?: Buffer | string; message: string };
    return `${failure.stdout?.toString() ?? ""}${failure.stderr?.toString() ?? ""}${failure.message}`;
  }
}

function seedOutputReferences(db: string) {
  const store = new SqliteDnaStore(db);
  store.migrate();
  const graph = createDefaultGraph({ graphId: "graph-output-cli", name: "Output CLI Graph", purpose: "output lifecycle CLI" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-output-cli", name: "Output CLI Species" });
  const phenotype = createDefaultPhenotype({
    phenotypeId: "phenotype-output-cli",
    graphId: graph.graphId,
    nodeId: node.nodeId,
    name: "Output CLI Phenotype",
    phenotypeType: "image"
  });
  const version = createDefaultPhenotypeVersion({
    phenotypeVersionId: "pv-output-cli",
    phenotypeId: phenotype.phenotypeId,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    status: "accepted"
  });
  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  store.phenotypeVersions.create(version);
  for (const reference of [
    createDefaultOutputReference({
      outputReferenceId: "out-pending-cli",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: version.phenotypeVersionId,
      uri: "eagle://item/pending-cli",
      referenceType: "eagle",
      role: "candidate"
    }),
    createDefaultOutputReference({
      outputReferenceId: "out-new-cli",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: version.phenotypeVersionId,
      uri: "eagle://item/new-cli",
      referenceType: "eagle",
      role: "candidate"
    }),
    createDefaultOutputReference({
      outputReferenceId: "out-source-cli",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: version.phenotypeVersionId,
      uri: "git://repo/source-cli.psd",
      referenceType: "git",
      role: "source"
    }),
    createDefaultOutputReference({
      outputReferenceId: "out-stale-preview-cli",
      graphId: graph.graphId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: version.phenotypeVersionId,
      uri: "eagle://item/stale-preview-cli",
      referenceType: "eagle",
      role: "preview",
      status: "stale"
    })
  ]) {
    store.outputReferences.create(reference);
  }
  store.close();
}

function searchById(db: string, id: string) {
  const references = JSON.parse(runDna(["--db", db, "output-ref", "search"])) as Array<{ outputReferenceId: string; status: string; role: string; referenceType: string; metadata?: Record<string, unknown> }>;
  return references.find((reference) => reference.outputReferenceId === id);
}

describe("Phase 32 output reference CLI", () => {
  test("validates canonical role and type before add on routed and explicit mount paths", () => {
    const dir = tempDir("phase32-output-ref-validation");
    const db = join(dir, "dna.sqlite");

    const invalidExplicitRole = runDnaFailure([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-invalid-role",
      "--graph",
      "graph-output-cli",
      "--phenotype-version",
      "pv-output-cli",
      "--uri",
      "eagle://item/invalid-role",
      "--type",
      "eagle",
      "--role",
      "source-candidate",
      "--storage-mount",
      "mount-eagle"
    ]);
    expect(invalidExplicitRole).toContain("unknown output reference role: source-candidate");
    expect(invalidExplicitRole).toContain("primary-output, candidate, preview, source, reference, negative-example, runtime-export, review-material");

    const invalidRoutedRole = runDnaFailure([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-invalid-routed-role",
      "--graph",
      "graph-output-cli",
      "--phenotype-version",
      "pv-output-cli",
      "--uri",
      "eagle://item/invalid-routed-role",
      "--type",
      "eagle",
      "--role",
      "source-candidate"
    ]);
    expect(invalidRoutedRole).toContain("unknown output reference role: source-candidate");

    const invalidExplicitType = runDnaFailure([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-invalid-type",
      "--graph",
      "graph-output-cli",
      "--phenotype-version",
      "pv-output-cli",
      "--uri",
      "eagle://item/invalid-type",
      "--type",
      "eagle-item",
      "--role",
      "candidate",
      "--storage-mount",
      "mount-eagle"
    ]);
    expect(invalidExplicitType).toContain("unknown output reference type: eagle-item");
    expect(invalidExplicitType).toContain("local-file, url, object-storage, eagle, figma, git, database, engine-export, inline-text, external-system, other");

    const preview = runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-valid-preview",
      "--graph",
      "graph-output-cli",
      "--phenotype-version",
      "pv-output-cli",
      "--uri",
      "eagle://item/valid-preview",
      "--type",
      "eagle",
      "--role",
      "candidate",
      "--storage-mount",
      "mount-eagle"
    ]);
    expect(preview).toContain("ChangeSet preview");
    expect(runDna(["--db", db, "output-ref", "search"])).not.toContain("out-valid-preview");

    runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-valid-apply",
      "--graph",
      "graph-output-cli",
      "--phenotype-version",
      "pv-output-cli",
      "--uri",
      "eagle://item/valid-apply",
      "--type",
      "eagle",
      "--role",
      "candidate",
      "--storage-mount",
      "mount-eagle",
      "--yes"
    ]);
    const applied = searchById(db, "out-valid-apply");
    expect(applied).toMatchObject({ role: "candidate", referenceType: "eagle", status: "pending" });
    expect(runDna(["--db", db, "output-ref", "search"])).not.toContain("out-invalid-role");
    expect(runDna(["--db", db, "output-ref", "search"])).not.toContain("out-invalid-type");
  }, CLI_TIMEOUT);

  test("previews and applies lifecycle commands, replace, and sync", () => {
    const dir = tempDir("phase32-output-ref-lifecycle");
    const db = join(dir, "dna.sqlite");
    seedOutputReferences(db);

    const preview = runDna(["--db", db, "output-ref", "accept", "--id", "out-pending-cli", "--reason", "human accepted"]);
    expect(preview).toContain("Preview output reference lifecycle");
    expect(preview).toContain("out-pending-cli: pending -> active");
    expect(searchById(db, "out-pending-cli")?.status).toBe("pending");

    const applied = JSON.parse(
      runDna(["--db", db, "output-ref", "accept", "--id", "out-pending-cli", "--reason", "human accepted", "--apply", "--format", "json"])
    );
    expect(applied.persisted).toBe(true);
    expect(searchById(db, "out-pending-cli")?.status).toBe("active");
    expect(runDna(["--db", db, "output-ref", "search", "--status", "active"])).toContain("out-pending-cli");

    const replaced = JSON.parse(
      runDna(["--db", db, "output-ref", "replace", "--old", "out-pending-cli", "--new", "out-new-cli", "--reason", "better output", "--apply", "--format", "json"])
    );
    expect(replaced.changes.map((change: { outputReferenceId: string; from: string; to: string }) => [change.outputReferenceId, change.from, change.to])).toEqual([
      ["out-pending-cli", "active", "archived"],
      ["out-new-cli", "pending", "active"]
    ]);
    expect(searchById(db, "out-pending-cli")?.metadata?.lifecycle).toMatchObject({ replacedBy: "out-new-cli" });
    expect(searchById(db, "out-new-cli")?.metadata?.lifecycle).toMatchObject({ replaces: "out-pending-cli" });

    const sync = JSON.parse(runDna(["--db", db, "output-ref", "sync", "--phenotype-version", "pv-output-cli", "--apply", "--format", "json"]));
    expect(sync.persisted).toBe(true);
    expect(sync.changes.map((change: { outputReferenceId: string; from: string; to: string }) => [change.outputReferenceId, change.from, change.to])).toEqual([
      ["out-stale-preview-cli", "stale", "active"]
    ]);
    expect(searchById(db, "out-stale-preview-cli")?.status).toBe("active");
    expect(searchById(db, "out-source-cli")?.status).toBe("pending");
  }, CLI_TIMEOUT);
});
