import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function tempDir(name: string) {
  const path = join(tmpdir(), `dna-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return path;
}

function runDna(args: string[]) {
  return execFileSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
}

describe("Phase 12 phenotype library CLI", () => {
  test("manages a phenotype library and records output references without forcing library usage", () => {
    const dir = tempDir("phase12-cli");
    const db = join(dir, "dna.sqlite");
    const importedDb = join(dir, "imported.sqlite");
    const out = join(dir, "export");

    runDna([
      "--db",
      db,
      "graph",
      "create",
      "--id",
      "graph-ui",
      "--name",
      "UI Graph",
      "--purpose",
      "phenotype library CLI test",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "create",
      "--id",
      "lib-shared-ui",
      "--name",
      "Shared UI Library",
      "--purpose",
      "shared phenotype catalog",
      "--profile",
      "media-asset",
      "--accepted-reference",
      "eagle",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "bind-graph",
      "--id",
      "bind-ui",
      "--library",
      "lib-shared-ui",
      "--graph",
      "graph-ui",
      "--role",
      "primary-library",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "mount",
      "add",
      "--id",
      "mount-eagle",
      "--library",
      "lib-shared-ui",
      "--storage-type",
      "eagle",
      "--adapter-kind",
      "managed-library",
      "--name",
      "Eagle Main",
      "--location",
      "eagle://library/main",
      "--capability",
      "preview",
      "--capability",
      "tags",
      "--yes"
    ]);

    const libraries = runDna(["--db", db, "library", "list"]);
    expect(libraries).toContain("lib-shared-ui");
    expect(libraries).toContain("graph-ui");
    expect(libraries).toContain("mount-eagle");

    runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-git",
      "--graph",
      "graph-ui",
      "--phenotype-version",
      "pv-warning-1",
      "--uri",
      "git://repo/ui/warning.svg",
      "--type",
      "git",
      "--role",
      "primary-output",
      "--tag",
      "ui",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-eagle",
      "--graph",
      "graph-ui",
      "--phenotype-version",
      "pv-warning-1",
      "--uri",
      "eagle://item/warning",
      "--type",
      "eagle",
      "--role",
      "preview",
      "--library",
      "lib-shared-ui",
      "--storage-mount",
      "mount-eagle",
      "--tag",
      "UI/Icon",
      "--normalized-tag",
      "ui-icon",
      "--yes"
    ]);

    const outputReferences = runDna(["--db", db, "output-ref", "search", "--phenotype-version", "pv-warning-1"]);
    expect(outputReferences).toContain("out-git");
    expect(outputReferences).toContain("out-eagle");

    const normalizedSearch = runDna(["--db", db, "output-ref", "search", "--tag", "ui-icon"]);
    expect(normalizedSearch).toContain("out-eagle");
    expect(normalizedSearch).not.toContain("out-git");

    runDna(["--db", db, "export", "--out", out]);
    expect(existsSync(join(out, "libraries", "lib-shared-ui", "library.json"))).toBe(true);
    expect(existsSync(join(out, "graphs", "graph-ui", "output-references", "out-eagle.json"))).toBe(true);

    runDna(["--db", importedDb, "import", "--in", out, "--yes"]);
    expect(runDna(["--db", importedDb, "library", "list"])).toContain("lib-shared-ui");
    expect(runDna(["--db", importedDb, "output-ref", "search", "--tag", "ui-icon"])).toContain("out-eagle");
  }, 60_000);
});
