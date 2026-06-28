import {
  Atlas,
  ChangeSet,
  createChangeSet,
  createDefaultAtlas,
  createDefaultContextAttachment,
  createDefaultContextFact,
  createDefaultContextMotif,
  createDefaultContextReference,
  createDefaultContextReviewRubric,
  createDefaultDesignContext,
  createDefaultDesignPrinciple,
  createDefaultDesignRelationship,
  createDefaultGraph,
  createDefaultExternalLibraryMapping,
  createDefaultLibraryRoutingPolicy,
  createDefaultNodeVersion,
  createDefaultPhenotypeLibrary,
  createDefaultPhenotypeLibraryGraphBinding,
  createDefaultProposal,
  createDefaultSpeciesGroup,
  createDefaultSpeciesGroupMembership,
  createDefaultSpeciesNode,
  createDefaultStorageMount,
  ContextAttachment,
  ContextFact,
  ContextMotif,
  ContextReference,
  ContextReviewRubric,
  DesignContext,
  DesignPrinciple,
  DesignRelationship,
  ExternalLibraryMapping,
  Graph,
  LibraryRoutingPolicy,
  markChangeSetApplied,
  markChangeSetDiscarded,
  ModelingBatch,
  ModelingBatchSchema,
  nowIso,
  PhenotypeLibrary,
  PhenotypeLibraryGraphBinding,
  Proposal,
  resolveLineageStatus,
  SpeciesGroup,
  SpeciesGroupMembership,
  SpeciesNode,
  StorageMount,
  validateDesignRelationshipSet,
  WriteMode
} from "@dna/core";
import { DnaServiceStore } from "./memory.js";

export interface WriteOptions {
  mode: WriteMode;
  apply?: boolean;
  changeSetId?: string;
}

export interface ServiceResult<T> {
  value: T;
  changeSet: ChangeSet;
}

export interface ChangeSetFilter {
  status?: ChangeSet["status"];
  objectType?: string;
}

export interface ChangeSetReviewResult {
  changeSetId: string;
  objectType: string;
  operation: ChangeSet["operation"];
  status: "pass" | "needs-review" | "fail";
  missingDimensions: string[];
  constraintViolations: string[];
  suggestedActions: string[];
  previewSummary: string;
}

export interface CreateGraphInput {
  graphId: string;
  name: string;
  purpose: string;
  status?: Graph["status"];
  templateIds?: string[];
}

export interface CreateNodeInput {
  graphId: string;
  nodeId: string;
  name: string;
  category: string;
  level: string;
  parentNodes?: string[];
  primaryParent?: string;
  parentRoles?: SpeciesNode["parentRoles"];
  motifs?: string[];
  constraints?: Record<string, unknown>;
  badcases?: string[];
}

export interface CreateSpeciesGroupInput {
  graphId: string;
  groupId: string;
  name: string;
  groupType?: SpeciesGroup["groupType"];
  parentGroupIds?: string[];
  templateIds?: string[];
  sharedFacts?: string[];
  facetSchemaIds?: string[];
  phenotypeTypeSuggestions?: string[];
  compilePolicy?: SpeciesGroup["compilePolicy"];
  reviewPolicy?: Record<string, unknown>;
  owner?: string;
  status?: SpeciesGroup["status"];
  extensions?: Record<string, unknown>;
}

export interface AddSpeciesGroupMemberInput {
  membershipId: string;
  graphId: string;
  groupId: string;
  nodeId: string;
  role?: SpeciesGroupMembership["role"];
  status?: SpeciesGroupMembership["status"];
}

export interface CreateAtlasInput {
  atlasId: string;
  name: string;
  purpose: string;
  graphIds?: string[];
  status?: Atlas["status"];
  metadata?: Record<string, unknown>;
}

export interface AddAtlasGraphInput {
  atlasId: string;
  graphId: string;
}

export interface CreateDesignRelationshipInput {
  relationshipId: string;
  source: DesignRelationship["source"];
  target: DesignRelationship["target"];
  relationshipType: DesignRelationship["relationshipType"];
  direction?: DesignRelationship["direction"];
  description?: string;
  designContract?: Partial<DesignRelationship["designContract"]>;
  auxiliaryRefs?: Partial<DesignRelationship["auxiliaryRefs"]>;
  status?: DesignRelationship["status"];
  metadata?: Record<string, unknown>;
  allowParallel?: boolean;
}

export interface CreateDesignContextInput {
  contextId: string;
  name: string;
  contextType: DesignContext["contextType"];
  summary?: string;
  status?: DesignContext["status"];
  factIds?: string[];
  principleIds?: string[];
  motifIds?: string[];
  referenceIds?: string[];
  reviewRubricIds?: string[];
  negativeBoundaries?: string[];
  sourceRefs?: string[];
  confidence?: DesignContext["confidence"];
  owner?: string;
  version?: string;
  extensions?: Record<string, unknown>;
}

export interface CreateContextAttachmentInput {
  attachmentId: string;
  contextId: string;
  targetType: ContextAttachment["targetType"];
  targetId: string;
  role?: ContextAttachment["role"];
  strength?: ContextAttachment["strength"];
  inheritance?: ContextAttachment["inheritance"];
  compileLayer?: ContextAttachment["compileLayer"];
  status?: ContextAttachment["status"];
}

export interface CreateContextFactInput {
  factId: string;
  factType: ContextFact["factType"];
  statement: string;
  scopeHint?: string;
  defaultStrength?: ContextFact["defaultStrength"];
  defaultBehaviorHint?: ContextFact["defaultBehaviorHint"];
  sourceTrace?: string[];
  status?: ContextFact["status"];
}

export interface CreateDesignPrincipleInput {
  principleId: string;
  statement: string;
  priority?: DesignPrinciple["priority"];
  scopeHint?: string;
  defaultBehaviorHint?: DesignPrinciple["defaultBehaviorHint"];
  experienceIntent?: string;
  readabilityGoal?: string;
  platformContext?: string;
  reviewQuestions?: string[];
  badcases?: string[];
  status?: DesignPrinciple["status"];
}

export interface CreateContextMotifInput {
  motifId: string;
  motifType: ContextMotif["motifType"];
  statement: string;
  sourceRef?: string;
  visualMotifRef?: string;
  note?: string;
  status?: ContextMotif["status"];
}

export interface CreateContextReferenceInput {
  referenceId: string;
  referenceType: ContextReference["referenceType"];
  sourceRef: ContextReference["sourceRef"];
  referenceRole?: ContextReference["referenceRole"];
  useFor?: string[];
  doNotUseFor?: string[];
  note?: string;
  risk?: string[];
  status?: ContextReference["status"];
}

export interface CreateContextReviewRubricInput {
  rubricId: string;
  dimension: ContextReviewRubric["dimension"];
  question: string;
  passSignal?: string;
  failSignal?: string;
  severity?: ContextReviewRubric["severity"];
  status?: ContextReviewRubric["status"];
}

export interface CreateProposalInput {
  proposalId: string;
  title: string;
  summary?: string;
  changeSetIds?: string[];
  riskNotes?: string[];
  reviewNotes?: string[];
}

export interface ProposalReviewResult {
  proposal: Proposal;
  status: Proposal["status"];
  blockers: string[];
  childReviews: ChangeSetReviewResult[];
}

export interface ProposalApplyResult {
  proposal: Proposal;
  appliedChangeSetIds: string[];
  childResults: ServiceResult<unknown>[];
}

export interface ImportModelingBatchInput {
  proposalId: string;
  title: string;
  summary?: string;
  batch: unknown;
  mode: "preview-confirm" | "draft-write";
}

export interface ImportModelingBatchResult {
  mode: "preview-confirm" | "draft-write";
  proposal: Proposal | null;
  changeSetIds: string[];
  counts: {
    planned: Record<string, number>;
    applied: Record<string, number>;
    skipped: Record<string, number>;
  };
  includesCrossGraphReferences: boolean;
  includesLibraryObjects: boolean;
  warning?: string;
}

