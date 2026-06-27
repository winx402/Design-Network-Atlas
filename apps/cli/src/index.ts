#!/usr/bin/env node
import { Command } from "commander";
import {
  collectImpact,
  compareStyleDistance,
  compilePhenotypeGeneration,
  compileSpecies,
  compileSpeciesSnapshot,
  createDefaultAsset,
  createDefaultContextFact,
  createDefaultContextMotif,
  createDefaultContextReference,
  createDefaultContextReviewRubric,
  createDefaultDesignPrinciple,
  createDefaultLibraryRoutingPolicy,
  createDefaultOutputReference,
  createDefaultExternalLibraryMapping,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultStorageMount,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createGenerationJob,
  createImpactRecord,
  createImpactRecords,
  createReviewRecord,
  formatGraphTreeText,
  buildGraphTree,
  makeId,
  MockGenerationProvider,
  OutputReferenceRoleSchema,
  OutputReferenceTypeSchema,
  PROJECT_VERSION,
  resolveLibraryRoutingPolicy,
  runGenerationProvider,
  reviewNode,
  reviewPhenotypeVersion
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";
import { startDnaHttpServer } from "@dna/server";
import { createDnaServices } from "@dna/storage";
import { installBuiltInTemplatePacks } from "@dna/template-packs";

type CommandOptions = {
  db?: string;
  yes?: boolean;
  mode?: "preview-confirm" | "draft-write" | "changeset-apply";
  changeSet?: string;
};

type CliImpactSummary = {
  objectType: "graph" | "node" | "species-group" | "phenotype-version";
  objectId: string;
  reason: string;
  suggestedAction: "review-or-regenerate";
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

function writeOptions(command: Command) {
  const options = command.optsWithGlobals<CommandOptions>();
  return {
    mode: options.mode ?? "preview-confirm",
    apply: Boolean(options.yes),
    changeSetId: options.changeSet
  };
}

function isChangeSetApply(command: Command) {
  return command.optsWithGlobals<CommandOptions>().mode === "changeset-apply";
}

function requiredUnlessChangeSetApply<T>(value: T | undefined, optionName: string, command: Command): T | "" {
  if (value !== undefined) return value;
  if (isChangeSetApply(command)) return "";
  throw new Error(`missing required option: ${optionName}`);
}

function requiredOption<T>(value: T | undefined, optionName: string): T {
  if (value !== undefined) return value;
  throw new Error(`missing required option: ${optionName}`);
}

function preview(command: Command, summary: string, payload: unknown) {
  const options = command.optsWithGlobals<CommandOptions>();
  console.log("ChangeSet preview");
  console.log(JSON.stringify({ mode: options.mode ?? "preview-confirm", summary, payload }, null, 2));
  console.log("Re-run with --yes to apply, or use --mode draft-write / --mode changeset-apply.");
}

function printChangeSet(changeSet: unknown) {
  console.log("ChangeSet preview");
  console.log(JSON.stringify(changeSet, null, 2));
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

function parseTagMappings(values: string[] | undefined) {
  return (values ?? []).map((value) => {
    const [externalTag, ...rest] = value.split("=");
    if (!externalTag || rest.length === 0) throw new Error(`Expected external=normalized, got ${value}`);
    return {
      externalTag,
      normalizedTag: rest.join("="),
      direction: "bidirectional" as const
    };
  });
}

function parseInteger(value: string) {
  if (!/^-?\d+$/.test(value)) throw new Error(`Expected integer, got ${value}`);
  const parsed = Number.parseInt(value, 10);
  return parsed;
}

function parsePort(value: string) {
  const parsed = parseInteger(value);
  if (parsed < 0 || parsed > 65_535) throw new Error(`Expected TCP port 0-65535, got ${value}`);
  return parsed;
}

function resolveOutputReferenceMount(
  store: SqliteDnaStore,
  request: {
    libraryId?: string;
    phenotypeId?: string;
    phenotypeVersionId?: string;
    phenotypeType?: string;
    outputRole?: string;
    referenceType?: string;
    tags?: string[];
  }
) {
  if (!request.libraryId) return undefined;
  const phenotypeType = request.phenotypeType ?? inferPhenotypeType(store, request.phenotypeId, request.phenotypeVersionId);
  const result = resolveLibraryRoutingPolicy({
    policies: store.libraryRoutingPolicies.listByLibrary(request.libraryId),
    mounts: store.storageMounts.listByLibrary(request.libraryId),
    request: {
      libraryId: request.libraryId,
      phenotypeType,
      outputRole: request.outputRole ? OutputReferenceRoleSchema.parse(request.outputRole) : undefined,
      referenceType: request.referenceType ? OutputReferenceTypeSchema.parse(request.referenceType) : undefined,
      tags: request.tags
    }
  });
  return result;
}

function inferPhenotypeType(store: SqliteDnaStore, phenotypeId?: string, phenotypeVersionId?: string) {
  if (phenotypeId) return store.phenotypes.get(phenotypeId)?.phenotypeType;
  if (!phenotypeVersionId) return undefined;
  const version = store.phenotypeVersions.get(phenotypeVersionId);
  if (!version) return undefined;
  return store.phenotypes.get(version.phenotypeId)?.phenotypeType;
}

const program = new Command()
  .name("dna")
  .description("DNA: Design Network Atlas local CLI")
  .version(PROJECT_VERSION)
  .option("--db <path>", "SQLite database path", ".dna/dna.sqlite")
  .option("--yes", "apply write operations without preview stop")
  .option("--mode <mode>", "write mode: preview-confirm, draft-write, changeset-apply", "preview-confirm")
  .option("--change-set <changeSetId>", "existing preview change-set id for --mode changeset-apply")
  .addHelpText(
    "after",
    `
Use \`dna <command> --help\` to inspect command-specific options.

Write modes:
  preview-confirm    create a preview change-set before durable writes
  draft-write        write draft objects directly
  changeset-apply    apply an existing preview change-set with --change-set
`
  );

const graph = program.command("graph").description("Manage design genome graphs");
graph
  .command("create")
  .option("--id <graphId>", "graph id")
  .option("--name <name>", "graph name")
  .option("--purpose <purpose>", "graph purpose")
  .option("--status <status>", "graph status", "draft")
  .option("--template <templateId>", "template id to bind", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.graph.createGraph(
      {
        graphId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        purpose: requiredUnlessChangeSetApply(options.purpose, "--purpose", command),
        status: options.status,
        templateIds: options.template
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created graph ${result.value.graphId}`);
    }
    store.close();
  });
graph.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.graphs.list(), null, 2));
  store.close();
});
graph.command("show").requiredOption("--id <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  const value = store.graphs.get(options.id);
  if (!value) throw new Error(`graph not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});
graph
  .command("tree")
  .requiredOption("--id <graphId>", "graph id")
  .option("--format <format>", "output format: text or json", "text")
  .action((options, command) => {
    const store = openStore(command);
    const value = store.graphs.get(options.id);
    if (!value) throw new Error(`graph not found: ${options.id}`);
    const tree = buildGraphTree({
      graph: value,
      nodes: store.nodes.listByGraph(options.id),
      edges: store.edges.listByGraph(options.id)
    });
    if (options.format === "json") {
      console.log(JSON.stringify(tree, null, 2));
    } else if (options.format === "text") {
      process.stdout.write(formatGraphTreeText(tree));
    } else {
      throw new Error(`unknown graph tree format: ${options.format}`);
    }
    store.close();
  });
graph.command("archive").requiredOption("--id <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  const value = store.graphs.get(options.id);
  if (!value) throw new Error(`graph not found: ${options.id}`);
  if (!shouldApply(command)) {
    store.close();
    return preview(command, `archive graph ${options.id}`, { before: value, after: { ...value, status: "archived" } });
  }
  store.graphs.archive(options.id);
  console.log(`archived graph ${options.id}`);
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
  .option("--graph <graphId>", "graph id")
  .option("--id <nodeId>", "node id")
  .option("--name <name>", "node name")
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
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.lineage.createNode(
      {
        graphId: requiredUnlessChangeSetApply(options.graph, "--graph", command),
        nodeId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        category: options.category,
        level: options.level,
        parentNodes,
        primaryParent: options.primaryParent,
        parentRoles,
        motifs: options.motif,
        constraints: parseKeyValue(options.constraint),
        badcases: options.badcase
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created node ${result.value.node.nodeId}`);
    }
    store.close();
  });
node.command("list").requiredOption("--graph <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.nodes.listByGraph(options.graph), null, 2));
  store.close();
});
node.command("show").requiredOption("--id <nodeId>", "node id").action((options, command) => {
  const store = openStore(command);
  const value = store.nodes.get(options.id);
  if (!value) throw new Error(`node not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});
node.command("versions").requiredOption("--id <nodeId>", "node id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.nodeVersions.listByNode(options.id), null, 2));
  store.close();
});

const edge = program.command("edge").description("Manage evolution edges");
edge
  .command("create")
  .option("--graph <graphId>", "graph id")
  .option("--id <edgeId>", "edge id")
  .option("--from <nodeId>", "source node")
  .option("--to <nodeId>", "target node")
  .option("--type <edgeType>", "edge type", "inherit")
  .option("--direction <direction>", "direction", "inherits visual identity")
  .option("--operation <operation>", "operation", "merge")
  .option("--delta <key=value>", "delta gene", collect, [])
  .option("--value-resolution <key=value>", "value resolution", collect, [])
  .option("--preserve <dimension>", "must preserve dimension or motif", collect, [])
  .option("--avoid <badcase>", "must avoid badcase", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.lineage.createEdge(
      {
        graphId: requiredUnlessChangeSetApply(options.graph, "--graph", command),
        edgeId: requiredUnlessChangeSetApply(options.id, "--id", command),
        fromNodeId: requiredUnlessChangeSetApply(options.from, "--from", command),
        toNodeId: requiredUnlessChangeSetApply(options.to, "--to", command),
        edgeType: options.type,
        direction: options.direction,
        operation: options.operation,
        deltaGenes: parseKeyValue(options.delta),
        valueResolution: parseKeyValue(options.valueResolution),
        mustPreserve: options.preserve,
        mustAvoid: options.avoid
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created edge ${result.value.edge.edgeId}`);
    }
    store.close();
  });
edge.command("list").requiredOption("--graph <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.edges.listByGraph(options.graph), null, 2));
  store.close();
});
edge.command("show").requiredOption("--id <edgeId>", "edge id").action((options, command) => {
  const store = openStore(command);
  const value = store.edges.get(options.id);
  if (!value) throw new Error(`edge not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});

const group = program.command("group").description("Manage graph-local species groups and weak group relations");
group
  .command("create")
  .option("--graph <graphId>", "graph id")
  .option("--id <groupId>", "species group id")
  .option("--name <name>", "species group name")
  .option("--type <groupType>", "group type: domain, family, collection, layer, system", "domain")
  .option("--parent <groupId>", "parent group id", collect, [])
  .option("--template <templateId>", "default template id", collect, [])
  .option("--shared-fact <fact>", "shared fact or motif", collect, [])
  .option("--facet-schema <facetSchemaId>", "referenced facet schema id", collect, [])
  .option("--phenotype-type <phenotypeType>", "phenotype type suggestion", collect, [])
  .option("--owner <owner>", "owner role")
  .option("--status <status>", "group status", "draft")
  .option("--extension <key=value>", "custom extension field", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.group.createGroup(
      {
        graphId: requiredUnlessChangeSetApply(options.graph, "--graph", command),
        groupId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        groupType: options.type,
        parentGroupIds: options.parent,
        templateIds: options.template,
        sharedFacts: options.sharedFact,
        facetSchemaIds: options.facetSchema,
        phenotypeTypeSuggestions: options.phenotypeType,
        owner: options.owner,
        status: options.status,
        extensions: parseKeyValue(options.extension)
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created species group ${result.value.groupId}`);
    }
    store.close();
  });
group.command("list").requiredOption("--graph <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.speciesGroups.listByGraph(options.graph), null, 2));
  store.close();
});

const groupMember = group.command("member").description("Manage species group memberships");
groupMember
  .command("add")
  .option("--id <membershipId>", "membership id")
  .option("--graph <graphId>", "graph id")
  .option("--group <groupId>", "species group id")
  .option("--node <nodeId>", "species node id")
  .option("--role <role>", "membership role: primary, reference, bridge, source, target", "primary")
  .option("--status <status>", "membership status", "active")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.group.addMember(
      {
        membershipId: requiredUnlessChangeSetApply(options.id, "--id", command),
        graphId: requiredUnlessChangeSetApply(options.graph, "--graph", command),
        groupId: requiredUnlessChangeSetApply(options.group, "--group", command),
        nodeId: requiredUnlessChangeSetApply(options.node, "--node", command),
        role: options.role,
        status: options.status
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`added node ${result.value.nodeId} to species group ${result.value.groupId}`);
    }
    store.close();
  });

const groupRelation = group.command("relation").description("Manage weak relations between species groups");
groupRelation
  .command("add")
  .option("--id <relationId>", "relation id")
  .option("--graph <graphId>", "graph id")
  .option("--source <groupId>", "source species group id")
  .option("--target <groupId>", "target species group id")
  .option("--type <relationType>", "relation type, including custom:<name>", "references")
  .option("--description <description>", "relation description", "")
  .option("--status <status>", "relation status", "draft")
  .option("--extension <key=value>", "custom extension field", collect, [])
  .option("--allow-parallel", "allow a second relation for the same source and target when the semantics are independent")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.group.createRelation(
      {
        relationId: requiredUnlessChangeSetApply(options.id, "--id", command),
        graphId: requiredUnlessChangeSetApply(options.graph, "--graph", command),
        sourceGroupId: requiredUnlessChangeSetApply(options.source, "--source", command),
        targetGroupId: requiredUnlessChangeSetApply(options.target, "--target", command),
        relationType: options.type,
        description: options.description,
        status: options.status,
        extensions: parseKeyValue(options.extension),
        allowParallel: Boolean(options.allowParallel)
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created species group relation ${result.value.relationId}`);
    }
    store.close();
  });

group
  .command("map")
  .requiredOption("--graph <graphId>", "graph id")
  .option("--format <format>", "output format: text or json", "text")
  .action((options, command) => {
    const store = openStore(command);
    const graphValue = store.graphs.get(options.graph);
    if (!graphValue) throw new Error(`graph not found: ${options.graph}`);
    const groupMap = {
      graph: graphValue,
      groups: store.speciesGroups.listByGraph(options.graph),
      memberships: store.speciesGroupMemberships.listByGraph(options.graph),
      relations: store.speciesGroupRelations.listByGraph(options.graph)
    };
    if (options.format === "json") {
      console.log(JSON.stringify(groupMap, null, 2));
    } else if (options.format === "text") {
      process.stdout.write(formatGroupMapText(groupMap));
    } else {
      throw new Error(`unknown group map format: ${options.format}`);
    }
    store.close();
  });

const atlas = program.command("atlas").description("Manage multi-graph atlases and graph bridges");
atlas
  .command("create")
  .option("--id <atlasId>", "atlas id")
  .option("--name <name>", "atlas name")
  .option("--purpose <purpose>", "atlas purpose")
  .option("--graph <graphId>", "graph id managed by this atlas", collect, [])
  .option("--status <status>", "atlas status", "draft")
  .option("--metadata <key=value>", "atlas metadata", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.atlas.createAtlas(
      {
        atlasId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        purpose: requiredUnlessChangeSetApply(options.purpose, "--purpose", command),
        graphIds: options.graph,
        status: options.status,
        metadata: parseKeyValue(options.metadata)
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created atlas ${result.value.atlasId}`);
    }
    store.close();
  });
atlas.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.atlases.list(), null, 2));
  store.close();
});
atlas.command("show").requiredOption("--id <atlasId>", "atlas id").action((options, command) => {
  const store = openStore(command);
  const value = store.atlases.get(options.id);
  if (!value) throw new Error(`atlas not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});
atlas
  .command("add-graph")
  .requiredOption("--id <atlasId>", "atlas id")
  .requiredOption("--graph <graphId>", "graph id")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.atlas.addGraph({ atlasId: options.id, graphId: options.graph }, writeOptions(command));
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`added graph ${options.graph} to atlas ${options.id}`);
    }
    store.close();
  });

const atlasBridge = atlas.command("bridge").description("Manage graph bridges in an atlas");
atlasBridge
  .command("add")
  .option("--id <bridgeId>", "bridge id")
  .option("--atlas <atlasId>", "atlas id")
  .option("--source <graphId>", "source graph id")
  .option("--target <graphId>", "target graph id")
  .option("--type <bridgeType>", "bridge type, including custom:<name>", "references-species")
  .option("--description <description>", "bridge description", "")
  .option("--status <status>", "bridge status", "draft")
  .option("--extension <key=value>", "custom extension field", collect, [])
  .option("--allow-parallel", "allow a second bridge for the same source and target when the semantics are independent")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.atlas.createBridge(
      {
        bridgeId: requiredUnlessChangeSetApply(options.id, "--id", command),
        atlasId: requiredUnlessChangeSetApply(options.atlas, "--atlas", command),
        sourceGraphId: requiredUnlessChangeSetApply(options.source, "--source", command),
        targetGraphId: requiredUnlessChangeSetApply(options.target, "--target", command),
        bridgeType: options.type,
        description: options.description,
        status: options.status,
        extensions: parseKeyValue(options.extension),
        allowParallel: Boolean(options.allowParallel)
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created graph bridge ${result.value.bridgeId}`);
    }
    store.close();
  });

atlas
  .command("map")
  .requiredOption("--id <atlasId>", "atlas id")
  .option("--format <format>", "output format: text or json", "text")
  .action((options, command) => {
    const store = openStore(command);
    const atlasValue = store.atlases.get(options.id);
    if (!atlasValue) throw new Error(`atlas not found: ${options.id}`);
    const atlasMap = {
      atlas: atlasValue,
      graphs: atlasValue.graphIds.map((graphId) => store.graphs.get(graphId)).filter(Boolean),
      bridges: store.graphBridges.listByAtlas(options.id)
    };
    if (options.format === "json") {
      console.log(JSON.stringify(atlasMap, null, 2));
    } else if (options.format === "text") {
      process.stdout.write(formatAtlasMapText(atlasMap));
    } else {
      throw new Error(`unknown atlas map format: ${options.format}`);
    }
    store.close();
  });

const context = program.command("context").description("Manage design context, facts, principles, motifs, references, and review rubrics");
context
  .command("create")
  .option("--id <contextId>", "design context id")
  .option("--name <name>", "design context name")
  .option("--type <contextType>", "context type", "worldview")
  .option("--summary <summary>", "context summary", "")
  .option("--status <status>", "context status", "draft")
  .option("--fact <factId>", "linked context fact id", collect, [])
  .option("--principle <principleId>", "linked design principle id", collect, [])
  .option("--motif <motifId>", "linked context motif id", collect, [])
  .option("--reference <referenceId>", "linked context reference id", collect, [])
  .option("--rubric <rubricId>", "linked review rubric id", collect, [])
  .option("--negative-boundary <boundary>", "negative boundary", collect, [])
  .option("--source-ref <sourceRef>", "source reference", collect, [])
  .option("--confidence <confidence>", "confirmed, inferred, or draft", "draft")
  .option("--owner <owner>", "owner role")
  .option("--version <version>", "context version", "1.0.0")
  .option("--extension <key=value>", "custom extension field", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.context.createContext(
      {
        contextId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        contextType: options.type,
        summary: options.summary,
        status: options.status,
        factIds: options.fact,
        principleIds: options.principle,
        motifIds: options.motif,
        referenceIds: options.reference,
        reviewRubricIds: options.rubric,
        negativeBoundaries: options.negativeBoundary,
        sourceRefs: options.sourceRef,
        confidence: options.confidence,
        owner: options.owner,
        version: options.version,
        extensions: parseKeyValue(options.extension)
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created design context ${result.value.contextId}`);
    }
    store.close();
  });

