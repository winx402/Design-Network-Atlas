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

  test("renders Atlas Map as the default module with explorer, board, and library routes", () => {
    const snapshot = JSON.parse(JSON.stringify(sampleWorkbenchSnapshot));
    const readiness = {
      score: 82,
      level: "ready",
      targetLevel: "graph",
      targetId: "graph-explorer",
      missing: [],
      suggestions: ["Keep current design language coverage."],
      dimensions: [{ key: "graph-purpose", label: "Purpose and design direction", score: 100 }],
      evaluatedAt: "2026-06-30T10:00:00.000Z"
    };
    snapshot.graphs[0].readiness = { ...readiness, targetId: "graph-language" };
    snapshot.graphs[1].readiness = readiness;
    snapshot.graphs[1].groups[0].readiness = { ...readiness, targetLevel: "species-group", targetId: "group-ui", level: "warning", score: 72 };
    snapshot.graphs[1].nodes[0].readiness = { ...readiness, targetLevel: "species-node", targetId: "node-warning", level: "warning", score: 68 };
    snapshot.graphs[1].phenotypeOverlay[0].readiness = {
      ...readiness,
      targetLevel: "phenotype",
      targetId: "ph-warning-icon",
      boundVersionRef: "phenotype-usage-guide:guide-warning-usage@2"
    };
    snapshot.generation.tasks[0].targetReadiness = { ...readiness, targetLevel: "phenotype", targetId: "ph-warning-icon" };
    const html = renderToStaticMarkup(
      React.createElement(ReadonlyWorkbench, {
        initialState: { status: "ready", snapshot }
      })
    );

    for (const label of ["Atlas Map", "Graph Explorer", "Generation Board", "Phenotype Library"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("DNA Read-only Explorer");
    expect(html).toContain("desktop-side-nav");
    expect(html).toContain("scope-bar");
    expect(html).toContain("workspace-grid");
    expect(html).toContain("status-bar");
    expect(html).toContain("mobile-bottom-nav");
    expect(html).toContain("detail-drawer");
    expect(html).toContain("Graph relationship map");
    expect(html).toContain("Reference Language Graph");
    expect(html).toContain("translates-to");
    expect(html).toContain("map-route-layer");
    expect(html).toContain("atlas-route-button");
    expect(html).toContain("group-lane");
    expect(html).toContain("species-card");
    expect(html).toContain("relationship-matrix");
    expect(html).toContain("Plan -&gt; Task -&gt; Compile Artifact -&gt; Generation Job -&gt; Phenotype Version -&gt; Output Reference / Asset");
    expect(html).toContain("plan-trace-row");
    expect(html).toContain("board-trace-grid");
    expect(html).toContain("Preview unavailable");
    expect(html).toContain("Inspector");
    expect(html).toContain("drawer-handle");
    expect(html).toContain("Identity");
    expect(html).toContain("Bound Semantics");
    expect(html).toContain("Relationships");
    expect(html).toContain("Provenance");
    expect(html).toContain("Governance");
    expect(html).toContain("External pointers");
    expect(html).toContain("<summary>Raw JSON</summary>");
    expect(html).toContain('for="graph-scope-select"');
    expect(html).toContain('for="object-search-input"');
    expect(html).toContain('for="status-filter-select"');
    expect(html).toContain('aria-label="Desktop Explorer modules"');
    expect(html).toContain('aria-label="Mobile Explorer modules"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('aria-label="Workbench metrics"');
    expect(html).not.toContain("Anomaly entry points");
    expect(html).not.toContain("Overview");
    expect(html).toContain("Gallery");
    expect(html).toContain("Usage Guide");
    expect(html).toContain("Guide coverage");
    expect(html).toContain("readiness ready 82");
    expect(html).toContain("Design readiness: ready 82");
    expect(html).toContain("must preserve");
    expect(html).toContain("Warning Toolbar Icon usage");
    expect(html).toContain("filter-sheet");
    expect(html).toContain("gallery-grid");
    expect((html.match(/gallery-card/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("asset-warning-source");
    expect(html).toContain("Storage");
    expect(html).toContain("redacted-or-unavailable");
    expect(html).not.toContain("Graph relationship routes");
    expect(html).not.toContain("relationship-route-list");
    expect(html).not.toContain("Context, facts, principles, motifs, facets, and rubrics appear when present");
    expect(html).not.toContain("Incoming and outgoing endpoints appear when present");
    expect(html).not.toContain("0 versions");
    expect(html).not.toContain("topbar");
    expect(html).not.toContain("mobile-tabbar");
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
    expect(errorHtml).toContain("Unable to load explorer snapshot");
    expect(errorHtml).toContain("failed to load workbench snapshot: 503");
    expect(errorHtml).toContain("No durable DNA records were changed");
  });

  test("keeps raw paths and credentials out of preview-ready app data", () => {
    const serialized = JSON.stringify(sampleWorkbenchSnapshot);
    expect(serialized).not.toMatch(/sk-test|OPENAI_API_KEY|password|secret|private_key|Bearer|X-Amz-Signature|\/Users\/bot/);
    expect(sampleWorkbenchSnapshot.resultPreviews.map((preview) => preview.preview.kind)).toContain("placeholder");
    expect(JSON.stringify(sampleWorkbenchSnapshot.usageGuides)).toContain("ph-warning-icon");
  });
});