export function createDnaServices(store: DnaServiceStore) {
  return {
    graph: {
      createGraph(input: CreateGraphInput, options: WriteOptions): ServiceResult<Graph> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyGraphChangeSet(store, existing);
        }
        const graph = createDefaultGraph({
          graphId: input.graphId,
          name: input.name,
          purpose: input.purpose,
          status: options.mode === "draft-write" ? "draft" : input.status ?? "draft",
          templateIds: input.templateIds ?? []
        });
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "graph",
          operation: "create",
          summary: `create graph ${graph.graphId}`,
          diff: { graphId: graph.graphId, name: graph.name, status: graph.status },
          payload: { graph }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyGraphChangeSet(store, changeSet);
        }
        return { value: graph, changeSet };
      },
      previewReset(graphId: string) {
        return store.previewGraphReset(graphId);
      },
      reset(graphId: string) {
        return store.resetGraph(graphId);
      }
    },
    lineage: {
      createNode(input: CreateNodeInput, options: WriteOptions): ServiceResult<{ node: SpeciesNode; nodeVersionId: string }> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyNodeChangeSet(store, existing);
        }
        const node = createDefaultSpeciesNode({
          graphId: input.graphId,
          nodeId: input.nodeId,
          name: input.name,
          category: input.category,
          level: input.level,
          parentNodes: input.parentNodes ?? [],
          primaryParent: input.primaryParent,
          parentRoles: input.parentRoles ?? {},
          motifs: input.motifs ?? [],
          constraints: input.constraints ?? {},
          badcases: input.badcases ?? []
        });
        const version = createDefaultNodeVersion({
          graphId: node.graphId,
          nodeId: node.nodeId,
          nodeVersionId: `${node.nodeId}@${node.currentVersion}`,
          ownGeneDelta: node.constraints,
          resolvedGeneSnapshot: { ...node.constraints, motifs: node.motifs, badcases: node.badcases },
          constraintSnapshot: node.constraints,
          compileSnapshot: node.compilePolicy ?? { type: "system-rule-first" }
        });
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "node",
          operation: "create",
          summary: `create node ${node.nodeId}`,
          diff: { nodeId: node.nodeId, graphId: node.graphId, version: version.nodeVersionId },
          payload: { node, version }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyNodeChangeSet(store, changeSet);
        }
        return { value: { node, nodeVersionId: version.nodeVersionId }, changeSet };
      }
    },
    relationship: {
      createRelationship(input: CreateDesignRelationshipInput, options: WriteOptions): ServiceResult<DesignRelationship> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyDesignRelationshipChangeSet(store, existing);
        }
        const relationship = createDefaultDesignRelationship({
          ...input,
          designContract: {
            transferRule: input.designContract?.transferRule ?? "",
            mustPreserve: input.designContract?.mustPreserve ?? [],
            mustAvoid: input.designContract?.mustAvoid ?? [],
            divergenceRule: input.designContract?.divergenceRule ?? "",
            reviewQuestions: input.designContract?.reviewQuestions ?? []
          },
          auxiliaryRefs: {
            contextIds: input.auxiliaryRefs?.contextIds ?? [],
            motifIds: input.auxiliaryRefs?.motifIds ?? [],
            principleIds: input.auxiliaryRefs?.principleIds ?? [],
            facetIds: input.auxiliaryRefs?.facetIds ?? [],
            rubricIds: input.auxiliaryRefs?.rubricIds ?? [],
            referenceIds: input.auxiliaryRefs?.referenceIds ?? []
          }
        });
        validatePendingDesignRelationship(store, relationship, Boolean(input.allowParallel));
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "design-relationship",
          operation: "create",
          summary: `create design relationship ${relationship.relationshipId}`,
          diff: {
            relationshipId: relationship.relationshipId,
            source: relationship.source,
            target: relationship.target,
            relationshipType: relationship.relationshipType,
            direction: relationship.direction,
            contract: Boolean(relationship.designContract.transferRule || relationship.designContract.mustPreserve.length || relationship.designContract.mustAvoid.length)
          },
          payload: { relationship, allowParallel: Boolean(input.allowParallel) }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyDesignRelationshipChangeSet(store, changeSet);
        }
        return { value: relationship, changeSet };
      }
    },
    group: {
      createGroup(input: CreateSpeciesGroupInput, options: WriteOptions): ServiceResult<SpeciesGroup> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applySpeciesGroupChangeSet(store, existing);
        }
        const group = createDefaultSpeciesGroup(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "species-group",
          operation: "create",
          summary: `create species group ${group.groupId}`,
          diff: { groupId: group.groupId, graphId: group.graphId, status: group.status },
          payload: { group }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applySpeciesGroupChangeSet(store, changeSet);
        }
        return { value: group, changeSet };
      },
      addMember(input: AddSpeciesGroupMemberInput, options: WriteOptions): ServiceResult<SpeciesGroupMembership> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applySpeciesGroupMembershipChangeSet(store, existing);
        }
        const membership = createDefaultSpeciesGroupMembership(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "species-group-membership",
          operation: "create",
          summary: `add node ${membership.nodeId} to species group ${membership.groupId}`,
          diff: { membershipId: membership.membershipId, groupId: membership.groupId, nodeId: membership.nodeId, role: membership.role },
          payload: { membership }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applySpeciesGroupMembershipChangeSet(store, changeSet);
        }
        return { value: membership, changeSet };
      }
    },
    atlas: {
      createAtlas(input: CreateAtlasInput, options: WriteOptions): ServiceResult<Atlas> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyAtlasChangeSet(store, existing);
        }
        const atlas = createDefaultAtlas(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "atlas",
          operation: "create",
          summary: `create atlas ${atlas.atlasId}`,
          diff: { atlasId: atlas.atlasId, graphIds: atlas.graphIds, status: atlas.status },
          payload: { atlas }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyAtlasChangeSet(store, changeSet);
        }
        return { value: atlas, changeSet };
      },
      addGraph(input: AddAtlasGraphInput, options: WriteOptions): ServiceResult<Atlas> {
        const atlas = requireAtlas(store, input.atlasId);
        const next: Atlas = {
          ...atlas,
          graphIds: atlas.graphIds.includes(input.graphId) ? atlas.graphIds : [...atlas.graphIds, input.graphId].sort(),
          updatedAt: nowIso()
        };
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "atlas",
          operation: "update",
          summary: `add graph ${input.graphId} to atlas ${input.atlasId}`,
          diff: { atlasId: input.atlasId, graphId: input.graphId },
          payload: { atlas: next }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyAtlasUpdateChangeSet(store, changeSet);
        }
        return { value: next, changeSet };
      }
    },
    context: {
      createContext(input: CreateDesignContextInput, options: WriteOptions): ServiceResult<DesignContext> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyDesignContextChangeSet(store, existing);
        }
        const context = createDefaultDesignContext(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "design-context",
          operation: "create",
          summary: `create design context ${context.contextId}`,
          diff: { contextId: context.contextId, contextType: context.contextType, status: context.status },
          payload: { context }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyDesignContextChangeSet(store, changeSet);
        }
        return { value: context, changeSet };
      },
      attachContext(input: CreateContextAttachmentInput, options: WriteOptions): ServiceResult<ContextAttachment> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyContextAttachmentChangeSet(store, existing);
        }
        const attachment = createDefaultContextAttachment(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "context-attachment",
          operation: "create",
          summary: `attach design context ${attachment.contextId} to ${attachment.targetType} ${attachment.targetId}`,
          diff: {
            attachmentId: attachment.attachmentId,
            contextId: attachment.contextId,
            targetType: attachment.targetType,
            targetId: attachment.targetId,
            role: attachment.role
          },
          payload: { attachment }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyContextAttachmentChangeSet(store, changeSet);
        }
        return { value: attachment, changeSet };
      },
      createFact(input: CreateContextFactInput, options: WriteOptions): ServiceResult<ContextFact> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyContextFactChangeSet(store, existing);
        }
        const fact = createDefaultContextFact(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "context-fact",
          operation: "create",
          summary: `create context fact ${fact.factId}`,
          diff: { factId: fact.factId, factType: fact.factType, status: fact.status },
          payload: { fact }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyContextFactChangeSet(store, changeSet);
        }
        return { value: fact, changeSet };
      },
      createPrinciple(input: CreateDesignPrincipleInput, options: WriteOptions): ServiceResult<DesignPrinciple> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyDesignPrincipleChangeSet(store, existing);
        }
        const principle = createDefaultDesignPrinciple(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "design-principle",
          operation: "create",
          summary: `create design principle ${principle.principleId}`,
          diff: { principleId: principle.principleId, priority: principle.priority, status: principle.status },
          payload: { principle }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyDesignPrincipleChangeSet(store, changeSet);
        }
        return { value: principle, changeSet };
      },
      createMotif(input: CreateContextMotifInput, options: WriteOptions): ServiceResult<ContextMotif> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyContextMotifChangeSet(store, existing);
        }
        const motif = createDefaultContextMotif(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "context-motif",
          operation: "create",
          summary: `create context motif ${motif.motifId}`,
          diff: { motifId: motif.motifId, motifType: motif.motifType, status: motif.status },
          payload: { motif }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyContextMotifChangeSet(store, changeSet);
        }
        return { value: motif, changeSet };
      },
      createReference(input: CreateContextReferenceInput, options: WriteOptions): ServiceResult<ContextReference> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyContextReferenceChangeSet(store, existing);
        }
        const reference = createDefaultContextReference(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "context-reference",
          operation: "create",
          summary: `create context reference ${reference.referenceId}`,
          diff: { referenceId: reference.referenceId, referenceType: reference.referenceType, status: reference.status },
          payload: { reference }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyContextReferenceChangeSet(store, changeSet);
        }
        return { value: reference, changeSet };
      },
      createReviewRubric(input: CreateContextReviewRubricInput, options: WriteOptions): ServiceResult<ContextReviewRubric> {
        if (options.mode === "changeset-apply") {
          const existing = requireExistingChangeSet(store, options.changeSetId);
          return applyContextReviewRubricChangeSet(store, existing);
        }
        const rubric = createDefaultContextReviewRubric(input);
        const changeSet = createChangeSet({
          mode: options.mode,
          objectType: "context-review-rubric",
          operation: "create",
          summary: `create context review rubric ${rubric.rubricId}`,
          diff: { rubricId: rubric.rubricId, dimension: rubric.dimension, severity: rubric.severity, status: rubric.status },
          payload: { rubric }
        });
        store.changeSets.create(changeSet);
        if (shouldApply(options)) {
          return applyContextReviewRubricChangeSet(store, changeSet);
        }
        return { value: rubric, changeSet };
      }
    },
    proposal: {
      create(input: CreateProposalInput): Proposal {
        const proposal = createDefaultProposal(input);
        store.proposals.create(proposal);
        return proposal;
      },
      importBatch(input: ImportModelingBatchInput): ImportModelingBatchResult {
        const batch = ModelingBatchSchema.parse(input.batch) as ModelingBatch;
        validateModelingBatchReferences(store, batch);
        return store.transaction(() => {
          const created = createModelingBatchChangeSets(store, batch, {
            mode: input.mode,
            apply: input.mode === "draft-write"
          });
          if (input.mode === "draft-write") {
            return {
              mode: "draft-write",
              proposal: null,
              changeSetIds: created.changeSetIds,
              counts: {
                planned: countModelingBatchObjects(batch),
                applied: countModelingBatchObjects(batch),
                skipped: { proposals: 1 }
              },
              includesCrossGraphReferences: modelingBatchHasCrossGraphReferences(batch),
              includesLibraryObjects: modelingBatchHasLibraryObjects(batch),
              warning: "mode draft-write writes local seed objects immediately and skips proposal review; do not use it for formal review packages"
            };
          }
          const proposal = createDefaultProposal({
            proposalId: input.proposalId,
            title: input.title,
            summary: input.summary ?? "",
            changeSetIds: created.changeSetIds
          });
          store.proposals.create(proposal);
          return {
            mode: "preview-confirm",
            proposal,
            changeSetIds: created.changeSetIds,
            counts: {
              planned: countModelingBatchObjects(batch),
              applied: {} as Record<string, number>,
              skipped: {} as Record<string, number>
            },
            includesCrossGraphReferences: modelingBatchHasCrossGraphReferences(batch),
            includesLibraryObjects: modelingBatchHasLibraryObjects(batch)
          };
        });
      },
      list(): Proposal[] {
        return store.proposals.list();
      },
      get(proposalId: string): Proposal | undefined {
        return store.proposals.get(proposalId);
      },
      addChangeSet(proposalId: string, changeSetId: string): Proposal {
        const proposal = requireProposal(store, proposalId);
        ensureProposalEditable(proposal);
        const changeSet = requireChangeSet(store, changeSetId);
        if (changeSet.status !== "preview") {
          throw new Error(`proposal can only link preview change-sets: ${changeSetId}`);
        }
        const next: Proposal = {
          ...proposal,
          changeSetIds: proposal.changeSetIds.includes(changeSetId)
            ? proposal.changeSetIds
            : [...proposal.changeSetIds, changeSetId],
          status: proposal.status === "ready" ? "draft" : proposal.status,
          updatedAt: nowIso()
        };
        store.proposals.update(next);
        return next;
      },
      show(proposalId: string): ProposalReviewResult {
        return reviewProposal(store, requireProposal(store, proposalId), { markReady: false });
      },
      review(proposalId: string): ProposalReviewResult {
        return reviewProposal(store, requireProposal(store, proposalId), { markReady: true });
      },
      apply(proposalId: string): ProposalApplyResult {
        const proposal = requireProposal(store, proposalId);
        if (proposal.status === "applied") throw new Error(`proposal is already applied: ${proposalId}`);
        if (proposal.status === "discarded") throw new Error(`proposal is discarded: ${proposalId}`);
        const review = reviewProposal(store, proposal, { markReady: false });
        if (review.blockers.length > 0) {
          throw new Error(`blocked proposal child change-set: ${review.blockers.join("; ")}`);
        }
        const childResults: ServiceResult<unknown>[] = [];
        for (const changeSetId of proposal.changeSetIds) {
          childResults.push(applyChangeSet(store, requireExistingChangeSet(store, changeSetId)));
        }
        const applied: Proposal = { ...proposal, status: "applied", updatedAt: nowIso() };
        store.proposals.update(applied);
        return { proposal: applied, appliedChangeSetIds: proposal.changeSetIds, childResults };
      },
      discard(proposalId: string): Proposal {
        const proposal = requireProposal(store, proposalId);
        if (proposal.status === "applied") throw new Error(`applied proposal cannot be discarded: ${proposalId}`);
        const discarded: Proposal = { ...proposal, status: "discarded", updatedAt: nowIso() };
        store.proposals.update(discarded);
        return discarded;
      }
    },
    changeSet: {
      list(filter: ChangeSetFilter = {}): ChangeSet[] {
        return store.changeSets.list().filter((changeSet) => {
          if (filter.status && changeSet.status !== filter.status) return false;
          if (filter.objectType && changeSet.objectType !== filter.objectType) return false;
          return true;
        });
      },
      get(changeSetId: string): ChangeSet | undefined {
        return store.changeSets.get(changeSetId);
      },
      apply(changeSetId: string): ServiceResult<unknown> {
        return applyChangeSet(store, requireExistingChangeSet(store, changeSetId));
      },
      discard(changeSetId: string): ChangeSet {
        const existing = requireExistingChangeSet(store, changeSetId);
        const discarded = markChangeSetDiscarded(existing);
        store.changeSets.update(discarded);
        return discarded;
      },
      review(changeSetId: string): ChangeSetReviewResult {
        const existing = requireChangeSet(store, changeSetId);
        return reviewChangeSet(store, existing);
      }
    }
  };
}

