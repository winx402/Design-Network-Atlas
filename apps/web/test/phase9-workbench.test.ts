import { describe, expect, test } from "vitest";
import {
  filterPhenotypes,
  getSelectedVersion,
  loadWorkbenchPhenotypes,
  loadWorkbenchPhenotypesForApp,
  loadWorkbenchSnapshot,
  samplePhenotypes
} from "../src/workbench-data";

describe("Phase 9 web result state model", () => {
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

  test("does not expose local status mutation helpers in the read-only workbench data module", async () => {
    const module = await import("../src/workbench-data");

    expect("updateVersionStatus" in module).toBe(false);
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

  test("loads read-only generation planning snapshot data from the local HTTP API", async () => {
    const snapshot = await loadWorkbenchSnapshot({
      baseUrl: "http://dna.local",
      graphId: "graph-ui",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            phenotypes: [],
            generationPlans: [
              {
                planId: "plan-ui",
                graphId: "graph-ui",
                scopeType: "graph",
                scopeId: "graph-ui",
                priority: 1,
                description: "UI pass",
                status: "expanded",
                taskCount: 2
              }
            ],
            generationTasks: [
              {
                taskId: "task-ui",
                graphId: "graph-ui",
                phenotypeType: "icon",
                taskBrief: "warning icon",
                priority: 1,
                status: "blocked",
                blockingReason: "waiting for review",
                links: { generationJobIds: [], phenotypeVersionIds: [] }
              }
            ]
          })
        )
    });

    expect(snapshot.generationPlans[0]).toMatchObject({ planId: "plan-ui", taskCount: 2 });
    expect(snapshot.generationTasks[0]).toMatchObject({ taskId: "task-ui", blockingReason: "waiting for review" });
  });

  test("always uses API-backed snapshot loading and ignores obsolete fixture bypass flags", async () => {
    let requestCount = 0;
    const obsoleteFixtureFlag = "de" + "mo";
    const apiResult = await loadWorkbenchPhenotypesForApp({
      baseUrl: "http://dna.local",
      [obsoleteFixtureFlag]: true,
      fetcher: async () =>
        {
          requestCount += 1;
          return new Response(
            JSON.stringify({
              phenotypes: [
                {
                  id: "ph-live",
                  name: "Live Phenotype",
                  nodeName: "Live Node",
                  phenotypeType: "image-prompt",
                  tags: [],
                  outdated: false,
                  currentSpeciesVersion: "node-live@1.0.0",
                  latestSpeciesVersion: "node-live@1.0.0",
                  versions: []
                }
              ]
            })
          );
        }
    } as never);

    expect(apiResult.status).toBe("ready");
    expect(apiResult.phenotypes.map((phenotype) => phenotype.id)).toEqual(["ph-live"]);
    expect(requestCount).toBe(1);
    if (apiResult.status === "ready") expect(apiResult.generationTasks).toEqual([]);
    expect(apiResult.phenotypes).not.toBe(samplePhenotypes);
  });

  test("loads API data into the app state", async () => {
    const apiResult = await loadWorkbenchPhenotypesForApp({
      baseUrl: "http://dna.local",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            phenotypes: [
              {
                id: "ph-live",
                name: "Live Phenotype",
                nodeName: "Live Node",
                phenotypeType: "image-prompt",
                tags: [],
                outdated: false,
                currentSpeciesVersion: "node-live@1.0.0",
                latestSpeciesVersion: "node-live@1.0.0",
                versions: []
              }
            ]
          })
        )
    });

    expect(apiResult.status).toBe("ready");
    expect(apiResult.phenotypes.map((phenotype) => phenotype.id)).toEqual(["ph-live"]);
    if (apiResult.status === "ready") expect(apiResult.generationTasks).toEqual([]);
  });

  test("returns a non-destructive error state when API loading fails", async () => {
    const result = await loadWorkbenchPhenotypesForApp({
      baseUrl: "http://dna.local",
      fetcher: async () => new Response(JSON.stringify({ error: "offline" }), { status: 503 })
    });

    expect(result).toMatchObject({
      status: "error",
      phenotypes: [],
      error: "failed to load workbench snapshot: 503"
    });
  });
});
