import { describe, expect, test } from "vitest";
import { createDnaServices, createInMemoryDnaStore } from "@dna/storage";

describe("proposal service workflow", () => {
  test("creates, reviews, and applies ordered preview change-sets", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const graph = services.graph.createGraph(
      { graphId: "graph-proposal", name: "Proposal Graph", purpose: "multi object review" },
      { mode: "preview-confirm" }
    );
    const node = services.lineage.createNode(
      {
        graphId: "graph-proposal",
        nodeId: "node-proposal",
        name: "Proposal Node",
        category: "icon",
        level: "root"
      },
      { mode: "preview-confirm" }
    );

    services.proposal.create({
      proposalId: "proposal-graph-node",
      title: "Graph and root node",
      summary: "Review graph and root species together"
    });
    services.proposal.addChangeSet("proposal-graph-node", graph.changeSet.changeSetId);
    const linked = services.proposal.addChangeSet("proposal-graph-node", node.changeSet.changeSetId);

    expect(linked.changeSetIds).toEqual([graph.changeSet.changeSetId, node.changeSet.changeSetId]);

    const review = services.proposal.review("proposal-graph-node");
    expect(review.status).toBe("ready");
    expect(review.blockers).toEqual([]);
    expect(store.proposals.get("proposal-graph-node")?.status).toBe("ready");

    const applied = services.proposal.apply("proposal-graph-node");

    expect(applied.proposal.status).toBe("applied");
    expect(store.graphs.get("graph-proposal")?.name).toBe("Proposal Graph");
    expect(store.nodes.get("node-proposal")?.name).toBe("Proposal Node");
    expect(store.changeSets.get(graph.changeSet.changeSetId)?.status).toBe("applied");
    expect(store.changeSets.get(node.changeSet.changeSetId)?.status).toBe("applied");
  });

  test("proposal apply fails before mutation when any child change-set is blocked", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);

    const graph = services.graph.createGraph(
      { graphId: "graph-blocked", name: "Blocked Graph", purpose: "should not write" },
      { mode: "preview-confirm" }
    );
    const fact = services.context.createFact(
      { factId: "fact-blocked", factType: "custom", statement: "Blocked child" },
      { mode: "preview-confirm" }
    );

    services.proposal.create({
      proposalId: "proposal-blocked",
      title: "Blocked proposal",
      summary: "One child is discarded before apply"
    });
    services.proposal.addChangeSet("proposal-blocked", graph.changeSet.changeSetId);
    services.proposal.addChangeSet("proposal-blocked", fact.changeSet.changeSetId);
    services.changeSet.discard(fact.changeSet.changeSetId);

    expect(() => services.proposal.apply("proposal-blocked")).toThrow(/blocked proposal child change-set/);

    expect(store.graphs.get("graph-blocked")).toBeUndefined();
    expect(store.contextFacts.get("fact-blocked")).toBeUndefined();
    expect(store.proposals.get("proposal-blocked")?.status).toBe("draft");
  });

  test("discard marks only the proposal and leaves child change-sets reviewable", () => {
    const store = createInMemoryDnaStore();
    const services = createDnaServices(store);
    const fact = services.context.createFact(
      { factId: "fact-discard-proposal", factType: "custom", statement: "Still reviewable" },
      { mode: "preview-confirm" }
    );

    services.proposal.create({
      proposalId: "proposal-discard",
      title: "Discard proposal only",
      summary: "Leave child change-set untouched"
    });
    services.proposal.addChangeSet("proposal-discard", fact.changeSet.changeSetId);

    const discarded = services.proposal.discard("proposal-discard");

    expect(discarded.status).toBe("discarded");
    expect(store.changeSets.get(fact.changeSet.changeSetId)?.status).toBe("preview");
  });
});