function createModelingBatchChangeSets(
  store: DnaServiceStore,
  batch: ModelingBatch,
  options: WriteOptions
): { changeSetIds: string[] } {
  const changeSets: ChangeSet[] = [];
  const push = (changeSet: ChangeSet) => {
    store.changeSets.create(changeSet);
    const next = shouldApply(options) ? applyChangeSet(store, changeSet).changeSet : changeSet;
    changeSets.push(next);
  };

  for (const input of batch.graphs) {
    const graph = createDefaultGraph(input);
    push(
      createChangeSet({
        mode: options.mode,
        objectType: "graph",
        operation: "create",
        summary: `import graph ${graph.graphId}`,
        diff: { graphId: graph.graphId, name: graph.name, status: graph.status },
        payload: { graph }
      })
    );
  }
  for (const input of batch.atlases) {
    const atlas = createDefaultAtlas(input);
    push(
      createChangeSet({
        mode: options.mode,
        objectType: "atlas",
        operation: "create",
        summary: `import atlas ${atlas.atlasId}`,
        diff: { atlasId: atlas.atlasId, graphIds: atlas.graphIds, status: atlas.status },
        payload: { atlas }
      })
    );
  }
  for (const input of batch.speciesGroups) {
    const group = createDefaultSpeciesGroup(input);
    push(
      createChangeSet({
        mode: options.mode,
        objectType: "species-group",
        operation: "create",
        summary: `import species group ${group.groupId}`,
        diff: { groupId: group.groupId, graphId: group.graphId, status: group.status },
        payload: { group }
      })
    );
  }
  for (const input of batch.speciesNodes) {
    const node = createDefaultSpeciesNode(input);
    const version = createDefaultNodeVersion({
      graphId: node.graphId,
      nodeId: node.nodeId,
      nodeVersionId: `${node.nodeId}@${node.currentVersion}`,
      ownGeneDelta: node.constraints,
      resolvedGeneSnapshot: { ...node.constraints, motifs: node.motifs, badcases: node.badcases },
      constraintSnapshot: node.constraints,
      compileSnapshot: node.compilePolicy ?? { type: "system-rule-first" }
    });
    push(
      createChangeSet({
        mode: options.mode,
        objectType: "node",
        operation: "create",
        summary: `import node ${node.nodeId}`,
        diff: { nodeId: node.nodeId, graphId: node.graphId, version: version.nodeVersionId },
        payload: { node, version }
      })
    );
  }
  for (const input of batch.groupMemberships) {
    const membership = createDefaultSpeciesGroupMembership(input);
    push(
      createChangeSet({
        mode: options.mode,
        objectType: "species-group-membership",
        operation: "create",
        summary: `import species group membership ${membership.membershipId}`,
        diff: { membershipId: membership.membershipId, groupId: membership.groupId, nodeId: membership.nodeId, role: membership.role },
        payload: { membership }
      })
    );
  }
  for (const input of batch.designRelationships) {
    const relationship = createDefaultDesignRelationship(input);
    push(
      createChangeSet({
        mode: options.mode,
        objectType: "design-relationship",
        operation: "create",
        summary: `import design relationship ${relationship.relationshipId}`,
        diff: { relationshipId: relationship.relationshipId, source: relationship.source, target: relationship.target, relationshipType: relationship.relationshipType },
        payload: { relationship, allowParallel: Boolean(input.allowParallel) }
      })
    );
  }
  for (const input of batch.phenotypeLibraries) {
    const library = createDefaultPhenotypeLibrary(input);
    push(createLibraryChangeSet(options.mode, "phenotype-library", `import phenotype library ${library.libraryId}`, { libraryId: library.libraryId }, { library }));
  }
  for (const input of batch.libraryGraphBindings) {
    const binding = createDefaultPhenotypeLibraryGraphBinding(input);
    push(createLibraryChangeSet(options.mode, "phenotype-library-graph-binding", `import library graph binding ${binding.bindingId}`, { bindingId: binding.bindingId, libraryId: binding.libraryId, graphId: binding.graphId }, { binding }));
  }
  for (const input of batch.storageMounts) {
    const mount = createDefaultStorageMount(input);
    push(createLibraryChangeSet(options.mode, "storage-mount", `import storage mount ${mount.mountId}`, { mountId: mount.mountId, libraryId: mount.libraryId }, { mount }));
  }
  for (const input of batch.externalLibraryMappings) {
    const mapping = createDefaultExternalLibraryMapping(input);
    push(createLibraryChangeSet(options.mode, "external-library-mapping", `import external library mapping ${mapping.mappingId}`, { mappingId: mapping.mappingId, libraryId: mapping.libraryId, mountId: mapping.mountId }, { mapping }));
  }
  for (const input of batch.libraryRoutingPolicies) {
    const policy = createDefaultLibraryRoutingPolicy(input);
    push(createLibraryChangeSet(options.mode, "library-routing-policy", `import library routing policy ${policy.routingPolicyId}`, { routingPolicyId: policy.routingPolicyId, libraryId: policy.libraryId, targetMountId: policy.targetMountId }, { policy }));
  }
  return { changeSetIds: changeSets.map((changeSet) => changeSet.changeSetId) };
}