context.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.designContexts.list(), null, 2));
  store.close();
});

context.command("show").requiredOption("--id <contextId>", "design context id").action((options, command) => {
  const store = openStore(command);
  const value = store.designContexts.get(options.id);
  if (!value) throw new Error(`design context not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});

const contextFact = context.command("fact").description("Manage structured context facts");
contextFact
  .command("add")
  .requiredOption("--id <factId>", "fact id")
  .requiredOption("--type <factType>", "fact type")
  .requiredOption("--statement <statement>", "fact statement")
  .option("--scope <scopeHint>", "scope hint", "")
  .option("--strength <strength>", "hard, soft, or reference", "reference")
  .option("--behavior <behavior>", "include, weaken, translate, exclude, or reference-only", "reference-only")
  .option("--source <sourceTrace>", "source trace", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const value = createDefaultContextFact({
      factId: options.id,
      factType: options.type,
      statement: options.statement,
      scopeHint: options.scope,
      defaultStrength: options.strength,
      defaultBehaviorHint: options.behavior,
      sourceTrace: options.source
    });
    store.contextFacts.create(value);
    console.log(`created context fact ${value.factId}`);
    store.close();
  });

const contextPrinciple = context.command("principle").description("Manage design principles");
contextPrinciple
  .command("add")
  .requiredOption("--id <principleId>", "principle id")
  .requiredOption("--statement <statement>", "principle statement")
  .option("--priority <priority>", "must, should, or may", "should")
  .option("--scope <scopeHint>", "scope hint", "")
  .option("--behavior <behavior>", "default behavior hint", "reference-only")
  .option("--experience-intent <intent>", "experience intent", "")
  .option("--readability-goal <goal>", "readability goal", "")
  .option("--platform-context <context>", "platform context", "")
  .option("--review-question <question>", "review question", collect, [])
  .option("--badcase <badcase>", "badcase", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const value = createDefaultDesignPrinciple({
      principleId: options.id,
      statement: options.statement,
      priority: options.priority,
      scopeHint: options.scope,
      defaultBehaviorHint: options.behavior,
      experienceIntent: options.experienceIntent,
      readabilityGoal: options.readabilityGoal,
      platformContext: options.platformContext,
      reviewQuestions: options.reviewQuestion,
      badcases: options.badcase
    });
    store.designPrinciples.create(value);
    console.log(`created design principle ${value.principleId}`);
    store.close();
  });

const contextMotif = context.command("motif").description("Manage context motifs");
contextMotif
  .command("add")
  .requiredOption("--id <motifId>", "motif id")
  .requiredOption("--type <motifType>", "motif type")
  .requiredOption("--statement <statement>", "motif statement")
  .option("--source-ref <sourceRef>", "source reference")
  .option("--visual-motif-ref <visualMotifRef>", "visual motif reference")
  .option("--note <note>", "note", "")
  .action((options, command) => {
    const store = openStore(command);
    const value = createDefaultContextMotif({
      motifId: options.id,
      motifType: options.type,
      statement: options.statement,
      sourceRef: options.sourceRef,
      visualMotifRef: options.visualMotifRef,
      note: options.note
    });
    store.contextMotifs.create(value);
    console.log(`created context motif ${value.motifId}`);
    store.close();
  });

const contextReference = context.command("reference").description("Manage context references");
contextReference
  .command("add")
  .requiredOption("--id <referenceId>", "reference id")
  .requiredOption("--type <referenceType>", "reference type")
  .requiredOption("--source-type <sourceType>", "source reference type")
  .requiredOption("--source-id <sourceId>", "source reference id")
  .option("--role <referenceRole>", "positive, negative, mood, evidence, or decision", "evidence")
  .option("--use-for <value>", "what this reference is safe to use for", collect, [])
  .option("--do-not-use-for <value>", "what this reference must not be used for", collect, [])
  .option("--note <note>", "note", "")
  .option("--risk <risk>", "risk note", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const value = createDefaultContextReference({
      referenceId: options.id,
      referenceType: options.type,
      sourceRef: { type: options.sourceType, id: options.sourceId },
      referenceRole: options.role,
      useFor: options.useFor,
      doNotUseFor: options.doNotUseFor,
      note: options.note,
      risk: options.risk
    });
    store.contextReferences.create(value);
    console.log(`created context reference ${value.referenceId}`);
    store.close();
  });

const contextRubric = context.command("rubric").description("Manage context review rubrics");
contextRubric
  .command("add")
  .requiredOption("--id <rubricId>", "rubric id")
  .requiredOption("--dimension <dimension>", "review dimension")
  .requiredOption("--question <question>", "review question")
  .option("--pass-signal <signal>", "pass signal", "")
  .option("--fail-signal <signal>", "fail signal", "")
  .option("--severity <severity>", "info, warning, or blocking", "info")
  .action((options, command) => {
    const store = openStore(command);
    const value = createDefaultContextReviewRubric({
      rubricId: options.id,
      dimension: options.dimension,
      question: options.question,
      passSignal: options.passSignal,
      failSignal: options.failSignal,
      severity: options.severity
    });
    store.contextReviewRubrics.create(value);
    console.log(`created context review rubric ${value.rubricId}`);
    store.close();
  });

context
  .command("attach")
  .option("--id <attachmentId>", "attachment id")
  .option("--context <contextId>", "design context id")
  .option("--target-type <targetType>", "target type")
  .option("--target <targetId>", "target id")
  .option("--role <role>", "foundation, reference, constraint, rationale, or review-source", "reference")
  .option("--strength <strength>", "hard, soft, or reference", "reference")
  .option("--inheritance <inheritance>", "none, downstream, children, graph, or atlas", "none")
  .option("--compile-layer <compileLayer>", "context compile layer", "node-context")
  .option("--status <status>", "attachment status", "draft")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.context.attachContext(
      {
        attachmentId: requiredUnlessChangeSetApply(options.id, "--id", command),
        contextId: requiredUnlessChangeSetApply(options.context, "--context", command),
        targetType: requiredUnlessChangeSetApply(options.targetType, "--target-type", command),
        targetId: requiredUnlessChangeSetApply(options.target, "--target", command),
        role: options.role,
        strength: options.strength,
        inheritance: options.inheritance,
        compileLayer: options.compileLayer,
        status: options.status
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`attached design context ${result.value.contextId} to ${result.value.targetType} ${result.value.targetId}`);
    }
    store.close();
  });

context
  .command("map")
  .requiredOption("--id <contextId>", "design context id")
  .option("--format <format>", "output format: text or json", "text")
  .action((options, command) => {
    const store = openStore(command);
    const contextValue = store.designContexts.get(options.id);
    if (!contextValue) throw new Error(`design context not found: ${options.id}`);
    const contextMap = {
      context: contextValue,
      facts: contextValue.factIds.map((id) => store.contextFacts.get(id)).filter(Boolean),
      principles: contextValue.principleIds.map((id) => store.designPrinciples.get(id)).filter(Boolean),
      motifs: contextValue.motifIds.map((id) => store.contextMotifs.get(id)).filter(Boolean),
      references: contextValue.referenceIds.map((id) => store.contextReferences.get(id)).filter(Boolean),
      rubrics: contextValue.reviewRubricIds.map((id) => store.contextReviewRubrics.get(id)).filter(Boolean),
      attachments: store.contextAttachments.listByContext(options.id),
      policies: store.contextPolicies.listByContext(options.id)
    };
    if (options.format === "json") {
      console.log(JSON.stringify(contextMap, null, 2));
    } else if (options.format === "text") {
      process.stdout.write(formatContextMapText(contextMap));
    } else {
      throw new Error(`unknown context map format: ${options.format}`);
    }
    store.close();
  });

const compile = program.command("compile").description("Create and inspect compile artifacts");
const compileSpeciesCommand = compile.command("species").description("Compile or inspect a stable species gene snapshot artifact");
compileSpeciesCommand
  .argument("[action]", "optional action: show")
  .option("--graph <graphId>", "graph id")
  .option("--node <nodeId>", "species node id")
  .option("--id <artifactId>", "species compile artifact id")
  .action((action, options, command) => {
    const store = openStore(command);
    if (action === "show") {
      const artifactId = requiredOption(options.id, "--id");
      const artifact = store.speciesCompileArtifacts.get(artifactId);
      if (!artifact) {
        store.close();
        throw new Error(`species compile artifact not found: ${artifactId}`);
      }
      console.log(JSON.stringify(artifact, null, 2));
      store.close();
      return;
    }
    if (action) {
      store.close();
      throw new Error(`unknown compile species action: ${action}`);
    }
    if (!options.graph || !options.node) throw new Error("--graph and --node are required");
    const artifact = compileSpeciesSnapshot({
      artifactId: options.id ?? makeId("sca"),
      ...buildSpeciesCompileInputForCli(store, options.graph, options.node)
    });
    if (!shouldApply(command)) {
      store.close();
      return preview(command, `compile species ${artifact.speciesNodeId}`, artifact);
    }
    store.speciesCompileArtifacts.create(artifact);
    console.log(JSON.stringify(artifact, null, 2));
    store.close();
  });

const compilePhenotypeCommand = compile.command("phenotype").description("Compile or inspect a phenotype generation artifact");
compilePhenotypeCommand
  .argument("[action]", "optional action: show")
  .option("--graph <graphId>", "graph id")
  .option("--node <nodeId>", "species node id")
  .option("--type <phenotypeType>", "phenotype type")
  .option("--brief <taskBrief>", "task brief")
  .option("--id <artifactId>", "phenotype compile artifact id")
  .option("--species-artifact <artifactId>", "species compile artifact id")
  .option("--reference <referenceId>", "context reference id", collect, [])
  .option("--rubric <rubricId>", "context review rubric id", collect, [])
  .action((action, options, command) => {
    const store = openStore(command);
    if (action === "show") {
      const artifactId = requiredOption(options.id, "--id");
      const artifact = store.phenotypeCompileArtifacts.get(artifactId);
      if (!artifact) {
        store.close();
        throw new Error(`phenotype compile artifact not found: ${artifactId}`);
      }
      console.log(JSON.stringify(artifact, null, 2));
      store.close();
      return;
    }
    if (action) {
      store.close();
      throw new Error(`unknown compile phenotype action: ${action}`);
    }
    if (!options.graph || !options.node || !options.type || !options.brief) {
      throw new Error("--graph, --node, --type, and --brief are required");
    }
    const { graph, node, nodeVersionId, contextReferences, contextReviewRubrics } = buildSpeciesCompileInputForCli(
      store,
      options.graph,
      options.node
    );
    const speciesArtifact =
      (options.speciesArtifact ? store.speciesCompileArtifacts.get(options.speciesArtifact) : undefined) ??
      store.speciesCompileArtifacts.listByNode(options.node).at(-1);
    if (options.speciesArtifact && !speciesArtifact) {
      store.close();
      throw new Error(`species compile artifact not found: ${options.speciesArtifact}`);
    }
    const selectedReferences = options.reference.length
      ? options.reference.map((referenceId: string) => {
          const reference = store.contextReferences.get(referenceId);
          if (!reference) throw new Error(`context reference not found: ${referenceId}`);
          return reference;
        })
      : contextReferences;
    const selectedRubrics = options.rubric.length
      ? options.rubric.map((rubricId: string) => {
          const rubric = store.contextReviewRubrics.get(rubricId);
          if (!rubric) throw new Error(`context review rubric not found: ${rubricId}`);
          return rubric;
        })
      : contextReviewRubrics;
    const artifact = compilePhenotypeGeneration({
      artifactId: options.id ?? makeId("pca"),
      graph,
      node,
      nodeVersionId,
      phenotypeType: options.type,
      taskBrief: options.brief,
      speciesArtifact,
      contextReferences: selectedReferences,
      contextReviewRubrics: selectedRubrics
    });
    if (!shouldApply(command)) {
      store.close();
      return preview(command, `compile phenotype ${artifact.speciesNodeId} ${artifact.phenotypeType}`, artifact);
    }
    store.phenotypeCompileArtifacts.create(artifact);
    console.log(JSON.stringify(artifact, null, 2));
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
  .option("--phenotype-id <phenotypeId>", "existing or explicit phenotype id")
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
    const phenotypeId = options.phenotypeId ?? makeId("ph");
    const existingPhenotype = options.phenotypeId ? store.phenotypes.get(options.phenotypeId) : undefined;
    if (existingPhenotype && (existingPhenotype.nodeId !== nodeValue.nodeId || existingPhenotype.phenotypeType !== options.type)) {
      store.close();
      throw new Error(`phenotype ${options.phenotypeId} belongs to a different node or type`);
    }
    const phenotypeVersionId = makeId("pv");
    const jobId = makeId("job");
    const phenotypeValue =
      existingPhenotype ??
      createDefaultPhenotype({
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
      if (!existingPhenotype) store.phenotypes.create(phenotypeValue);
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
asset
  .command("search")
  .option("--graph <graphId>", "graph id")
  .option("--linked-id <objectId>", "linked object id")
  .option("--node <nodeId>", "node id")
  .option("--phenotype-type <phenotypeType>", "phenotype type")
  .option("--tag <tag>")
  .option("--status <status>")
  .action((options, command) => {
    const store = openStore(command);
    let results = store.assets.search({
      graphId: options.graph,
      linkedObjectId: options.linkedId,
      tag: options.tag,
      status: options.status
    });
    if (options.node || options.phenotypeType) {
      results = results.filter((assetValue) => {
        const context = resolveAssetContext(store, assetValue.linkedObjectType, assetValue.linkedObjectId);
        if (options.node && context.nodeId !== options.node) return false;
        if (options.phenotypeType && context.phenotypeType !== options.phenotypeType) return false;
        return true;
      });
    }
    console.log(JSON.stringify(results, null, 2));
    store.close();
  });

const library = program.command("library").description("Manage phenotype libraries and external storage adapters");
library
  .command("create")
  .requiredOption("--id <libraryId>", "library id")
  .requiredOption("--name <name>", "library name")
  .requiredOption("--purpose <purpose>", "library purpose")
  .option("--profile <profile>", "library profile", "media-asset")
  .option("--accepted-reference <type>", "accepted output reference type", collect, [])
  .option("--tag <tag>", "library tag", collect, [])
  .action((options, command) => {
    const libraryValue = createDefaultPhenotypeLibrary({
      libraryId: options.id,
      name: options.name,
      purpose: options.purpose,
      profile: options.profile,
      acceptedReferenceTypes: options.acceptedReference,
      tags: options.tag
    });
    if (!shouldApply(command)) return preview(command, `create phenotype library ${libraryValue.libraryId}`, libraryValue);
    const store = openStore(command);
    store.phenotypeLibraries.create(libraryValue);
    console.log(`created phenotype library ${libraryValue.libraryId}`);
    store.close();
  });
library
  .command("bind-graph")
  .requiredOption("--id <bindingId>", "binding id")
  .requiredOption("--library <libraryId>", "library id")
  .requiredOption("--graph <graphId>", "graph id")
  .option("--role <role>", "binding role", "primary-library")
  .option("--sync <key=value>", "sync policy field", collect, [])
  .action((options, command) => {
    const binding = createDefaultPhenotypeLibraryGraphBinding({
      bindingId: options.id,
      libraryId: options.library,
      graphId: options.graph,
      role: options.role,
      syncPolicy: parseKeyValue(options.sync)
    });
    if (!shouldApply(command)) return preview(command, `bind library ${binding.libraryId} to graph ${binding.graphId}`, binding);
    const store = openStore(command);
    store.phenotypeLibraryGraphBindings.create(binding);
    console.log(`bound phenotype library ${binding.libraryId} to graph ${binding.graphId}`);
    store.close();
  });
library.command("list").action((_options, command) => {
  const store = openStore(command);
  const libraries = store.phenotypeLibraries.list().map((libraryValue) => ({
    library: libraryValue,
    bindings: store.phenotypeLibraryGraphBindings.listByLibrary(libraryValue.libraryId),
    storageMounts: store.storageMounts.listByLibrary(libraryValue.libraryId),
    externalMappings: store.externalLibraryMappings.listByLibrary(libraryValue.libraryId)
  }));
  console.log(JSON.stringify(libraries, null, 2));
  store.close();
});

const libraryMount = library.command("mount").description("Manage phenotype library storage mounts");
libraryMount
  .command("add")
  .requiredOption("--id <mountId>", "mount id")
  .requiredOption("--library <libraryId>", "library id")
  .requiredOption("--storage-type <storageType>", "storage type")
  .requiredOption("--adapter-kind <adapterKind>", "adapter kind")
  .requiredOption("--name <name>", "display name")
  .requiredOption("--location <location>", "storage location")
  .option("--capability <capability>", "adapter capability", collect, [])
  .option("--metadata <key=value>", "metadata field", collect, [])
  .action((options, command) => {
    const mount = createDefaultStorageMount({
      mountId: options.id,
      libraryId: options.library,
      storageType: options.storageType,
      adapterKind: options.adapterKind,
      displayName: options.name,
      location: options.location,
      capabilities: options.capability,
      metadata: parseKeyValue(options.metadata)
    });
    if (!shouldApply(command)) return preview(command, `add storage mount ${mount.mountId}`, mount);
    const store = openStore(command);
    store.storageMounts.create(mount);
    console.log(`added storage mount ${mount.mountId}`);
    store.close();
  });

const libraryMapping = library.command("mapping").description("Manage external library metadata mappings");
libraryMapping
  .command("add")
  .requiredOption("--id <mappingId>", "mapping id")
  .requiredOption("--library <libraryId>", "library id")
  .requiredOption("--mount <mountId>", "mount id")
  .requiredOption("--adapter <adapterId>", "adapter id")
  .option("--sync-mode <mode>", "sync mode", "pointer-only")
  .option("--conflict-policy <policy>", "conflict policy", "manual-review")
  .option("--tag-map <external=normalized>", "tag mapping", collect, [])
  .option("--field-map <external=target>", "field mapping", collect, [])
  .action((options, command) => {
    const mapping = createDefaultExternalLibraryMapping({
      mappingId: options.id,
      libraryId: options.library,
      mountId: options.mount,
      adapterId: options.adapter,
      syncMode: options.syncMode,
      conflictPolicy: options.conflictPolicy,
      tagMappings: parseTagMappings(options.tagMap),
      fieldMappings: parseKeyValue(options.fieldMap)
    });
    if (!shouldApply(command)) return preview(command, `add external library mapping ${mapping.mappingId}`, mapping);
    const store = openStore(command);
    store.externalLibraryMappings.create(mapping);
    console.log(`added external library mapping ${mapping.mappingId}`);
    store.close();
  });

const libraryRouting = library.command("routing").description("Manage output routing policies for a phenotype library");
libraryRouting
  .command("add")
  .requiredOption("--id <routingPolicyId>", "routing policy id")
  .requiredOption("--library <libraryId>", "library id")
  .requiredOption("--name <name>", "routing policy name")
  .requiredOption("--target-mount <mountId>", "target storage mount id")
  .option("--priority <number>", "routing priority", parseInteger, 0)
  .option("--phenotype-type <phenotypeType>", "phenotype/result type to match")
  .option("--role <role>", "output role to match")
  .option("--reference-type <referenceType>", "output reference type to match")
  .option("--tag <tag>", "required output tag", collect, [])
  .option("--fallback-mount <mountId>", "fallback storage mount id")
  .option("--sync-mode <mode>", "sync mode", "pointer-only")
  .option("--required-metadata <key>", "required metadata key", collect, [])
  .option("--metadata-default <key=value>", "default metadata field", collect, [])
  .action((options, command) => {
    const policy = createDefaultLibraryRoutingPolicy({
      routingPolicyId: options.id,
      libraryId: options.library,
      name: options.name,
      priority: options.priority,
      match: {
        phenotypeType: options.phenotypeType,
        outputRole: options.role,
        referenceType: options.referenceType,
        tags: options.tag
      },
      targetMountId: options.targetMount,
      fallbackMountId: options.fallbackMount,
      syncMode: options.syncMode,
      requiredMetadata: options.requiredMetadata,
      metadataDefaults: parseKeyValue(options.metadataDefault)
    });
    if (!shouldApply(command)) return preview(command, `add library routing policy ${policy.routingPolicyId}`, policy);
    const store = openStore(command);
    store.libraryRoutingPolicies.create(policy);
    console.log(`added library routing policy ${policy.routingPolicyId}`);
    store.close();
  });
libraryRouting.command("list").requiredOption("--library <libraryId>", "library id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.libraryRoutingPolicies.listByLibrary(options.library), null, 2));
  store.close();
});

const outputRef = program.command("output-ref").description("Manage phenotype output references");
outputRef
  .command("add")
  .requiredOption("--id <outputReferenceId>", "output reference id")
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--phenotype-version <phenotypeVersionId>", "phenotype version id")
  .requiredOption("--uri <uri>", "output uri")
  .requiredOption("--type <referenceType>", "reference type")
  .requiredOption("--role <role>", "reference role")
  .option("--phenotype <phenotypeId>", "phenotype id")
  .option("--phenotype-type <phenotypeType>", "phenotype/result type for routing")
  .option("--library <libraryId>", "phenotype library id")
  .option("--storage-mount <mountId>", "storage mount id")
  .option("--external-id <externalId>", "external object id")
  .option("--tag <tag>", "raw or source tag", collect, [])
  .option("--normalized-tag <tag>", "normalized search tag", collect, [])
  .option("--metadata <key=value>", "metadata field", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const routingResult = options.storageMount ? undefined : resolveOutputReferenceMount(store, {
      libraryId: options.library,
      phenotypeId: options.phenotype,
      phenotypeVersionId: options.phenotypeVersion,
      phenotypeType: options.phenotypeType,
      outputRole: options.role,
      referenceType: options.type,
      tags: options.tag
    });
    const metadata = { ...(routingResult?.metadataDefaults ?? {}), ...parseKeyValue(options.metadata) };
    const missingMetadata = (routingResult?.requiredMetadata ?? []).filter((key) => metadata[key] === undefined);
    if (missingMetadata.length) {
      store.close();
      throw new Error(`missing required routing metadata: ${missingMetadata.join(", ")}`);
    }
    const reference = createDefaultOutputReference({
      outputReferenceId: options.id,
      graphId: options.graph,
      phenotypeId: options.phenotype,
      phenotypeVersionId: options.phenotypeVersion,
      libraryId: options.library,
      storageMountId: options.storageMount ?? routingResult?.targetMountId,
      externalId: options.externalId,
      uri: options.uri,
      referenceType: options.type,
      role: options.role,
      tags: options.tag,
      normalizedTags: options.normalizedTag,
      metadata
    });
    if (!shouldApply(command)) {
      store.close();
      return preview(command, `add output reference ${reference.outputReferenceId}`, reference);
    }
    store.outputReferences.create(reference);
    console.log(`added output reference ${reference.outputReferenceId}`);
    store.close();
  });
outputRef
  .command("search")
  .option("--graph <graphId>", "graph id")
  .option("--phenotype-version <phenotypeVersionId>", "phenotype version id")
  .option("--library <libraryId>", "phenotype library id")
  .option("--tag <tag>", "raw or normalized tag")
  .option("--status <status>", "reference status")
  .action((options, command) => {
    const store = openStore(command);
    console.log(
      JSON.stringify(
        store.outputReferences.search({
          graphId: options.graph,
          phenotypeVersionId: options.phenotypeVersion,
          libraryId: options.library,
          tag: options.tag,
          status: options.status
        }),
        null,
        2
      )
    );
    store.close();
  });

const review = program.command("review").description("Review nodes and phenotypes");
review.command("node").requiredOption("--node <nodeId>", "node id").option("--required <dimension>", "required dimension", collect, []).action((options, command) => {
  const store = openStore(command);
  const nodeValue = store.nodes.get(options.node);
  if (!nodeValue) throw new Error(`node not found: ${options.node}`);
  const result = reviewNode({ node: nodeValue, requiredDimensions: options.required });
  if (shouldApply(command)) {
    const record = createReviewRecord({
      reviewRecordId: makeId("review"),
      graphId: nodeValue.graphId,
      objectType: "node",
      objectId: nodeValue.nodeId,
      status: result.status,
      missingDimensions: result.missingDimensions,
      constraintViolations: result.constraintViolations,
      suggestedActions: result.suggestedActions,
      inputSnapshot: { requiredDimensions: options.required },
      confirmedByHuman: true
    });
    store.reviews.create(record);
    console.log(JSON.stringify({ review: result, reviewRecord: record }, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  store.close();
});
review
  .command("phenotype")
  .requiredOption("--phenotype-version <phenotypeVersionId>", "phenotype version id")
  .option("--required-motif <motif>", "required motif", collect, [])
  .option("--required-constraint <key=value>", "required constraint", collect, [])
  .option("--forbidden-text <text>", "forbidden prompt or brief text", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const version = store.phenotypeVersions.get(options.phenotypeVersion);
    if (!version) throw new Error(`phenotype version not found: ${options.phenotypeVersion}`);
    const requiredConstraints = parseKeyValue(options.requiredConstraint);
    const result = reviewPhenotypeVersion({
      version,
      requiredMotifs: options.requiredMotif,
      requiredConstraints,
      forbiddenText: options.forbiddenText
    });
    if (shouldApply(command)) {
      const record = createReviewRecord({
        reviewRecordId: makeId("review"),
        graphId: version.graphId,
        objectType: "phenotype-version",
        objectId: version.phenotypeVersionId,
        status: result.status,
        missingDimensions: result.missingDimensions,
        constraintViolations: result.constraintViolations,
        suggestedActions: result.suggestedActions,
        inputSnapshot: {
          requiredMotifs: options.requiredMotif,
          requiredConstraints,
          forbiddenText: options.forbiddenText
        },
        confirmedByHuman: true
      });
      store.reviews.create(record);
      console.log(JSON.stringify({ review: result, reviewRecord: record }, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    store.close();
  });
review.command("list").requiredOption("--type <objectType>", "object type").requiredOption("--id <objectId>", "object id").action((options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.reviews.listByObject(options.type, options.id), null, 2));
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
impact
  .command("check")
  .requiredOption("--graph <graphId>", "graph id")
  .option("--node <nodeId>", "changed node id")
  .option("--edge <edgeId>", "changed edge id")
  .option("--group <groupId>", "changed species group id")
  .option("--bridge <bridgeId>", "changed graph bridge id")
  .option("--context <contextId>", "changed design context id")
  .option("--changed-version <versionId>", "changed version id", "latest")
  .action((options, command) => {
  const store = openStore(command);
  const selected = [options.node, options.edge, options.group, options.bridge, options.context].filter(Boolean);
  if (selected.length !== 1) {
    store.close();
    throw new Error("Provide exactly one of --node, --edge, --group, --bridge, or --context");
  }
  const nodes = store.nodes.listByGraph(options.graph).map((nodeValue) => ({
    nodeId: nodeValue.nodeId,
    phenotypeVersionIds: store.phenotypeVersions.listByNode(nodeValue.nodeId).map((version) => version.phenotypeVersionId)
  }));
  const edges = store.edges.listByGraph(options.graph).map((edgeValue) => ({
    edgeId: edgeValue.edgeId,
    fromNodeId: edgeValue.fromNodeId,
    toNodeId: edgeValue.toNodeId
  }));
  const changed = options.edge
    ? ({ type: "edge", id: options.edge, versionId: options.changedVersion } as const)
    : options.node
      ? ({ type: "node", id: options.node, versionId: options.changedVersion } as const)
      : undefined;
  const lineageImpacts = changed ? collectImpact({ changed, nodes, edges }) : undefined;
  const impacts: CliImpactSummary[] =
    lineageImpacts ??
    (options.group
      ? collectGroupImpactForCli(store, options.graph, options.group)
      : options.bridge
        ? collectGraphBridgeImpactForCli(store, options.bridge)
        : collectContextImpactForCli(store, options.graph, options.context));
  if (shouldApply(command)) {
    const changedObjectType = options.group ? "species-group" : options.bridge ? "graph-bridge" : "design-context";
    const changedObjectId = options.group ?? options.bridge ?? options.context;
    const records = changed && lineageImpacts
      ? createImpactRecords({ graphId: options.graph, changed, impacts: lineageImpacts })
      : impacts.map((impactValue: { objectType: "graph" | "node" | "species-group" | "phenotype-version"; objectId: string; reason: string }, index: number) =>
          createImpactRecord({
            impactRecordId: `impact-${changedObjectId}-${impactValue.objectId}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
            graphId: options.graph,
            changedObjectType,
            changedObjectId,
            changedVersionId: options.changedVersion,
            objectType: impactValue.objectType,
            objectId: impactValue.objectId,
            reason: impactValue.reason,
            suggestedAction: "review-or-regenerate",
            reviewStatus: "pending"
          })
        );
    store.transaction(() => {
      for (const record of records) store.impacts.create(record);
    });
    console.log(JSON.stringify({ impacts, impactRecords: records }, null, 2));
  } else {
    console.log(JSON.stringify(impacts, null, 2));
  }
  store.close();
});
impact.command("list").requiredOption("--type <objectType>", "node or edge").requiredOption("--id <objectId>", "changed object id").action((options, command) => {
  if (options.type !== "node" && options.type !== "edge") throw new Error("--type must be node or edge");
  const store = openStore(command);
  console.log(JSON.stringify(store.impacts.listByChangedObject(options.type, options.id), null, 2));
  store.close();
});

