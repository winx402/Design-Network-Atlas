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

export interface HttpGenerationProviderOptions {
  name?: string;
  endpoint: string;
  headers?: Record<string, string>;
  fetcher?: typeof fetch;
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

export type ProviderFailureCategory = "http-error" | "provider-error";

export interface ProviderFailureSummary {
  category: ProviderFailureCategory;
  httpStatus?: number;
  retryHint: string;
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
    const failure = summarizeProviderFailure(error);
    return {
      job: {
        ...baseJob,
        status: "failed",
        errorMessage: `provider failure: ${failure.category}`,
        outputSnapshot: {
          provider: input.provider.name,
          failure
        },
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

export class HttpGenerationProvider implements GenerationProvider {
  readonly name: string;
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly fetcher: typeof fetch;

  constructor(options: HttpGenerationProviderOptions) {
    this.name = options.name ?? "http";
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.fetcher = options.fetcher ?? fetch;
  }

  async generate(input: GenerationProviderInput): Promise<GenerationProviderOutput> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.headers
      },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new ProviderHttpError(response.status);
    const body = (await response.json()) as Partial<GenerationProviderOutput>;
    return {
      text: body.text ?? "",
      assetUris: body.assetUris ?? [],
      metadata: body.metadata ?? {}
    };
  }
}

class ProviderHttpError extends Error {
  constructor(readonly httpStatus: number) {
    super(`provider request failed: ${httpStatus}`);
    this.name = "ProviderHttpError";
  }
}

function summarizeProviderFailure(error: unknown): ProviderFailureSummary {
  const httpStatus = extractHttpStatus(error);
  if (httpStatus !== undefined) {
    return {
      category: "http-error",
      httpStatus,
      retryHint: `Provider returned HTTP ${httpStatus}. Retry after provider availability recovers.`
    };
  }
  return {
    category: "provider-error",
    retryHint: "Review provider availability and retry with sanitized runtime credentials."
  };
}

function extractHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const value = (error as { httpStatus?: unknown; status?: unknown }).httpStatus ?? (error as { status?: unknown }).status;
    if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) return value;
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const match = message.match(/\b(?:HTTP|status|failed:)\s*(\d{3})\b/i);
  if (!match) return undefined;
  const status = Number.parseInt(match[1], 10);
  return status >= 100 && status <= 599 ? status : undefined;
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
