# DNA Write Boundary Matrix

状态：active
最后审阅：2026-06-27
来源级别：normative write policy
术语来源：[docs/design/concept-registry.md](concept-registry.md)

This matrix is normative for CLI, application services, server, Web, skills, tests, and future adapters. `packages/core` remains the domain source of truth; this document defines how each concept class may be written.

SQLite persistence follows `SqliteDnaStore.migrate()` as the runtime schema authority. `packages/sqlite/src/schema.ts` is a reference/type mapping, not the runtime migration authority. `node_relations` and `phenotype_types` are retained as deprecated/migration-only compatibility tables and are not productized write targets.

## Write Vocabulary

- `preview/change-set`: build a reviewable change-set and do not persist the formal fact until the user applies it.
- `draft-write`: persist an explicitly draft object or generated trace/output record while keeping provenance and snapshots.
- `direct audit write`: persist a trace, output, external pointer, governance record, or admin configuration through a CLI/application service boundary without pretending it changed formal graph facts.
- `changeset-apply`: apply an existing reviewed preview change-set.

Web remains read-only in the current product baseline. It must not expose graph, context, facet, phenotype, review, impact, asset, output reference, or change-set write controls.

## Object Matrix

| Class | Examples | Default write mode | Required boundary |
| --- | --- | --- | --- |
| Formal graph facts | `Graph`, `SpeciesNode`, `NodeVersion`, `SpeciesGroup`, memberships, atlases, `DesignRelationship` | preview/change-set | application/service change-set |
| Formal design context facts | `DesignContext`, facts, principles, motifs, references, rubrics, attachments, policies | preview/change-set | application/service change-set |
| Facet taxonomy and assignments | `FacetDefinition`, `FacetSchema`, `FacetAssignment` | preview/change-set for user-authored taxonomy; direct only for imported fixtures | application/service change-set |
| Generated trace artifacts | `EntityCompileArtifact`, `SpeciesCompileArtifact`, `PhenotypeCompileArtifact`, `CompileFrame` payloads | preview for standalone compile; direct audit write during explicit persisted compile or formal generation apply | application service |
| Stable generated-output guidance | `PhenotypeUsageGuide` | preview/change-set for create/update/archive; imported current state may use trusted import path | application/service change-set |
| Generated outputs | planned `Phenotype`, `PhenotypeVersion`, `GenerationJob` | planned containers through proposal/change-set or draft-write; generated versions/jobs through direct audit write | application service |
| External pointers | `AssetIndex`, `OutputReference`, libraries, mounts, routing policies, graph bindings | direct audit write through CLI/application service | application/service |
| Governance records | `ReviewRecord`, `ImpactRecord`, change-set review results | direct audit write | application/service |
| Templates and capability config | `TemplatePack`, `GeneTemplate` | direct admin write with compatibility validation | template/application service |

## Rules

1. LLM-inferred formal graph, context, design, and facet facts default to `preview/change-set`.
2. A user must explicitly apply formal facts through the accepted CLI/application service boundary before they become durable graph truth.
3. Generated trace artifacts and generated outputs may use `direct audit write` during formal generation apply because they are provenance records, not unconfirmed graph facts.
4. Standalone layered compile commands default to preview. Persisting compile artifacts requires explicit apply/persist mode and writes generated trace artifacts only; compile never mutates graph, context, facet, relationship, template, or phenotype facts.
5. `phenotype generate --apply` may persist layered compile artifacts, phenotype/version records, and a generation job in one transaction. When `--phenotype-id` points to an existing planned phenotype, generation reuses that container and creates a pending version/job instead of duplicating the phenotype.
6. `PhenotypeUsageGuide` create/update/archive defaults to preview/change-set. Formal generation may reference an active guide id/revision and bounded snapshot, but it must not auto-create or auto-update the guide.
7. Persisted compile artifacts carry dependency version vectors. Upstream writes make them stale or historical by comparison; DNA must not auto-recompile downstream artifacts or silently treat stale artifacts as current.
8. `proposal import-batch` defaults to proposal + preview change-sets for `dna.modeling-batch.v1`; explicit `draft-write` is a local seed path that skips proposal review and must say so in output. Batch `phenotypePlans` become planned `Phenotype` containers only after apply/draft-write and must not create versions, jobs, assets, or output references.
9. Direct audit commands must name the object type they persist and must not imply they changed graph identity.
10. Provider credentials, raw provider errors, complete private links, and secrets may not be stored in generated artifacts, jobs, exports, logs, or fixtures.
11. Web remains read-only until a future accepted PRD adds service-backed writes.

## CLI And Skill Language

Use these terms consistently:

- `preview-confirm` for default formal fact previews.
- `draft-write` for explicitly draft objects or generated trace/output records.
- `direct audit write` for generated trace/output/audit records and external pointers written through CLI/application service boundaries.
- `changeset-apply` for applying an existing preview change-set.
- `review stage` for derived proposal/import/export visibility: `draft`, `pending-review`, `confirmed-applied`, or `reviewed` for clean current exports.

Avoid bare `direct` because it hides whether the write is an audit/output record or an unreviewed formal fact.
