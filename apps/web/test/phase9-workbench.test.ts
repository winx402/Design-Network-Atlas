import { describe, expect, test } from "vitest";
import {
  filterPhenotypes,
  getSelectedVersion,
  loadWorkbenchPhenotypes,
  samplePhenotypes,
  updateVersionStatus
} from "../src/workbench-data";

describe("Phase 9 asset workbench state model", () => {
  test("filters phenotypes by query, status, tag, and outdated flag", () => {
    expect(filterPhenotypes(samplePhenotypes, { query: "warning", status: "all", tag: "all", outdatedOnly: false })).toHaveLength(1);
    expect(filterPhenotypes(samplePhenotypes, { query: "", status: "accepted", tag: "all", outdatedOnly: false })).toHaveLength(1);
    expect(filterPhenotypes(samplePhenotypes, { query: "", status: "all", tag: "ui", outdatedOnly: false })).toHaveLength(1);
    expect(filterPhenotypes(samplePhenotypes, { query: "", status: "all", tag: "all", outdatedOnly: true }).map((item) => item.id)).toEqual([
      "ph-warning-icon"
    ]);
  });

  test("selects the current accepted version when one exists and otherwise uses the newest version", () => {
    const accepted = samplePhenotypes.find((phenotype) => phenotype.id === "ph-faction-emblem")!;
    const pending = samplePhenotypes.find((phenotype) => phenotype.id === "ph-warning-icon")!;

    expect(getSelectedVersion(accepted)?.id).toBe("pv-emblem-2");
    expect(getSelectedVersion(pending)?.id).toBe("pv-warning-2");
  });

  test("status transitions update one version without mutating the source list", () => {
    const updated = updateVersionStatus(samplePhenotypes, "ph-warning-icon", "pv-warning-2", "accepted");
    const originalVersion = getSelectedVersion(samplePhenotypes.find((phenotype) => phenotype.id === "ph-warning-icon")!)!;
    const updatedPhenotype = updated.find((phenotype) => phenotype.id === "ph-warning-icon")!;
    const updatedVersion = getSelectedVersion(updatedPhenotype)!;

    expect(originalVersion.status).toBe("pending-confirmation");
    expect(updatedVersion.status).toBe("accepted");
    expect(updatedPhenotype.currentAcceptedVersionId).toBe("pv-warning-2");
  });

  test("rejecting or archiving a version keeps the accepted version pointer unchanged", () => {
    const rejected = updateVersionStatus(samplePhenotypes, "ph-faction-emblem", "pv-emblem-1", "rejected");
    const archived = updateVersionStatus(rejected, "ph-faction-emblem", "pv-emblem-1", "archived");
    const phenotype = archived.find((item) => item.id === "ph-faction-emblem")!;

    expect(phenotype.currentAcceptedVersionId).toBe("pv-emblem-2");
    expect(phenotype.versions.find((version) => version.id === "pv-emblem-1")?.status).toBe("archived");
  });

  test("loads workbench phenotypes from the local HTTP API", async () => {
    const phenotypes = await loadWorkbenchPhenotypes({
      baseUrl: "http://dna.local",
      graphId: "graph-ui",
      fetcher: async (url) =>
        new Response(
          JSON.stringify({
            phenotypes: [
              {
                id: "ph-api",
                name: "API Phenotype",
                nodeName: "API Node",
                phenotypeType: "image-prompt",
                tags: ["api"],
                outdated: false,
                currentSpeciesVersion: "node-api@1.0.0",
                latestSpeciesVersion: "node-api@1.0.0",
                versions: []
              }
            ]
          })
        )
    });

    expect(phenotypes).toHaveLength(1);
    expect(phenotypes[0].id).toBe("ph-api");
  });
});
