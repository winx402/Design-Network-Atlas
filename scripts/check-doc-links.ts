import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve("/Users/bot/Documents/DNA-Design-Network-Atlas");
const markdownFiles = listMarkdownFiles(root).filter((path) => !path.includes("/node_modules/"));
const failures: string[] = [];
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

for (const file of markdownFiles) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1];
    if (!target || target.startsWith("http") || target.startsWith("#") || target.startsWith("mailto:")) continue;
    const [pathPart] = target.split("#");
    if (!pathPart || pathPart.startsWith("app://")) continue;
    const absoluteTarget = normalize(resolve(dirname(file), pathPart));
    if (!absoluteTarget.startsWith(root)) {
      failures.push(`${relative(file)} links outside repo: ${target}`);
      continue;
    }
    if (!existsSync(absoluteTarget)) failures.push(`${relative(file)} missing link target: ${target}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} markdown files.`);

function listMarkdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !["node_modules", "dist", ".git"].includes(entry.name)) return listMarkdownFiles(path);
    if (entry.isFile() && extname(entry.name) === ".md") return [path];
    return [];
  });
}

function relative(path: string): string {
  return path.slice(root.length + 1);
}
