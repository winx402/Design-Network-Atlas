#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import {
  buildSpeciesCompileInput,
  acceptPhenotypeVersion,
  addPhenotypeVersionFeedback,
  archivePhenotypeVersion,
  collectContextImpact,
  collectDesignRelationshipImpact,
  collectGroupImpact,
  collectLineageImpact,
  checkGraphModelingQuality,
  checkModelingBatchQuality,
  checkProposalModelingQuality,
  deletePhenotypeVersion,
  deprecatePhenotypeVersion,
  prepareEntityCompileArtifact,
  preparePhenotypeCompileArtifact,
  preparePhenotypeGeneration,
  preparePhenotypeGenerationForTask,
  prepareSpeciesCompileArtifact,
  createGenerationPlan,
  createGenerationTask,
  expandGenerationPlan,
  persistPhenotypeGeneration,
  rejectPhenotypeVersion,
  replacePhenotypeVersion,
  rollbackPhenotypeVersion,
  submitPhenotypeVersionCandidate,
  updatePhenotypeVersionFeedbackSummary,
  type ApplicationImpactSummary
} from "@dna/application";
import {
  compareStyleDistance,
  createDefaultAsset,
  createDefaultLibraryRoutingPolicy,
  createDefaultOutputReference,
  createDefaultExternalLibraryMapping,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultStorageMount,
  createImpactRecord,
  createImpactRecords,
  createReviewRecord,
  formatGraphTreeText,
  formatGraphTreeWithGroupsText,
  formatGraphTreeWithPhenotypesText,
  buildGraphTree,
  buildGraphGroupOverlay,
  buildGraphPhenotypeOverlay,
  makeId,
  MockGenerationProvider,
  OutputReferenceRoleSchema,
  OutputReferenceTypeSchema,
  PROJECT_VERSION,
  type GenerationVersionBinding,
  type PhenotypeGenerationPlan,
  type PhenotypeGenerationTask,
  type PhenotypeVersion,
  type PhenotypeVersionFeedbackItem,
  type ModelingQualityReport,
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
  cliVersion?: boolean;
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

function graphNotFoundError(graphId: string) {
  return new Error(`graph not found: ${graphId}\nRun dna graph list to see available graph ids.`);
}

function getGraphOrThrow(store: SqliteDnaStore, graphId: string) {
  const value = store.graphs.get(graphId);
  if (!value) throw graphNotFoundError(graphId);
  return value;
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

function parseFacetValueLiteral(value: string, valueType?: string): string | number | boolean | unknown {
  if (valueType === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Expected numeric facet value, got ${value}`);
    return parsed;
  }
  if (valueType === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`Expected boolean facet value true or false, got ${value}`);
  }
  if (valueType === "json") return JSON.parse(value);
  return value;
}

function parseFacetAssignmentValues(values: string[] | undefined) {
  const result: Record<string, unknown> = {};
  for (const value of values ?? []) {
    const [key, ...rest] = value.split("=");
    if (!key || rest.length === 0) throw new Error(`Expected facetId=value, got ${value}`);
    const raw = rest.join("=");
    try {
      result[key] = JSON.parse(raw);
    } catch {
      result[key] = raw;
    }
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

function parseExportProfile(value: string): "full" | "review-current" | "proposal-review" {
  if (value === "full" || value === "review-current" || value === "proposal-review") return value;
  throw new Error(`unknown export profile: ${value}`);
}

type ImportBatchCliResult = {
  mode: "preview-confirm" | "draft-write";
  reviewStage: "draft" | "pending-review" | "confirmed-applied" | "discarded";
  proposal: null | { proposalId: string; title: string; status: string; changeSetIds?: string[] };
  changeSetIds: string[];
  counts: {
    planned: Record<string, number>;
    applied: Record<string, number>;
    skipped: Record<string, number>;
  };
  includesCrossGraphReferences: boolean;
  includesLibraryObjects: boolean;
  warning?: string;
};

function countTotal(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function nonZeroCountLines(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `  - ${key}: ${value}`);
}

function nextImportBatchCommand(result: ImportBatchCliResult) {
  if (result.mode === "preview-confirm" && result.proposal) return `dna proposal show ${result.proposal.proposalId}`;
  return "dna export --profile review-current --out <dir>";
}

function formatImportBatchReport(result: ImportBatchCliResult, includeIds: boolean) {
  const warnings = result.warning ? [result.warning] : [];
  const lines = [
    "Modeling batch import report",
    `Mode: ${result.mode}`,
    `Review stage: ${result.reviewStage}`,
    `Proposal: ${result.proposal?.proposalId ?? "none"}`,
    `Planned: ${countTotal(result.counts.planned)}`,
    `Applied: ${countTotal(result.counts.applied)}`,
    `Skipped: ${countTotal(result.counts.skipped)}`,
    `Cross-graph relationships: ${result.includesCrossGraphReferences ? "yes" : "no"}`,
    `Library objects: ${result.includesLibraryObjects ? "yes" : "no"}`
  ];
  const planned = nonZeroCountLines(result.counts.planned);
  if (planned.length) lines.push("Planned counts:", ...planned);
  const applied = nonZeroCountLines(result.counts.applied);
  if (applied.length) lines.push("Applied counts:", ...applied);
  const skipped = nonZeroCountLines(result.counts.skipped);
  if (skipped.length) lines.push("Skipped counts:", ...skipped);
  lines.push("Warnings:", ...(warnings.length ? warnings.map((warning) => `  - ${warning}`) : ["  - none"]));
  if (includeIds) lines.push("Change-set ids:", ...result.changeSetIds.map((changeSetId) => `  - ${changeSetId}`));
  lines.push(`Next: ${nextImportBatchCommand(result)}`);
  return `${lines.join("\n")}\n`;
}

function formatImportBatchJson(result: ImportBatchCliResult, includeIds: boolean) {
  if (includeIds) return result;
  const proposal = result.proposal
    ? {
        proposalId: result.proposal.proposalId,
        title: result.proposal.title,
        status: result.proposal.status,
        changeSetCount: result.changeSetIds.length
      }
    : null;
  return {
    mode: result.mode,
    reviewStage: result.reviewStage,
    proposal,
    changeSetCount: result.changeSetIds.length,
    counts: result.counts,
    includesCrossGraphReferences: result.includesCrossGraphReferences,
    includesLibraryObjects: result.includesLibraryObjects,
    warning: result.warning,
    next: nextImportBatchCommand(result)
  };
}

function parseOutputFormat(value: string | undefined): "text" | "json" | undefined {
  if (value === undefined) return undefined;
  if (value === "text" || value === "json") return value;
  throw new Error(`unknown output format: ${value}`);
}

function parseVersionBinding(options: {
  versionBinding?: string;
  nodeVersion?: string;
  speciesArtifact?: string;
  phenotypeArtifact?: string;
  replayHistorical?: boolean;
}): GenerationVersionBinding {
  const hasPinnedInput = Boolean(options.nodeVersion || options.speciesArtifact || options.phenotypeArtifact);
  const mode = options.versionBinding ?? (hasPinnedInput ? "pinned" : "latest-at-execution");
  if (mode !== "latest-at-execution" && mode !== "pinned") throw new Error(`unknown version binding mode: ${mode}`);
  return mode === "latest-at-execution"
    ? { mode, replayHistorical: false }
    : {
        mode,
        nodeVersionId: options.nodeVersion,
        speciesCompileArtifactId: options.speciesArtifact,
        phenotypeCompileArtifactId: options.phenotypeArtifact,
        replayHistorical: Boolean(options.replayHistorical)
      };
}

function printJsonOrText(format: "text" | "json" | undefined, jsonValue: unknown, textValue: string) {
  if (format === "json") console.log(JSON.stringify(jsonValue, null, 2));
  else console.log(textValue);
}

function formatGenerationPlan(plan: PhenotypeGenerationPlan, taskCount?: number) {
  const lines = [
    `Generation plan: ${plan.planId}`,
    `Status: ${plan.status}`,
    `Scope: ${plan.scopeType} ${plan.scopeId}`,
    `Graph: ${plan.graphId ?? "n/a"}`,
    `Priority: ${plan.priority}`,
    `Description: ${plan.description}`,
    `Version binding: ${plan.versionBinding.mode}`
  ];
  if (plan.toolPreference) lines.push(`Tool preference: ${plan.toolPreference}`);
  if (taskCount !== undefined) lines.push(`Tasks: ${taskCount}`);
  return `${lines.join("\n")}\n`;
}

function formatGenerationTask(task: PhenotypeGenerationTask) {
  const lines = [
    `Generation task: ${task.taskId}`,
    `Status: ${task.status}`,
    `Graph: ${task.graphId}`,
    `Plan: ${task.planId ?? "none"}`,
    `Node: ${task.nodeId ?? "none"}`,
    `Phenotype: ${task.phenotypeId ?? "none"}`,
    `Type: ${task.phenotypeType}`,
    `Priority: ${task.priority}`,
    `Version binding: ${task.versionBinding.mode}`,
    `Brief: ${task.taskBrief}`,
    `Species artifact: ${task.speciesCompileArtifactId ?? "none"}`,
    `Phenotype artifact: ${task.phenotypeCompileArtifactId ?? "none"}`,
    `Generation jobs: ${task.generationJobIds.length ? task.generationJobIds.join(", ") : "none"}`,
    `Phenotype versions: ${task.phenotypeVersionIds.length ? task.phenotypeVersionIds.join(", ") : "none"}`
  ];
  if (task.blockingReason) lines.push(`Blocked: ${task.blockingReason}`);
  return `${lines.join("\n")}\n`;
}

function formatGenerationExpansion(result: {
  persisted: boolean;
  createdTasks: PhenotypeGenerationTask[];
  skippedExistingTaskIds: string[];
  warnings: string[];
}) {
  const lines = [
    result.persisted ? "Created generation tasks" : "Preview generation tasks",
    `planned: ${result.createdTasks.length + result.skippedExistingTaskIds.length}`,
    `created: ${result.createdTasks.length}`,
    `skipped-existing: ${result.skippedExistingTaskIds.length}`,
    "warnings:",
    ...(result.warnings.length ? result.warnings.map((warning) => `  - ${warning}`) : ["  - none"])
  ];
  if (!result.persisted) lines.push("Re-run with --apply or --yes to persist tasks.");
  return `${lines.join("\n")}\n`;
}

function generationResponse(prepared: {
  artifacts: { species: unknown; phenotype: unknown };
  speciesArtifact: unknown;
  phenotypeArtifact: unknown;
  phenotype: unknown;
  phenotypeVersion: unknown;
  job: unknown;
  prompt: string;
}) {
  return {
    artifacts: prepared.artifacts,
    speciesArtifact: prepared.speciesArtifact,
    phenotypeArtifact: prepared.phenotypeArtifact,
    phenotype: prepared.phenotype,
    phenotypeVersion: prepared.phenotypeVersion,
    job: prepared.job,
    prompt: prepared.prompt
  };
}

function compileArtifactLabel(artifact: { compileTarget: string; targetLevel?: string }) {
  if (artifact.compileTarget === "entity-layer") return artifact.targetLevel ?? "entity";
  if (artifact.compileTarget === "species-snapshot") return "species";
  return "phenotype-generation";
}

function formatLayeredCompileText(artifact: {
  compileTarget: string;
  targetLevel?: string;
  frames: Array<{ level: string; target: { objectId: string; label?: string } }>;
  conflictReport: unknown[];
  openQuestions?: string[];
  feedback?: unknown[];
}) {
  const lines = [`Layered compile: ${compileArtifactLabel(artifact)}`];
  artifact.frames.forEach((frame, index) => {
    const label = frame.level === "phenotype" ? (frame.target.label ?? frame.target.objectId) : frame.target.objectId;
    lines.push(`${index + 1}. ${frame.level}: ${label}`);
  });
  lines.push(`Conflicts: ${artifact.conflictReport.length}`);
  lines.push(`Open questions: ${artifact.openQuestions?.length ?? 0}`);
  lines.push(`Feedback: ${artifact.feedback?.length ?? 0}`);
  return `${lines.join("\n")}\n`;
}

function printCompileArtifact(
  artifact: {
    compileTarget: string;
    targetLevel?: string;
    frames: Array<{ level: string; target: { objectId: string; label?: string } }>;
    conflictReport: unknown[];
    openQuestions?: string[];
    feedback?: unknown[];
  },
  format: "text" | "json" | undefined,
  defaultText: boolean
) {
  if (format === "json" || (!format && !defaultText)) {
    console.log(JSON.stringify(artifact, null, 2));
    return;
  }
  process.stdout.write(formatLayeredCompileText(artifact));
}

function formatModelingQualityReport(report: ModelingQualityReport) {
  const source = `${report.source.type}${report.source.id ? `:${report.source.id}` : ""}`;
  const lines = [
    "Modeling quality report",
    `Source: ${source}`,
    `Status: ${report.status}`,
    `Issues: ${report.summary.issueCount} (blocking=${report.summary.blocking}, warning=${report.summary.warning}, info=${report.summary.info})`,
    "Findings:"
  ];
  if (report.issues.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity}] ${issue.objectType}:${issue.objectId} ${issue.path} - ${issue.reason}`);
      lines.push(`  Suggested: ${issue.suggestedAction}`);
    }
  }
  return `${lines.join("\n")}\n`;
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
  .option("-V, --cli-version", "output the CLI version")
  .option("--db <path>", "SQLite database path", ".dna/dna.sqlite")
  .option("--yes", "apply write operations without preview stop")
  .option("--mode <mode>", "write mode: preview-confirm, draft-write, changeset-apply", "preview-confirm")
  .option("--change-set <changeSetId>", "existing preview change-set id for --mode changeset-apply")
  .addHelpText(
    "after",
    `
Use \`dna <command> --help\` to inspect command-specific options.

Write boundaries:
  preview-confirm    formal graph/context/facet facts create a preview change-set before durable writes
  draft-write        write explicitly draft objects or generated trace/output/audit records directly
  direct audit write generated trace/output/audit records and external pointers persisted through CLI/application services
  changeset-apply    apply an existing preview change-set with --change-set
`
  );

program.action((options: CommandOptions) => {
  if (options.cliVersion) {
    console.log(PROJECT_VERSION);
    return;
  }
  program.outputHelp();
});

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
  const value = getGraphOrThrow(store, options.id);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});
