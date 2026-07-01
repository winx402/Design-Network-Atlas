import { describe, expect, test } from "vitest";
import { createGenerationJob, GenerationJobSchema } from "../src/index.js";

describe("Phase 33 PRD-24 managed generation evidence core schema", () => {
  test("defaults legacy generation jobs to compiled-only provenance and not-run verification", () => {
    const parsed = GenerationJobSchema.parse({
      generationJobId: "job-legacy",
      graphId: "graph-managed",
      nodeId: "node-managed",
      phenotypeType: "image",
      compilePolicy: { type: "system-rule-first", conflictResolution: "system" },
      inputSnapshot: {},
      outputSnapshot: { prompt: "safe prompt" },
      toolParameters: {},
      status: "created",
      facets: {},
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z"
    });

    expect(parsed).toMatchObject({
      executionMode: "compiled-only",
      provenanceLevel: "compiled-only",
      verificationSummary: { status: "not-run", checks: [], blockingReasons: [], warningReasons: [] }
    });

    expect(createGenerationJob({ generationJobId: "job-default", graphId: "graph-managed" })).toMatchObject({
      executionMode: "compiled-only",
      provenanceLevel: "compiled-only",
      verificationSummary: { status: "not-run" }
    });
  });

  test("sanitizes request evidence, output evidence, and verification notes", () => {
    const job = createGenerationJob({
      generationJobId: "job-secret-evidence",
      graphId: "graph-managed",
      nodeId: "node-managed",
      phenotypeType: "image",
      requestEvidence: {
        actualPromptSnapshot: "Use OPENAI_API_KEY=sk-do-not-store and https://private.example.test/file.png?token=secret",
        provider: "mock-runner",
        parameters: {
          size: "1024x1024",
          apiKey: "sk-hidden",
          nested: { Authorization: "Bearer raw-secret" }
        }
      },
      outputEvidence: {
        assetIds: ["asset-secret"],
        outputReferenceIds: [],
        outputHashes: [{ assetId: "asset-secret", hash: "sha256-safe", uri: "/Users/bot/private/output.png?token=secret" }],
        mimeType: "image/png",
        byteSize: 256,
        width: 64,
        height: 64,
        hashAlgorithm: "sha256"
      },
      verificationSummary: {
        status: "failed",
        checks: [
          {
            checkId: "manual-secret",
            source: "manual",
            severity: "blocking",
            status: "failed",
            reason: "Bearer raw-secret should be redacted"
          }
        ],
        blockingReasons: ["password=hunter2"],
        warningReasons: ["private_key=hidden"],
        checkedBy: "OPENAI_API_KEY=sk-verifier"
      }
    });

    const serialized = JSON.stringify(job);
    expect(serialized).not.toMatch(/sk-do-not-store|sk-hidden|raw-secret|private\.example|token=secret|\/Users\/bot|password=hunter2|private_key|sk-verifier/);
    expect(serialized).toContain("[redacted]");
  });
});
