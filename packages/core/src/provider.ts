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
