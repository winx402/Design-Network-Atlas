import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { MockGenerationProvider, runGenerationProvider } from "@dna/core";
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
});