const changeSet = program.command("changeset").alias("changesets").description("Review and manage preview change-sets");
changeSet
  .command("list")
  .option("--status <status>", "filter by status: preview, applied, discarded")
  .option("--object-type <objectType>", "filter by object type")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    console.log(JSON.stringify(services.changeSet.list({ status: options.status, objectType: options.objectType }), null, 2));
    store.close();
  });
changeSet
  .command("show")
  .argument("<changeSetId>", "change-set id")
  .action((changeSetId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const value = services.changeSet.get(changeSetId);
    if (!value) {
      store.close();
      throw new Error(`change-set not found: ${changeSetId}`);
    }
    console.log(JSON.stringify(value, null, 2));
    store.close();
  });
changeSet
  .command("apply")
  .argument("<changeSetId>", "change-set id")
  .action((changeSetId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.changeSet.apply(changeSetId);
    console.log(JSON.stringify(result, null, 2));
    store.close();
  });
changeSet
  .command("discard")
  .argument("<changeSetId>", "change-set id")
  .action((changeSetId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const discarded = services.changeSet.discard(changeSetId);
    console.log(JSON.stringify(discarded, null, 2));
    store.close();
  });
changeSet
  .command("review")
  .argument("<changeSetId>", "change-set id")
  .action((changeSetId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    console.log(JSON.stringify(services.changeSet.review(changeSetId), null, 2));
    store.close();
  });

