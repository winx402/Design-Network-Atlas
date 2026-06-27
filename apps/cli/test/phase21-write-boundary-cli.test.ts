import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_TIMEOUT = 60_000;

function runDna(args: string[]) {
  return execFileSync("pnpm", ["--silent", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
}

describe("Phase 21 PRD-06 CLI write-boundary language", () => {
  test("root help distinguishes preview, draft, direct audit, and changeset apply semantics", () => {
    const output = runDna(["--help"]);

    expect(output).toContain("Write boundaries");
    expect(output).toContain("preview-confirm");
    expect(output).toContain("draft-write");
    expect(output).toContain("direct audit write");
    expect(output).toContain("changeset-apply");
    expect(output).toContain("formal graph/context/facet facts");
    expect(output).toContain("generated trace/output/audit records");
  }, CLI_TIMEOUT);
});
