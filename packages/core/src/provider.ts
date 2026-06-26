import { createDefaultAsset, createGenerationJob, nowIso } from "./defaults.js";
import { AssetIndex, CompilePolicy, GenerationJob } from "./schemas.js";

export interface GenerationProviderInput {
  prompt: string;
  brief: string;
  toolParameters: Record<string, unknown>;
}

export interface GenerationProviderOutput {
  text: string;
  assetUris: string[];
  metadata: Record<string, unknown>;
}

export interface GenerationProvider {
  readonly name: string;
  generate(input: GenerationProviderInput): Promise<GenerationProviderOutput>;
}

export interface RunGenerationProviderInput {
  provider: GenerationProvider;
  generationJobId: string;
  graphId: string;
  nodeId: string;
  phenotypeId?: string;
  phenotypeVersionId?: string;
  phenotypeType: string;
  taskBrief: string;
  compilePolicy: CompilePolicy;
  prompt: string;
  brief: string;
  toolParameters: Record<string, unknown>;
}

export interface RunGenerationProviderResult {
  job: GenerationJob;
  assets: AssetIndex[];
}

const SENSITIVE_PARAMETER_PATTERN = /api[_-]?key|secret|password|token|private[_-]?key/i;

export function sanitizeToolParameters(parameters: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(parameters);
}

export async function runGenerationProvider(input: RunGenerationProviderInput): Promise<RunGenerationProviderResult> {
  const safeToolParameters = sanitizeToolParameters(input.toolParameters);
  const baseJob = createGenerationJob({
    generationJobId: input.generationJobId,
    graphId: input.graphId,
    nodeId: input.nodeId,
    phenotypeId: input.phenotypeId,
    phenotypeVersionId: input.phenotypeVersionId,
    phenotypeType: input.phenotypeType,
    taskBrief: input.taskBrief,
    compilePolicy: input.compilePolicy,
    inputSnapshot: {
      prompt: input.prompt,
      brief: input.brief,
      toolParameters: safeToolParameters
    },
    outputSnapshot: {},
    tool: input.provider.name,
    toolParameters: safeToolParameters,
    status: "created"
  });

  try {
    const output = await input.provider.generate({
      prompt: input.prompt,
      brief: input.brief,
      toolParameters: safeToolParameters
    });
    const assets = output.assetUris.map((uri, index) =>
      createDefaultAsset({
        assetId: `${input.generationJobId}-asset-${index}`,
        uri,
        storageType: uri.includes("://") ? "url" : "local",
        assetType: "model-output",
        role: "output",
        linkedObjectType: "generation-job",
        linkedObjectId: input.generationJobId,
        description: `provider output ${index + 1} from ${input.provider.name}`
      })
    );
    return {
      job: {
        ...baseJob,
        status: "generated",
        outputSnapshot: {
          provider: input.provider.name,
          assetIds: assets.map((asset) => asset.assetId),
          metadata: sanitizeToolParameters(output.metadata)
        },
        updatedAt: nowIso()
      },
      assets
    };
  } catch (error) {
    return {
      job: {
        ...baseJob,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        outputSnapshot: {},
        updatedAt: nowIso()
      },
      assets: []
    };
  }
}

export class MockGenerationProvider implements GenerationProvider {
  readonly name = "mock";

  async generate(input: GenerationProviderInput): Promise<GenerationProviderOutput> {
    return {
      text: `${input.brief}\n${input.prompt}`,
      assetUris: [],
      metadata: { provider: this.name, parameters: input.toolParameters }
    };
  }
}

function sanitizeRecord(parameters: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (SENSITIVE_PARAMETER_PATTERN.test(key)) continue;
    result[key] = sanitizeValue(value);
  }
  return result;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === "object") return sanitizeRecord(value as Record<string, unknown>);
  return value;
}
