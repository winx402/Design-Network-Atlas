import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createDefaultGraph, createGenerationJob } from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "../src/index.js";

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Phase 33 PRD-24 managed generation evidence storage", () => {
  test("round-trips generation job evidence through SQLite export/import without private payloads", () => {
    const source = new SqliteDnaStore(":memory:");
    const target = new SqliteDnaStore(":memory:");
    source.migrate();
    target.migrate();
    const out = tempDir("phase33-managed-generation-export");

    const graph = createDefaultGraph({ graphId: "graph-managed-storage", name: "Managed Storage", purpose: "evidence export" });
    source.graphs.create(graph);
    source.generationJobs.create(
      createGenerationJob({
        generationJobId: "job-managed-storage",
        graphId: graph.graphId,
        nodeId: "node-managed-storage",
        phenotypeType: "image",
        status: "generated",
        executionMode: "managed-runner",
        provenanceLevel: "runner-verified",
        requestEvidence: {
          compiledPromptHash: "sha256:compiled",
          actualPromptHash: "sha256:actual",
          actualPromptSnapshot: "safe prompt",
          runnerId: "mock-runner",
          runnerInvocationId: "run-storage",
          providerRequestId: "provider-storage",
          parameters: { size: "512x512", apiKey: "sk-hidden" },
          submittedAt: "2026-07-02T00:00:00.000Z"
        },
        outputEvidence: {
          assetIds: ["asset-managed-storage"],
          outputReferenceIds: [],
          outputHashes: [{ assetId: "asset-managed-storage", hash: "sha256:output", uri: "/Users/bot/private/out.png?token=secret" }],
          mimeType: "image/png",
          byteSize: 1024,
          width: 512,
          height: 512,
          storageType: "local",
          hashAlgorithm: "sha256"
        },
        verificationSummary: {
          status: "passed",
          checks: [{ checkId: "dimensions", source: "system", severity: "info", status: "passed", reason: "512x512 image" }],
          blockingReasons: [],
          warningReasons: [],
          checkedBy: "system",
          checkedAt: "2026-07-02T00:00:00.000Z"
        }
      })
    );

    exportProject(source, out);
    const exportedPath = join(out, "graphs", graph.graphId, "generation-jobs", "job-managed-storage.json");
    expect(existsSync(exportedPath)).toBe(true);
    const serialized = readFileSync(exportedPath, "utf8");
    expect(serialized).not.toMatch(/sk-hidden|\/Users\/bot|token=secret/);
    expect(readJson(exportedPath)).toMatchObject({
      executionMode: "managed-runner",
      provenanceLevel: "runner-verified",
      requestEvidence: { compiledPromptHash: "sha256:compiled", runnerId: "mock-runner" },
      outputEvidence: { assetIds: ["asset-managed-storage"], outputHashes: [{ assetId: "asset-managed-storage", hash: "sha256:output" }] },
      verificationSummary: { status: "passed" }
    });

    importProject(target, out);
    expect(target.generationJobs.get("job-managed-storage")).toMatchObject({
      executionMode: "managed-runner",
      provenanceLevel: "runner-verified",
      verificationSummary: { status: "passed" }
    });
  });
});
