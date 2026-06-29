import { describe, expect, test } from "vitest";
import {
  assertCanTransitionStatus,
  createDefaultPhenotypeVersion,
  PhenotypeVersionSchema
} from "@dna/core";

function versionInput() {
  return {
    phenotypeVersionId: "pv-lifecycle",
    phenotypeId: "ph-lifecycle",
    graphId: "graph-lifecycle",
    nodeId: "node-lifecycle",
    nodeVersionId: "node-lifecycle@1.0.0",
    promptSnapshot: "Generate a clean lifecycle test icon",
    generationRecipe: { seed: 42 },
    resolvedGeneSnapshot: { shape: "diamond" },
    speciesCompileArtifactId: "sca-lifecycle",
    phenotypeCompileArtifactId: "pca-lifecycle",
    compileArtifactSnapshot: { prompt: "Generate a clean lifecycle test icon" }
  };
}

describe("Phase 27 PRD-18 phenotype version lifecycle domain", () => {
  test("defaults formal generated versions to candidate and stores lightweight feedback", () => {
    const version = createDefaultPhenotypeVersion({
      ...versionInput(),
      feedback: {
        summary: "Candidate needs art review.",
        items: [
          {
            feedbackId: "fb-1",
            severity: "warning",
            source: "human",
            message: "Silhouette is promising but needs stronger contrast.",
            suggestedAction: "Increase edge contrast.",
            createdAt: "2026-06-29T00:00:00.000Z"
          }
        ]
      }
    });

    expect(PhenotypeVersionSchema.parse(version)).toMatchObject({
      status: "candidate",
      feedback: {
        summary: "Candidate needs art review.",
        items: [{ feedbackId: "fb-1", severity: "warning", source: "human" }]
      }
    });
  });

  test("uses PRD-18 status vocabulary and rejects old pending/superseded terms", () => {
    const version = createDefaultPhenotypeVersion(versionInput());

    expect(() => PhenotypeVersionSchema.parse({ ...version, status: "pending-confirmation" })).toThrow();
    expect(() => PhenotypeVersionSchema.parse({ ...version, status: "superseded" })).toThrow();

    expect(() => assertCanTransitionStatus("phenotype-version", "candidate", "accepted")).not.toThrow();
    expect(() => assertCanTransitionStatus("phenotype-version", "accepted", "replaced")).not.toThrow();
    expect(() => assertCanTransitionStatus("phenotype-version", "accepted", "rolled-back")).not.toThrow();
    expect(() => assertCanTransitionStatus("phenotype-version", "replaced", "accepted")).not.toThrow();
    expect(() => assertCanTransitionStatus("phenotype-version", "accepted", "candidate")).toThrow(
      /Invalid phenotype-version status transition: accepted -> candidate/
    );
  });

  test("redacts credential-like feedback values at creation time", () => {
    const version = createDefaultPhenotypeVersion({
      ...versionInput(),
      feedback: {
        summary: "Use OPENAI_API_KEY=sk-do-not-store",
        items: [
          {
            feedbackId: "fb-secret",
            severity: "blocking",
            source: "agent",
            message: "Provider said Bearer private-token and password=hunter2",
            suggestedAction: "Open https://private.example.test/out.png?token=secret",
            createdAt: "2026-06-29T00:00:00.000Z"
          }
        ]
      }
    });

    const serialized = JSON.stringify(version);
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).not.toContain("sk-do-not-store");
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("private.example.test/out.png");
    expect(version.feedback.summary).toContain("[redacted]");
    expect(version.feedback.items[0].message).toContain("[redacted]");
    expect(version.feedback.items[0].suggestedAction).toContain("[redacted]");
  });
});
