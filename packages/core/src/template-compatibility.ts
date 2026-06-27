export const CURRENT_DNA_SCHEMA_COMPATIBILITY = "1.x";

export const CURRENT_DNA_CAPABILITIES = [
  "facets",
  "compile-artifacts",
  "design-context",
  "phenotype-generation",
  "result-library",
  "output-references"
] as const;

export type DnaCapability = (typeof CURRENT_DNA_CAPABILITIES)[number] | string;

export interface TemplateCompatibilityInput {
  compatibility?: Record<string, unknown>;
}

export interface TemplateCompatibilityResult {
  compatible: boolean;
  dnaSchema?: string;
  unsupportedDnaSchema?: string;
  missingCapabilities: string[];
  legacyDnaCompatibility?: string;
  warnings: string[];
}

const CURRENT_DNA_SCHEMA_MAJOR = CURRENT_DNA_SCHEMA_COMPATIBILITY.split(".")[0];
const CURRENT_CAPABILITY_SET = new Set<string>(CURRENT_DNA_CAPABILITIES);

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function supportsDnaSchema(requirement: string | undefined): boolean {
  if (!requirement) return true;
  if (requirement === CURRENT_DNA_SCHEMA_COMPATIBILITY) return true;
  if (requirement === CURRENT_DNA_SCHEMA_MAJOR) return true;
  if (requirement === `${CURRENT_DNA_SCHEMA_MAJOR}.x`) return true;
  if (requirement.startsWith(`${CURRENT_DNA_SCHEMA_MAJOR}.`)) return true;
  return false;
}

export function validateTemplateCompatibility(input: TemplateCompatibilityInput): TemplateCompatibilityResult {
  const compatibility = input.compatibility ?? {};
  const warnings: string[] = [];
  const schemaRequirements = toStringArray(compatibility.dnaSchema);
  const dnaSchema = schemaRequirements[0];
  const legacyDnaCompatibility = typeof compatibility.dna === "string" ? compatibility.dna : undefined;

  if (legacyDnaCompatibility) {
    warnings.push("legacy compatibility.dna is accepted for reading; write dnaSchema/capabilities instead");
  }

  const unsupportedDnaSchema = schemaRequirements.find((requirement) => !supportsDnaSchema(requirement));
  const missingCapabilities = toStringArray(compatibility.capabilities).filter((capability) => !CURRENT_CAPABILITY_SET.has(capability));

  return {
    compatible: !unsupportedDnaSchema && missingCapabilities.length === 0,
    dnaSchema,
    unsupportedDnaSchema,
    missingCapabilities,
    legacyDnaCompatibility,
    warnings
  };
}
