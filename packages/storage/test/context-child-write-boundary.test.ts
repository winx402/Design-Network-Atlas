import { describe, expect, test } from "vitest";
import { createDnaServices, createInMemoryDnaStore } from "@dna/storage";

describe("context child service write boundary", () => {
  test("context fact preview creates a change-set without persisting the fact", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const result = services.context.createFact(
      {
        factId: "fact-preview",
        factType: "symbol-rule",
        statement: "Use ring motifs only as broken silhouettes"
      },
      { mode: "preview-confirm" }
    );

    expect(result.changeSet.status).toBe("preview");
    expect(result.changeSet.objectType).toBe("context-fact");
    expect(result.changeSet.preview.summary).toContain("create context fact fact-preview");
    expect(store.contextFacts.get("fact-preview")).toBeUndefined();

    services.changeSet.apply(result.changeSet.changeSetId);

    expect(store.contextFacts.get("fact-preview")?.statement).toBe("Use ring motifs only as broken silhouettes");
    expect(store.changeSets.get(result.changeSet.changeSetId)?.status).toBe("applied");
  });

  test("context child services default to preview for each formal child object", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const previews = [
      {
        objectType: "design-principle",
        run: () =>
          services.context.createPrinciple(
            {
              principleId: "principle-preview",
              statement: "Favor readable ritual silhouettes"
            },
            { mode: "preview-confirm" }
          ),
        persisted: () => store.designPrinciples.get("principle-preview")
      },
      {
        objectType: "context-motif",
        run: () =>
          services.context.createMotif(
            {
              motifId: "motif-preview",
              motifType: "symbolic-motif",
              statement: "Cracked halo"
            },
            { mode: "preview-confirm" }
          ),
        persisted: () => store.contextMotifs.get("motif-preview")
      },
      {
        objectType: "context-reference",
        run: () =>
          services.context.createReference(
            {
              referenceId: "reference-preview",
              referenceType: "source-document",
              sourceRef: { type: "design-note", id: "note-1" }
            },
            { mode: "preview-confirm" }
          ),
        persisted: () => store.contextReferences.get("reference-preview")
      },
      {
        objectType: "context-review-rubric",
        run: () =>
          services.context.createReviewRubric(
            {
              rubricId: "rubric-preview",
              dimension: "context-consistency",
              question: "Does the result preserve the ritual boundary?"
            },
            { mode: "preview-confirm" }
          ),
        persisted: () => store.contextReviewRubrics.get("rubric-preview")
      }
    ];

    for (const preview of previews) {
      const result = preview.run();
      expect(result.changeSet.status).toBe("preview");
      expect(result.changeSet.objectType).toBe(preview.objectType);
      expect(preview.persisted()).toBeUndefined();
    }
  });

  test("context fact apply paths use change-set application", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const applied = services.context.createFact(
      {
        factId: "fact-apply",
        factType: "custom",
        statement: "Applied through the service boundary"
      },
      { mode: "preview-confirm", apply: true }
    );

    expect(applied.changeSet.status).toBe("applied");
    expect(store.contextFacts.get("fact-apply")?.statement).toBe("Applied through the service boundary");

    const preview = services.context.createFact(
      {
        factId: "fact-mode-apply",
        factType: "custom",
        statement: "Applied from an existing preview change-set"
      },
      { mode: "preview-confirm" }
    );

    const modeApplied = services.context.createFact(
      {
        factId: "unused",
        factType: "custom",
        statement: "unused"
      },
      { mode: "changeset-apply", changeSetId: preview.changeSet.changeSetId }
    );

    expect(modeApplied.changeSet.status).toBe("applied");
    expect(store.contextFacts.get("fact-mode-apply")?.statement).toBe("Applied from an existing preview change-set");
  });
});
