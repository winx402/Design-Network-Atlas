#!/usr/bin/env node
import { Command } from "commander";
import {
  collectImpact,
  compareStyleDistance,
  compileSpecies,
  createDefaultAsset,
  createDefaultEvolutionEdge,
  createDefaultGraph,
  createDefaultNodeVersion,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createDefaultSpeciesNode,
  createGenerationJob,
  makeId,
  nowIso,
  reviewNode
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";
import { installBuiltInTemplatePacks } from "@dna/template-packs";

type CommandOptions = {
  db?: string;
  yes?: boolean;
  mode?: "preview-confirm" | "draft-write" | "changeset-apply";
};

function openStore(command: Command) {
  const options = command.optsWithGlobals<CommandOptions>();
  const dbPath = options.db ?? ".dna/dna.sqlite";
  const store = new SqliteDnaStore(dbPath);
  store.migrate();
  return store;
}

function shouldApply(command: Command) {
  const options = command.optsWithGlobals<CommandOptions>();
  return Boolean(options.yes || options.mode === "draft-write" || options.mode === "changeset-apply");
}

function preview(command: Command, summary: string, payload: unknown) {
  const options = command.optsWithGlobals<CommandOptions>();
  console.log("ChangeSet preview");
  console.log(JSON.stringify({ mode: options.mode ?? "preview-confirm", summary, payload }, null, 2));
  console.log("Re-run with --yes to apply, or use --mode draft-write / --mode changeset-apply.");
}

function parseKeyValue(values: string[] | undefined) {
  const result: Record<string, string> = {};
  for (const value of values ?? []) {
    const [key, ...rest] = value.split("=");
    if (!key || rest.length === 0) throw new Error(`Expected key=value, got ${value}`);
    result[key] = rest.join("=");
  }
  return result;
}

const program = new Command()
  .name("dna")
  .description("DNA: Design Network Atlas local CLI")
  .version("0.1.0")
  .option("--db <path>", "SQLite database path", ".dna/dna.sqlite")
  .option("--yes", "apply write operations without preview stop")
  .option("--mode <mode>", "write mode: preview-confirm, draft-write, changeset-apply", "preview-confirm");

const graph = program.command("graph").description("Manage design genome graphs");
graph
  .command("create")
  .requiredOption("--id <graphId>", "graph id")
  .requiredOption("--name <name>", "graph name")
  .requiredOption("--purpose <purpose>", "graph purpose")
  .option("--status <status>", "graph status", "draft")
  .action((options, command) => {
    const graphValue = createDefaultGraph({
      graphId: options.id,
      name: options.name,
      purpose: options.purpose,
      status: options.status
    });
    if (!shouldApply(command)) return preview(command, `create graph ${graphValue.graphId}`, graphValue);
    const store = openStore(command);
    store.graphs.create(graphValue);
    console.log(`created graph ${graphValue.graphId}`);
    store.close();
  });
graph.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.graphs.list(), null, 2));
  store.close();
});

const template = program.command("template").description("Manage gene templates");
template.command("install-builtins").action((_options, command) => {
  if (!shouldApply(command)) return preview(command, "install built-in template packs", { packs: ["game-art-assets", "ui-icon-assets"] });
  const store = openStore(command);
  installBuiltInTemplatePacks(store);
  console.log("installed built-in template packs");
  store.close();
});
template.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify({ packs: store.templates.listPacks(), templates: store.templates.listTemplates() }, null, 2));
  store.close();
});

const node = program.command("node").description("Manage species nodes");
node
  .command("create")
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--id <nodeId>", "node id")
  .requiredOption("--name <name>", "node name")
  .option("--category <category>", "category", "uncategorized")
  .option("--level <level>", "level", "species")
  .option("--parent <nodeId>", "parent node ids", collect, [])
  .option("--primary-parent <nodeId>", "primary parent")
  .option("--motif <motif>", "visual motif", collect, [])
  .option("--constraint <key=value>", "constraint", collect, [])
  .option("--badcase <badcase>", "badcase", collect, [])
  .action((options, command) => {
    const parentNodes = options.parent as string[];
    const parentRoles = Object.fromEntries(
      parentNodes.map((parentId) => [parentId, parentId === options.primaryParent ? "primary" : "reference"])
    ) as Record<string, "primary" | "fusion" | "reference" | "constraint" | "variant-source">;
    const nodeValue = createDefaultSpeciesNode({
      graphId: options.graph,
      nodeId: options.id,
      name: options.name,
      category: options.category,
      level: options.level,
      parentNodes,
      primaryParent: options.primaryParent,
      parentRoles,
      motifs: options.motif,
      constraints: parseKeyValue(options.constraint),
      badcases: options.badcase
    });
    const version = createDefaultNodeVersion({
      graphId: nodeValue.graphId,
      nodeId: nodeValue.nodeId,
      nodeVersionId: `${nodeValue.nodeId}@${nodeValue.currentVersion}`,
      resolvedGeneSnapshot: { ...nodeValue.constraints, motifs: nodeValue.motifs, badcases: nodeValue.badcases },
      ownGeneDelta: nodeValue.constraints,
      constraintSnapshot: nodeValue.constraints,
      compileSnapshot: nodeValue.compilePolicy ?? { type: "system-rule-first" }
    });
    if (!shouldApply(command)) return preview(command, `create node ${nodeValue.nodeId}`, { node: nodeValue, version });
    const store = openStore(command);
    store.transaction(() => {
      store.nodes.create(nodeValue);
      store.nodeVersions.create(version);
      const graphValue = store.graphs.get(nodeValue.graphId);
      if (graphValue && nodeValue.parentNodes.length === 0 && !graphValue.rootNodes.includes(nodeValue.nodeId)) {
        store.graphs.update({ ...graphValue, rootNodes: [...graphValue.rootNodes, nodeValue.nodeId], updatedAt: nowIso() });
      }
    });
    console.log(`created node ${nodeValue.nodeId}`);
    store.close();
  });