const provider = program.command("provider").description("Run generation providers and inspect generation jobs");
provider
  .command("run-mock")
  .requiredOption("--id <generationJobId>", "generation job id")
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--node <nodeId>", "node id")
  .requiredOption("--phenotype-type <phenotypeType>", "phenotype type")
  .requiredOption("--brief <brief>", "task brief")
  .requiredOption("--prompt <prompt>", "compiled prompt")
  .option("--phenotype <phenotypeId>", "phenotype id")
  .option("--phenotype-version <phenotypeVersionId>", "phenotype version id")
  .option("--param <key=value>", "runtime provider parameter", collect, [])
  .action(async (options, command) => {
    const store = openStore(command);
    const graphValue = store.graphs.get(options.graph);
    const nodeValue = store.nodes.get(options.node);
    if (!graphValue || !nodeValue) {
      store.close();
      throw new Error("graph or node not found");
    }
    const result = await runGenerationProvider({
      provider: new MockGenerationProvider(),
      generationJobId: options.id,
      graphId: options.graph,
      nodeId: options.node,
      phenotypeId: options.phenotype,
      phenotypeVersionId: options.phenotypeVersion,
      phenotypeType: options.phenotypeType,
      taskBrief: options.brief,
      compilePolicy: graphValue.compilePolicy,
      prompt: options.prompt,
      brief: options.brief,
      toolParameters: parseKeyValue(options.param)
    });
    if (!shouldApply(command)) {
      store.close();
      return preview(command, `run mock provider ${result.job.generationJobId}`, result);
    }
    store.transaction(() => {
      store.generationJobs.create(result.job);
      for (const assetValue of result.assets) store.assets.create(assetValue);
    });
    console.log(JSON.stringify(result, null, 2));
    store.close();
  });
