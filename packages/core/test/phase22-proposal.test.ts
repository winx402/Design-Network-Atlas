import { describe, expect, test } from "vitest";
import { createDefaultProposal, ProposalSchema } from "../src/index.js";

describe("Phase 22 proposal core model", () => {
  test("models proposal as a local package of ordered preview change-sets", () => {
    const proposal = createDefaultProposal({
      proposalId: "proposal-modeling",
      title: "Initial icon graph",
      summary: "Review graph root and first node together",
      changeSetIds: ["cs-graph", "cs-node"],
      riskNotes: ["root taxonomy may change"],
      reviewNotes: ["PM reviewed object boundaries"]
    });

    expect(ProposalSchema.parse(proposal)).toMatchObject({
      proposalId: "proposal-modeling",
      title: "Initial icon graph",
      summary: "Review graph root and first node together",
      status: "draft",
      changeSetIds: ["cs-graph", "cs-node"],
      riskNotes: ["root taxonomy may change"],
      reviewNotes: ["PM reviewed object boundaries"]
    });
  });
});
