import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { PROJECT_VERSION } from "@dna/core";

const root = resolve();

describe("project version policy", () => {
  test("uses root package.json as the only hand-authored version source", () => {
    const rootPackage = readJson<{ version: string }>("package.json");
    expect(rootPackage.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PROJECT_VERSION).toBe(rootPackage.version);

    const projectVersionSource = readFileSync(join(root, "packages/core/src/project-version.ts"), "utf8");
    expect(projectVersionSource).toContain("Generated from root package.json");

    for (const file of workspacePackageFiles()) {
      const packageJson = readJson<Record<string, unknown>>(file);
      expect(packageJson.version, `${file} should not define its own version`).toBeUndefined();
    }
  });
});

function workspacePackageFiles(): string[] {
  return [...listPackageFiles("apps"), ...listPackageFiles("packages")];
}

function listPackageFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listPackageFiles(path);
    if (entry.isFile() && entry.name === "package.json") return [path];
    return [];
  });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as T;
}
