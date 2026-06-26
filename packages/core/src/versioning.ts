export type VersionBump = "patch" | "minor" | "major";

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(version: string): ParsedVersion {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function formatVersion(version: ParsedVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function bumpVersion(version: string, bump: VersionBump): string {
  const parsed = parseVersion(version);
  if (bump === "major") {
    return formatVersion({ major: parsed.major + 1, minor: 0, patch: 0 });
  }
  if (bump === "minor") {
    return formatVersion({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
  }
  return formatVersion({ major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1 });
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

export function isVersionOutdated(current: string, latest: string): boolean {
  return compareVersions(current, latest) < 0;
}
