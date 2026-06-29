import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeUsageGuide,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDb(name: string) {
  const dbPath = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`, "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

function seedStore(store: SqliteDnaStore) {
  const graph = createDefaultGraph({ graphId: "graph-guide-sqlite", name: "Guide SQLite", purpose: "usage guide storage" });
  const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-guide-sqlite", name: "Guide Node" });
  const phenotype = createDefaultPhenotype({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: "ph-guide-sqlite",
    name: "Guide Phenotype",
    phenotypeType: "ui-icon"
  });
  const guide = createDefaultPhenotypeUsageGuide({
    usageGuideId: "guide-sqlite",
    phenotypeId: phenotype.phenotypeId,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeType: phenotype.phenotypeType,
    title: "SQLite guide",
    summary: "Exportable stable usage guide.",
    usageScenarios: [{ scenarioId: "primary", name: "Primary", designIntent: "Show the guide.", priority: "primary" }],
    usageInstructions: { primaryUse: "Use as a product-facing result explanation." },
    designSemantics: { mustPreserve: ["meaning"], mustAvoid: ["secret paths"] },
    variantPlan: [{ variantId: "default", name: "Default", purpose: "baseline", required: true }],
    productionHints: { suggestedAssetTypes: ["image"] },
    reviewChecklist: [{ checklistId: "check-sqlite", question: "Guide still current?", severity: "warning" }],
    sourceSummary: "SQLite seed."
  });
  const version = createDefaultPhenotypeVersion({
    graphId: graph.graphId,
    nodeId: node.nodeId,
    phenotypeId: phenotype.phenotypeId,
    phenotypeVersionId: "pv-guide-sqlite",
    nodeVersionId: "node-guide-sqlite@1.0.0",
    usageGuideId: guide.usageGuideId,
    usageGuideRevision: guide.revision,
    compileArtifactSnapshot: { usageGuideSnapshot: { usageGuideId: guide.usageGuideId, usageGuideRevision: guide.revision } }
  });
  store.graphs.create(graph);
  store.nodes.create(node);
  store.phenotypes.create(phenotype);
  store.phenotypeUsageGuides.create(guide);
  store.phenotypeVersions.create(version);
  return { graph, phenotype, guide, version };
}

describe("Phase 31 PRD-22 phenotype usage guide SQLite and exchange", () => {
  test("stores, updates, and queries active guides by phenotype and species", () => {
    const store = new SqliteDnaStore(tempDb("phenotype-usage-guide-storage"));
    store.migrate();
    const { phenotype, guide } = seedStore(store);

    expect(store.phenotypeUsageGuides.get(guide.usageGuideId)).toMatchObject({ revision: 1, status: "active" });
    expect(store.phenotypeUsageGuides.getActiveByPhenotype(phenotype.phenotypeId)?.usageGuideId).toBe(guide.usageGuideId);
    expect(store.phenotypeUsageGuides.listByNode("node-guide-sqlite").map((item) => item.usageGuideId)).toEqual([guide.usageGuideId]);

    store.phenotypeUsageGuides.update({ ...guide, summary: "Updated", revision: 2, updatedAt: "2026-06-30T00:00:00.000Z" });
    expect(store.phenotypeUsageGuides.get(guide.usageGuideId)?.revision).toBe(2);
    store.close();
  });

  test("full and review-current export/import include guide JSON and markdown", () => {
    const source = new SqliteDnaStore(tempDb("phenotype-usage-guide-export-source"));
    source.migrate();
    const { graph, phenotype, guide } = seedStore(source);

    const fullOut = tempDir("phenotype-usage-guide-full-export");
    const reviewOut = tempDir("phenotype-usage-guide-review-export");
    exportProject(source, fullOut);
    exportProject(source, reviewOut, { profile: "review-current" });

    const guideJsonPath = join(reviewOut, "graphs", graph.graphId, "phenotypes", phenotype.phenotypeId, "usage-guide.json");
    const guideMarkdownPath = join(reviewOut, "graphs", graph.graphId, "phenotypes", phenotype.phenotypeId, "usage-guide.md");
    expect(existsSync(guideJsonPath)).toBe(true);
    expect(existsSync(guideMarkdownPath)).toBe(true);
    expect(JSON.parse(readFileSync(guideJsonPath, "utf8"))).toMatchObject({
      usageGuideId: guide.usageGuideId,
      revision: 1
    });
    expect(readFileSync(guideMarkdownPath, "utf8")).toContain("# SQLite guide 使用说明");
    expect(JSON.stringify(JSON.parse(readFileSync(join(reviewOut, "dna.project.json"), "utf8")).review)).toContain("usageGuideCoverage");
    const serializedGuide = `${readFileSync(guideJsonPath, "utf8")}\n${readFileSync(guideMarkdownPath, "utf8")}`;
    expect(serializedGuide).not.toMatch(/OPENAI_API_KEY|sk-proj|Bearer|\/Users\/bot/);
    expect(existsSync(join(fullOut, "graphs", graph.graphId, "phenotypes", phenotype.phenotypeId, "usage-guide.json"))).toBe(true);

    const target = new SqliteDnaStore(tempDb("phenotype-usage-guide-export-target"));
    target.migrate();
    importProject(target, reviewOut);
    expect(target.phenotypeUsageGuides.get(guide.usageGuideId)?.summary).toBe("Exportable stable usage guide.");
    expect(target.phenotypeVersions.get("pv-guide-sqlite")?.usageGuideId).toBe(guide.usageGuideId);
    source.close();
    target.close();
  });
});
