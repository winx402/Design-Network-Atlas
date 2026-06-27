# Versioning And Release Policy

状态：active
最后审阅：2026-06-27
来源级别：project release policy

DNA uses two project-wide operating rules.

## 1. Defaults First, Deep Customization Second

Every subsystem should work with sensible defaults before users configure advanced behavior.

- Default flows must be usable with local SQLite, built-in template packs, and Git-friendly JSON exchange.
- Advanced configuration should be opt-in.
- Custom storage engines, asset-library adapters, generation providers, routing policies, review rules, and template packs must extend the system without changing the core model.
- Public documentation should explain the default path first, then describe where deeper customization fits.

## 2. Three-Segment Versioning

All project versions must use exactly three numeric segments:

```text
MAJOR.MINOR.PATCH
```

No prerelease or build suffix is used for repository-level versions at this stage.

Version bump rules:

- `PATCH`: documentation, tests, compatible fixes, compatible internal behavior changes.
- `MINOR`: new compatible capabilities, commands, adapters, schemas, or public workflows.
- `MAJOR`: breaking schema, storage, CLI, import/export, or API changes.

Every push to the remote repository that changes tracked project files must include a version bump. For routine documentation-only pushes, use a patch bump.

The root `package.json` is the only hand-authored version source. Workspace package manifests should not define their own versions while the repository is private. `PROJECT_VERSION` is generated from the root version and is used by the CLI and export metadata.

Required check:

```bash
pnpm version:sync
pnpm version:check
```

Recommended pre-push check:

```bash
pnpm version:sync
pnpm version:check
pnpm docs:check
pnpm typecheck
pnpm test
```