node.command("list").requiredOption("--graph <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.nodes.listByGraph(options.graph), null, 2));
  store.close();
});

const edge = program.command("edge").description("Manage evolution edges");
edge
  .command("create")
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--id <edgeId>", "edge id")
  .requiredOption("--from <nodeId>", "source node")
  .requiredOption("--to <nodeId>", "target node")
  .option("--type <edgeType>", "edge type", "inherit")
  .option("--direction <direction>", "direction", "inherits visual identity")
  .option("--operation <operation>", "operation", "merge")
  .option("--delta <key=value>", "delta gene", collect, [])
  .action((options, command) => {
    const edgeValue = createDefaultEvolutionEdge({
      graphId: options.graph,
      edgeId: options.id,
      fromNodeId: options.from,
      toNodeId: options.to,
      edgeType: options.type,
      direction: options.direction,
      operation: options.operation,
      deltaGenes: parseKeyValue(options.delta)
    });
    if (!shouldApply(command)) return preview(command, `create edge ${edgeValue.edgeId}`, edgeValue);
    const store = openStore(command);
    store.edges.create(edgeValue);
    const toNode = store.nodes.get(edgeValue.toNodeId);
    if (toNode && !toNode.incomingEdges.includes(edgeValue.edgeId)) {
      store.nodes.update({
        ...toNode,
        incomingEdges: [...toNode.incomingEdges, edgeValue.edgeId],
        lineageStatus: toNode.parentNodes.length > 0 ? "complete" : toNode.lineageStatus,
        updatedAt: nowIso()
      });
    }
    console.log(`created edge ${edgeValue.edgeId}`);
    store.close();
  });

const phenotype = program.command("phenotype").description("Generate and manage phenotypes");
phenotype
  .command("generate")
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--node <nodeId>", "node id")
  .requiredOption("--type <phenotypeType>", "phenotype type")
  .requiredOption("--name <name>", "phenotype name")
  .requiredOption("--brief <brief>", "task brief")
  .option("--tool <tool>", "tool", "manual")
  .action((options, command) => {
    const store = openStore(command);
    const graphValue = store.graphs.get(options.graph);
    const nodeValue = store.nodes.get(options.node);
    if (!graphValue || !nodeValue) throw new Error("graph or node not found");
    const parentSnapshots = nodeValue.parentNodes
      .map((parentId) => store.nodeVersions.listByNode(parentId).at(-1))
      .filter((version): version is NonNullable<typeof version> => Boolean(version))
      .map((version) => ({ nodeVersionId: version.nodeVersionId, snapshot: version.resolvedGeneSnapshot }));
    const edgeDeltas = nodeValue.incomingEdges
      .map((edgeId) => store.edges.get(edgeId))
      .filter((edgeValue): edgeValue is NonNullable<typeof edgeValue> => Boolean(edgeValue))
      .map((edgeValue) => ({ edgeVersionId: `${edgeValue.edgeId}@${edgeValue.currentVersion}`, delta: edgeValue.deltaGenes }));
    const compiled = compileSpecies({
      graph: graphValue,
      node: nodeValue,
      parentSnapshots,
      edgeDeltas,
      taskBrief: options.brief,
      phenotypeType: options.type
    });
    const phenotypeId = makeId("ph");
    const phenotypeVersionId = makeId("pv");
    const jobId = makeId("job");
    const phenotypeValue = createDefaultPhenotype({
      graphId: graphValue.graphId,
      nodeId: nodeValue.nodeId,
      phenotypeId,
      name: options.name,
      phenotypeType: options.type,
      objectBrief: options.brief
    });
    const phenotypeVersion = createDefaultPhenotypeVersion({
      graphId: graphValue.graphId,
      nodeId: nodeValue.nodeId,
      phenotypeId,
      phenotypeVersionId,
      nodeVersionId: `${nodeValue.nodeId}@${nodeValue.currentVersion}`,
      edgeVersionTrace: compiled.edgeVersionTrace,
      resolvedGeneSnapshot: compiled.resolvedGeneSnapshot,
      generationRecipe: {
        compilePolicy: compiled.compilePolicy,
        conflicts: compiled.conflicts,
        jobId
      },
      generationBrief: options.brief,
      promptSnapshot: compiled.prompt,
      tool: options.tool
    });
    const job = createGenerationJob({
      generationJobId: jobId,
      graphId: graphValue.graphId,
      nodeId: nodeValue.nodeId,
      phenotypeId,
      phenotypeVersionId,
      phenotypeType: options.type,
      taskBrief: options.brief,
      compilePolicy: graphValue.compilePolicy,
      inputSnapshot: { graph: graphValue.graphId, node: nodeValue.nodeId, brief: options.brief },
      outputSnapshot: { prompt: compiled.prompt, brief: compiled.brief },
      tool: options.tool,
      status: "generated"
    });
    if (!shouldApply(command)) {
      store.close();
      return preview(command, `generate phenotype ${phenotypeId}`, { phenotype: phenotypeValue, phenotypeVersion, job, prompt: compiled.prompt });
    }
    store.transaction(() => {
      store.phenotypes.create(phenotypeValue);
      store.phenotypeVersions.create(phenotypeVersion);
      store.generationJobs.create(job);
    });
    console.log(JSON.stringify({ phenotype: phenotypeValue, phenotypeVersion, prompt: compiled.prompt }, null, 2));
    store.close();
  });

