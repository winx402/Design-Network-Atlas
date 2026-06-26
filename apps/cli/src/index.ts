#!/usr/bin/env node
import { Command } from "commander";
import {
  collectImpact,
  compareStyleDistance,
  compileSpecies,
  createDefaultAsset,
  createDefaultOutputReference,
  createDefaultExternalLibraryMapping,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultStorageMount,
  createDefaultPhenotype,
  createDefaultPhenotypeVersion,
  createGenerationJob,
  createImpactRecords,
  createReviewRecord,
  makeId,
  PROJECT_VERSION,
  reviewNode,
  reviewPhenotypeVersion
} from "@dna/core";
import { exportProject, importProject, SqliteDnaStore } from "@dna/sqlite";
import { createDnaServices } from "@dna/storage";
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

function writeOptions(command: Command) {
  const options = command.optsWithGlobals<CommandOptions>();
  return {
    mode: options.mode ?? "preview-confirm",
    apply: Boolean(options.yes)
  };
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

const program = new Command()
  .name("dna")
  .description("DNA: Design Network Atlas local CLI")
  .version(PROJECT_VERSION)
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
  .option("--template <templateId>", "template id to bind", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.graph.createGraph(
      {
        graphId: options.id,
        name: options.name,
        purpose: options.purpose,
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
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.lineage.createNode(
      {
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
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--id <edgeId>", "edge id")
  .requiredOption("--from <nodeId>", "source node")
  .requiredOption("--to <nodeId>", "target node")
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
        graphId: options.graph,
        edgeId: options.id,
        fromNodeId: options.from,
        toNodeId: options.to,
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
  .option("--library <libraryId>", "phenotype library id")
  .option("--storage-mount <mountId>", "storage mount id")
  .option("--external-id <externalId>", "external object id")
  .option("--tag <tag>", "raw or source tag", collect, [])
  .option("--normalized-tag <tag>", "normalized search tag", collect, [])
  .option("--metadata <key=value>", "metadata field", collect, [])
  .action((options, command) => {
    const reference = createDefaultOutputReference({
      outputReferenceId: options.id,
      graphId: options.graph,
      phenotypeId: options.phenotype,
      phenotypeVersionId: options.phenotypeVersion,
      libraryId: options.library,
      storageMountId: options.storageMount,
      externalId: options.externalId,
      uri: options.uri,
      referenceType: options.type,
      role: options.role,
      tags: options.tag,
      normalizedTags: options.normalizedTag,
      metadata: parseKeyValue(options.metadata)
    });
    if (!shouldApply(command)) return preview(command, `add output reference ${reference.outputReferenceId}`, reference);
    const store = openStore(command);
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
  .option("--changed-version <versionId>", "changed version id", "latest")
  .action((options, command) => {
  const store = openStore(command);
  if ((options.node && options.edge) || (!options.node && !options.edge)) {
    store.close();
    throw new Error("Provide exactly one of --node or --edge");
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
    : ({ type: "node", id: options.node, versionId: options.changedVersion } as const);
  const impacts = collectImpact({ changed, nodes, edges });
  if (shouldApply(command)) {
    const records = createImpactRecords({ graphId: options.graph, changed, impacts });
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

program.parse();