graph
  .command("tree")
  .requiredOption("--id <graphId>", "graph id")
  .option("--format <format>", "output format: text or json", "text")
  .option("--include-groups", "include species group memberships and group relations as a review overlay")
  .option("--include-phenotypes", "include planned and generated phenotype containers as a review overlay")
  .action((options, command) => {
    const store = openStore(command);
    const value = getGraphOrThrow(store, options.id);
    const tree = buildGraphTree({
      graph: value,
      nodes: store.nodes.listByGraph(options.id),
      relationships: store.designRelationships.listByGraph(options.id)
    });
    const overlay = options.includeGroups
      ? buildGraphGroupOverlay({
          graph: value,
          nodes: store.nodes.listByGraph(options.id),
          groups: store.speciesGroups.listByGraph(options.id),
          memberships: store.speciesGroupMemberships.listByGraph(options.id),
          relationships: store.designRelationships.listByGraph(options.id)
        })
      : undefined;
    const phenotypeOverlay = options.includePhenotypes
      ? buildGraphPhenotypeOverlay({
          graph: value,
          nodes: store.nodes.listByGraph(options.id),
          phenotypes: store.phenotypes.listByGraph(options.id)
        })
      : undefined;
    if (options.format === "json") {
      console.log(JSON.stringify({ ...tree, ...(overlay ? { groupOverlay: overlay } : {}), ...(phenotypeOverlay ? { phenotypeOverlay } : {}) }, null, 2));
    } else if (options.format === "text") {
      let text = overlay ? formatGraphTreeWithGroupsText(tree, overlay) : formatGraphTreeText(tree);
      if (phenotypeOverlay) {
        const phenotypeText = formatGraphTreeWithPhenotypesText(tree, phenotypeOverlay);
        text = `${text.trimEnd()}\n\n${phenotypeText.slice(phenotypeText.indexOf("Planned phenotypes:"))}`;
      }
      process.stdout.write(text);
    } else {
      throw new Error(`unknown graph tree format: ${options.format}`);
    }
    store.close();
  });
graph.command("archive").requiredOption("--id <graphId>", "graph id").action((options, command) => {
  const store = openStore(command);
  const value = getGraphOrThrow(store, options.id);
  if (!shouldApply(command)) {
    store.close();
    return preview(command, `archive graph ${options.id}`, { before: value, after: { ...value, status: "archived" } });
  }
  store.graphs.archive(options.id);
  console.log(`archived graph ${options.id}`);
  store.close();
});
graph
  .command("reset")
  .requiredOption("--id <graphId>", "graph id")
  .option("--confirm-reset <graphId>", "exact graph id required with --yes")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const rootOptions = (command as Command).optsWithGlobals<CommandOptions>();
    if (!rootOptions.yes) {
      const summary = services.graph.previewReset(options.id);
      console.log("Graph reset preview");
      console.log(JSON.stringify(summary, null, 2));
      console.log(`Re-run with --yes --confirm-reset ${options.id} to reset DNA metadata for this local graph.`);
      store.close();
      return;
    }
    if (options.confirmReset !== options.id) {
      store.close();
      throw new Error(`graph reset requires --confirm-reset ${options.id}`);
    }
    const summary = services.graph.reset(options.id);
    console.log(`reset graph ${options.id}`);
    console.log(JSON.stringify(summary, null, 2));
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

