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

describe("Phase 13 library routing CLI", () => {
  test("routes output references to storage mounts and preserves policies in export/import", () => {
    const dir = tempDir("phase13-cli");
    const db = join(dir, "dna.sqlite");
    const importedDb = join(dir, "imported.sqlite");
    const out = join(dir, "export");

    runDna(["--db", db, "graph", "create", "--id", "graph-ui", "--name", "UI Graph", "--purpose", "routing", "--yes"]);
    runDna([
      "--db",
      db,
      "library",
      "create",
      "--id",
      "lib-ui",
      "--name",
      "UI Results",
      "--purpose",
      "routed outputs",
      "--yes"
    ]);
    runDna(["--db", db, "library", "bind-graph", "--id", "bind-ui", "--library", "lib-ui", "--graph", "graph-ui", "--yes"]);
    runDna([
      "--db",
      db,
      "library",
      "mount",
      "add",
      "--id",
      "mount-eagle",
      "--library",
      "lib-ui",
      "--storage-type",
      "eagle",
      "--adapter-kind",
      "managed-library",
      "--name",
      "Eagle",
      "--location",
      "eagle://library/main",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "mount",
      "add",
      "--id",
      "mount-docs",
      "--library",
      "lib-ui",
      "--storage-type",
      "database",
      "--adapter-kind",
      "database",
      "--name",
      "Brief DB",
      "--location",
      "sqlite://briefs",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "mount",
      "add",
      "--id",
      "mount-git",
      "--library",
      "lib-ui",
      "--storage-type",
      "git",
      "--adapter-kind",
      "git",
      "--name",
      "Git",
      "--location",
      "git://repo/assets",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "routing",
      "add",
      "--id",
      "route-preview",
      "--library",
      "lib-ui",
      "--name",
      "Preview to Eagle",
      "--priority",
      "20",
      "--role",
      "preview",
      "--reference-type",
      "eagle",
      "--tag",
      "ui",
      "--target-mount",
      "mount-eagle",
      "--sync-mode",
      "metadata-mirror",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "routing",
      "add",
      "--id",
      "route-source",
      "--library",
      "lib-ui",
      "--name",
      "Source to Git",
      "--priority",
      "10",
      "--role",
      "primary-output",
      "--reference-type",
      "git",
      "--target-mount",
      "mount-git",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "library",
      "routing",
      "add",
      "--id",
      "route-brief",
      "--library",
      "lib-ui",
      "--name",
      "Art briefs to DB",
      "--priority",
      "30",
      "--phenotype-type",
      "art-brief",
      "--target-mount",
      "mount-docs",
      "--yes"
    ]);

    runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-preview",
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
      "lib-ui",
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
      "out-source",
      "--graph",
      "graph-ui",
      "--phenotype-version",
      "pv-warning-1",
      "--uri",
      "git://repo/assets/warning.svg",
      "--type",
      "git",
      "--role",
      "primary-output",
      "--library",
      "lib-ui",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-brief",
      "--graph",
      "graph-ui",
      "--phenotype-version",
      "pv-warning-1",
      "--uri",
      "sqlite://briefs/warning",
      "--type",
      "inline-text",
      "--role",
      "primary-output",
      "--library",
      "lib-ui",
      "--phenotype-type",
      "art-brief",
      "--yes"
    ]);
    runDna([
      "--db",
      db,
      "output-ref",
      "add",
      "--id",
      "out-brief-override",
      "--graph",
      "graph-ui",
      "--phenotype-version",
      "pv-warning-1",
      "--uri",
      "git://repo/assets/warning-brief.md",
      "--type",
      "git",
      "--role",
      "primary-output",
      "--library",
      "lib-ui",
      "--phenotype-type",
      "art-brief",
      "--storage-mount",
      "mount-git",
      "--yes"
    ]);

    const references = runDna(["--db", db, "output-ref", "search", "--phenotype-version", "pv-warning-1"]);
    const referencesById = new Map(
      (JSON.parse(references) as Array<{ outputReferenceId: string; storageMountId?: string }>).map((reference) => [
        reference.outputReferenceId,
        reference
      ])
    );
    expect(referencesById.get("out-preview")?.storageMountId).toBe("mount-eagle");
    expect(referencesById.get("out-source")?.storageMountId).toBe("mount-git");
    expect(referencesById.get("out-brief")?.storageMountId).toBe("mount-docs");
    expect(referencesById.get("out-brief-override")?.storageMountId).toBe("mount-git");

    const policies = runDna(["--db", db, "library", "routing", "list", "--library", "lib-ui"]);
    expect(policies).toContain("route-preview");
    expect(policies).toContain("mount-eagle");

    runDna(["--db", db, "export", "--out", out]);
    expect(existsSync(join(out, "libraries", "lib-ui", "routing-policies", "route-preview.json"))).toBe(true);

    runDna(["--db", importedDb, "import", "--in", out, "--yes"]);
    expect(runDna(["--db", importedDb, "library", "routing", "list", "--library", "lib-ui"])).toContain("route-source");
    expect(runDna(["--db", importedDb, "library", "routing", "list", "--library", "lib-ui"])).toContain("route-brief");
  }, 60_000);
});
