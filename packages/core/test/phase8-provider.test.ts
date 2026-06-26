import { describe, expect, test } from "vitest";
import {
  GenerationProvider,
  HttpGenerationProvider,
  MockGenerationProvider,
  runGenerationProvider,
  sanitizeToolParameters
} from "@dna/core";

const compilePolicy = { type: "system-rule-first", conflictResolution: "system" } as const;

describe("Phase 8 generation provider adapter boundary", () => {
  test("sanitizes sensitive provider parameters before storing job snapshots or metadata", async () => {
    const result = await runGenerationProvider({
      provider: new MockGenerationProvider(),
      generationJobId: "job-secure",
      graphId: "graph-provider",
      nodeId: "node-warning",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar warning icon",
      compilePolicy,
      prompt: "Prompt with warning icon constraints",
      brief: "Warning icon brief",
      toolParameters: {
        model: "mock-image",
        apiKey: "sk-test-secret",
        nested: {
          width: 1024,
          password: "do-not-store"
        }
      }
    });

    const serialized = JSON.stringify(result);
    expect(result.job.status).toBe("generated");
    expect(result.job.toolParameters).toEqual({ model: "mock-image", nested: { width: 1024 } });
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).not.toContain("do-not-store");
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("password");
  });

  test("registers provider output through asset pointers instead of embedding raw asset output in the job", async () => {
    const provider: GenerationProvider = {
      name: "assetful-mock",
      async generate() {
        return {
          text: "raw model response body",
          assetUris: ["model://asset/front", "model://asset/angle"],
          metadata: { model: "assetful", secretToken: "hidden" }
        };
      }
    };

    const result = await runGenerationProvider({
      provider,
      generationJobId: "job-assets",
      graphId: "graph-provider",
      nodeId: "node-warning",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar warning icon",
      compilePolicy,
      prompt: "Prompt",
      brief: "Brief",
      toolParameters: { model: "assetful" }
    });

    expect(result.job.outputSnapshot).toEqual({
      provider: "assetful-mock",
      assetIds: ["job-assets-asset-0", "job-assets-asset-1"],
      metadata: { model: "assetful" }
    });
    expect(result.assets.map((asset) => asset.uri)).toEqual(["model://asset/front", "model://asset/angle"]);
    expect(JSON.stringify(result.job)).not.toContain("raw model response body");
    expect(JSON.stringify(result.job)).not.toContain("model://asset/front");
    expect(JSON.stringify(result.job)).not.toContain("hidden");
  });

  test("failed providers create a failed job and no asset pointers", async () => {
    const provider: GenerationProvider = {
      name: "failing-mock",
      async generate() {
        throw new Error("provider unavailable");
      }
    };

    const result = await runGenerationProvider({
      provider,
      generationJobId: "job-failed",
      graphId: "graph-provider",
      nodeId: "node-warning",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar warning icon",
      compilePolicy,
      prompt: "Prompt",
      brief: "Brief",
      toolParameters: { model: "failing" }
    });

    expect(result.job.status).toBe("failed");
    expect(result.job.errorMessage).toBe("provider unavailable");
    expect(result.assets).toEqual([]);
  });

  test("tool parameter sanitizer removes nested secret-shaped fields", () => {
    expect(
      sanitizeToolParameters({
        model: "safe",
        authToken: "hidden",
        nested: {
          privateKey: "hidden",
          size: "1024x1024"
        }
      })
    ).toEqual({ model: "safe", nested: { size: "1024x1024" } });
  });

  test("generic HTTP provider posts compiled inputs without persisting credentials", async () => {
    const provider = new HttpGenerationProvider({
      name: "http-local",
      endpoint: "https://provider.example.test/generate",
      headers: { Authorization: "Bearer runtime-secret" },
      fetcher: async (url, init) => {
        expect(url).toBe("https://provider.example.test/generate");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer runtime-secret");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ prompt: "Prompt", brief: "Brief" });
        expect(JSON.stringify(body)).not.toContain("sk-do-not-store");
        return new Response(JSON.stringify({ text: "ok", assetUris: ["https://cdn.example.test/out.png"], metadata: { model: "http" } }));
      }
    });

    const result = await runGenerationProvider({
      provider,
      generationJobId: "job-http",
      graphId: "graph-provider",
      nodeId: "node-warning",
      phenotypeType: "image-prompt",
      taskBrief: "toolbar warning icon",
      compilePolicy,
      prompt: "Prompt",
      brief: "Brief",
      toolParameters: { model: "http", apiKey: "sk-do-not-store" }
    });

    expect(result.job.status).toBe("generated");
    expect(result.assets[0].uri).toBe("https://cdn.example.test/out.png");
    expect(JSON.stringify(result.job)).not.toContain("runtime-secret");
    expect(JSON.stringify(result.job)).not.toContain("sk-do-not-store");
  });
});
