import { GeneTemplate, TemplatePack, nowIso } from "@dna/core";

const createdAt = "2026-06-26T00:00:00.000Z";

export const gameArtTemplatePack: TemplatePack = {
  templatePackId: "game-art-assets",
  name: "Game Art Visual Assets",
  version: "0.1.0",
  domain: "game-art",
  status: "active",
  description: "Initial DNA template pack for game art visual assets.",
  facets: { domain: "game-art" },
  createdAt,
  updatedAt: createdAt
};

export const uiIconTemplatePack: TemplatePack = {
  templatePackId: "ui-icon-assets",
  name: "UI and Icon Assets",
  version: "0.1.0",
  domain: "ui-icon",
  status: "active",
  description: "Initial DNA template pack for UI and icon assets.",
  facets: { domain: "ui-icon" },
  createdAt,
  updatedAt: createdAt
};

export const builtInTemplates: GeneTemplate[] = [
  {
    templateId: "game-art-visual-asset",
    templatePackId: gameArtTemplatePack.templatePackId,
    version: "0.1.0",
    domain: "game-art",
    scope: "node",
    extends: [],
    requiredDimensions: ["shape_language", "color_language", "material_language", "visual_motif"],
    recommendedDimensions: ["composition_grammar", "culture_motif", "rarity_or_faction", "animation_feasibility"],
    optionalDimensions: ["semantic_token", "texture_pattern", "style_distance"],
    forbiddenDimensions: [],
    dimensionSchema: {
      visual_motif: "recognizable repeated visual content or structure",
      shape_language: "dominant silhouette and shape behavior",
      material_language: "surface and material direction"
    },
    propertyResolution: { default: "override", visual_motif: "must-preserve" },
    reviewQuestions: [
      "Which motifs must be preserved across variants?",
      "Which badcases must this asset avoid?",
      "Does the generated phenotype stay inside the faction or rarity identity?"
    ],
    phenotypeTypeSuggestions: ["image-prompt", "art-brief", "review-checklist", "engine-config"],
    compatibility: { dna: "0.1.x" },
    status: "active",
    facets: { gameArt: { assetKinds: ["character", "environment", "prop", "icon"] } },
    createdAt,
    updatedAt: createdAt
  },
  {
    templateId: "ui-icon-asset",
    templatePackId: uiIconTemplatePack.templatePackId,
    version: "0.1.0",
    domain: "ui-icon",
    scope: "node",
    extends: [],
    requiredDimensions: ["visual_motif", "grid", "stroke", "color"],
    recommendedDimensions: ["semantic_token", "state_expression", "accessibility", "thumbnail_recognition"],
    optionalDimensions: ["figma_variable", "svg_spec", "platform_mode"],
    forbiddenDimensions: [],
    dimensionSchema: {
      visual_motif: "recognizable icon family motif",
      grid: "layout grid such as 24px or 32px",
      stroke: "stroke width and cap/join behavior"
    },
    propertyResolution: { default: "override", grid: "restrict", visual_motif: "must-preserve" },
    reviewQuestions: [
      "Can this icon be recognized at small sizes?",
      "Does this icon preserve the family motif?",
      "Does it avoid the listed badcases?"
    ],
    phenotypeTypeSuggestions: ["image-prompt", "svg-spec", "design-token", "figma-variable", "review-checklist"],
    compatibility: { dna: "0.1.x" },
    status: "active",
    facets: { uiIcon: { defaultGrid: "24px", platforms: ["web", "ios", "android"] } },
    createdAt,
    updatedAt: createdAt
  }
];

export function installBuiltInTemplatePacks(store: {
  templates: {
    createPack(pack: TemplatePack): void;
    createTemplate(template: GeneTemplate): void;
  };
}) {
  store.templates.createPack({ ...gameArtTemplatePack, updatedAt: nowIso() });
  store.templates.createPack({ ...uiIconTemplatePack, updatedAt: nowIso() });
  for (const template of builtInTemplates) {
    store.templates.createTemplate({ ...template, updatedAt: nowIso() });
  }
}
