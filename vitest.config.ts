import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@dna/core": resolve(root, "packages/core/src/index.ts"),
      "@dna/application": resolve(root, "packages/application/src/index.ts"),
      "@dna/storage": resolve(root, "packages/storage/src/index.ts"),
      "@dna/sqlite": resolve(root, "packages/sqlite/src/index.ts"),
      "@dna/template-packs": resolve(root, "packages/template-packs/src/index.ts"),
      "@dna/server": resolve(root, "packages/server/src/index.ts")
    }
  }
});
