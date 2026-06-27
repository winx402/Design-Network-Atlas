import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDefaultContextAttachment,
  createDefaultContextFact,
  createDefaultContextMotif,
  createDefaultContextPolicy,
  createDefaultContextReference,
  createDefaultContextReviewRubric,
  createDefaultDesignContext,
  createDefaultDesignPrinciple
} from "@dna/core";
import { createDnaServices } from "@dna/storage";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";

function tempPath(name: string) {
  return join(tmpdir(), `dna-phase18-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function tempDb(name: string) {
  const dbPath = join(tempPath(name), "dna.sqlite");
  mkdirSync(join(dbPath, ".."), { recursive: true });
  return dbPath;
}

describe("Phase 18 PRD-02 SQLite design context storage", () => {
  test("migration creates design context tables", () => {
    const store = new SqliteDnaStore(tempDb("tables"));
    store.migrate();

    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    for (const table of [
      "design_contexts",
      "context_facts",
      "design_principles",
      "context_motifs",
      "context_references",
      "context_review_rubrics",
      "context_attachments",
      "context_policies"
    ]) {
      expect(names.has(table), table).toBe(true);
    }
    store.close();
  });

  test("persists contexts through preview/apply services and direct child repositories", () => {
    const store = new SqliteDnaStore(tempDb("crud"));
    store.migrate();
    const services = createDnaServices(store);

    const preview = services.context.createContext(
      {
        contextId: "ctx-worldview",
        name: "Worldview",
        contextType: "worldview",
        summary: "世界观基底",
        factIds: ["fact-faction"],
        principleIds: ["principle-ui"],
        motifIds: ["motif-ring"],
        referenceIds: ["ref-board"],
        reviewRubricIds: ["rubric-consistency"]
      },
      { mode: "preview-confirm", apply: false }
    );

    expect(preview.changeSet.status).toBe("preview");
    expect(store.designContexts.get("ctx-worldview")).toBeUndefined();

    services.context.createContext(
      {
        contextId: "ctx-worldview",
        name: "Worldview",
        contextType: "worldview",
        summary: "世界观基底",
        factIds: ["fact-faction"],
        principleIds: ["principle-ui"],
        motifIds: ["motif-ring"],
        referenceIds: ["ref-board"],
        reviewRubricIds: ["rubric-consistency"],
        confidence: "confirmed"
      },
      { mode: "preview-confirm", apply: true }
    );

    store.contextFacts.create(
      createDefaultContextFact({
        factId: "fact-faction",
        factType: "faction",
        statement: "月蚀阵营使用残月符号",
        defaultStrength: "hard",
        defaultBehaviorHint: "include"
      })
    );
    store.designPrinciples.create(
      createDefaultDesignPrinciple({
        principleId: "principle-ui",
        statement: "UI 先可读再保留世界观识别",
        experienceIntent: "快速识别阵营",
        readabilityGoal: "small icon readable"
      })
    );
    store.contextMotifs.create(
      createDefaultContextMotif({
        motifId: "motif-ring",
        motifType: "symbolic-motif",
        statement: "断环代表破碎誓约"
      })
    );
    store.contextReferences.create(
      createDefaultContextReference({
        referenceId: "ref-board",
        referenceType: "moodboard",
        sourceRef: { type: "asset-index", id: "asset-board" },
        useFor: ["emotion"],
        doNotUseFor: ["exact silhouette"]
      })
    );
    store.contextReviewRubrics.create(
      createDefaultContextReviewRubric({
        rubricId: "rubric-consistency",
        dimension: "context-consistency",
        question: "是否符合世界观？"
      })
    );
    services.context.attachContext(
      {
        attachmentId: "att-node",
        contextId: "ctx-worldview",
        targetType: "species-node",
        targetId: "node-faction-icon",
        role: "constraint",
        strength: "soft",
        compileLayer: "node-context"
      },
      { mode: "preview-confirm", apply: true }
    );
    store.contextPolicies.create(
      createDefaultContextPolicy({
        policyId: "policy-node",
        contextId: "ctx-worldview",
        attachmentId: "att-node",
        compileParticipation: "llm-context",
        reviewParticipation: "include",
        impactParticipation: "outdated-check"
      })
    );

    expect(store.designContexts.get("ctx-worldview")?.confidence).toBe("confirmed");
    expect(store.contextFacts.get("fact-faction")?.defaultStrength).toBe("hard");
    expect(store.designPrinciples.get("principle-ui")?.experienceIntent).toBe("快速识别阵营");
    expect(store.contextMotifs.get("motif-ring")?.motifType).toBe("symbolic-motif");
    expect(store.contextReferences.get("ref-board")?.doNotUseFor).toEqual(["exact silhouette"]);
    expect(store.contextReviewRubrics.get("rubric-consistency")?.dimension).toBe("context-consistency");
    expect(store.contextAttachments.listByTarget("species-node", "node-faction-icon").map((attachment) => attachment.attachmentId)).toEqual([
      "att-node"
    ]);
    expect(store.contextPolicies.listByContext("ctx-worldview").map((policy) => policy.policyId)).toEqual(["policy-node"]);

    store.close();
  });

  test("exports and imports design context objects through the Git directory format", () => {
    const source = new SqliteDnaStore(tempDb("source"));
    source.migrate();

    source.designContexts.create(
      createDefaultDesignContext({
        contextId: "ctx-export",
        name: "Export Context",
        contextType: "art-direction",
        factIds: ["fact-export"],
        principleIds: ["principle-export"],
        motifIds: ["motif-export"],
        referenceIds: ["ref-export"],
        reviewRubricIds: ["rubric-export"],
        confidence: "confirmed"
      })
    );
    source.contextFacts.create(createDefaultContextFact({ factId: "fact-export", factType: "era", statement: "后灾变时代" }));
    source.designPrinciples.create(createDefaultDesignPrinciple({ principleId: "principle-export", statement: "保持低噪音识别" }));
    source.contextMotifs.create(createDefaultContextMotif({ motifId: "motif-export", motifType: "cultural-motif", statement: "失落文明" }));
    source.contextReferences.create(
      createDefaultContextReference({
        referenceId: "ref-export",
        referenceType: "accepted-phenotype",
        sourceRef: { type: "phenotype-version", id: "pv-export@1.0.0" },
        referenceRole: "positive",
        useFor: ["case evidence"]
      })
    );
    source.contextReviewRubrics.create(
      createDefaultContextReviewRubric({
        rubricId: "rubric-export",
        dimension: "motif-retention",
        question: "是否保留必要母题？"
      })
    );
    source.contextAttachments.create(
      createDefaultContextAttachment({
        attachmentId: "att-export",
        contextId: "ctx-export",
        targetType: "phenotype-version",
        targetId: "pv-export@1.0.0",
        role: "review-source"
      })
    );
    source.contextPolicies.create(
      createDefaultContextPolicy({
        policyId: "policy-export",
        contextId: "ctx-export",
        attachmentId: "att-export",
        compileParticipation: "llm-context"
      })
    );

    const outDir = tempPath("export-dir");
    exportProject(source, outDir);

    const target = new SqliteDnaStore(tempDb("target"));
    target.migrate();
    importProject(target, outDir);

    expect(target.designContexts.get("ctx-export")?.referenceIds).toEqual(["ref-export"]);
    expect(target.contextFacts.get("fact-export")?.statement).toBe("后灾变时代");
    expect(target.designPrinciples.get("principle-export")?.statement).toBe("保持低噪音识别");
    expect(target.contextMotifs.get("motif-export")?.statement).toBe("失落文明");
    expect(target.contextReferences.get("ref-export")?.sourceRef).toEqual({ type: "phenotype-version", id: "pv-export@1.0.0" });
    expect(target.contextReviewRubrics.get("rubric-export")?.dimension).toBe("motif-retention");
    expect(target.contextAttachments.listByContext("ctx-export").map((attachment) => attachment.attachmentId)).toEqual(["att-export"]);
    expect(target.contextPolicies.listByContext("ctx-export").map((policy) => policy.policyId)).toEqual(["policy-export"]);

    source.close();
    target.close();
    rmSync(outDir, { recursive: true, force: true });
  });
});
