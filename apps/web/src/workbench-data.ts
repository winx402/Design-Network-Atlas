export type WorkbenchVersionStatus =
  | "draft"
  | "candidate"
  | "accepted"
  | "rejected"
  | "replaced"
  | "rolled-back"
  | "deprecated"
  | "archived"
  | "deleted";

export interface WorkbenchAsset {
  id: string;
  label: string;
  uri: string;
  variantRole: "preview" | "size-variant" | "angle-variant" | "source-file";
  status: "pending" | "active" | "rejected" | "archived";
  tags: string[];
}

export interface WorkbenchReview {
  id: string;
  status: "pass" | "needs-review" | "fail";
  summary: string;
  missingDimensions: string[];
  constraintViolations: string[];
  suggestedActions: string[];
}

export interface WorkbenchVersion {
  id: string;
  speciesVersion: string;
  createdAt: string;
  status: WorkbenchVersionStatus;
  feedback?: {
    summary?: string;
    items: Array<{
      feedbackId: string;
      severity: "info" | "warning" | "blocking";
      source: "human" | "agent" | "system";
      message: string;
      suggestedAction?: string;
      createdAt: string;
    }>;
  };
  promptSnapshot: string;
  assets: WorkbenchAsset[];
  reviews: WorkbenchReview[];
}

export interface WorkbenchPhenotype {
  id: string;
  name: string;
  nodeName: string;
  phenotypeType: string;
  tags: string[];
  outdated: boolean;
  currentSpeciesVersion: string;
  latestSpeciesVersion: string;
  currentAcceptedVersionId?: string;
  versions: WorkbenchVersion[];
}

