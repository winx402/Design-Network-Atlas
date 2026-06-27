import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createDnaServices } from "@dna/storage";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempDir(name: string) {
  return mkdtempSync(join(tmpdir(), `dna-${name}-`));
}

describe("proposal SQLite persistence and exchange", () => {
  test("migrates, exports, and imports proposals with linked change-set ids", () => {
    const dir = tempDir("phase22-proposals");
    const source = new SqliteDnaStore(join(dir, "source.sqlite"));
    source.migrate();
    const services = createDnaServices(source);
    const graph = services.graph.createGraph(
      { graphId: "graph-export-proposal", name: "Proposal Export", purpose: "exchange" },
      { mode: "preview-confirm" }
    );
    services.proposal.create({
      proposalId: "proposal-export",
      title: "Exported proposal",
      summary: "Keep change-set package portable"
    });
    services.proposal.addChangeSet("proposal-export", graph.changeSet.changeSetId);

    const out = join(dir, "dna-export");
    exportProject(source, out);

    expect(existsSync(join(out, "proposals", "proposal-export.json"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(out, "dna.project.json"), "utf8"));
    expect(manifest.capabilities).toContain("proposals");

    const target = new SqliteDnaStore(join(dir, "target.sqlite"));
    target.migrate();
    importProject(target, out);

    expect(target.proposals.get("proposal-export")?.changeSetIds).toEqual([graph.changeSet.changeSetId]);
    expect(target.changeSets.get(graph.changeSet.changeSetId)?.status).toBe("preview");
    source.close();
    target.close();
  });
});