function createLibraryChangeSet(
  mode: WriteMode,
  objectType: string,
  summary: string,
  diff: Record<string, unknown>,
  payload: Record<string, unknown>
): ChangeSet {
  return createChangeSet({ mode, objectType, operation: "create", summary, diff, payload });
}

function countModelingBatchObjects(batch: ModelingBatch): Record<string, number> {
  return {
    graphs: batch.graphs.length,
    atlases: batch.atlases.length,
    speciesGroups: batch.speciesGroups.length,
    groupMemberships: batch.groupMemberships.length,
    designRelationships: batch.designRelationships.length,
    speciesNodes: batch.speciesNodes.length,
    phenotypeLibraries: batch.phenotypeLibraries.length,
    libraryGraphBindings: batch.libraryGraphBindings.length,
    storageMounts: batch.storageMounts.length,
    externalLibraryMappings: batch.externalLibraryMappings.length,
    libraryRoutingPolicies: batch.libraryRoutingPolicies.length
  };
}

function modelingBatchHasLibraryObjects(batch: ModelingBatch): boolean {
  return (
    batch.phenotypeLibraries.length +
      batch.libraryGraphBindings.length +
      batch.storageMounts.length +
      batch.externalLibraryMappings.length +
      batch.libraryRoutingPolicies.length >
    0
  );
}

function modelingBatchHasCrossGraphReferences(batch: ModelingBatch): boolean {
  return batch.designRelationships.some((relationship) => relationship.source.graphId !== relationship.target.graphId);
}

function validateModelingBatchReferences(store: DnaServiceStore, batch: ModelingBatch) {
  const errors: string[] = [];
  const graphIds = collectKnownIds(store.graphs.list().map((graph) => graph.graphId), batch.graphs.map((graph) => graph.graphId));
  const nodeIds = collectKnownIds(
    batch.graphs.flatMap((graph) => store.nodes.listByGraph(graph.graphId).map((node) => node.nodeId)),
    batch.speciesNodes.map((node) => node.nodeId)
  );
  const groupIds = collectKnownIds(
    batch.graphs.flatMap((graph) => store.speciesGroups.listByGraph(graph.graphId).map((group) => group.groupId)),
    batch.speciesGroups.map((group) => group.groupId)
  );
  const atlasIds = collectKnownIds(store.atlases.list().map((atlas) => atlas.atlasId), batch.atlases.map((atlas) => atlas.atlasId));
  const libraryIds = collectKnownIds(store.phenotypeLibraries.list().map((library) => library.libraryId), batch.phenotypeLibraries.map((library) => library.libraryId));
  const mountIds = collectKnownIds(
    store.phenotypeLibraries.list().flatMap((library) => store.storageMounts.listByLibrary(library.libraryId).map((mount) => mount.mountId)),
    batch.storageMounts.map((mount) => mount.mountId)
  );

  addDuplicateErrors(errors, "graphs", batch.graphs.map((graph) => graph.graphId));
  addDuplicateErrors(errors, "atlases", batch.atlases.map((atlas) => atlas.atlasId));
  addDuplicateErrors(errors, "speciesGroups", batch.speciesGroups.map((group) => group.groupId));
  addDuplicateErrors(errors, "speciesNodes", batch.speciesNodes.map((node) => node.nodeId));
  addDuplicateErrors(errors, "groupMemberships", batch.groupMemberships.map((membership) => membership.membershipId));
  addDuplicateErrors(errors, "designRelationships", batch.designRelationships.map((relationship) => relationship.relationshipId));
  addDuplicateErrors(errors, "phenotypeLibraries", batch.phenotypeLibraries.map((library) => library.libraryId));
  addDuplicateErrors(errors, "libraryGraphBindings", batch.libraryGraphBindings.map((binding) => binding.bindingId));
  addDuplicateErrors(errors, "storageMounts", batch.storageMounts.map((mount) => mount.mountId));
  addDuplicateErrors(errors, "externalLibraryMappings", batch.externalLibraryMappings.map((mapping) => mapping.mappingId));
  addDuplicateErrors(errors, "libraryRoutingPolicies", batch.libraryRoutingPolicies.map((policy) => policy.routingPolicyId));

  batch.speciesNodes.forEach((node, index) => requireKnown(errors, `speciesNodes[${index}].graphId`, graphIds, node.graphId, "graph"));
  batch.speciesGroups.forEach((group, index) => requireKnown(errors, `speciesGroups[${index}].graphId`, graphIds, group.graphId, "graph"));
  batch.groupMemberships.forEach((membership, index) => {
    requireKnown(errors, `groupMemberships[${index}].graphId`, graphIds, membership.graphId, "graph");
    requireKnown(errors, `groupMemberships[${index}].groupId`, groupIds, membership.groupId, "species group");
    requireKnown(errors, `groupMemberships[${index}].nodeId`, nodeIds, membership.nodeId, "node");
  });
  batch.atlases.forEach((atlas, index) => {
    (atlas.graphIds ?? []).forEach((graphId) => requireKnown(errors, `atlases[${index}].graphIds`, graphIds, graphId, "graph"));
  });
  batch.designRelationships.forEach((relationship, index) => {
    validateBatchEndpoint(errors, `designRelationships[${index}].source`, relationship.source, graphIds, groupIds, nodeIds);
    validateBatchEndpoint(errors, `designRelationships[${index}].target`, relationship.target, graphIds, groupIds, nodeIds);
  });
  batch.libraryGraphBindings.forEach((binding, index) => {
    requireKnown(errors, `libraryGraphBindings[${index}].libraryId`, libraryIds, binding.libraryId, "library");
    requireKnown(errors, `libraryGraphBindings[${index}].graphId`, graphIds, binding.graphId, "graph");
  });
  batch.storageMounts.forEach((mount, index) => requireKnown(errors, `storageMounts[${index}].libraryId`, libraryIds, mount.libraryId, "library"));
  batch.externalLibraryMappings.forEach((mapping, index) => {
    requireKnown(errors, `externalLibraryMappings[${index}].libraryId`, libraryIds, mapping.libraryId, "library");
    requireKnown(errors, `externalLibraryMappings[${index}].mountId`, mountIds, mapping.mountId, "storage mount");
  });
  batch.libraryRoutingPolicies.forEach((policy, index) => {
    requireKnown(errors, `libraryRoutingPolicies[${index}].libraryId`, libraryIds, policy.libraryId, "library");
    requireKnown(errors, `libraryRoutingPolicies[${index}].targetMountId`, mountIds, policy.targetMountId, "storage mount");
  });

  if (errors.length > 0) {
    throw new Error(`modeling batch validation failed (${errors.length}): ${errors.join("; ")}`);
  }
}