const asset = program.command("asset").description("Manage asset pointers");
asset
  .command("add")
  .requiredOption("--id <assetId>", "asset id")
  .requiredOption("--uri <uri>", "asset uri")
  .requiredOption("--linked-type <type>", "linked object type")
  .requiredOption("--linked-id <id>", "linked object id")
  .option("--tag <tag>", "tag", collect, [])
  .option("--variant-role <role>", "variant role")
  .action((options, command) => {
    const assetValue = createDefaultAsset({
      assetId: options.id,
      uri: options.uri,
      linkedObjectType: options.linkedType,
      linkedObjectId: options.linkedId,
      tags: options.tag,
      variantRole: options.variantRole
    });
    if (!shouldApply(command)) return preview(command, `add asset ${assetValue.assetId}`, assetValue);
    const store = openStore(command);
    store.assets.create(assetValue);
    console.log(`added asset ${assetValue.assetId}`);
    store.close();
  });
asset.command("search").option("--tag <tag>").option("--status <status>").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.assets.search({ tag: options.tag, status: options.status }), null, 2));
  store.close();
});

const review = program.command("review").description("Review nodes and phenotypes");
review.command("node").requiredOption("--node <nodeId>", "node id").option("--required <dimension>", "required dimension", collect, []).action((options, command) => {
  const store = openStore(command);
  const nodeValue = store.nodes.get(options.node);
  if (!nodeValue) throw new Error(`node not found: ${options.node}`);
  console.log(JSON.stringify(reviewNode({ node: nodeValue, requiredDimensions: options.required }), null, 2));
  store.close();
});
program
  .command("compare-style-distance")
  .requiredOption("--left <nodeId>", "left node")
  .requiredOption("--right <nodeId>", "right node")
  .action((options, command) => {
    const store = openStore(command);
    const left = store.nodes.get(options.left);
    const right = store.nodes.get(options.right);
    if (!left || !right) throw new Error("left or right node not found");
    console.log(JSON.stringify(compareStyleDistance({ motifs: left.motifs, constraints: left.constraints }, { motifs: right.motifs, constraints: right.constraints }), null, 2));
    store.close();
  });

const impact = program.command("impact").description("Run impact analysis");
impact.command("check").requiredOption("--graph <graphId>", "graph id").requiredOption("--node <nodeId>", "changed node id").option("--version <versionId>", "changed version id", "latest").action((options, command) => {
  const store = openStore(command);
  const nodes = store.nodes.listByGraph(options.graph).map((nodeValue) => ({
    nodeId: nodeValue.nodeId,
    phenotypeVersionIds: store.phenotypeVersions.listByNode(nodeValue.nodeId).map((version) => version.phenotypeVersionId)
  }));
  const edges = store.edges.listByGraph(options.graph).map((edgeValue) => ({
    edgeId: edgeValue.edgeId,
    fromNodeId: edgeValue.fromNodeId,
    toNodeId: edgeValue.toNodeId
  }));
  console.log(JSON.stringify(collectImpact({ changed: { type: "node", id: options.node, versionId: options.version }, nodes, edges }), null, 2));
  store.close();
});

program.command("export").requiredOption("--out <directory>", "output directory").action((options, command) => {
  const store = openStore(command);
  exportProject(store, options.out);
  console.log(`exported DNA project to ${options.out}`);
  store.close();
});
program.command("import").requiredOption("--in <directory>", "input directory").action((options, command) => {
  if (!shouldApply(command)) return preview(command, `import project from ${options.in}`, { in: options.in });
  const store = openStore(command);
  importProject(store, options.in);
  console.log(`imported DNA project from ${options.in}`);
  store.close();
});

function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}

program.parse();
