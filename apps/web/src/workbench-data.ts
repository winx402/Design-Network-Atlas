export type WorkbenchVersionStatus =
  | "pending-confirmation"
  | "accepted"
  | "rejected"
  | "superseded"
  | "archived";

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

export interface PhenotypeFilter {
  query: string;
  status: WorkbenchVersionStatus | "all";
  tag: string | "all";
  outdatedOnly: boolean;
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
        status: "pending-confirmation",
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
        status: "superseded",
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

export function updateVersionStatus(
  phenotypes: WorkbenchPhenotype[],
  phenotypeId: string,
  versionId: string,
  status: WorkbenchVersionStatus
): WorkbenchPhenotype[] {
  return phenotypes.map((phenotype) => {
    if (phenotype.id !== phenotypeId) return phenotype;
    return {
      ...phenotype,
      currentAcceptedVersionId: status === "accepted" ? versionId : phenotype.currentAcceptedVersionId,
      versions: phenotype.versions.map((version) => (version.id === versionId ? { ...version, status } : version))
    };
  });
}

export function allTags(phenotypes: WorkbenchPhenotype[]): string[] {
  return [...new Set(phenotypes.flatMap((phenotype) => phenotype.tags))].sort();
}