const relationship = program.command("relationship").description("Manage design relationships between same-level core entities").addHelpText(
  "after",
  `
Endpoint formats:
  graph:<graphId>
  species-group:<graphId>:<groupId>
  species-node:<graphId>:<nodeId>
`
);
relationship
  .command("create")
  .option("--id <relationshipId>", "design relationship id")
  .option("--source <endpoint>", "source endpoint: graph:<id>, species-group:<graphId>:<groupId>, or species-node:<graphId>:<nodeId>")
  .option("--target <endpoint>", "target endpoint: graph:<id>, species-group:<graphId>:<groupId>, or species-node:<graphId>:<nodeId>")
  .option("--type <relationshipType>", "relationship type, including custom:<name>", "references")
  .option("--direction <direction>", "source-to-target, bidirectional, or reference-only", "source-to-target")
  .option("--description <description>", "relationship description", "")
  .option("--transfer-rule <text>", "design transfer rule")
  .option("--must-preserve <text>", "contract item that must be preserved", collect, [])
  .option("--must-avoid <text>", "contract item that must be avoided", collect, [])
  .option("--divergence-rule <text>", "intentional divergence rule")
  .option("--review-question <text>", "review question for this relationship", collect, [])
  .option("--status <status>", "relationship status", "draft")
  .option("--metadata <key=value>", "relationship metadata", collect, [])
  .option("--allow-parallel", "allow another relationship with the same endpoints when semantics are independent")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.relationship.createRelationship(
      {
        relationshipId: requiredUnlessChangeSetApply(options.id, "--id", command),
        source: isChangeSetApply(command)
          ? { type: "graph", graphId: "" }
          : parseRelationshipEndpoint(requiredUnlessChangeSetApply(options.source, "--source", command)),
        target: isChangeSetApply(command)
          ? { type: "graph", graphId: "target" }
          : parseRelationshipEndpoint(requiredUnlessChangeSetApply(options.target, "--target", command)),
        relationshipType: options.type,
        direction: options.direction,
        description: options.description,
        designContract: {
          transferRule: options.transferRule,
          mustPreserve: options.mustPreserve,
          mustAvoid: options.mustAvoid,
          divergenceRule: options.divergenceRule,
          reviewQuestions: options.reviewQuestion
        },
        status: options.status,
        metadata: parseKeyValue(options.metadata),
        allowParallel: Boolean(options.allowParallel)
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created design relationship ${result.value.relationshipId}`);
    }
    store.close();
  });
relationship.command("list").option("--graph <graphId>", "filter by graph id").action((options, command) => {
  const store = openStore(command);
  const values = options.graph ? store.designRelationships.listByGraph(options.graph) : store.designRelationships.list();
  store.close();
  console.log(JSON.stringify(values, null, 2));
});
relationship.command("show").requiredOption("--id <relationshipId>", "design relationship id").option("--format <format>", "output format: json or text", "text").action((options, command) => {
  const store = openStore(command);
  const value = store.designRelationships.get(options.id);
  if (!value) throw new Error(`design relationship not found: ${options.id}`);
  store.close();
  if (options.format === "json") {
    console.log(JSON.stringify(value, null, 2));
  } else if (options.format === "text") {
    process.stdout.write(formatRelationshipText(value));
  } else {
    throw new Error(`unknown relationship format: ${options.format}`);
  }
});

const facet = program.command("facet").description("Manage facet definitions, schemas, and assignments");
const facetDefinition = facet.command("definition").description("Manage facet definitions");
facetDefinition
  .command("create")
  .option("--id <facetId>", "facet definition id")
  .option("--name <name>", "facet name")
  .option("--description <description>", "facet description", "")
  .option("--value-type <valueType>", "value type: string, number, boolean, enum, json", "string")
  .option("--allowed-value <value>", "allowed value", collect, [])
  .option("--status <status>", "facet status", "active")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const valueType = options.valueType;
    const result = services.facet.createDefinition(
      {
        facetId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        description: options.description,
        valueType,
        allowedValues: (options.allowedValue ?? []).map((value: string) => parseFacetValueLiteral(value, valueType)) as Array<string | number | boolean>,
        status: options.status
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") printChangeSet(result.changeSet);
    else console.log(`created facet definition ${result.value.facetId}`);
    store.close();
  });
facetDefinition.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.facetDefinitions.list(), null, 2));
  store.close();
});
facetDefinition.command("show").requiredOption("--id <facetId>", "facet definition id").action((options, command) => {
  const store = openStore(command);
  const value = store.facetDefinitions.get(options.id);
  if (!value) throw new Error(`facet definition not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});

const facetSchema = facet.command("schema").description("Manage facet schemas");
facetSchema
  .command("create")
  .option("--id <facetSchemaId>", "facet schema id")
  .option("--name <name>", "facet schema name")
  .option("--description <description>", "facet schema description", "")
  .option("--facet <facetId>", "facet definition id", collect, [])
  .option("--required <facetId>", "required facet definition id", collect, [])
  .option("--status <status>", "facet schema status", "active")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.facet.createSchema(
      {
        facetSchemaId: requiredUnlessChangeSetApply(options.id, "--id", command),
        name: requiredUnlessChangeSetApply(options.name, "--name", command),
        description: options.description,
        facetIds: options.facet,
        requiredFacetIds: options.required,
        status: options.status
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") printChangeSet(result.changeSet);
    else console.log(`created facet schema ${result.value.facetSchemaId}`);
    store.close();
  });
facetSchema.command("list").action((_options, command) => {
  const store = openStore(command);
  console.log(JSON.stringify(store.facetSchemas.list(), null, 2));
  store.close();
});
facetSchema.command("show").requiredOption("--id <facetSchemaId>", "facet schema id").action((options, command) => {
  const store = openStore(command);
  const value = store.facetSchemas.get(options.id);
  if (!value) throw new Error(`facet schema not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});

const facetAssignment = facet.command("assignment").description("Manage facet assignments");
facetAssignment
  .command("create")
  .option("--id <assignmentId>", "facet assignment id")
  .option("--target-type <targetType>", "assignment target type")
  .option("--target <targetId>", "assignment target id")
  .option("--value <facetId=value>", "facet value assignment", collect, [])
  .option("--status <status>", "facet assignment status", "active")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.facet.createAssignment(
      {
        assignmentId: requiredUnlessChangeSetApply(options.id, "--id", command),
        targetType: requiredUnlessChangeSetApply(options.targetType, "--target-type", command),
        targetId: requiredUnlessChangeSetApply(options.target, "--target", command),
        values: parseFacetAssignmentValues(options.value),
        status: options.status
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") printChangeSet(result.changeSet);
    else console.log(`created facet assignment ${result.value.assignmentId}`);
    store.close();
  });
facetAssignment.command("list").option("--target-type <targetType>", "target type").option("--target <targetId>", "target id").action((options, command) => {
  const store = openStore(command);
  const values = options.targetType && options.target ? store.facetAssignments.listByTarget(options.targetType, options.target) : store.facetAssignments.list();
  console.log(JSON.stringify(values, null, 2));
  store.close();
});
facetAssignment.command("show").requiredOption("--id <assignmentId>", "facet assignment id").action((options, command) => {
  const store = openStore(command);
  const value = store.facetAssignments.get(options.id);
  if (!value) throw new Error(`facet assignment not found: ${options.id}`);
  console.log(JSON.stringify(value, null, 2));
  store.close();
});

const group = program.command("group").description("Manage graph-local species groups");
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
  .option("--role <role>", "membership role: primary, reference, connector, source, target", "primary")
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
      relationships: store.designRelationships
        .listByGraph(options.graph)
        .filter((relationshipValue) => relationshipValue.source.type === "species-group" && relationshipValue.target.type === "species-group")
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

const atlas = program.command("atlas").description("Manage multi-graph atlases");
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
      relationships: store.designRelationships
        .list()
        .filter(
          (relationshipValue) =>
            relationshipValue.source.type === "graph" &&
            relationshipValue.target.type === "graph" &&
            atlasValue.graphIds.includes(relationshipValue.source.graphId) &&
            atlasValue.graphIds.includes(relationshipValue.target.graphId)
        )
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
  .option("--id <factId>", "fact id")
  .option("--type <factType>", "fact type")
  .option("--statement <statement>", "fact statement")
  .option("--scope <scopeHint>", "scope hint", "")
  .option("--strength <strength>", "hard, soft, or reference", "reference")
  .option("--behavior <behavior>", "include, weaken, translate, exclude, or reference-only", "reference-only")
  .option("--source <sourceTrace>", "source trace", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.context.createFact(
      {
        factId: requiredUnlessChangeSetApply(options.id, "--id", command),
        factType: requiredUnlessChangeSetApply(options.type, "--type", command),
        statement: requiredUnlessChangeSetApply(options.statement, "--statement", command),
        scopeHint: options.scope,
        defaultStrength: options.strength,
        defaultBehaviorHint: options.behavior,
        sourceTrace: options.source
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created context fact ${result.value.factId}`);
    }
    store.close();
  });

const contextPrinciple = context.command("principle").description("Manage design principles");
contextPrinciple
  .command("add")
  .option("--id <principleId>", "principle id")
  .option("--statement <statement>", "principle statement")
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
    const services = createDnaServices(store);
    const result = services.context.createPrinciple(
      {
        principleId: requiredUnlessChangeSetApply(options.id, "--id", command),
        statement: requiredUnlessChangeSetApply(options.statement, "--statement", command),
        priority: options.priority,
        scopeHint: options.scope,
        defaultBehaviorHint: options.behavior,
        experienceIntent: options.experienceIntent,
        readabilityGoal: options.readabilityGoal,
        platformContext: options.platformContext,
        reviewQuestions: options.reviewQuestion,
        badcases: options.badcase
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created design principle ${result.value.principleId}`);
    }
    store.close();
  });

const contextMotif = context.command("motif").description("Manage context motifs");
contextMotif
  .command("add")
  .option("--id <motifId>", "motif id")
  .option("--type <motifType>", "motif type")
  .option("--statement <statement>", "motif statement")
  .option("--source-ref <sourceRef>", "source reference")
  .option("--visual-motif-ref <visualMotifRef>", "visual motif reference")
  .option("--note <note>", "note", "")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.context.createMotif(
      {
        motifId: requiredUnlessChangeSetApply(options.id, "--id", command),
        motifType: requiredUnlessChangeSetApply(options.type, "--type", command),
        statement: requiredUnlessChangeSetApply(options.statement, "--statement", command),
        sourceRef: options.sourceRef,
        visualMotifRef: options.visualMotifRef,
        note: options.note
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created context motif ${result.value.motifId}`);
    }
    store.close();
  });

