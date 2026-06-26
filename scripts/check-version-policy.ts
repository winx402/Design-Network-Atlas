import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve();
const packageFiles = [
  join(root, "package.json"),
  ...listPackageFiles(join(root, "apps")),
  ...listPackageFiles(join(root, "packages"))
];
const semverPattern = /^\d+\.\d+\.\d+$/;
const failures: string[] = [];

const rootPackage = readJson<{ version?: string }>(join(root, "package.json"));
const rootVersion = rootPackage.version;

if (!rootVersion || !semverPattern.test(rootVersion)) {
  failures.push(`root package.json version must be three numeric segments, received ${rootVersion ?? "<missing>"}`);
}

for (const file of packageFiles) {
  const packageJson = readJson<{ name?: string; version?: string }>(file);
  const label = packageJson.name ?? relative(file);
  if (!packageJson.version || !semverPattern.test(packageJson.version)) {
    failures.push(`${label} version must be three numeric segments, received ${packageJson.version ?? "<missing>"}`);
    continue;
  }
  if (rootVersion && packageJson.version !== rootVersion) {
    failures.push(`${label} version ${packageJson.version} must match root version ${rootVersion}`);
  }
}

const projectVersionFile = join(root, "packages/core/src/project-version.ts");
const projectVersion = readFileSync(projectVersionFile, "utf8").match(/PROJECT_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (!projectVersion || !semverPattern.test(projectVersion)) {
  failures.push(`PROJECT_VERSION must be three numeric segments, received ${projectVersion ?? "<missing>"}`);
} else if (rootVersion && projectVersion !== rootVersion) {
  failures.push(`PROJECT_VERSION ${projectVersion} must match root version ${rootVersion}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked ${packageFiles.length} package versions and PROJECT_VERSION ${projectVersion}.`);

function listPackageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !["node_modules", "dist", ".git"].includes(entry.name)) return listPackageFiles(path);
    if (entry.isFile() && entry.name === "package.json" && extname(entry.name) === ".json") return [path];
    return [];
  });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function relative(path: string): string {
  return path.slice(root.length + 1);
}