export interface WorkbenchGenerationPlan {
  planId: string;
  graphId?: string;
  scopeType: "graph" | "species-group" | "species-node" | "phenotype";
  scopeId: string;
  priority: number;
  description: string;
  status: string;
  taskCount: number;
  versionBinding?: unknown;
  toolPreference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkbenchGenerationTask {
  taskId: string;
  planId?: string;
  graphId: string;
  nodeId?: string;
  phenotypeId?: string;
  phenotypeType: string;
  taskBrief: string;
  priority: number;
  status: string;
  blockingReason?: string;
  versionBinding?: unknown;
  toolPreference?: string;
  links: {
    planId?: string;
    speciesCompileArtifactId?: string;
    phenotypeCompileArtifactId?: string;
    generationJobIds: string[];
    phenotypeVersionIds: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkbenchOverview {
  counts: Record<string, number>;
  anomalies: Array<{ type: string; severity: "info" | "warning"; count?: number; message: string }>;
  latest?: Record<string, unknown>;
}

export type WorkbenchRelationshipEndpoint =
  | { type: "graph"; graphId: string }
  | { type: "species-group"; graphId: string; groupId: string }
  | { type: "species-node"; graphId: string; nodeId: string };

export interface WorkbenchGraphDetail {
  graphId: string;
  name: string;
  purpose?: string;
  status: string;
  currentVersion?: string;
  counts: Record<string, number>;
  groups: Array<{
    groupId: string;
    name: string;
    groupType?: string;
    status: string;
    memberNodeIds: string[];
    sharedFacts?: string[];
    phenotypeTypeSuggestions?: string[];
    relationshipIds?: string[];
    phenotypeIds?: string[];
  }>;
  nodes: Array<{
    nodeId: string;
    name: string;
    category?: string;
    level?: string;
    status: string;
    lineageStatus?: string;
    currentVersion?: string;
    groupIds: string[];
    parentNodes?: string[];
    motifs?: string[];
    constraintSummary?: unknown;
    relationshipIds?: string[];
    phenotypeIds: string[];
    latestCompileArtifactId?: string;
  }>;
  relationships: Array<{
    relationshipId: string;
    relationshipType: string;
    direction?: string;
    status: string;
    summary: string;
    source?: WorkbenchRelationshipEndpoint;
    target?: WorkbenchRelationshipEndpoint;
    designContract?: {
      transferRule?: string;
      mustPreserve?: string[];
      mustAvoid?: string[];
      divergenceRule?: string;
      reviewQuestions?: string[];
    };
  }>;
  semantics?: Record<string, unknown>;
  phenotypeOverlay: Array<{
    phenotypeId: string;
    name: string;
    nodeId: string;
    phenotypeType: string;
    status: string;
    currentAcceptedVersionId?: string;
    versions: Array<{ phenotypeVersionId: string; status: WorkbenchVersionStatus; speciesCompileArtifactId?: string; phenotypeCompileArtifactId?: string }>;
  }>;
  compileTrace?: {
    entityArtifacts: number;
    speciesArtifacts: number;
    phenotypeArtifacts: number;
    artifacts: Array<Record<string, unknown>>;
  };
  rawJsonSummary?: unknown;
}

export interface WorkbenchGenerationJob {
  generationJobId: string;
  graphId: string;
  nodeId: string;
  phenotypeId?: string;
  phenotypeVersionId?: string;
  phenotypeType: string;
  taskBrief?: string;
  status: string;
  tool?: string;
  errorSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkbenchPreview {
  kind: "image" | "placeholder";
  url?: string;
  displayUri?: string;
  reason?: string;
}

export interface WorkbenchResultPreview {
  objectType: "output-reference" | "asset";
  objectId: string;
  graphId?: string;
  phenotypeId?: string;
  phenotypeName?: string;
  phenotypeVersionId?: string;
  libraryId?: string;
  storageMountId?: string;
  label: string;
  status: string;
  tags: string[];
  preview: WorkbenchPreview;
}

export interface WorkbenchLibrarySummary {
  libraryId: string;
  name: string;
  purpose: string;
  profile: string;
  status: string;
  graphIds: string[];
  boundGraphCount: number;
  mountCount: number;
  routingPolicyCount: number;
  outputReferenceCount: number;
  mounts: Array<{
    mountId: string;
    displayName: string;
    storageType: string;
    adapterKind: string;
    status: string;
    capabilities: string[];
    credentialStatus: "configured" | "not configured";
    displayLocation?: string;
  }>;
  routingPolicies: unknown[];
  results: Array<{
    phenotypeId: string;
    phenotypeName: string;
    versionId: string;
    versionStatus: WorkbenchVersionStatus;
    graphId: string;
    nodeId: string;
    nodeName?: string;
    phenotypeType: string;
    outputRoles: string[];
    referenceCount: number;
    assetCount: number;
    latestStatus: string;
    preview: WorkbenchPreview;
  }>;
  gallery: WorkbenchResultPreview[];
  rawJsonSummary?: unknown;
}

export interface WorkbenchSnapshot {
  overview: WorkbenchOverview;
  graphs: WorkbenchGraphDetail[];
  generation: {
    plans: WorkbenchGenerationPlan[];
    tasks: WorkbenchGenerationTask[];
    jobs: WorkbenchGenerationJob[];
  };
  libraries: WorkbenchLibrarySummary[];
  outputReferences: unknown[];
  assets: unknown[];
  resultPreviews: WorkbenchResultPreview[];
  phenotypes: WorkbenchPhenotype[];
  generationPlans: WorkbenchGenerationPlan[];
  generationTasks: WorkbenchGenerationTask[];
}

export interface PhenotypeFilter {
  query: string;
  status: WorkbenchVersionStatus | "all";
  tag: string | "all";
  outdatedOnly: boolean;
}

export interface WorkbenchLoadOptions {
  baseUrl: string;
  graphId?: string;
  fetcher?: (url: string) => Promise<{ ok?: boolean; status?: number; json(): Promise<unknown> }>;
}

export interface WorkbenchAppLoadOptions extends WorkbenchLoadOptions {
  demo?: boolean;
}

export type WorkbenchAppLoadState =
  | { status: "loading"; snapshot: WorkbenchSnapshot; phenotypes: []; generationPlans: []; generationTasks: [] }
  | {
      status: "ready";
      snapshot: WorkbenchSnapshot;
      phenotypes: WorkbenchPhenotype[];
      generationPlans: WorkbenchGenerationPlan[];
      generationTasks: WorkbenchGenerationTask[];
    }
  | { status: "error"; snapshot: WorkbenchSnapshot; phenotypes: []; generationPlans: []; generationTasks: []; error: string };

export function createEmptyWorkbenchSnapshot(): WorkbenchSnapshot {
  return {
    overview: {
      counts: {
        graphs: 0,
        activeGraphs: 0,
        speciesGroups: 0,
        speciesNodes: 0,
        designRelationships: 0,
        phenotypes: 0,
        phenotypeVersions: 0,
        candidateVersions: 0,
        acceptedVersions: 0,
        generationPlans: 0,
        generationTasks: 0,
        generationJobs: 0,
        failedGenerationJobs: 0,
        libraries: 0,
        mounts: 0,
        outputReferences: 0,
        missingOrStaleOutputReferences: 0
      },
      anomalies: [{ type: "empty-store", severity: "info", message: "No DNA records found in the current read-only workbench scope." }]
    },
    graphs: [],
    generation: { plans: [], tasks: [], jobs: [] },
    libraries: [],
    outputReferences: [],
    assets: [],
    resultPreviews: [],
    phenotypes: [],
    generationPlans: [],
    generationTasks: []
  };
}

export const samplePhenotypes: WorkbenchPhenotype[] = [
  {
    id: "ph-warning-icon",
    name: "Warning Toolbar Icon",
    nodeName: "Warning Icon",
    phenotypeType: "image-prompt",
    tags: ["ui", "icon", "warning"],
    outdated: true,
    currentSpeciesVersion: "node-warning@1.0.0",
    latestSpeciesVersion: "node-warning@1.1.0",
    versions: [
      {
        id: "pv-warning-1",
        speciesVersion: "node-warning@1.0.0",
        createdAt: "2026-06-24T09:00:00.000Z",
        status: "rejected",
        promptSnapshot: "Older warning icon prompt with a soft circular motif.",
        assets: [
          {
            id: "asset-warning-old-preview",
            label: "Rejected preview",
            uri: "local://assets/warning-old.png",
            variantRole: "preview",
            status: "rejected",
            tags: ["old", "soft"]
          }
        ],
        reviews: [
          {
            id: "review-warning-1",
            status: "fail",
            summary: "Motif too soft for the warning family.",
            missingDimensions: [],
            constraintViolations: ["stroke weight below required range"],
            suggestedActions: ["regenerate with sharper stroke and angular motif"]
          }
        ]
      },
      {
        id: "pv-warning-2",
        speciesVersion: "node-warning@1.0.0",
        createdAt: "2026-06-25T11:30:00.000Z",
        status: "candidate",
        feedback: {
          summary: "Candidate waiting for style review.",
          items: []
        },
        promptSnapshot: "Sharp amber broken-ring warning icon for compact toolbar use.",
        assets: [
          {
            id: "asset-warning-front",
            label: "Front 64px",
            uri: "local://assets/warning-front.png",
            variantRole: "size-variant",
            status: "pending",
            tags: ["64px", "front"]
          },
          {
            id: "asset-warning-angle",
            label: "Angle preview",
            uri: "local://assets/warning-angle.png",
            variantRole: "angle-variant",
            status: "pending",
            tags: ["angle", "preview"]
          }
        ],
        reviews: [
          {
            id: "review-warning-2",
            status: "needs-review",
            summary: "Species has a newer gene snapshot.",
            missingDimensions: ["constraint:stroke"],
            constraintViolations: [],
            suggestedActions: ["review against node-warning@1.1.0 before accepting"]
          }
        ]
      }
    ]
  },
  {
    id: "ph-faction-emblem",
    name: "Faction Emblem Brief",
    nodeName: "Moon Faction Emblem",
    phenotypeType: "art-brief",
    tags: ["game-art", "emblem", "faction"],
    outdated: false,
    currentSpeciesVersion: "node-emblem@2.0.0",
    latestSpeciesVersion: "node-emblem@2.0.0",
    currentAcceptedVersionId: "pv-emblem-2",
    versions: [
      {
        id: "pv-emblem-1",
        speciesVersion: "node-emblem@1.9.0",
        createdAt: "2026-06-21T14:00:00.000Z",
        status: "replaced",
        feedback: {
          summary: "Replaced by a cleaner accepted brief.",
          items: []
        },
        promptSnapshot: "Early faction emblem art brief.",
        assets: [
          {
            id: "asset-emblem-source",
            label: "Source brief",
            uri: "local://assets/emblem-brief.md",
            variantRole: "source-file",
            status: "archived",
            tags: ["source"]
          }
        ],
        reviews: [
          {
            id: "review-emblem-1",
            status: "pass",
            summary: "Superseded by a cleaner accepted brief.",
            missingDimensions: [],
            constraintViolations: [],
            suggestedActions: []
          }
        ]
      },
      {
        id: "pv-emblem-2",
        speciesVersion: "node-emblem@2.0.0",
        createdAt: "2026-06-26T08:20:00.000Z",
        status: "accepted",
        promptSnapshot: "Moon faction emblem brief with silver crescent motif and restrained battle-worn texture.",
        assets: [
          {
            id: "asset-emblem-brief",
            label: "Accepted brief",
            uri: "local://assets/emblem-brief-v2.md",
            variantRole: "source-file",
            status: "active",
            tags: ["accepted", "brief"]
          }
        ],
        reviews: [
          {
            id: "review-emblem-2",
            status: "pass",
            summary: "Matches motif, palette, and usage constraints.",
            missingDimensions: [],
            constraintViolations: [],
            suggestedActions: []
          }
        ]
      }
    ]
  }
];

export const sampleWorkbenchSnapshot: WorkbenchSnapshot = {
  overview: {
    counts: {
      graphs: 2,
      activeGraphs: 2,
      speciesGroups: 1,
      speciesNodes: 2,
      designRelationships: 2,
      phenotypes: samplePhenotypes.length,
      phenotypeVersions: samplePhenotypes.reduce((count, phenotype) => count + phenotype.versions.length, 0),
      candidateVersions: 1,
      acceptedVersions: 1,
      deprecatedOrReplacedVersions: 1,
      generationPlans: 1,
      generationTasks: 2,
      generationJobs: 1,
      failedGenerationJobs: 0,
      outputReferences: 2,
      missingOrStaleOutputReferences: 1,
      libraries: 1,
      mounts: 2
    },
    anomalies: [{ type: "missing-or-stale-output-references", severity: "warning", count: 1, message: "Some output references need review." }]
  },
  graphs: [
    {
      graphId: "graph-language",
      name: "Reference Language Graph",
      purpose: "Shared visual language and review semantics for generated UI assets",
      status: "active",
      currentVersion: "1.0.0",
      counts: { groups: 0, nodes: 0, relationships: 1, phenotypes: 0, candidateVersions: 0, acceptedVersions: 0 },
      groups: [],
      nodes: [],
      relationships: [
        {
          relationshipId: "rel-graph-language",
          relationshipType: "translates-to",
          direction: "source-to-target",
          status: "active",
          summary: "Reference graph translates motif and review language into the demo graph.",
          source: { type: "graph", graphId: "graph-language" },
          target: { type: "graph", graphId: "graph-demo" },
          designContract: {
            transferRule: "Carry bounded visual-language tokens into phenotype briefs.",
            mustPreserve: ["warning semantics", "readable silhouette"],
            mustAvoid: ["fake inheritance", "credential leakage"],
            reviewQuestions: ["Can reviewers inspect the translated motif?"]
          }
        }
      ],
      phenotypeOverlay: [],
      compileTrace: {
        entityArtifacts: 0,
        speciesArtifacts: 0,
        phenotypeArtifacts: 0,
        artifacts: []
      }
    },
    {
      graphId: "graph-demo",
      name: "Demo Design Graph",
      purpose: "Read-only workbench sample",
      status: "active",
      currentVersion: "1.0.0",
      counts: { groups: 1, nodes: 2, relationships: 2, phenotypes: 2, candidateVersions: 1, acceptedVersions: 1 },
      groups: [
        {
          groupId: "group-ui",
          name: "UI Icon Family",
          groupType: "product-surface",
          status: "active",
          memberNodeIds: ["node-warning", "node-emblem"],
          sharedFacts: ["small UI assets must preserve sharp silhouettes"],
          phenotypeTypeSuggestions: ["image-prompt", "art-brief"],
          relationshipIds: ["rel-ui-icons"],
          phenotypeIds: ["ph-warning-icon", "ph-faction-emblem"]
        }
      ],
      nodes: [
        {
          nodeId: "node-warning",
          name: "Warning Icon",
          category: "ui-asset",
          level: "species",
          status: "active",
          currentVersion: "1.1.0",
          groupIds: ["group-ui"],
          motifs: ["broken amber ring", "sharp caution notch"],
          constraintSummary: { readability: "32px", palette: "amber on dark surface" },
          relationshipIds: ["rel-ui-icons"],
          phenotypeIds: ["ph-warning-icon"],
          latestCompileArtifactId: "sca-warning"
        },
        {
          nodeId: "node-emblem",
          name: "Moon Faction Emblem",
          category: "game-art",
          level: "species",
          status: "active",
          currentVersion: "2.0.0",
          groupIds: ["group-ui"],
          motifs: ["silver crescent", "battle-worn rim"],
          constraintSummary: { texture: "restrained", palette: "silver blue" },
          relationshipIds: ["rel-ui-icons"],
          phenotypeIds: ["ph-faction-emblem"],
          latestCompileArtifactId: "sca-emblem"
        }
      ],
      relationships: [
        {
          relationshipId: "rel-graph-language",
          relationshipType: "translates-to",
          direction: "source-to-target",
          status: "active",
          summary: "Reference graph translates motif and review language into the demo graph.",
          source: { type: "graph", graphId: "graph-language" },
          target: { type: "graph", graphId: "graph-demo" },
          designContract: {
            transferRule: "Carry bounded visual-language tokens into phenotype briefs.",
            mustPreserve: ["warning semantics", "readable silhouette"],
            mustAvoid: ["fake inheritance", "credential leakage"],
            reviewQuestions: ["Can reviewers inspect the translated motif?"]
          }
        },
        {
          relationshipId: "rel-ui-icons",
          relationshipType: "constrains",
          direction: "source-to-target",
          status: "active",
          summary: "Group readability constrains the icon output.",
          source: { type: "species-group", graphId: "graph-demo", groupId: "group-ui" },
          target: { type: "species-node", graphId: "graph-demo", nodeId: "node-warning" },
          designContract: {
            transferRule: "Apply shared readability constraints to compact icon phenotypes.",
            mustPreserve: ["high-contrast warning motif"],
            mustAvoid: ["soft rounded warning shape"],
            reviewQuestions: ["Does the icon still read at toolbar size?"]
          }
        }
      ],
      semantics: {
        contextAttachments: [{ attachmentId: "attach-ui-context", contextId: "ctx-ui-safety", targetType: "species-group", targetId: "group-ui", status: "active" }],
        facetAssignments: [{ assignmentId: "facet-warning-tone", targetType: "species-node", targetId: "node-warning", status: "active", values: { tone: "urgent" } }]
      },
      phenotypeOverlay: samplePhenotypes.map((phenotype) => ({
        phenotypeId: phenotype.id,
        name: phenotype.name,
        nodeId: phenotype.id === "ph-warning-icon" ? "node-warning" : "node-emblem",
        phenotypeType: phenotype.phenotypeType,
        status: "generated",
        currentAcceptedVersionId: phenotype.currentAcceptedVersionId,
        versions: phenotype.versions.map((version) => ({
          phenotypeVersionId: version.id,
          status: version.status,
          speciesCompileArtifactId: "sca-demo",
          phenotypeCompileArtifactId: "pca-demo"
        }))
      })),
      compileTrace: {
        entityArtifacts: 1,
        speciesArtifacts: 2,
        phenotypeArtifacts: 2,
        artifacts: [{ artifactId: "pca-demo", targetLevel: "phenotype", dependencyCount: 4, feedbackCount: 0, openQuestionCount: 0 }]
      }
    }
  ],
  generation: {
    plans: [
      {
        planId: "plan-demo",
        graphId: "graph-demo",
        scopeType: "graph",
        scopeId: "graph-demo",
        priority: 1,
        description: "Generate icon review set",
        status: "expanded",
        taskCount: 2,
        toolPreference: "mock"
      }
    ],
    tasks: [
      {
        taskId: "task-warning",
        planId: "plan-demo",
        graphId: "graph-demo",
        nodeId: "node-warning",
        phenotypeId: "ph-warning-icon",
        phenotypeType: "image-prompt",
        taskBrief: "warning icon preview",
        priority: 1,
        status: "blocked",
        blockingReason: "style review pending",
        links: {
          planId: "plan-demo",
          speciesCompileArtifactId: "sca-warning",
          phenotypeCompileArtifactId: "pca-warning",
          generationJobIds: ["job-warning"],
          phenotypeVersionIds: ["pv-warning-2"]
        }
      },
      {
        taskId: "task-emblem",
        planId: "plan-demo",
        graphId: "graph-demo",
        nodeId: "node-emblem",
        phenotypeId: "ph-faction-emblem",
        phenotypeType: "art-brief",
        taskBrief: "accepted emblem brief",
        priority: 2,
        status: "completed",
        links: { planId: "plan-demo", generationJobIds: [], phenotypeVersionIds: ["pv-emblem-2"] }
      }
    ],
    jobs: [
      {
        generationJobId: "job-warning",
        graphId: "graph-demo",
        nodeId: "node-warning",
        phenotypeId: "ph-warning-icon",
        phenotypeVersionId: "pv-warning-2",
        phenotypeType: "image-prompt",
        status: "generated",
        tool: "mock"
      }
    ]
  },
  libraries: [
    {
      libraryId: "library-demo",
      name: "Demo Result Library",
      purpose: "Read-only generated result preview",
      profile: "media-asset",
      status: "active",
      graphIds: ["graph-demo"],
      boundGraphCount: 1,
      mountCount: 2,
      routingPolicyCount: 1,
      outputReferenceCount: 2,
      mounts: [
        {
          mountId: "mount-preview",
          displayName: "Preview URLs",
          storageType: "url",
          adapterKind: "pointer-only",
          status: "read-only",
          capabilities: ["thumbnail"],
          credentialStatus: "not configured",
          displayLocation: "https://assets.example.invalid/public"
        },
        {
          mountId: "mount-source",
          displayName: "Source Git",
          storageType: "git",
          adapterKind: "git",
          status: "active",
          capabilities: ["source"],
          credentialStatus: "configured",
          displayLocation: "[redacted]"
        }
      ],
      routingPolicies: [{ routingPolicyId: "route-preview", name: "Preview route" }],
      results: [
        {
          phenotypeId: "ph-faction-emblem",
          phenotypeName: "Faction Emblem Brief",
          versionId: "pv-emblem-2",
          versionStatus: "accepted",
          graphId: "graph-demo",
          nodeId: "node-emblem",
          nodeName: "Moon Faction Emblem",
          phenotypeType: "art-brief",
          outputRoles: ["primary-output"],
          referenceCount: 1,
          assetCount: 1,
          latestStatus: "accepted",
          preview: { kind: "placeholder", reason: "unsupported-type", displayUri: "[redacted-or-unavailable]" }
        },
        {
          phenotypeId: "ph-warning-icon",
          phenotypeName: "Warning Toolbar Icon",
          versionId: "pv-warning-2",
          versionStatus: "candidate",
          graphId: "graph-demo",
          nodeId: "node-warning",
          nodeName: "Warning Icon",
          phenotypeType: "image-prompt",
          outputRoles: ["preview"],
          referenceCount: 1,
          assetCount: 2,
          latestStatus: "needs-review",
          preview: { kind: "image", url: "https://assets.example.invalid/public/warning.png", displayUri: "https://assets.example.invalid/public/warning.png" }
        }
      ],
      gallery: [
        {
          objectType: "output-reference",
          objectId: "oref-warning-preview",
          graphId: "graph-demo",
          phenotypeId: "ph-warning-icon",
          phenotypeName: "Warning Toolbar Icon",
          phenotypeVersionId: "pv-warning-2",
          libraryId: "library-demo",
          storageMountId: "mount-preview",
          label: "preview url",
          status: "active",
          tags: ["preview"],
          preview: { kind: "image", url: "https://assets.example.invalid/public/warning.png", displayUri: "https://assets.example.invalid/public/warning.png" }
        },
        {
          objectType: "asset",
          objectId: "asset-warning-source",
          graphId: "graph-demo",
          phenotypeId: "ph-warning-icon",
          phenotypeName: "Warning Toolbar Icon",
          phenotypeVersionId: "pv-warning-2",
          label: "Source file",
          status: "pending",
          tags: ["source"],
          preview: { kind: "placeholder", reason: "redacted-or-unavailable", displayUri: "[redacted-or-unavailable]" }
        }
      ]
    }
  ],
  outputReferences: [],
  assets: [],
  resultPreviews: [
    {
      objectType: "output-reference",
      objectId: "oref-warning-preview",
      graphId: "graph-demo",
      phenotypeId: "ph-warning-icon",
      phenotypeName: "Warning Toolbar Icon",
      phenotypeVersionId: "pv-warning-2",
      libraryId: "library-demo",
      storageMountId: "mount-preview",
      label: "preview url",
      status: "active",
      tags: ["preview"],
      preview: { kind: "image", url: "https://assets.example.invalid/public/warning.png", displayUri: "https://assets.example.invalid/public/warning.png" }
    },
    {
      objectType: "asset",
      objectId: "asset-warning-source",
      graphId: "graph-demo",
      phenotypeId: "ph-warning-icon",
      phenotypeName: "Warning Toolbar Icon",
      phenotypeVersionId: "pv-warning-2",
      label: "Source file",
      status: "pending",
      tags: ["source"],
      preview: { kind: "placeholder", reason: "redacted-or-unavailable", displayUri: "[redacted-or-unavailable]" }
    }
  ],
  phenotypes: samplePhenotypes,
  generationPlans: [],
  generationTasks: []
};
sampleWorkbenchSnapshot.generationPlans = sampleWorkbenchSnapshot.generation.plans;
sampleWorkbenchSnapshot.generationTasks = sampleWorkbenchSnapshot.generation.tasks;

export function filterPhenotypes(phenotypes: WorkbenchPhenotype[], filter: PhenotypeFilter): WorkbenchPhenotype[] {
  const query = filter.query.trim().toLowerCase();
  return phenotypes.filter((phenotype) => {
    const selectedVersion = getSelectedVersion(phenotype);
    const searchable = [
      phenotype.name,
      phenotype.nodeName,
      phenotype.phenotypeType,
      phenotype.tags.join(" "),
      phenotype.versions.map((version) => `${version.id} ${version.promptSnapshot}`).join(" "),
      phenotype.versions.flatMap((version) => version.assets.map((asset) => `${asset.label} ${asset.tags.join(" ")}`)).join(" ")
    ]
      .join(" ")
      .toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (filter.status !== "all" && selectedVersion?.status !== filter.status) return false;
    if (filter.tag !== "all" && !phenotype.tags.includes(filter.tag)) return false;
    if (filter.outdatedOnly && !phenotype.outdated) return false;
    return true;
  });
}

export function getSelectedVersion(phenotype: WorkbenchPhenotype, versionId?: string): WorkbenchVersion | undefined {
  if (versionId) return phenotype.versions.find((version) => version.id === versionId);
  if (phenotype.currentAcceptedVersionId) {
    const accepted = phenotype.versions.find((version) => version.id === phenotype.currentAcceptedVersionId);
    if (accepted) return accepted;
  }
  return [...phenotype.versions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export function allTags(phenotypes: WorkbenchPhenotype[]): string[] {
  return [...new Set(phenotypes.flatMap((phenotype) => phenotype.tags))].sort();
}

export async function loadWorkbenchPhenotypes(options: WorkbenchLoadOptions): Promise<WorkbenchPhenotype[]> {
  return (await loadWorkbenchSnapshot(options)).phenotypes;
}

export async function loadWorkbenchSnapshot(options: WorkbenchLoadOptions): Promise<WorkbenchSnapshot> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL("/api/workbench/snapshot", options.baseUrl);
  if (options.graphId) url.searchParams.set("graphId", options.graphId);
  const response = await fetcher(url.toString());
  if (response.ok === false) throw new Error(`failed to load workbench snapshot: ${response.status ?? "unknown"}`);
  const body = (await response.json()) as Partial<WorkbenchSnapshot>;
  return normalizeWorkbenchSnapshot(body);
}

function normalizeWorkbenchSnapshot(body: Partial<WorkbenchSnapshot>): WorkbenchSnapshot {
  const empty = createEmptyWorkbenchSnapshot();
  const generationPlans = body.generationPlans ?? body.generation?.plans ?? [];
  const generationTasks = body.generationTasks ?? body.generation?.tasks ?? [];
  return {
    overview: body.overview ?? {
      counts: {
        ...empty.overview.counts,
        phenotypes: body.phenotypes?.length ?? 0,
        generationPlans: generationPlans.length,
        generationTasks: generationTasks.length
      },
      anomalies: body.phenotypes?.length ? [] : empty.overview.anomalies
    },
    graphs: body.graphs ?? [],
    generation: {
      plans: generationPlans,
      tasks: generationTasks,
      jobs: body.generation?.jobs ?? []
    },
    libraries: body.libraries ?? [],
    outputReferences: body.outputReferences ?? [],
    assets: body.assets ?? [],
    resultPreviews: body.resultPreviews ?? [],
    phenotypes: body.phenotypes ?? [],
    generationPlans,
    generationTasks
  };
}

export async function loadWorkbenchForApp(options: WorkbenchAppLoadOptions): Promise<WorkbenchAppLoadState> {
  if (options.demo === true) {
    return {
      status: "ready",
      snapshot: sampleWorkbenchSnapshot,
      phenotypes: sampleWorkbenchSnapshot.phenotypes,
      generationPlans: sampleWorkbenchSnapshot.generationPlans,
      generationTasks: sampleWorkbenchSnapshot.generationTasks
    };
  }
  try {
    const snapshot = await loadWorkbenchSnapshot(options);
    return {
      status: "ready",
      snapshot,
      ...snapshot
    };
  } catch (error) {
    const snapshot = createEmptyWorkbenchSnapshot();
    return {
      status: "error",
      snapshot,
      phenotypes: [],
      generationPlans: [],
      generationTasks: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function loadWorkbenchPhenotypesForApp(options: WorkbenchAppLoadOptions): Promise<WorkbenchAppLoadState> {
  return loadWorkbenchForApp(options);
}
