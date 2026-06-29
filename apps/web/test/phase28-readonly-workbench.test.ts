import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ReadonlyWorkbench } from "../src/main";
import {
  createEmptyWorkbenchSnapshot,
  loadWorkbenchForApp,
  loadWorkbenchSnapshot,
  sampleWorkbenchSnapshot
} from "../src/workbench-data";

describe("Phase 28 PRD-21 DNA read-only workbench", () => {
  test("loads the four-module snapshot endpoint instead of assembling low-level phenotype data", async () => {
    const requested: string[] = [];
    const snapshot = await loadWorkbenchSnapshot({
      baseUrl: "http://dna.local",
      graphId: "graph-web",
      fetcher: async (url) => {
        requested.push(url);
        return new Response(
          JSON.stringify({
            overview: { counts: { graphs: 1, phenotypes: 0 }, anomalies: [] },
            graphs: [],
            generation: { plans: [], tasks: [], jobs: [] },
            libraries: [],
            outputReferences: [],
            assets: [],
            resultPreviews: []
          })
        );
      }
    });

    expect(requested[0]).toBe("http://dna.local/api/workbench/snapshot?graphId=graph-web");
    expect(snapshot.overview.counts.graphs).toBe(1);
  });

  test("renders Overview, Graphs, Generation, and Libraries as read-only first-level modules", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReadonlyWorkbench, {
        initialState: { status: "ready", snapshot: sampleWorkbenchSnapshot }
      })
    );

    for (const label of ["Overview", "Graphs", "Generation", "Libraries"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("DNA Read-only Workbench");
    expect(html).toContain("Trace Panel");
    expect(html).toContain("Identity");
    expect(html).toContain("Relationships");
    expect(html).toContain("Provenance");
    expect(html).toContain("Governance");
    expect(html).toContain("External pointers");
    expect(html).toContain("Raw JSON summary");
    expect(html).toContain("Results");
    expect(html).toContain("Gallery");
    expect(html).toContain("mobile-tabbar");
    expect(html).toContain("filter-sheet");
    expect(html).toContain("detail-drawer");
    expect(html).toContain("gallery-grid");
    expect(html).not.toMatch(/\bAccept\b|\bReject\b|\bArchive\b|\bRun task\b|\bApply\b|\bCreate\b|\bEdit\b/);
  });

  test("renders clear read-only empty and error states", async () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(ReadonlyWorkbench, {
        initialState: { status: "ready", snapshot: createEmptyWorkbenchSnapshot() }
      })
    );
    expect(emptyHtml).toContain("No DNA records found");
    expect(emptyHtml).toContain("read-only");
    expect(emptyHtml).toContain("CLI/service boundary");

    const result = await loadWorkbenchForApp({
      baseUrl: "http://dna.local",
      fetcher: async () => new Response(JSON.stringify({ error: "offline" }), { status: 503 })
    });
    const errorHtml = renderToStaticMarkup(React.createElement(ReadonlyWorkbench, { initialState: result }));
    expect(errorHtml).toContain("Unable to load workbench snapshot");
    expect(errorHtml).toContain("No durable DNA records were changed");
  });

  test("keeps raw paths and credentials out of preview-ready app data", () => {
    const serialized = JSON.stringify(sampleWorkbenchSnapshot);
    expect(serialized).not.toMatch(/sk-test|OPENAI_API_KEY|password|secret|private_key|Bearer|X-Amz-Signature|\/Users\/bot/);
    expect(sampleWorkbenchSnapshot.resultPreviews.map((preview) => preview.preview.kind)).toContain("placeholder");
  });
});