function collectKnownIds(existingIds: string[], batchIds: string[]): Set<string> {
  return new Set([...existingIds, ...batchIds]);
}

function addDuplicateErrors(errors: string[], section: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${section}: duplicate id ${id}`);
    seen.add(id);
  }
}

function requireKnown(errors: string[], path: string, knownIds: Set<string>, id: string, label: string) {
  if (!knownIds.has(id)) errors.push(`${path}: ${label} not found: ${id}`);
}

function validateBatchEndpoint(
  errors: string[],
  path: string,
  endpoint: DesignRelationship["source"],
  graphIds: Set<string>,
  groupIds: Set<string>,
  nodeIds: Set<string>
) {
  requireKnown(errors, `${path}.graphId`, graphIds, endpoint.graphId, "graph");
  if (endpoint.type === "species-group") requireKnown(errors, `${path}.groupId`, groupIds, endpoint.groupId, "species group");
  if (endpoint.type === "species-node") requireKnown(errors, `${path}.nodeId`, nodeIds, endpoint.nodeId, "node");
}

function shouldApply(options: WriteOptions): boolean {
  return options.apply === true || options.mode === "draft-write";
}

function requireExistingChangeSet(store: DnaServiceStore, changeSetId: string | undefined): ChangeSet {
  if (!changeSetId) throw new Error("change-set id is required for changeset-apply");
  const existing = requireChangeSet(store, changeSetId);
  if (existing.status !== "preview") throw new Error(`change-set is not preview: ${changeSetId}`);
  return existing;
}

function requireChangeSet(store: DnaServiceStore, changeSetId: string | undefined): ChangeSet {
  if (!changeSetId) throw new Error("change-set id is required");
  const existing = store.changeSets.get(changeSetId);
  if (!existing) throw new Error(`change-set not found: ${changeSetId}`);
  return existing;
}

function requireProposal(store: DnaServiceStore, proposalId: string): Proposal {
  const proposal = store.proposals.get(proposalId);
  if (!proposal) throw new Error(`proposal not found: ${proposalId}`);
  return proposal;
}

function ensureProposalEditable(proposal: Proposal) {
  if (proposal.status === "applied") throw new Error(`applied proposal cannot be edited: ${proposal.proposalId}`);
  if (proposal.status === "discarded") throw new Error(`discarded proposal cannot be edited: ${proposal.proposalId}`);
}

const PROPOSAL_APPLY_OBJECT_TYPES = new Set([
  "graph",
  "node",
  "design-relationship",
  "species-group",
  "species-group-membership",
  "atlas",
  "design-context",
  "context-attachment",
  "context-fact",
  "design-principle",
  "context-motif",
  "context-reference",
  "context-review-rubric",
  "phenotype-library",
  "phenotype-library-graph-binding",
  "storage-mount",
  "external-library-mapping",
  "library-routing-policy"
]);

interface ProposalPlannedCreates {
  graphIds: Set<string>;
  nodeIds: Set<string>;
  speciesGroupIds: Set<string>;
  atlasIds: Set<string>;
  designContextIds: Set<string>;
  libraryIds: Set<string>;
  mountIds: Set<string>;
}

function reviewProposal(
  store: DnaServiceStore,
  proposal: Proposal,
  options: { markReady: boolean }
): ProposalReviewResult {
  const blockers: string[] = [];
  const childChangeSets: ChangeSet[] = [];
  for (const changeSetId of proposal.changeSetIds) {
    const changeSet = store.changeSets.get(changeSetId);
    if (!changeSet) {
      blockers.push(`missing change-set: ${changeSetId}`);
      continue;
    }
    childChangeSets.push(changeSet);
    if (changeSet.status !== "preview") {
      blockers.push(`change-set ${changeSetId} is ${changeSet.status}`);
    }
    if (!PROPOSAL_APPLY_OBJECT_TYPES.has(changeSet.objectType)) {
      blockers.push(`change-set ${changeSetId} has unsupported object type: ${changeSet.objectType}`);
    }
  }

  const plannedCreates = collectProposalPlannedCreates(childChangeSets);
  const childReviews = childChangeSets.map((changeSet) => reviewChangeSetForProposal(store, changeSet, plannedCreates));
  for (const review of childReviews) {
    if (review.status === "fail") {
      blockers.push(`change-set ${review.changeSetId} review failed: ${review.constraintViolations.join("; ")}`);
    }
  }

  const status: Proposal["status"] =
    proposal.status === "applied" || proposal.status === "discarded"
      ? proposal.status
      : blockers.length > 0
        ? "draft"
        : "ready";
  const nextProposal =
    options.markReady && status === "ready" && proposal.status !== "ready"
      ? { ...proposal, status, updatedAt: nowIso() }
      : proposal;
  if (nextProposal !== proposal) store.proposals.update(nextProposal);
  return { proposal: nextProposal, status, blockers, childReviews };
}

function collectProposalPlannedCreates(changeSets: ChangeSet[]): ProposalPlannedCreates {
  const planned: ProposalPlannedCreates = {
    graphIds: new Set(),
    nodeIds: new Set(),
    speciesGroupIds: new Set(),
    atlasIds: new Set(),
    designContextIds: new Set(),
    libraryIds: new Set(),
    mountIds: new Set()
  };
  for (const changeSet of changeSets) {
    if (changeSet.status !== "preview" || changeSet.operation !== "create") continue;
    const payload = changeSet.payload as Record<string, unknown>;
    const graph = payload.graph as Graph | undefined;
    const node = payload.node as SpeciesNode | undefined;
    const group = payload.group as SpeciesGroup | undefined;
    const atlas = payload.atlas as Atlas | undefined;
    const context = payload.context as DesignContext | undefined;
    const library = payload.library as PhenotypeLibrary | undefined;
    const mount = payload.mount as StorageMount | undefined;
    if (graph?.graphId) planned.graphIds.add(graph.graphId);
    if (node?.nodeId) planned.nodeIds.add(node.nodeId);
    if (group?.groupId) planned.speciesGroupIds.add(group.groupId);
    if (atlas?.atlasId) planned.atlasIds.add(atlas.atlasId);
    if (context?.contextId) planned.designContextIds.add(context.contextId);
    if (library?.libraryId) planned.libraryIds.add(library.libraryId);
    if (mount?.mountId) planned.mountIds.add(mount.mountId);
  }
  return planned;
}

function reviewChangeSetForProposal(
  store: DnaServiceStore,
  changeSet: ChangeSet,
  plannedCreates: ProposalPlannedCreates
): ChangeSetReviewResult {
  const base = reviewChangeSet(store, changeSet);
  const constraintViolations = base.constraintViolations.filter((violation) => !isSatisfiedByProposalPlan(violation, plannedCreates));
  return {
    ...base,
    status: constraintViolations.length > 0 ? "fail" : base.missingDimensions.length > 0 ? "needs-review" : "pass",
    constraintViolations
  };
}

function isSatisfiedByProposalPlan(violation: string, plannedCreates: ProposalPlannedCreates): boolean {
  return (
    plannedIdMatches(violation, /^graph not found: (.+)$/, plannedCreates.graphIds) ||
    plannedIdMatches(violation, /^source graph not found: (.+)$/, plannedCreates.graphIds) ||
    plannedIdMatches(violation, /^target graph not found: (.+)$/, plannedCreates.graphIds) ||
    plannedIdMatches(violation, /^node not found: (.+)$/, plannedCreates.nodeIds) ||
    plannedIdMatches(violation, /^source node not found: (.+)$/, plannedCreates.nodeIds) ||
    plannedIdMatches(violation, /^target node not found: (.+)$/, plannedCreates.nodeIds) ||
    plannedIdMatches(violation, /^species group not found: (.+)$/, plannedCreates.speciesGroupIds) ||
    plannedIdMatches(violation, /^source species group not found: (.+)$/, plannedCreates.speciesGroupIds) ||
    plannedIdMatches(violation, /^target species group not found: (.+)$/, plannedCreates.speciesGroupIds) ||
    plannedIdMatches(violation, /^atlas not found: (.+)$/, plannedCreates.atlasIds) ||
    plannedIdMatches(violation, /^design context not found: (.+)$/, plannedCreates.designContextIds) ||
    plannedIdMatches(violation, /^library not found: (.+)$/, plannedCreates.libraryIds) ||
    plannedIdMatches(violation, /^storage mount not found: (.+)$/, plannedCreates.mountIds)
  );
}

function plannedIdMatches(violation: string, pattern: RegExp, plannedIds: Set<string>): boolean {
  const id = violation.match(pattern)?.[1];
  return Boolean(id && plannedIds.has(id));
}

function applyChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<unknown> {
  if (changeSet.objectType === "graph") return applyGraphChangeSet(store, changeSet);
  if (changeSet.objectType === "node") return applyNodeChangeSet(store, changeSet);
  if (changeSet.objectType === "design-relationship") return applyDesignRelationshipChangeSet(store, changeSet);
  if (changeSet.objectType === "species-group") return changeSet.operation === "update" ? applySpeciesGroupUpdateChangeSet(store, changeSet) : applySpeciesGroupChangeSet(store, changeSet);
  if (changeSet.objectType === "species-group-membership") return applySpeciesGroupMembershipChangeSet(store, changeSet);
  if (changeSet.objectType === "atlas") return changeSet.operation === "update" ? applyAtlasUpdateChangeSet(store, changeSet) : applyAtlasChangeSet(store, changeSet);
  if (changeSet.objectType === "design-context") return applyDesignContextChangeSet(store, changeSet);
  if (changeSet.objectType === "context-attachment") return applyContextAttachmentChangeSet(store, changeSet);
  if (changeSet.objectType === "context-fact") return applyContextFactChangeSet(store, changeSet);
  if (changeSet.objectType === "design-principle") return applyDesignPrincipleChangeSet(store, changeSet);
  if (changeSet.objectType === "context-motif") return applyContextMotifChangeSet(store, changeSet);
  if (changeSet.objectType === "context-reference") return applyContextReferenceChangeSet(store, changeSet);
  if (changeSet.objectType === "context-review-rubric") return applyContextReviewRubricChangeSet(store, changeSet);
  if (changeSet.objectType === "phenotype-library") return applyPhenotypeLibraryChangeSet(store, changeSet);
  if (changeSet.objectType === "phenotype-library-graph-binding") return applyPhenotypeLibraryGraphBindingChangeSet(store, changeSet);
  if (changeSet.objectType === "storage-mount") return applyStorageMountChangeSet(store, changeSet);
  if (changeSet.objectType === "external-library-mapping") return applyExternalLibraryMappingChangeSet(store, changeSet);
  if (changeSet.objectType === "library-routing-policy") return applyLibraryRoutingPolicyChangeSet(store, changeSet);
  throw new Error(`unsupported change-set object type: ${changeSet.objectType}`);
}

function reviewChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ChangeSetReviewResult {
  const missingDimensions: string[] = [];
  const constraintViolations: string[] = [];
  const suggestedActions: string[] = [];
  if (changeSet.status !== "preview") {
    suggestedActions.push(`change-set is ${changeSet.status}; review is informational only`);
  }
  if (changeSet.objectType === "graph") {
    const graph = changeSet.payload.graph as Graph | undefined;
    if (!graph) constraintViolations.push("change-set payload missing graph");
    if (graph && !graph.purpose) missingDimensions.push("graph.purpose");
  } else if (changeSet.objectType === "node") {
    const node = changeSet.payload.node as SpeciesNode | undefined;
    if (!node) {
      constraintViolations.push("change-set payload missing node");
    } else {
      if (!store.graphs.get(node.graphId)) constraintViolations.push(`graph not found: ${node.graphId}`);
      if (!node.category) missingDimensions.push("node.category");
      if (!node.level) missingDimensions.push("node.level");
    }
  } else if (changeSet.objectType === "design-relationship") {
    const relationship = changeSet.payload.relationship as DesignRelationship | undefined;
    if (!relationship) {
      constraintViolations.push("change-set payload missing design relationship");
    } else {
      constraintViolations.push(...validateRelationshipEndpointsForStore(store, relationship));
    }
  } else if (changeSet.objectType === "species-group") {
    const group = changeSet.payload.group as SpeciesGroup | undefined;
    if (!group) constraintViolations.push("change-set payload missing species group");
    if (group && !store.graphs.get(group.graphId)) constraintViolations.push(`graph not found: ${group.graphId}`);
  } else if (changeSet.objectType === "species-group-membership") {
    const membership = changeSet.payload.membership as SpeciesGroupMembership | undefined;
    if (!membership) constraintViolations.push("change-set payload missing species group membership");
    if (membership && !store.speciesGroups.get(membership.groupId)) constraintViolations.push(`species group not found: ${membership.groupId}`);
    if (membership && !store.nodes.get(membership.nodeId)) constraintViolations.push(`node not found: ${membership.nodeId}`);
  } else if (changeSet.objectType === "atlas") {
    const atlas = changeSet.payload.atlas as Atlas | undefined;
    if (!atlas) constraintViolations.push("change-set payload missing atlas");
  } else if (changeSet.objectType === "design-context") {
    const context = changeSet.payload.context as DesignContext | undefined;
    if (!context) constraintViolations.push("change-set payload missing design context");
    if (context && !context.summary) missingDimensions.push("context.summary");
  } else if (changeSet.objectType === "context-attachment") {
    const attachment = changeSet.payload.attachment as ContextAttachment | undefined;
    if (!attachment) constraintViolations.push("change-set payload missing context attachment");
    if (attachment && !store.designContexts.get(attachment.contextId)) constraintViolations.push(`design context not found: ${attachment.contextId}`);
  } else if (changeSet.objectType === "context-fact") {
    const fact = changeSet.payload.fact as ContextFact | undefined;
    if (!fact) constraintViolations.push("change-set payload missing context fact");
    if (fact && !fact.statement) missingDimensions.push("fact.statement");
  } else if (changeSet.objectType === "design-principle") {
    const principle = changeSet.payload.principle as DesignPrinciple | undefined;
    if (!principle) constraintViolations.push("change-set payload missing design principle");
    if (principle && !principle.statement) missingDimensions.push("principle.statement");
  } else if (changeSet.objectType === "context-motif") {
    const motif = changeSet.payload.motif as ContextMotif | undefined;
    if (!motif) constraintViolations.push("change-set payload missing context motif");
    if (motif && !motif.statement) missingDimensions.push("motif.statement");
  } else if (changeSet.objectType === "context-reference") {
    const reference = changeSet.payload.reference as ContextReference | undefined;
    if (!reference) constraintViolations.push("change-set payload missing context reference");
    if (reference && !reference.sourceRef) missingDimensions.push("reference.sourceRef");
  } else if (changeSet.objectType === "context-review-rubric") {
    const rubric = changeSet.payload.rubric as ContextReviewRubric | undefined;
    if (!rubric) constraintViolations.push("change-set payload missing context review rubric");
    if (rubric && !rubric.question) missingDimensions.push("rubric.question");
  } else if (changeSet.objectType === "phenotype-library") {
    const library = changeSet.payload.library as PhenotypeLibrary | undefined;
    if (!library) constraintViolations.push("change-set payload missing phenotype library");
    if (library && !library.purpose) missingDimensions.push("library.purpose");
  } else if (changeSet.objectType === "phenotype-library-graph-binding") {
    const binding = changeSet.payload.binding as PhenotypeLibraryGraphBinding | undefined;
    if (!binding) constraintViolations.push("change-set payload missing phenotype library graph binding");
    if (binding && !store.phenotypeLibraries.get(binding.libraryId)) constraintViolations.push(`library not found: ${binding.libraryId}`);
    if (binding && !store.graphs.get(binding.graphId)) constraintViolations.push(`graph not found: ${binding.graphId}`);
  } else if (changeSet.objectType === "storage-mount") {
    const mount = changeSet.payload.mount as StorageMount | undefined;
    if (!mount) constraintViolations.push("change-set payload missing storage mount");
    if (mount && !store.phenotypeLibraries.get(mount.libraryId)) constraintViolations.push(`library not found: ${mount.libraryId}`);
  } else if (changeSet.objectType === "external-library-mapping") {
    const mapping = changeSet.payload.mapping as ExternalLibraryMapping | undefined;
    if (!mapping) constraintViolations.push("change-set payload missing external library mapping");
    if (mapping && !store.phenotypeLibraries.get(mapping.libraryId)) constraintViolations.push(`library not found: ${mapping.libraryId}`);
    if (mapping && !store.storageMounts.get(mapping.mountId)) constraintViolations.push(`storage mount not found: ${mapping.mountId}`);
  } else if (changeSet.objectType === "library-routing-policy") {
    const policy = changeSet.payload.policy as LibraryRoutingPolicy | undefined;
    if (!policy) constraintViolations.push("change-set payload missing library routing policy");
    if (policy && !store.phenotypeLibraries.get(policy.libraryId)) constraintViolations.push(`library not found: ${policy.libraryId}`);
    if (policy && !store.storageMounts.get(policy.targetMountId)) constraintViolations.push(`storage mount not found: ${policy.targetMountId}`);
  } else {
    suggestedActions.push(`manual review required for unsupported object type: ${changeSet.objectType}`);
  }
  if (missingDimensions.length === 0 && constraintViolations.length === 0) {
    suggestedActions.push("change-set can be applied or discarded after human review");
  }
  return {
    changeSetId: changeSet.changeSetId,
    objectType: changeSet.objectType,
    operation: changeSet.operation,
    status: constraintViolations.length > 0 ? "fail" : missingDimensions.length > 0 ? "needs-review" : "pass",
    missingDimensions,
    constraintViolations,
    suggestedActions,
    previewSummary: changeSet.preview.summary
  };
}

function requireAtlas(store: DnaServiceStore, atlasId: string): Atlas {
  const atlas = store.atlases.get(atlasId);
  if (!atlas) throw new Error(`atlas not found: ${atlasId}`);
  return atlas;
}

function requireChangeSetObjectType(changeSet: ChangeSet, expected: string) {
  if (changeSet.objectType !== expected) {
    throw new Error(`change-set object type mismatch: expected ${expected}, received ${changeSet.objectType}`);
  }
}

function applyGraphChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<Graph> {
  const graph = changeSet.payload.graph as Graph | undefined;
  if (!graph) throw new Error("change-set payload missing graph");
  const applied = store.transaction(() => {
    store.graphs.create(graph);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: graph, changeSet: applied };
}

function applyNodeChangeSet(
  store: DnaServiceStore,
  changeSet: ChangeSet
): ServiceResult<{ node: SpeciesNode; nodeVersionId: string }> {
  const node = changeSet.payload.node as SpeciesNode | undefined;
  const version = changeSet.payload.version as ReturnType<typeof createDefaultNodeVersion> | undefined;
  if (!node || !version) throw new Error("change-set payload missing node or version");
  const applied = store.transaction(() => {
    const graph = store.graphs.get(node.graphId);
    if (!graph) throw new Error(`graph not found: ${node.graphId}`);
    store.nodes.create(node);
    store.nodeVersions.create(version);
    if (node.parentNodes.length === 0 && !graph.rootNodes.includes(node.nodeId)) {
      store.graphs.update({ ...graph, rootNodes: [...graph.rootNodes, node.nodeId], updatedAt: nowIso() });
    }
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: { node, nodeVersionId: version.nodeVersionId }, changeSet: applied };
}

function applyDesignRelationshipChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<DesignRelationship> {
  const relationship = changeSet.payload.relationship as DesignRelationship | undefined;
  if (!relationship) throw new Error("change-set payload missing design relationship");
  const allowParallel = Boolean(changeSet.payload.allowParallel);
  const applied = store.transaction(() => {
    const endpointErrors = validateRelationshipEndpointsForStore(store, relationship);
    if (endpointErrors.length > 0) throw new Error(endpointErrors.join("; "));
    validatePendingDesignRelationship(store, relationship, allowParallel);
    store.designRelationships.create(relationship);
    const targetNodeId = relationship.target.type === "species-node" ? relationship.target.nodeId : undefined;
    const target = targetNodeId ? store.nodes.get(targetNodeId) : undefined;
    if (target) {
      const incomingEdges = target.incomingEdges.includes(relationship.relationshipId)
      ? target.incomingEdges
      : [...target.incomingEdges, relationship.relationshipId];
      store.nodes.update({
        ...target,
        incomingEdges,
        lineageStatus: resolveLineageStatus({
          parentNodes: target.parentNodes,
          incomingEdges,
          primaryParent: target.primaryParent
        }),
        updatedAt: nowIso()
      });
    }
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: relationship, changeSet: applied };
}

function applySpeciesGroupChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<SpeciesGroup> {
  const group = changeSet.payload.group as SpeciesGroup | undefined;
  if (!group) throw new Error("change-set payload missing species group");
  const applied = store.transaction(() => {
    if (!store.graphs.get(group.graphId)) throw new Error(`graph not found: ${group.graphId}`);
    store.speciesGroups.create(group);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: group, changeSet: applied };
}

function applySpeciesGroupUpdateChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<SpeciesGroup> {
  const group = changeSet.payload.group as SpeciesGroup | undefined;
  if (!group) throw new Error("change-set payload missing species group");
  const applied = store.transaction(() => {
    if (!store.speciesGroups.get(group.groupId)) throw new Error(`species group not found: ${group.groupId}`);
    store.speciesGroups.update(group);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: group, changeSet: applied };
}

function applySpeciesGroupMembershipChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<SpeciesGroupMembership> {
  const membership = changeSet.payload.membership as SpeciesGroupMembership | undefined;
  if (!membership) throw new Error("change-set payload missing species group membership");
  const applied = store.transaction(() => {
    if (!store.graphs.get(membership.graphId)) throw new Error(`graph not found: ${membership.graphId}`);
    if (!store.speciesGroups.get(membership.groupId)) throw new Error(`species group not found: ${membership.groupId}`);
    if (!store.nodes.get(membership.nodeId)) throw new Error(`node not found: ${membership.nodeId}`);
    store.speciesGroupMemberships.create(membership);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: membership, changeSet: applied };
}

function validatePendingDesignRelationship(store: DnaServiceStore, relationship: DesignRelationship, allowParallel: boolean) {
  const existing = store.designRelationships.listByGraph(relationship.source.graphId).filter((candidate) => {
    return JSON.stringify(candidate.source) === JSON.stringify(relationship.source) && JSON.stringify(candidate.target) === JSON.stringify(relationship.target);
  });
  const validation = validateDesignRelationshipSet([...existing, relationship], { allowParallel });
  if (!validation.valid) throw new Error(validation.issues.join("; "));
}

function validateRelationshipEndpointsForStore(store: DnaServiceStore, relationship: DesignRelationship): string[] {
  const errors: string[] = [];
  validateEndpoint(store, relationship.source, "source", errors);
  validateEndpoint(store, relationship.target, "target", errors);
  return errors;
}

function validateEndpoint(
  store: DnaServiceStore,
  endpoint: DesignRelationship["source"],
  label: "source" | "target",
  errors: string[]
) {
  if (endpoint.type === "graph" && !store.graphs.get(endpoint.graphId)) errors.push(`${label} graph not found: ${endpoint.graphId}`);
  if (endpoint.type === "species-group") {
    const group = store.speciesGroups.get(endpoint.groupId);
    if (!group) errors.push(`${label} species group not found: ${endpoint.groupId}`);
    if (group && group.graphId !== endpoint.graphId) errors.push(`${label} species group ${endpoint.groupId} is not in graph ${endpoint.graphId}`);
  }
  if (endpoint.type === "species-node") {
    const node = store.nodes.get(endpoint.nodeId);
    if (!node) errors.push(`${label} node not found: ${endpoint.nodeId}`);
    if (node && node.graphId !== endpoint.graphId) errors.push(`${label} node ${endpoint.nodeId} is not in graph ${endpoint.graphId}`);
  }
}

function applyAtlasChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<Atlas> {
  const atlas = changeSet.payload.atlas as Atlas | undefined;
  if (!atlas) throw new Error("change-set payload missing atlas");
  const applied = store.transaction(() => {
    for (const graphId of atlas.graphIds) {
      if (!store.graphs.get(graphId)) throw new Error(`graph not found: ${graphId}`);
    }
    store.atlases.create(atlas);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: atlas, changeSet: applied };
}

function applyAtlasUpdateChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<Atlas> {
  const atlas = changeSet.payload.atlas as Atlas | undefined;
  if (!atlas) throw new Error("change-set payload missing atlas");
  const applied = store.transaction(() => {
    if (!store.atlases.get(atlas.atlasId)) throw new Error(`atlas not found: ${atlas.atlasId}`);
    for (const graphId of atlas.graphIds) {
      if (!store.graphs.get(graphId)) throw new Error(`graph not found: ${graphId}`);
    }
    store.atlases.update(atlas);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: atlas, changeSet: applied };
}

function applyDesignContextChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<DesignContext> {
  const context = changeSet.payload.context as DesignContext | undefined;
  if (!context) throw new Error("change-set payload missing design context");
  const applied = store.transaction(() => {
    store.designContexts.create(context);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: context, changeSet: applied };
}

function applyContextAttachmentChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<ContextAttachment> {
  const attachment = changeSet.payload.attachment as ContextAttachment | undefined;
  if (!attachment) throw new Error("change-set payload missing context attachment");
  const applied = store.transaction(() => {
    if (!store.designContexts.get(attachment.contextId)) throw new Error(`design context not found: ${attachment.contextId}`);
    store.contextAttachments.create(attachment);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: attachment, changeSet: applied };
}

function applyContextFactChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<ContextFact> {
  requireChangeSetObjectType(changeSet, "context-fact");
  const fact = changeSet.payload.fact as ContextFact | undefined;
  if (!fact) throw new Error("change-set payload missing context fact");
  const applied = store.transaction(() => {
    store.contextFacts.create(fact);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: fact, changeSet: applied };
}

function applyDesignPrincipleChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<DesignPrinciple> {
  requireChangeSetObjectType(changeSet, "design-principle");
  const principle = changeSet.payload.principle as DesignPrinciple | undefined;
  if (!principle) throw new Error("change-set payload missing design principle");
  const applied = store.transaction(() => {
    store.designPrinciples.create(principle);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: principle, changeSet: applied };
}

function applyContextMotifChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<ContextMotif> {
  requireChangeSetObjectType(changeSet, "context-motif");
  const motif = changeSet.payload.motif as ContextMotif | undefined;
  if (!motif) throw new Error("change-set payload missing context motif");
  const applied = store.transaction(() => {
    store.contextMotifs.create(motif);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: motif, changeSet: applied };
}

function applyContextReferenceChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<ContextReference> {
  requireChangeSetObjectType(changeSet, "context-reference");
  const reference = changeSet.payload.reference as ContextReference | undefined;
  if (!reference) throw new Error("change-set payload missing context reference");
  const applied = store.transaction(() => {
    store.contextReferences.create(reference);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: reference, changeSet: applied };
}

function applyContextReviewRubricChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<ContextReviewRubric> {
  requireChangeSetObjectType(changeSet, "context-review-rubric");
  const rubric = changeSet.payload.rubric as ContextReviewRubric | undefined;
  if (!rubric) throw new Error("change-set payload missing context review rubric");
  const applied = store.transaction(() => {
    store.contextReviewRubrics.create(rubric);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: rubric, changeSet: applied };
}

function applyPhenotypeLibraryChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<PhenotypeLibrary> {
  requireChangeSetObjectType(changeSet, "phenotype-library");
  const library = changeSet.payload.library as PhenotypeLibrary | undefined;
  if (!library) throw new Error("change-set payload missing phenotype library");
  const applied = store.transaction(() => {
    store.phenotypeLibraries.create(library);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: library, changeSet: applied };
}

function applyPhenotypeLibraryGraphBindingChangeSet(
  store: DnaServiceStore,
  changeSet: ChangeSet
): ServiceResult<PhenotypeLibraryGraphBinding> {
  requireChangeSetObjectType(changeSet, "phenotype-library-graph-binding");
  const binding = changeSet.payload.binding as PhenotypeLibraryGraphBinding | undefined;
  if (!binding) throw new Error("change-set payload missing phenotype library graph binding");
  const applied = store.transaction(() => {
    if (!store.phenotypeLibraries.get(binding.libraryId)) throw new Error(`library not found: ${binding.libraryId}`);
    if (!store.graphs.get(binding.graphId)) throw new Error(`graph not found: ${binding.graphId}`);
    store.phenotypeLibraryGraphBindings.create(binding);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: binding, changeSet: applied };
}

function applyStorageMountChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<StorageMount> {
  requireChangeSetObjectType(changeSet, "storage-mount");
  const mount = changeSet.payload.mount as StorageMount | undefined;
  if (!mount) throw new Error("change-set payload missing storage mount");
  const applied = store.transaction(() => {
    if (!store.phenotypeLibraries.get(mount.libraryId)) throw new Error(`library not found: ${mount.libraryId}`);
    store.storageMounts.create(mount);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: mount, changeSet: applied };
}

function applyExternalLibraryMappingChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<ExternalLibraryMapping> {
  requireChangeSetObjectType(changeSet, "external-library-mapping");
  const mapping = changeSet.payload.mapping as ExternalLibraryMapping | undefined;
  if (!mapping) throw new Error("change-set payload missing external library mapping");
  const applied = store.transaction(() => {
    if (!store.phenotypeLibraries.get(mapping.libraryId)) throw new Error(`library not found: ${mapping.libraryId}`);
    if (!store.storageMounts.get(mapping.mountId)) throw new Error(`storage mount not found: ${mapping.mountId}`);
    store.externalLibraryMappings.create(mapping);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: mapping, changeSet: applied };
}

function applyLibraryRoutingPolicyChangeSet(store: DnaServiceStore, changeSet: ChangeSet): ServiceResult<LibraryRoutingPolicy> {
  requireChangeSetObjectType(changeSet, "library-routing-policy");
  const policy = changeSet.payload.policy as LibraryRoutingPolicy | undefined;
  if (!policy) throw new Error("change-set payload missing library routing policy");
  const applied = store.transaction(() => {
    if (!store.phenotypeLibraries.get(policy.libraryId)) throw new Error(`library not found: ${policy.libraryId}`);
    if (!store.storageMounts.get(policy.targetMountId)) throw new Error(`storage mount not found: ${policy.targetMountId}`);
    store.libraryRoutingPolicies.create(policy);
    const next = markChangeSetApplied(changeSet);
    store.changeSets.update(next);
    return next;
  });
  return { value: policy, changeSet: applied };
}