const contextReference = context.command("reference").description("Manage context references");
contextReference
  .command("add")
  .option("--id <referenceId>", "reference id")
  .option("--type <referenceType>", "reference type")
  .option("--source-type <sourceType>", "source reference type")
  .option("--source-id <sourceId>", "source reference id")
  .option("--role <referenceRole>", "positive, negative, mood, evidence, or decision", "evidence")
  .option("--use-for <value>", "what this reference is safe to use for", collect, [])
  .option("--do-not-use-for <value>", "what this reference must not be used for", collect, [])
  .option("--note <note>", "note", "")
  .option("--risk <risk>", "risk note", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.context.createReference(
      {
        referenceId: requiredUnlessChangeSetApply(options.id, "--id", command),
        referenceType: requiredUnlessChangeSetApply(options.type, "--type", command),
        sourceRef: {
          type: requiredUnlessChangeSetApply(options.sourceType, "--source-type", command),
          id: requiredUnlessChangeSetApply(options.sourceId, "--source-id", command)
        },
        referenceRole: options.role,
        useFor: options.useFor,
        doNotUseFor: options.doNotUseFor,
        note: options.note,
        risk: options.risk
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created context reference ${result.value.referenceId}`);
    }
    store.close();
  });

const contextRubric = context.command("rubric").description("Manage context review rubrics");
contextRubric
  .command("add")
  .option("--id <rubricId>", "rubric id")
  .option("--dimension <dimension>", "review dimension")
  .option("--question <question>", "review question")
  .option("--pass-signal <signal>", "pass signal", "")
  .option("--fail-signal <signal>", "fail signal", "")
  .option("--severity <severity>", "info, warning, or blocking", "info")
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const result = services.context.createReviewRubric(
      {
        rubricId: requiredUnlessChangeSetApply(options.id, "--id", command),
        dimension: requiredUnlessChangeSetApply(options.dimension, "--dimension", command),
        question: requiredUnlessChangeSetApply(options.question, "--question", command),
        passSignal: options.passSignal,
        failSignal: options.failSignal,
        severity: options.severity
      },
      writeOptions(command)
    );
    if (result.changeSet.status === "preview") {
      printChangeSet(result.changeSet);
    } else {
      console.log(`created context review rubric ${result.value.rubricId}`);
    }
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
const compileAtlasCommand = compile.command("atlas").description("Compile or inspect an atlas layered artifact");
compileAtlasCommand
  .argument("[action]", "optional action: show")
  .option("--id <atlasOrArtifactId>", "atlas id, or artifact id when action is show")
  .option("--artifact-id <artifactId>", "entity compile artifact id")
  .option("--format <format>", "output format: text|json")
  .option("--persist", "persist the compile artifact")
  .action((action, options, command) => {
    const store = openStore(command);
    const format = parseOutputFormat(options.format);
    if (action === "show") {
      const artifactId = requiredOption(options.id, "--id");
      const artifact = store.entityCompileArtifacts.get(artifactId);
      if (!artifact) {
        store.close();
        throw new Error(`entity compile artifact not found: ${artifactId}`);
      }
      console.log(JSON.stringify(artifact, null, 2));
      store.close();
      return;
    }
    if (action) {
      store.close();
      throw new Error(`unknown compile atlas action: ${action}`);
    }
    const artifact = prepareEntityCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("eca"),
      targetLevel: "atlas",
      atlasId: requiredOption(options.id, "--id")
    });
    if (options.persist || shouldApply(command)) {
      store.entityCompileArtifacts.create(artifact);
      console.log(JSON.stringify(artifact, null, 2));
    } else {
      printCompileArtifact(artifact, format, true);
    }
    store.close();
  });

const compileGraphCommand = compile.command("graph").description("Compile or inspect a graph layered artifact");
compileGraphCommand
  .argument("[action]", "optional action: show")
  .option("--id <graphOrArtifactId>", "graph id, or artifact id when action is show")
  .option("--artifact-id <artifactId>", "entity compile artifact id")
  .option("--format <format>", "output format: text|json")
  .option("--persist", "persist the compile artifact")
  .action((action, options, command) => {
    const store = openStore(command);
    const format = parseOutputFormat(options.format);
    if (action === "show") {
      const artifactId = requiredOption(options.id, "--id");
      const artifact = store.entityCompileArtifacts.get(artifactId);
      if (!artifact) {
        store.close();
        throw new Error(`entity compile artifact not found: ${artifactId}`);
      }
      console.log(JSON.stringify(artifact, null, 2));
      store.close();
      return;
    }
    if (action) {
      store.close();
      throw new Error(`unknown compile graph action: ${action}`);
    }
    const graphId = requiredOption(options.id, "--id");
    const artifact = prepareEntityCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("eca"),
      targetLevel: "graph",
      graphId
    });
    if (options.persist || shouldApply(command)) {
      store.entityCompileArtifacts.create(artifact);
      console.log(JSON.stringify(artifact, null, 2));
    } else {
      printCompileArtifact(artifact, format, true);
    }
    store.close();
  });

const compileGroupCommand = compile.command("group").description("Compile or inspect a species-group layered artifact");
compileGroupCommand
  .argument("[action]", "optional action: show")
  .option("--graph <graphId>", "graph id")
  .option("--group <groupId>", "species group id")
  .option("--id <artifactId>", "artifact id when action is show")
  .option("--artifact-id <artifactId>", "entity compile artifact id")
  .option("--format <format>", "output format: text|json")
  .option("--persist", "persist the compile artifact")
  .action((action, options, command) => {
    const store = openStore(command);
    const format = parseOutputFormat(options.format);
    if (action === "show") {
      const artifactId = requiredOption(options.id, "--id");
      const artifact = store.entityCompileArtifacts.get(artifactId);
      if (!artifact) {
        store.close();
        throw new Error(`entity compile artifact not found: ${artifactId}`);
      }
      console.log(JSON.stringify(artifact, null, 2));
      store.close();
      return;
    }
    if (action) {
      store.close();
      throw new Error(`unknown compile group action: ${action}`);
    }
    const artifact = prepareEntityCompileArtifact(store, {
      artifactId: options.artifactId ?? makeId("eca"),
      targetLevel: "species-group",
      graphId: requiredOption(options.graph, "--graph"),
      groupId: requiredOption(options.group, "--group")
    });
    if (options.persist || shouldApply(command)) {
      store.entityCompileArtifacts.create(artifact);
      console.log(JSON.stringify(artifact, null, 2));
    } else {
      printCompileArtifact(artifact, format, true);
    }
    store.close();
  });

const compileSpeciesCommand = compile.command("species").description("Compile or inspect a stable species gene snapshot artifact");
compileSpeciesCommand
  .argument("[action]", "optional action: show")
  .option("--graph <graphId>", "graph id")
  .option("--node <nodeId>", "species node id")
  .option("--id <artifactId>", "species compile artifact id")
  .option("--artifact-id <artifactId>", "species compile artifact id")
  .option("--format <format>", "output format: text|json")
  .option("--persist", "persist the compile artifact")
  .action((action, options, command) => {
    const store = openStore(command);
    const format = parseOutputFormat(options.format);
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
    const artifact = prepareSpeciesCompileArtifact(store, {
      artifactId: options.artifactId ?? options.id ?? makeId("sca"),
      graphId: options.graph,
      nodeId: options.node
    });
    if (!(options.persist || shouldApply(command))) {
      store.close();
      if (format) return printCompileArtifact(artifact, format, true);
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
  .option("--artifact-id <artifactId>", "phenotype compile artifact id")
  .option("--species-artifact <artifactId>", "species compile artifact id")
  .option("--reference <referenceId>", "context reference id", collect, [])
  .option("--rubric <rubricId>", "context review rubric id", collect, [])
  .option("--format <format>", "output format: text|json")
  .option("--persist", "persist the compile artifact")
  .action((action, options, command) => {
    const store = openStore(command);
    const format = parseOutputFormat(options.format);
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
    const speciesArtifact = options.speciesArtifact
      ? store.speciesCompileArtifacts.get(options.speciesArtifact)
      : store.speciesCompileArtifacts.listByNode(options.node).at(-1);
    if (options.speciesArtifact && !speciesArtifact) {
      store.close();
      throw new Error(`species compile artifact not found: ${options.speciesArtifact}`);
    }
    const artifact = preparePhenotypeCompileArtifact(store, {
      artifactId: options.artifactId ?? options.id ?? makeId("pca"),
      graphId: options.graph,
      nodeId: options.node,
      phenotypeType: options.type,
      taskBrief: options.brief,
      speciesArtifact
    });
    if (!(options.persist || shouldApply(command))) {
      store.close();
      return printCompileArtifact(artifact, format, true);
    }
    store.phenotypeCompileArtifacts.create(artifact);
    console.log(JSON.stringify(artifact, null, 2));
    store.close();
  });

const generationPlan = program.command("generation-plan").description("Plan phenotype generation work across graph, group, node, or phenotype scopes");
generationPlan
  .command("create")
  .requiredOption("--id <planId>", "generation plan id")
  .requiredOption("--scope <scopeType>", "scope type: graph|species-group|species-node|phenotype")
  .requiredOption("--scope-id <scopeId>", "scope object id")
  .requiredOption("--priority <number>", "numeric priority; lower runs first", parseInteger)
  .requiredOption("--description <text>", "plan description")
  .option("--graph <graphId>", "graph id for disambiguation")
  .option("--type <phenotypeType>", "explicit phenotype type when no planned phenotype exists")
  .option("--brief <taskBrief>", "explicit task brief when no planned phenotype exists")
  .option("--model <text>", "model preference")
  .option("--provider <text>", "provider preference; never store credentials here")
  .option("--tool <text>", "tool preference")
  .option("--llm-instructions <text>", "LLM-readable non-sensitive instructions")
  .option("--operator-notes <text>", "operator notes")
  .option("--requirement <key=value>", "requirement metadata", collect, [])
  .option("--metadata <key=value>", "metadata", collect, [])
  .option("--extension <key=value>", "extension metadata", collect, [])
  .option("--tag <tag>", "tag", collect, [])
  .option("--version-binding <mode>", "version binding: latest-at-execution|pinned")
  .option("--node-version <nodeVersionId>", "pinned node version id")
  .option("--species-artifact <artifactId>", "pinned species compile artifact id")
  .option("--phenotype-artifact <artifactId>", "pinned phenotype compile artifact id")
  .option("--replay-historical", "allow historical replay for pinned artifacts")
  .option("--apply", "persist the generation plan")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = createGenerationPlan(
      store,
      {
        planId: options.id,
        scopeType: options.scope,
        scopeId: options.scopeId,
        graphId: options.graph,
        priority: options.priority,
        description: options.description,
        phenotypeType: options.type,
        taskBrief: options.brief,
        modelPreference: options.model,
        providerPreference: options.provider,
        toolPreference: options.tool,
        llmInstructions: options.llmInstructions,
        operatorNotes: options.operatorNotes,
        requirements: parseKeyValue(options.requirement),
        metadata: parseKeyValue(options.metadata),
        extensions: parseKeyValue(options.extension),
        tags: options.tag,
        versionBinding: parseVersionBinding(options)
      },
      { apply }
    );
    const format = parseOutputFormat(options.format);
    if (format === "json") console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`${apply ? "Created generation plan" : "Preview generation plan"}\n${formatGenerationPlan(result.plan)}`);
      if (!apply) console.log("Re-run with --apply or --yes to persist the generation plan.");
    }
    store.close();
  });
generationPlan
  .command("list")
  .option("--graph <graphId>", "filter by graph id")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const plans = options.graph ? store.generationPlans.listByGraph(options.graph) : store.generationPlans.list();
    const rows = plans.map((plan) => ({ ...plan, taskCount: store.generationTasks.listByPlan(plan.planId).length }));
    if (parseOutputFormat(options.format) === "json") console.log(JSON.stringify(rows, null, 2));
    else {
      const lines = ["Generation plans:"];
      if (!rows.length) lines.push("- none");
      for (const plan of rows) {
        lines.push(`- ${plan.planId} [${plan.status}] ${plan.scopeType}:${plan.scopeId} priority=${plan.priority} tasks=${plan.taskCount}`);
      }
      console.log(`${lines.join("\n")}\n`);
    }
    store.close();
  });
generationPlan
  .command("show")
  .requiredOption("--id <planId>", "generation plan id")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const plan = store.generationPlans.get(options.id);
    if (!plan) {
      store.close();
      throw new Error(`generation plan not found: ${options.id}`);
    }
    const taskCount = store.generationTasks.listByPlan(plan.planId).length;
    printJsonOrText(parseOutputFormat(options.format), { ...plan, taskCount }, formatGenerationPlan(plan, taskCount));
    store.close();
  });
generationPlan
  .command("expand")
  .requiredOption("--id <planId>", "generation plan id")
  .option("--priority <number>", "override task priority", parseInteger)
  .option("--apply", "persist generated tasks")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const result = expandGenerationPlan(
      store,
      {
        planId: options.id,
        taskOverrides: options.priority !== undefined ? { priority: options.priority } : undefined
      },
      { apply: Boolean(options.apply || shouldApply(command)) }
    );
    printJsonOrText(parseOutputFormat(options.format), result, formatGenerationExpansion(result));
    store.close();
  });

const generationTask = program.command("generation-task").description("Create, inspect, and run phenotype generation tasks");
generationTask
  .command("create")
  .requiredOption("--id <taskId>", "generation task id")
  .requiredOption("--graph <graphId>", "graph id")
  .requiredOption("--type <phenotypeType>", "phenotype type")
  .requiredOption("--brief <taskBrief>", "task brief")
  .requiredOption("--priority <number>", "numeric priority; lower runs first", parseInteger)
  .option("--plan <planId>", "optional generation plan id")
  .option("--node <nodeId>", "species node id")
  .option("--phenotype <phenotypeId>", "planned phenotype id")
  .option("--model <text>", "model preference")
  .option("--provider <text>", "provider preference; never store credentials here")
  .option("--tool <text>", "tool preference")
  .option("--llm-instructions <text>", "LLM-readable non-sensitive instructions")
  .option("--operator-notes <text>", "operator notes")
  .option("--requirement <key=value>", "requirement metadata", collect, [])
  .option("--metadata <key=value>", "metadata", collect, [])
  .option("--extension <key=value>", "extension metadata", collect, [])
  .option("--tag <tag>", "tag", collect, [])
  .option("--version-binding <mode>", "version binding: latest-at-execution|pinned")
  .option("--node-version <nodeVersionId>", "pinned node version id")
  .option("--species-artifact <artifactId>", "pinned species compile artifact id")
  .option("--phenotype-artifact <artifactId>", "pinned phenotype compile artifact id")
  .option("--replay-historical", "allow historical replay for pinned artifacts")
  .option("--apply", "persist the generation task")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const result = createGenerationTask(
      store,
      {
        taskId: options.id,
        graphId: options.graph,
        planId: options.plan,
        nodeId: options.node,
        phenotypeId: options.phenotype,
        phenotypeType: options.type,
        taskBrief: options.brief,
        priority: options.priority,
        modelPreference: options.model,
        providerPreference: options.provider,
        toolPreference: options.tool,
        llmInstructions: options.llmInstructions,
        operatorNotes: options.operatorNotes,
        requirements: parseKeyValue(options.requirement),
        metadata: parseKeyValue(options.metadata),
        extensions: parseKeyValue(options.extension),
        tags: options.tag,
        versionBinding: parseVersionBinding(options)
      },
      { apply: Boolean(options.apply || shouldApply(command)) }
    );
    if (parseOutputFormat(options.format) === "json") console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`${result.persisted ? "Created generation task" : "Preview generation task"}\n${formatGenerationTask(result.task)}`);
      if (!result.persisted) console.log("Re-run with --apply or --yes to persist the generation task.");
    }
    store.close();
  });
generationTask
  .command("list")
  .option("--graph <graphId>", "filter by graph id")
  .option("--plan <planId>", "filter by generation plan id")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const tasks = options.plan ? store.generationTasks.listByPlan(options.plan) : options.graph ? store.generationTasks.listByGraph(options.graph) : store.generationTasks.list();
    if (parseOutputFormat(options.format) === "json") console.log(JSON.stringify(tasks, null, 2));
    else {
      const lines = ["Generation tasks:"];
      if (!tasks.length) lines.push("- none");
      for (const task of tasks) {
        lines.push(`- ${task.taskId} [${task.status}] ${task.phenotypeId ?? task.nodeId ?? "unbound"} ${task.phenotypeType} priority=${task.priority}`);
      }
      console.log(`${lines.join("\n")}\n`);
    }
    store.close();
  });
generationTask
  .command("show")
  .requiredOption("--id <taskId>", "generation task id")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const task = store.generationTasks.get(options.id);
    if (!task) {
      store.close();
      throw new Error(`generation task not found: ${options.id}`);
    }
    printJsonOrText(parseOutputFormat(options.format), task, formatGenerationTask(task));
    store.close();
  });
generationTask
  .command("run-mock")
  .requiredOption("--id <taskId>", "generation task id")
  .option("--apply", "persist generated artifacts, phenotype version, generation job, and task links")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const prepared = preparePhenotypeGenerationForTask(store, { taskId: options.id, tool: "mock" });
    const response = generationResponse(prepared);
    if (!(options.apply || shouldApply(command))) {
      store.close();
      return preview(command, `run generation task ${options.id}`, response);
    }
    persistPhenotypeGeneration(store, prepared, { taskId: options.id });
    printJsonOrText(parseOutputFormat(options.format), response, JSON.stringify(response, null, 2));
    store.close();
  });
generationTask
  .command("link-result")
  .requiredOption("--id <taskId>", "generation task id")
  .option("--job <generationJobId>", "generation job id", collect, [])
  .option("--version <phenotypeVersionId>", "phenotype version id", collect, [])
  .option("--species-artifact <artifactId>", "species compile artifact id")
  .option("--phenotype-artifact <artifactId>", "phenotype compile artifact id")
  .option("--status <status>", "task status after linking", "generated")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const task = store.generationTasks.get(options.id);
    if (!task) {
      store.close();
      throw new Error(`generation task not found: ${options.id}`);
    }
    const linked = {
      ...task,
      status: options.status,
      speciesCompileArtifactId: options.speciesArtifact ?? task.speciesCompileArtifactId,
      phenotypeCompileArtifactId: options.phenotypeArtifact ?? task.phenotypeCompileArtifactId,
      generationJobIds: [...new Set([...task.generationJobIds, ...options.job])],
      phenotypeVersionIds: [...new Set([...task.phenotypeVersionIds, ...options.version])],
      updatedAt: new Date().toISOString()
    };
    store.generationTasks.update(linked);
    printJsonOrText(parseOutputFormat(options.format), linked, formatGenerationTask(linked));
    store.close();
  });

const phenotype = program.command("phenotype").description("Generate and manage phenotypes");
phenotype
  .command("generate")
  .option("--task <taskId>", "generation task id")
  .option("--graph <graphId>", "graph id")
  .option("--node <nodeId>", "node id")
  .option("--type <phenotypeType>", "phenotype type")
  .option("--name <name>", "phenotype name")
  .option("--brief <brief>", "task brief")
  .option("--phenotype-id <phenotypeId>", "existing or explicit phenotype id")
  .option("--species-artifact <artifactId>", "existing species compile artifact id")
  .option("--phenotype-artifact <artifactId>", "existing phenotype compile artifact id")
  .option("--replay-historical", "allow stale compile artifacts for deterministic historical replay")
  .option("--tool <tool>", "tool", "manual")
  .option("--apply", "persist generated artifacts, phenotype version, and generation job")
  .action((options, command) => {
    const store = openStore(command);
    const prepared = options.task
      ? preparePhenotypeGenerationForTask(store, { taskId: options.task, tool: options.tool, name: options.name })
      : preparePhenotypeGeneration(store, {
          graphId: requiredOption(options.graph, "--graph"),
          nodeId: requiredOption(options.node, "--node"),
          phenotypeType: requiredOption(options.type, "--type"),
          name: requiredOption(options.name, "--name"),
          taskBrief: requiredOption(options.brief, "--brief"),
          phenotypeId: options.phenotypeId,
          speciesArtifactId: options.speciesArtifact,
          phenotypeArtifactId: options.phenotypeArtifact,
          replayHistorical: Boolean(options.replayHistorical),
          tool: options.tool
        });
    const response = {
      ...generationResponse(prepared),
      nextAction:
        !options.task && prepared.phenotype.status === "planned"
          ? `Create a generation task to track orchestration for planned phenotype ${prepared.phenotype.phenotypeId}.`
          : undefined
    };
    if (!options.apply && !shouldApply(command)) {
      store.close();
      return preview(command, `generate phenotype ${prepared.phenotype.phenotypeId}`, response);
    }
    persistPhenotypeGeneration(store, prepared, { taskId: options.task });
    console.log(JSON.stringify(response, null, 2));
    store.close();
  });

const phenotypeVersion = program.command("phenotype-version").description("Review and update phenotype version lifecycle metadata");
phenotypeVersion
  .command("show")
  .requiredOption("--id <phenotypeVersionId>", "phenotype version id")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const version = store.phenotypeVersions.get(options.id);
    if (!version) {
      store.close();
      throw new Error(`phenotype version not found: ${options.id}`);
    }
    const projection = phenotypeVersionProjection(store, version);
    printJsonOrText(parseOutputFormat(options.format), projection, formatPhenotypeVersionShow(projection));
    store.close();
  });

function addLifecycleApplyAndFormat(command: Command) {
  return command.option("--feedback <text>", "feedback item message").option("--apply", "persist lifecycle metadata").option("--format <format>", "output format: text|json");
}

addLifecycleApplyAndFormat(phenotypeVersion.command("submit-candidate").requiredOption("--id <phenotypeVersionId>", "phenotype version id"))
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = submitPhenotypeVersionCandidate(store, { phenotypeVersionId: options.id, feedback: options.feedback, apply });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });
addLifecycleApplyAndFormat(phenotypeVersion.command("accept").requiredOption("--id <phenotypeVersionId>", "phenotype version id"))
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = acceptPhenotypeVersion(store, { phenotypeVersionId: options.id, feedback: options.feedback, apply });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });
addLifecycleApplyAndFormat(phenotypeVersion.command("reject").requiredOption("--id <phenotypeVersionId>", "phenotype version id"))
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = rejectPhenotypeVersion(store, { phenotypeVersionId: options.id, feedback: options.feedback, apply });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });
addLifecycleApplyAndFormat(
  phenotypeVersion
    .command("replace")
    .requiredOption("--old <phenotypeVersionId>", "current accepted version id")
    .requiredOption("--new <phenotypeVersionId>", "candidate replacement version id")
).action((options, command) => {
  const store = openStore(command);
  const apply = Boolean(options.apply || shouldApply(command));
  const result = replacePhenotypeVersion(store, {
    oldPhenotypeVersionId: options.old,
    newPhenotypeVersionId: options.new,
    feedback: options.feedback,
    apply
  });
  printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
  store.close();
});
addLifecycleApplyAndFormat(phenotypeVersion.command("deprecate").requiredOption("--id <phenotypeVersionId>", "phenotype version id"))
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = deprecatePhenotypeVersion(store, { phenotypeVersionId: options.id, feedback: options.feedback, apply });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });
addLifecycleApplyAndFormat(
  phenotypeVersion
    .command("rollback")
    .requiredOption("--phenotype <phenotypeId>", "phenotype id")
    .requiredOption("--to <phenotypeVersionId>", "historical version id to restore")
).action((options, command) => {
  const store = openStore(command);
  const apply = Boolean(options.apply || shouldApply(command));
  const result = rollbackPhenotypeVersion(store, {
    phenotypeId: options.phenotype,
    toPhenotypeVersionId: options.to,
    feedback: options.feedback,
    apply
  });
  printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
  store.close();
});
addLifecycleApplyAndFormat(phenotypeVersion.command("archive").requiredOption("--id <phenotypeVersionId>", "phenotype version id"))
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = archivePhenotypeVersion(store, { phenotypeVersionId: options.id, feedback: options.feedback, apply });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });
addLifecycleApplyAndFormat(phenotypeVersion.command("delete").requiredOption("--id <phenotypeVersionId>", "phenotype version id"))
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = deletePhenotypeVersion(store, { phenotypeVersionId: options.id, feedback: options.feedback, apply });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });

const phenotypeVersionFeedback = phenotypeVersion.command("feedback").description("Manage phenotype version feedback metadata");
phenotypeVersionFeedback
  .command("add")
  .requiredOption("--id <phenotypeVersionId>", "phenotype version id")
  .requiredOption("--message <text>", "feedback message")
  .option("--severity <severity>", "info|warning|blocking", "info")
  .option("--source <source>", "human|agent|system", "human")
  .option("--suggested-action <text>", "suggested follow-up action")
  .option("--apply", "persist feedback metadata")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = addPhenotypeVersionFeedback(store, {
      phenotypeVersionId: options.id,
      message: options.message,
      severity: parseFeedbackSeverity(options.severity),
      source: parseFeedbackSource(options.source),
      suggestedAction: options.suggestedAction,
      apply
    });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
    store.close();
  });
phenotypeVersionFeedback
  .command("summary")
  .requiredOption("--id <phenotypeVersionId>", "phenotype version id")
  .requiredOption("--summary <text>", "feedback summary")
  .option("--apply", "persist feedback summary")
  .option("--format <format>", "output format: text|json")
  .action((options, command) => {
    const store = openStore(command);
    const apply = Boolean(options.apply || shouldApply(command));
    const result = updatePhenotypeVersionFeedbackSummary(store, {
      phenotypeVersionId: options.id,
      summary: options.summary,
      apply
    });
    printJsonOrText(parseOutputFormat(options.format), result, formatLifecycleResult(result));
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
  .option("--relationship <relationshipId>", "changed design relationship id")
  .option("--group <groupId>", "changed species group id")
  .option("--context <contextId>", "changed design context id")
  .option("--changed-version <versionId>", "changed version id", "latest")
  .action((options, command) => {
  const store = openStore(command);
  const selected = [options.node, options.relationship, options.group, options.context].filter(Boolean);
  if (selected.length !== 1) {
    store.close();
    throw new Error("Provide exactly one of --node, --relationship, --group, or --context");
  }
  const changed = options.relationship
    ? ({ type: "design-relationship", id: options.relationship, versionId: options.changedVersion } as const)
    : options.node
      ? ({ type: "node", id: options.node, versionId: options.changedVersion } as const)
      : undefined;
  const lineageImpacts = collectLineageImpact(store, {
    graphId: options.graph,
    nodeId: options.node,
    relationshipId: options.relationship,
    changedVersionId: options.changedVersion
  });
  const impacts: ApplicationImpactSummary[] =
    lineageImpacts ??
    (options.group
      ? collectGroupImpact(store, { graphId: options.graph, groupId: options.group })
      : options.relationship
        ? collectDesignRelationshipImpact(store, { relationshipId: options.relationship })
        : collectContextImpact(store, { graphId: options.graph, contextId: options.context }));
  if (shouldApply(command)) {
    const changedObjectType = options.group ? "species-group" : options.relationship ? "design-relationship" : "design-context";
    const changedObjectId = options.group ?? options.relationship ?? options.context;
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
impact.command("list").requiredOption("--type <objectType>", "node or design-relationship").requiredOption("--id <objectId>", "changed object id").action((options, command) => {
  if (options.type !== "node" && options.type !== "design-relationship") throw new Error("--type must be node or design-relationship");
  const store = openStore(command);
  console.log(JSON.stringify(store.impacts.listByChangedObject(options.type, options.id), null, 2));
  store.close();
 });

const modeling = program.command("modeling").description("Review modeling quality for batches, graphs, and proposals");
modeling
  .command("check")
  .option("--batch <file>", "dna.modeling-batch.v1 JSON file")
  .option("--graph <graphId>", "persisted graph id")
  .option("--proposal <proposalId>", "local proposal id")
  .option("--format <format>", "output format: text or json", "text")
  .action((options, command) => {
    const targets = [options.batch, options.graph, options.proposal].filter(Boolean);
    if (targets.length !== 1) throw new Error("modeling check requires exactly one of --batch, --graph, or --proposal");
    let report: ModelingQualityReport;
    if (options.batch) {
      report = checkModelingBatchQuality(JSON.parse(readFileSync(options.batch, "utf8")));
    } else {
      const store = openStore(command);
      report = options.graph ? checkGraphModelingQuality(store, options.graph) : checkProposalModelingQuality(store, options.proposal);
      store.close();
    }
    if (options.format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else if (options.format === "text") {
      process.stdout.write(formatModelingQualityReport(report));
    } else {
      throw new Error(`unknown modeling check format: ${options.format}`);
    }
  });

const proposal = program.command("proposal").description("Manage local proposal packages of preview change-sets");
proposal
  .command("create")
  .option("--id <proposalId>", "proposal id")
  .option("--title <title>", "proposal title")
  .option("--summary <summary>", "proposal summary", "")
  .option("--risk-note <note>", "proposal risk note", collect, [])
  .option("--review-note <note>", "proposal review note", collect, [])
  .action((options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const value = services.proposal.create({
      proposalId: requiredOption(options.id, "--id"),
      title: requiredOption(options.title, "--title"),
      summary: options.summary,
      riskNotes: options.riskNote,
      reviewNotes: options.reviewNote
    });
    console.log(JSON.stringify(value, null, 2));
    store.close();
  });
proposal
  .command("import-batch")
  .requiredOption("--in <file>", "dna.modeling-batch.v1 JSON file")
  .requiredOption("--id <proposalId>", "proposal id for preview-confirm mode")
  .requiredOption("--title <title>", "proposal title for preview-confirm mode")
  .option("--summary <summary>", "proposal summary", "")
  .option("--mode <mode>", "import mode: preview-confirm or draft-write", "preview-confirm")
  .option("--format <format>", "report format: text or json", "text")
  .option("--include-ids", "include generated change-set ids in the report")
  .action((options, command) => {
    const importMode = (command as Command).optsWithGlobals<CommandOptions>().mode ?? options.mode;
    if (importMode === "changeset-apply") throw new Error("changeset-apply is not an import-batch mode");
    if (importMode !== "preview-confirm" && importMode !== "draft-write") {
      throw new Error(`unknown import-batch mode: ${importMode}`);
    }
    const store = openStore(command);
    const services = createDnaServices(store);
    const batch = JSON.parse(readFileSync(options.in, "utf8"));
    const result = services.proposal.importBatch({
      proposalId: options.id,
      title: options.title,
      summary: options.summary,
      batch,
      mode: importMode
    });
    if (options.format === "json") {
      console.log(JSON.stringify(formatImportBatchJson(result, Boolean(options.includeIds)), null, 2));
    } else if (options.format === "text") {
      process.stdout.write(formatImportBatchReport(result, Boolean(options.includeIds)));
    } else {
      throw new Error(`unknown import-batch report format: ${options.format}`);
    }
    store.close();
  });
proposal.command("list").action((_options, command) => {
  const store = openStore(command);
  const services = createDnaServices(store);
  console.log(JSON.stringify(services.proposal.list(), null, 2));
  store.close();
});
proposal
  .command("show")
  .argument("<proposalId>", "proposal id")
  .action((proposalId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const value = services.proposal.get(proposalId);
    if (!value) {
      store.close();
      throw new Error(`proposal not found: ${proposalId}`);
    }
    console.log(JSON.stringify({ proposal: value, review: services.proposal.show(proposalId) }, null, 2));
    store.close();
  });
proposal
  .command("add-change-set")
  .argument("<proposalId>", "proposal id")
  .option("--change-set <changeSetId>", "preview change-set id to add")
  .action((proposalId, options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    const changeSetId = options.changeSet ?? (command as Command).optsWithGlobals<CommandOptions>().changeSet;
    console.log(JSON.stringify(services.proposal.addChangeSet(proposalId, requiredOption(changeSetId, "--change-set")), null, 2));
    store.close();
  });
proposal
  .command("review")
  .argument("<proposalId>", "proposal id")
  .action((proposalId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    console.log(JSON.stringify(services.proposal.review(proposalId), null, 2));
    store.close();
  });
proposal
  .command("apply")
  .argument("<proposalId>", "proposal id")
  .action((proposalId, _options, command) => {
    const options = (command as Command).optsWithGlobals<CommandOptions>();
    if (!options.yes) throw new Error("proposal apply requires --yes");
    const store = openStore(command);
    const services = createDnaServices(store);
    console.log(JSON.stringify(services.proposal.apply(proposalId), null, 2));
    store.close();
  });
proposal
  .command("discard")
  .argument("<proposalId>", "proposal id")
  .action((proposalId, _options, command) => {
    const store = openStore(command);
    const services = createDnaServices(store);
    console.log(JSON.stringify(services.proposal.discard(proposalId), null, 2));
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

function addExportOptions(command: Command) {
  return command
    .requiredOption("--out <directory>", "output directory")
    .option("--profile <profile>", "export profile: full, review-current, proposal-review", "full")
    .option("--proposal <proposalId>", "proposal id required for --profile proposal-review");
}

addExportOptions(program.command("export")).action((options, command) => {
  const store = openStore(command);
  exportProject(store, options.out, { profile: parseExportProfile(options.profile), proposalId: options.proposal });
  console.log(`exported DNA project to ${options.out}`);
  store.close();
});

const sync = program.command("sync").description("Exchange DNA projects through Git-friendly directories");
addExportOptions(sync.command("export")).action((options, command) => {
  const store = openStore(command);
  exportProject(store, options.out, { profile: parseExportProfile(options.profile), proposalId: options.proposal });
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

function formatContextMapText(input: {
  context: {
    contextId: string;
    name: string;
    contextType: string;
    summary: string;
    status?: string;
    confidence?: string;
    owner?: string;
    version?: string;
    sourceRefs?: string[];
    negativeBoundaries?: string[];
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
  lines.push(`Summary: ${contextValue.summary ?? ""}`);
  lines.push(`Status: ${contextValue.status ?? "none"}`);
  lines.push(`Confidence: ${contextValue.confidence ?? "none"}`);
  lines.push(`Owner: ${contextValue.owner ?? "none"}`);
  lines.push(`Version: ${contextValue.version ?? "none"}`);

  lines.push("Source Refs:");
  if (!contextValue.sourceRefs?.length) {
    lines.push("- none");
  } else {
    for (const sourceRef of contextValue.sourceRefs) lines.push(`- ${sourceRef}`);
  }

  lines.push("Negative Boundaries:");
  if (!contextValue.negativeBoundaries?.length) {
    lines.push("- none");
  } else {
    for (const boundary of contextValue.negativeBoundaries) lines.push(`- ${boundary}`);
  }

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
  relationships: Array<{
    source: { type: string; groupId?: string };
    target: { type: string; groupId?: string };
    relationshipType: string;
    description: string;
  }>;
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
  lines.push("Design Relationships:");
  if (!input.relationships.length) {
    lines.push("- none");
  } else {
    for (const relationshipValue of input.relationships) {
      const description = relationshipValue.description ? ` - ${relationshipValue.description}` : "";
      lines.push(`- ${relationshipValue.source.groupId} -> ${relationshipValue.target.groupId} [${relationshipValue.relationshipType}]${description}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatAtlasMapText(input: {
  atlas: { atlasId: string; name: string; graphIds: string[] };
  graphs: Array<{ graphId: string; name: string } | undefined>;
  relationships: Array<{
    source: { type: string; graphId?: string };
    target: { type: string; graphId?: string };
    relationshipType: string;
    description: string;
    designContract: {
      transferRule?: string;
      mustPreserve: string[];
      mustAvoid: string[];
      divergenceRule?: string;
      reviewQuestions: string[];
    };
  }>;
}) {
  const lines = [`Atlas Map: ${input.atlas.name} (${input.atlas.atlasId})`, "Graphs:"];
  const graphById = new Map(input.graphs.filter((graphValue): graphValue is { graphId: string; name: string } => Boolean(graphValue)).map((graphValue) => [graphValue.graphId, graphValue]));
  for (const graphId of input.atlas.graphIds) {
    const graphValue = graphById.get(graphId);
    lines.push(`- ${graphValue?.name ?? graphId} (${graphId})`);
  }
  lines.push("Design Relationships:");
  if (!input.relationships.length) {
    lines.push("- none");
  } else {
    for (const relationshipValue of input.relationships) {
      const description = relationshipValue.description ? ` - ${relationshipValue.description}` : "";
      lines.push(`- graph:${relationshipValue.source.graphId} -> graph:${relationshipValue.target.graphId} [${relationshipValue.relationshipType}]${description}`);
      if (relationshipValue.designContract.transferRule) lines.push(`  Transfer Rule: ${relationshipValue.designContract.transferRule}`);
      if (relationshipValue.designContract.mustPreserve.length) {
        lines.push(`  Must Preserve: ${relationshipValue.designContract.mustPreserve.join(", ")}`);
      }
      if (relationshipValue.designContract.mustAvoid.length) {
        lines.push(`  Must Avoid: ${relationshipValue.designContract.mustAvoid.join(", ")}`);
      }
      if (relationshipValue.designContract.divergenceRule) lines.push(`  Divergence Rule: ${relationshipValue.designContract.divergenceRule}`);
      if (relationshipValue.designContract.reviewQuestions.length) {
        lines.push(`  Review Questions: ${relationshipValue.designContract.reviewQuestions.join("; ")}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function parseFeedbackSeverity(value: string | undefined): PhenotypeVersionFeedbackItem["severity"] {
  if (value === undefined) return "info";
  if (value === "info" || value === "warning" || value === "blocking") return value;
  throw new Error(`unknown feedback severity: ${value}`);
}

function parseFeedbackSource(value: string | undefined): PhenotypeVersionFeedbackItem["source"] {
  if (value === undefined) return "human";
  if (value === "human" || value === "agent" || value === "system") return value;
  throw new Error(`unknown feedback source: ${value}`);
}

function uniqueCli(values: string[]) {
  return [...new Set(values)];
}

function phenotypeVersionProjection(store: SqliteDnaStore, version: PhenotypeVersion) {
  const jobs = store.generationJobs
    .listByGraph(version.graphId)
    .filter((job) => job.phenotypeVersionId === version.phenotypeVersionId);
  const tasks = store.generationTasks
    .listByGraph(version.graphId)
    .filter((task) => task.phenotypeVersionIds.includes(version.phenotypeVersionId));
  const jobTaskIds = jobs
    .map((job) => job.inputSnapshot.generationTaskId)
    .filter((value): value is string => typeof value === "string");
  const jobPlanIds = jobs
    .map((job) => job.inputSnapshot.generationPlanId)
    .filter((value): value is string => typeof value === "string");
  return {
    ...version,
    provenance: {
      generationJobIds: uniqueCli(jobs.map((job) => job.generationJobId)),
      generationTaskIds: uniqueCli([...tasks.map((task) => task.taskId), ...jobTaskIds]),
      generationPlanIds: uniqueCli([
        ...tasks.map((task) => task.planId).filter((value): value is string => Boolean(value)),
        ...jobPlanIds
      ])
    }
  };
}

function formatPhenotypeVersionShow(value: ReturnType<typeof phenotypeVersionProjection>) {
  const lines = [
    `Phenotype version: ${value.phenotypeVersionId}`,
    `Status: ${value.status}`,
    `Phenotype: ${value.phenotypeId}`,
    `Graph: ${value.graphId}`,
    `Node: ${value.nodeId}`,
    `Node version: ${value.nodeVersionId}`,
    `Generation jobs: ${value.provenance.generationJobIds.length ? value.provenance.generationJobIds.join(", ") : "none"}`,
    `Generation tasks: ${value.provenance.generationTaskIds.length ? value.provenance.generationTaskIds.join(", ") : "none"}`,
    `Generation plans: ${value.provenance.generationPlanIds.length ? value.provenance.generationPlanIds.join(", ") : "none"}`,
    `Feedback summary: ${value.feedback.summary ?? "none"}`,
    "Feedback:"
  ];
  if (!value.feedback.items.length) lines.push("- none");
  for (const item of value.feedback.items) {
    const suggested = item.suggestedAction ? ` Suggested: ${item.suggestedAction}` : "";
    lines.push(`- [${item.severity}/${item.source}] ${item.message}${suggested}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatLifecycleResult(result: {
  action: string;
  persisted: boolean;
  statusChanges: Array<{ phenotypeVersionId: string; from: string; to: string }>;
  currentAcceptedVersion: { before: string | null; after: string | null };
  feedbackChanges: Array<{ phenotypeVersionId: string; addedFeedbackItemIds: string[]; summaryBefore?: string; summaryAfter?: string }>;
  provenance: { generationJobIds: string[]; generationTaskIds: string[]; generationPlanIds: string[] };
  warnings: string[];
}) {
  const lines = [
    `${result.persisted ? "Applied" : "Preview"} phenotype version lifecycle`,
    `Action: ${result.action}`,
    "Status changes:"
  ];
  if (!result.statusChanges.length) lines.push("- none");
  for (const change of result.statusChanges) {
    lines.push(`- ${change.phenotypeVersionId}: ${change.from} -> ${change.to}`);
  }
  lines.push(`Current accepted: ${result.currentAcceptedVersion.before ?? "none"} -> ${result.currentAcceptedVersion.after ?? "none"}`);
  lines.push("Feedback changes:");
  if (!result.feedbackChanges.length) lines.push("- none");
  for (const change of result.feedbackChanges) {
    const summary =
      change.summaryBefore !== change.summaryAfter
        ? ` summary: ${change.summaryBefore ?? "none"} -> ${change.summaryAfter ?? "none"}`
        : "";
    const items = change.addedFeedbackItemIds.length ? ` items: ${change.addedFeedbackItemIds.join(", ")}` : "";
    lines.push(`- ${change.phenotypeVersionId}:${summary}${items}`.trimEnd());
  }
  lines.push(`Generation jobs: ${result.provenance.generationJobIds.length ? result.provenance.generationJobIds.join(", ") : "none"}`);
  lines.push(`Generation tasks: ${result.provenance.generationTaskIds.length ? result.provenance.generationTaskIds.join(", ") : "none"}`);
  lines.push(`Generation plans: ${result.provenance.generationPlanIds.length ? result.provenance.generationPlanIds.join(", ") : "none"}`);
  if (result.warnings.length) lines.push(`Warnings: ${result.warnings.join("; ")}`);
  if (!result.persisted) lines.push("Re-run with --apply or --yes to persist lifecycle metadata.");
  return `${lines.join("\n")}\n`;
}

function parseRelationshipEndpoint(value: string) {
  const parts = value.split(":");
  if (parts[0] === "graph" && parts.length === 2 && parts[1]) return { type: "graph" as const, graphId: parts[1] };
  if (parts[0] === "species-group" && parts.length === 3 && parts[1] && parts[2]) {
    return { type: "species-group" as const, graphId: parts[1], groupId: parts[2] };
  }
  if (parts[0] === "species-node" && parts.length === 3 && parts[1] && parts[2]) {
    return { type: "species-node" as const, graphId: parts[1], nodeId: parts[2] };
  }
  throw new Error(`invalid design relationship endpoint: ${value}`);
}

function formatRelationshipEndpoint(endpoint: ReturnType<typeof parseRelationshipEndpoint>) {
  if (endpoint.type === "graph") return `graph:${endpoint.graphId}`;
  if (endpoint.type === "species-group") return `species-group:${endpoint.graphId}:${endpoint.groupId}`;
  return `species-node:${endpoint.graphId}:${endpoint.nodeId}`;
}

function formatRelationshipText(relationshipValue: {
  relationshipId: string;
  source: ReturnType<typeof parseRelationshipEndpoint>;
  target: ReturnType<typeof parseRelationshipEndpoint>;
  relationshipType: string;
  direction: string;
  description: string;
  designContract: {
    transferRule?: string;
    mustPreserve: string[];
    mustAvoid: string[];
    divergenceRule?: string;
    reviewQuestions: string[];
  };
}) {
  const lines = [
    `Design Relationship: ${relationshipValue.relationshipId}`,
    `Endpoints: ${formatRelationshipEndpoint(relationshipValue.source)} -> ${formatRelationshipEndpoint(relationshipValue.target)}`,
    `Type: ${relationshipValue.relationshipType}`,
    `Direction: ${relationshipValue.direction}`,
    `Description: ${relationshipValue.description}`
  ];
  lines.push(`Transfer Rule: ${relationshipValue.designContract.transferRule ?? "none"}`);
  lines.push(
    `Must Preserve: ${relationshipValue.designContract.mustPreserve.length ? relationshipValue.designContract.mustPreserve.join(", ") : "none"}`
  );
  lines.push(`Must Avoid: ${relationshipValue.designContract.mustAvoid.length ? relationshipValue.designContract.mustAvoid.join(", ") : "none"}`);
  lines.push(`Divergence Rule: ${relationshipValue.designContract.divergenceRule ?? "none"}`);
  lines.push(
    `Review Questions: ${relationshipValue.designContract.reviewQuestions.length ? relationshipValue.designContract.reviewQuestions.join("; ") : "none"}`
  );
  return `${lines.join("\n")}\n`;
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