provider
  .command("job")
  .command("show")
  .requiredOption("--id <generationJobId>", "generation job id")
  .action((options, command) => {
    const store = openStore(command);
    const job = store.generationJobs.get(options.id);
    if (!job) {
      store.close();
      throw new Error(`generation job not found: ${options.id}`);
    }
    console.log(JSON.stringify(job, null, 2));
    store.close();
  });

program
  .command("serve")
  .description("Start the local DNA HTTP API; web page access is disabled unless --web is passed")
  .option("--host <host>", "bind host", "127.0.0.1")
  .option("--port <port>", "bind port", parsePort, 3042)
  .option("--web", "enable HTTP access to the DNA web page")
  .action(async (options, command) => {
    const store = openStore(command);
    const httpServer = await startDnaHttpServer(store, {
      host: options.host,
      port: options.port,
      webEnabled: Boolean(options.web)
    });
    console.log(`DNA HTTP API listening at ${httpServer.url}`);
    console.log(options.web ? `DNA web page enabled at ${httpServer.url}/` : "DNA web page disabled. Restart with --web to enable /.");
    const shutdown = async () => {
      await httpServer.close();
      store.close();
      process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    await new Promise(() => {});
  });

program.command("export").requiredOption("--out <directory>", "output directory").action((options, command) => {
  const store = openStore(command);
  exportProject(store, options.out);
  console.log(`exported DNA project to ${options.out}`);
  store.close();
});

const sync = program.command("sync").description("Exchange DNA projects through Git-friendly directories");
sync.command("export").requiredOption("--out <directory>", "output directory").action((options, command) => {
  const store = openStore(command);
  exportProject(store, options.out);
  console.log(`synced DNA project export to ${options.out}`);
  store.close();
});
sync.command("import").requiredOption("--in <directory>", "input directory").action((options, command) => {
  if (!shouldApply(command)) return preview(command, `sync import project from ${options.in}`, { in: options.in });
  const store = openStore(command);
  importProject(store, options.in);
  console.log(`synced DNA project import from ${options.in}`);
  store.close();
});
program.command("import").requiredOption("--in <directory>", "input directory").action((options, command) => {
  if (!shouldApply(command)) return preview(command, `import project from ${options.in}`, { in: options.in });
  const store = openStore(command);
  importProject(store, options.in);
  console.log(`imported DNA project from ${options.in}`);
  store.close();
});

function buildSpeciesCompileInputForCli(store: SqliteDnaStore, graphId: string, nodeId: string) {
  const graph = store.graphs.get(graphId);
  const node = store.nodes.get(nodeId);
  if (!graph || !node) throw new Error("graph or node not found");
  const nodeVersionId = store.nodeVersions.listByNode(nodeId).at(-1)?.nodeVersionId ?? `${node.nodeId}@${node.currentVersion}`;
  const parentSnapshots = node.parentNodes
    .map((parentNodeId) => {
      const version = store.nodeVersions.listByNode(parentNodeId).at(-1);
      if (!version) return undefined;
      return {
        parentNodeId,
        nodeVersionId: version.nodeVersionId,
        snapshot: version.resolvedGeneSnapshot
      };
    })
    .filter((value): value is { parentNodeId: string; nodeVersionId: string; snapshot: Record<string, unknown> } => Boolean(value));
  const edgeDeltas = node.incomingEdges
    .map((edgeId) => store.edgeVersions.listByEdge(edgeId).at(-1))
    .filter((version): version is NonNullable<typeof version> => Boolean(version))
    .map((version) => ({
      edgeVersionId: version.edgeVersionId,
      delta: version.deltaGenes
    }));
  const speciesGroups = store.speciesGroupMemberships
    .listByNode(nodeId)
    .map((membership) => store.speciesGroups.get(membership.groupId))
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
  const contextAttachments = [
    ...store.contextAttachments.listByTarget("species-node", nodeId),
    ...store.contextAttachments.listByTarget("graph", graphId),
    ...speciesGroups.flatMap((group) => store.contextAttachments.listByTarget("species-group", group.groupId))
  ];
  const contextIds = [...new Set(contextAttachments.map((attachment) => attachment.contextId))];
  const designContexts = contextIds
    .map((contextId) => store.designContexts.get(contextId))
    .filter((context): context is NonNullable<typeof context> => Boolean(context));
  const contextPolicies = contextIds.flatMap((contextId) => store.contextPolicies.listByContext(contextId));
  const contextFacts = designContexts
    .flatMap((context) => context.factIds)
    .map((factId) => store.contextFacts.get(factId))
    .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));
  const designPrinciples = designContexts
    .flatMap((context) => context.principleIds)
    .map((principleId) => store.designPrinciples.get(principleId))
    .filter((principle): principle is NonNullable<typeof principle> => Boolean(principle));
  const contextMotifs = designContexts
    .flatMap((context) => context.motifIds)
    .map((motifId) => store.contextMotifs.get(motifId))
    .filter((motif): motif is NonNullable<typeof motif> => Boolean(motif));
  const contextReferences = designContexts
    .flatMap((context) => context.referenceIds)
    .map((referenceId) => store.contextReferences.get(referenceId))
    .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference));
  const contextReviewRubrics = designContexts
    .flatMap((context) => context.reviewRubricIds)
    .map((rubricId) => store.contextReviewRubrics.get(rubricId))
    .filter((rubric): rubric is NonNullable<typeof rubric> => Boolean(rubric));

  return {
    graph,
    node,
    nodeVersionId,
    parentSnapshots,
    edgeDeltas,
    speciesGroups,
    groupRelations: store.speciesGroupRelations.listByGraph(graphId),
    graphBridges: store.graphBridges.listByGraph(graphId),
    designContexts,
    contextAttachments,
    contextPolicies,
    contextFacts,
    designPrinciples,
    contextMotifs,
    contextReferences,
    contextReviewRubrics
  };
}

