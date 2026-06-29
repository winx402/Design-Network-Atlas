import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultGraph,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode,
  GenerationProvider,
  MockGenerationProvider,
  runGenerationProvider
} from "@dna/core";
import { exportProject, SqliteDnaStore } from "@dna/sqlite";

const compilePolicy = { type: "system-rule-first", conflictResolution: "system" } as const;

function readAllFiles(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return readAllFiles(path);
      if (entry.isFile()) return readFileSync(path, "utf8");
      return [];
    })
    .join("\n");
}

describe("Phase 8 provider security persistence", () => {
  test("provider jobs and exported project files do not contain secret-shaped parameters", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dna-provider-security-"));
    const db = join(dir, "dna.sqlite");
    const out = join(dir, "export");
    const store = new SqliteDnaStore(db);
    store.migrate();

    const result = await runGenerationProvider({
      provider: new MockGenerationProvider(),
      generationJobId: "job-secure",
      graphId: "graph-provider",
      nodeId: "node-provider",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar warning icon",
      compilePolicy,
      prompt: "Prompt",
      brief: "Brief",
      toolParameters: {
        model: "mock",
        apiKey: "sk-do-not-export",
        nested: { password: "do-not-export" }
      }
    });

    store.generationJobs.create(result.job);
    for (const asset of result.assets) store.assets.create(asset);

    expect(JSON.stringify(store.generationJobs.get("job-secure"))).not.toContain("sk-do-not-export");
    expect(JSON.stringify(store.generationJobs.get("job-secure"))).not.toContain("do-not-export");

    exportProject(store, out);
    const exported = readAllFiles(out);
    expect(exported).not.toContain("sk-do-not-export");
    expect(exported).not.toContain("do-not-export");
    store.close();
  });

  test("failed provider jobs do not persist or export raw secret-bearing errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dna-provider-failure-security-"));
    const db = join(dir, "dna.sqlite");
    const out = join(dir, "export");
    const store = new SqliteDnaStore(db);
    store.migrate();
    const provider: GenerationProvider = {
      name: "secret-failing-provider",
      async generate() {
        throw new Error(
          "request failed with OPENAI_API_KEY=sk-failed-secret password=bad secret=raw private_key=abc Authorization: Bearer bearer-secret https://private.example.test/file.png?token=signed"
        );
      }
    };

    const result = await runGenerationProvider({
      provider,
      generationJobId: "job-failed-secret",
      graphId: "graph-provider",
      nodeId: "node-provider",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar warning icon",
      compilePolicy,
      prompt: "Prompt",
      brief: "Brief",
      toolParameters: {
        model: "mock",
        apiKey: "sk-tool-secret",
        nested: { password: "tool-password" }
      }
    });

    store.generationJobs.create(result.job);
    const persisted = JSON.stringify(store.generationJobs.get("job-failed-secret"));
    expect(persisted).toContain("provider failure: provider-error");
    for (const forbidden of [
      "sk-failed-secret",
      "sk-tool-secret",
      "OPENAI_API_KEY",
      "tool-password",
      "password=bad",
      "secret=raw",
      "private_key",
      "Bearer bearer-secret",
      "private.example.test/file.png"
    ]) {
      expect(persisted).not.toContain(forbidden);
    }

    exportProject(store, out);
    const exported = readAllFiles(out);
    for (const forbidden of ["sk-failed-secret", "OPENAI_API_KEY", "Bearer bearer-secret", "private.example.test/file.png"]) {
      expect(exported).not.toContain(forbidden);
    }
    store.close();
  });

  test("phenotype version feedback is sanitized before persistence and export", () => {
    const dir = mkdtempSync(join(tmpdir(), "dna-feedback-security-"));
    const db = join(dir, "dna.sqlite");
    const out = join(dir, "export");
    const store = new SqliteDnaStore(db);
    store.migrate();
    const graph = createDefaultGraph({ graphId: "graph-feedback-security", name: "Feedback Security", purpose: "feedback security" });
    const node = createDefaultSpeciesNode({ graphId: graph.graphId, nodeId: "node-feedback-security", name: "Feedback Node" });
    const phenotype = createDefaultPhenotype({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: "ph-feedback-security",
      name: "Feedback Phenotype",
      phenotypeType: "image-prompt"
    });
    const version = createDefaultPhenotypeVersion({
      graphId: graph.graphId,
      nodeId: node.nodeId,
      phenotypeId: phenotype.phenotypeId,
      phenotypeVersionId: "pv-feedback-security",
      feedback: {
        summary: "OPENAI_API_KEY=sk-feedback-summary",
        items: [
          {
            feedbackId: "fb-feedback-security",
            severity: "blocking",
            source: "agent",
            message: "Bearer feedback-token password=feedback-password",
            suggestedAction: "Open https://private.example.test/file.png?token=signed",
            createdAt: "2026-06-29T00:00:00.000Z"
          }
        ]
      }
    });
    store.graphs.create(graph);
    store.nodes.create(node);
    store.phenotypes.create(phenotype);
    store.phenotypeVersions.create(version);

    const persisted = JSON.stringify(store.phenotypeVersions.get(version.phenotypeVersionId));
    exportProject(store, out);
    const exported = readAllFiles(out);
    for (const forbidden of ["sk-feedback-summary", "OPENAI_API_KEY", "feedback-token", "feedback-password", "private.example.test/file.png"]) {
      expect(persisted).not.toContain(forbidden);
      expect(exported).not.toContain(forbidden);
    }
    expect(persisted).toContain("[redacted]");
    store.close();
  });
});