function formatContextMapText(input: {
  context: {
    contextId: string;
    name: string;
    contextType: string;
    summary: string;
    factIds: string[];
    principleIds: string[];
    motifIds: string[];
    referenceIds: string[];
    reviewRubricIds: string[];
  };
  facts: Array<{ factId: string; factType: string; statement: string } | undefined>;
  principles: Array<{ principleId: string; priority: string; statement: string } | undefined>;
  motifs: Array<{ motifId: string; motifType: string; statement: string } | undefined>;
  references: Array<{ referenceId: string; referenceType: string; referenceRole: string } | undefined>;
  rubrics: Array<{ rubricId: string; dimension: string; severity: string; question: string } | undefined>;
  attachments: Array<{ attachmentId: string; targetType: string; targetId: string; role: string; compileLayer: string }>;
  policies: Array<{ policyId: string; compileParticipation: string; reviewParticipation: string; impactParticipation: string }>;
}) {
  const contextValue = input.context;
  const lines = [`Design Context: ${contextValue.name} (${contextValue.contextId}) [${contextValue.contextType}]`];
  if (contextValue.summary) lines.push(`Summary: ${contextValue.summary}`);

  lines.push("Facts:");
  if (!input.facts.length) {
    lines.push("- none");
  } else {
    for (const fact of input.facts) {
      if (!fact) continue;
      lines.push(`- ${fact.factId} [${fact.factType}] ${fact.statement}`);
    }
  }

  lines.push("Principles:");
  if (!input.principles.length) {
    lines.push("- none");
  } else {
    for (const principle of input.principles) {
      if (!principle) continue;
      lines.push(`- ${principle.principleId} [${principle.priority}] ${principle.statement}`);
    }
  }

  lines.push("Motifs:");
  if (!input.motifs.length) {
    lines.push("- none");
  } else {
    for (const motif of input.motifs) {
      if (!motif) continue;
      lines.push(`- ${motif.motifId} [${motif.motifType}] ${motif.statement}`);
    }
  }

  lines.push("References:");
  if (!input.references.length) {
    lines.push("- none");
  } else {
    for (const reference of input.references) {
      if (!reference) continue;
      lines.push(`- ${reference.referenceId} [${reference.referenceType}/${reference.referenceRole}]`);
    }
  }

  lines.push("Review Rubrics:");
  if (!input.rubrics.length) {
    lines.push("- none");
  } else {
    for (const rubric of input.rubrics) {
      if (!rubric) continue;
      lines.push(`- ${rubric.rubricId} [${rubric.dimension}/${rubric.severity}] ${rubric.question}`);
    }
  }

  lines.push("Attachments:");
  if (!input.attachments.length) {
    lines.push("- none");
  } else {
    for (const attachment of input.attachments) {
      lines.push(`- ${attachment.targetType}:${attachment.targetId} [${attachment.role}] via ${attachment.compileLayer}`);
    }
  }

  lines.push("Policies:");
  if (!input.policies.length) {
    lines.push("- none");
  } else {
    for (const policy of input.policies) {
      lines.push(
        `- ${policy.policyId} [compile=${policy.compileParticipation}, review=${policy.reviewParticipation}, impact=${policy.impactParticipation}]`
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatGroupMapText(input: {
  graph: { graphId: string; name: string };
  groups: Array<{ groupId: string; name: string; groupType: string; sharedFacts: string[]; facetSchemaIds: string[] }>;
  memberships: Array<{ membershipId: string; groupId: string; nodeId: string; role: string }>;
  relations: Array<{ sourceGroupId: string; targetGroupId: string; relationType: string; description: string }>;
}) {
  const lines = [`Group Map: ${input.graph.name} (${input.graph.graphId})`, "Groups:"];
  for (const groupValue of input.groups) {
    lines.push(`- ${groupValue.name} (${groupValue.groupId}) [${groupValue.groupType}]`);
    const memberships = input.memberships.filter((membership) => membership.groupId === groupValue.groupId);
    if (memberships.length) {
      lines.push(`  members: ${memberships.map((membership) => `${membership.nodeId} [${membership.role}]`).join(", ")}`);
    }
    if (groupValue.sharedFacts.length) lines.push(`  shared facts: ${groupValue.sharedFacts.join(", ")}`);
    if (groupValue.facetSchemaIds.length) lines.push(`  facet schemas: ${groupValue.facetSchemaIds.join(", ")}`);
  }
  lines.push("Relations:");
  if (!input.relations.length) {
    lines.push("- none");
  } else {
    for (const relation of input.relations) {
      const description = relation.description ? ` - ${relation.description}` : "";
      lines.push(`- ${relation.sourceGroupId} -> ${relation.targetGroupId} [${relation.relationType}]${description}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatAtlasMapText(input: {
  atlas: { atlasId: string; name: string; graphIds: string[] };
  graphs: Array<{ graphId: string; name: string } | undefined>;
  bridges: Array<{ sourceGraphId: string; targetGraphId: string; bridgeType: string; description: string }>;
}) {
  const lines = [`Atlas Map: ${input.atlas.name} (${input.atlas.atlasId})`, "Graphs:"];
  const graphById = new Map(input.graphs.filter((graphValue): graphValue is { graphId: string; name: string } => Boolean(graphValue)).map((graphValue) => [graphValue.graphId, graphValue]));
  for (const graphId of input.atlas.graphIds) {
    const graphValue = graphById.get(graphId);
    lines.push(`- ${graphValue?.name ?? graphId} (${graphId})`);
  }
  lines.push("Bridges:");
  if (!input.bridges.length) {
    lines.push("- none");
  } else {
    for (const bridge of input.bridges) {
      const description = bridge.description ? ` - ${bridge.description}` : "";
      lines.push(`- ${bridge.sourceGraphId} -> ${bridge.targetGraphId} [${bridge.bridgeType}]${description}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function collectGroupImpactForCli(store: SqliteDnaStore, graphId: string, groupId: string) {
  const impacts: Array<{
    objectType: "node" | "species-group" | "phenotype-version";
    objectId: string;
    reason: string;
    suggestedAction: "review-or-regenerate";
  }> = [];
  for (const membership of store.speciesGroupMemberships.listByGroup(groupId)) {
    impacts.push({
      objectType: "node",
      objectId: membership.nodeId,
      reason: `${membership.nodeId} belongs to changed species group ${groupId}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const version of store.phenotypeVersions.listByNode(membership.nodeId)) {
      impacts.push({
        objectType: "phenotype-version",
        objectId: version.phenotypeVersionId,
        reason: `${version.phenotypeVersionId} was generated from node ${membership.nodeId} in changed species group ${groupId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
  }
  for (const relation of store.speciesGroupRelations.listByGraph(graphId)) {
    if (relation.sourceGroupId !== groupId && relation.targetGroupId !== groupId) continue;
    const otherGroupId = relation.sourceGroupId === groupId ? relation.targetGroupId : relation.sourceGroupId;
    impacts.push({
      objectType: "species-group",
      objectId: otherGroupId,
      reason: `${otherGroupId} is connected to changed species group ${groupId} by ${relation.relationType}`,
      suggestedAction: "review-or-regenerate"
    });
  }
  return impacts;
}

function collectGraphBridgeImpactForCli(store: SqliteDnaStore, bridgeId: string) {
  const bridge = store.graphBridges.get(bridgeId);
  if (!bridge) throw new Error(`graph bridge not found: ${bridgeId}`);
  const impacts: Array<{
    objectType: "graph" | "node" | "phenotype-version";
    objectId: string;
    reason: string;
    suggestedAction: "review-or-regenerate";
  }> = [
    {
      objectType: "graph",
      objectId: bridge.targetGraphId,
      reason: `${bridge.targetGraphId} is the target graph of changed bridge ${bridgeId}`,
      suggestedAction: "review-or-regenerate"
    }
  ];
  for (const nodeValue of store.nodes.listByGraph(bridge.targetGraphId)) {
    impacts.push({
      objectType: "node",
      objectId: nodeValue.nodeId,
      reason: `${nodeValue.nodeId} belongs to target graph ${bridge.targetGraphId} of changed bridge ${bridgeId}`,
      suggestedAction: "review-or-regenerate"
    });
    for (const version of store.phenotypeVersions.listByNode(nodeValue.nodeId)) {
      impacts.push({
        objectType: "phenotype-version",
        objectId: version.phenotypeVersionId,
        reason: `${version.phenotypeVersionId} was generated from node ${nodeValue.nodeId} in target graph ${bridge.targetGraphId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
  }
  return impacts;
}

function collectContextImpactForCli(store: SqliteDnaStore, graphId: string, contextId: string) {
  const contextValue = store.designContexts.get(contextId);
  if (!contextValue) throw new Error(`design context not found: ${contextId}`);
  const impacts: CliImpactSummary[] = [];
  const seen = new Set<string>();
  const pushImpact = (impactValue: CliImpactSummary) => {
    const key = `${impactValue.objectType}:${impactValue.objectId}:${impactValue.reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    impacts.push(impactValue);
  };
  const pushNodeImpact = (nodeId: string, reason: string) => {
    const nodeValue = store.nodes.get(nodeId);
    if (!nodeValue || nodeValue.graphId !== graphId) return;
    pushImpact({
      objectType: "node",
      objectId: nodeId,
      reason,
      suggestedAction: "review-or-regenerate"
    });
    for (const version of store.phenotypeVersions.listByNode(nodeId)) {
      pushImpact({
        objectType: "phenotype-version",
        objectId: version.phenotypeVersionId,
        reason: `${version.phenotypeVersionId} was generated from node ${nodeId} attached to changed design context ${contextId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
  };

  for (const attachment of store.contextAttachments.listByContext(contextId)) {
    if (attachment.targetType === "graph") {
      if (attachment.targetId !== graphId) continue;
      pushImpact({
        objectType: "graph",
        objectId: graphId,
        reason: `${graphId} is attached to changed design context ${contextId}`,
        suggestedAction: "review-or-regenerate"
      });
      for (const nodeValue of store.nodes.listByGraph(graphId)) {
        pushNodeImpact(nodeValue.nodeId, `${nodeValue.nodeId} belongs to graph ${graphId} attached to changed design context ${contextId}`);
      }
    } else if (attachment.targetType === "species-node") {
      pushNodeImpact(attachment.targetId, `${attachment.targetId} is attached to changed design context ${contextId}`);
    } else if (attachment.targetType === "species-group") {
      const groupValue = store.speciesGroups.get(attachment.targetId);
      if (!groupValue || groupValue.graphId !== graphId) continue;
      pushImpact({
        objectType: "species-group",
        objectId: attachment.targetId,
        reason: `${attachment.targetId} is attached to changed design context ${contextId}`,
        suggestedAction: "review-or-regenerate"
      });
      for (const membership of store.speciesGroupMemberships.listByGroup(attachment.targetId)) {
        pushNodeImpact(
          membership.nodeId,
          `${membership.nodeId} belongs to species group ${attachment.targetId} attached to changed design context ${contextId}`
        );
      }
    } else if (attachment.targetType === "phenotype-version") {
      const version = store.phenotypeVersions.get(attachment.targetId);
      if (!version || version.graphId !== graphId) continue;
      pushImpact({
        objectType: "phenotype-version",
        objectId: attachment.targetId,
        reason: `${attachment.targetId} is attached to changed design context ${contextId}`,
        suggestedAction: "review-or-regenerate"
      });
    }
  }
  return impacts;
}

function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}

function resolveAssetContext(store: SqliteDnaStore, linkedObjectType: string, linkedObjectId: string) {
  if (linkedObjectType === "node") return { nodeId: linkedObjectId, phenotypeType: undefined };
  if (linkedObjectType === "phenotype") {
    const phenotypeValue = store.phenotypes.get(linkedObjectId);
    return { nodeId: phenotypeValue?.nodeId, phenotypeType: phenotypeValue?.phenotypeType };
  }
  if (linkedObjectType === "phenotype-version") {
    const version = store.phenotypeVersions.get(linkedObjectId);
    const phenotypeValue = version ? store.phenotypes.get(version.phenotypeId) : undefined;
    return { nodeId: version?.nodeId, phenotypeType: phenotypeValue?.phenotypeType };
  }
  return { nodeId: undefined, phenotypeType: undefined };
}

await program.parseAsync();
