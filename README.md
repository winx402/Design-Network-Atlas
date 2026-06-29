# DNA: Design Network Atlas

> English | [中文](#中文)

DNA is a local-first, open-source architecture for managing design assets through a structured design graph. It helps teams describe design rules, stable design objects, style evolution, generated results, asset references, review records, and downstream impact.

DNA is not a binary asset store by default. It is a graph and governance layer that can connect to Git repositories, local folders, NAS, Eagle, Figma, databases, object storage, engine export folders, or future custom asset libraries.

## LLM Design Generation Focus

DNA's primary product scenario is LLM-assisted design generation. The graph is the durable design context that lets an LLM generate, revise, review, and register design outputs without treating each prompt as an isolated one-off request.

Principles:

- Durable design facts belong in the graph; prompts and briefs are compiled views of those facts.
- LLM work should start from existing species, design relationships, planned phenotype surfaces, design contexts, references, rubrics, and compile artifacts.
- Planned outputs are represented as `Phenotype` containers with `status: "planned"`; concrete generation attempts create `PhenotypeVersion` and `GenerationJob` records later.
- Generated outputs remain phenotypes and phenotype versions until review confirms whether they become accepted results.
- Provider calls should not mutate the formal graph, persist raw credentials, or invent unresolved design facts.
- Every output reference should remain traceable back to the graph object, version, task brief, compile artifact, review record, and impact loop that produced it.

## What DNA Models

- **Gene layer**: reusable design dimensions, constraints, templates, and review questions.
- **Species layer**: stable design objects such as icon families, characters, props, components, or style families.
- **Relationship layer**: `DesignRelationship` records graph/group/node relationships with endpoint cardinality, design-language contract, review fields, provenance, and audit metadata.
- **Result layer**: concrete generated or curated outputs for a task, such as images, prompts, briefs, source files, previews, or runtime exports.
- **Impact layer**: downstream review or regeneration signals when an upstream design object or evolution rule changes.

In the internal schema, the result layer uses the term `Phenotype`. Public-facing docs can read this as "generated result", "asset result", or "design output".
Canonical boundaries between durable design facts, compiled views, runtime jobs, generated outputs, external pointers, and audit records are maintained in [docs/design/concept-registry.md](docs/design/concept-registry.md).
Object-level write semantics are maintained in [docs/design/write-boundary-matrix.md](docs/design/write-boundary-matrix.md): formal graph/context/facet facts default to preview/change-set, while generated trace/output/audit records use `direct audit write` or `draft-write` through CLI/application service boundaries.

## Architecture

DNA is split into a reusable domain core, storage ports, concrete adapters, and user-facing entrypoints.

```text
Human / Agent / LLM design task
        |
        v
CLI / Codex Skills / Web / Local API
        |
        v
Application services + preview ChangeSet review
        |
        v
@dna/core domain model + @dna/storage repository ports
        |
        +--> Graph/Atlas: SpeciesNode, SpeciesGroup, DesignRelationship
        +--> Context: DesignContext, facts, principles, motifs, references, rubrics
        +--> Compile: SpeciesCompileArtifact, PhenotypeCompileArtifact, trace/conflicts
        +--> Generation: GenerationJob, provider ports, sanitized parameters
        +--> Results: Phenotype, PhenotypeVersion, AssetIndex, OutputReference
        +--> Governance: ReviewRecord, ImpactRecord, library routing
        |
        v
SQLite / Git directory export / local HTTP snapshots / external asset libraries
```

Key boundaries:

- Core domain logic does not depend on SQLite, CLI, Web, or any specific asset-management system.
- Persistent writes are expected to flow through services, repositories, and change-set semantics.
- Storage implementations are replaceable because the domain layer talks to repository ports.
- External asset libraries are adapter targets, not hard-coded product assumptions.
- Generated results can be recorded even when a team does not use DNA's optional result-library layer.
- Graph lineage can be projected as a readable species tree or JSON structure without changing stored node and design relationship data.
- Preview change-sets can be listed, reviewed, applied, discarded, packaged in local proposals, exported, and imported as first-class review artifacts.

## Defaults First

DNA should work with strong defaults before a team configures advanced policies. This rule applies across the whole system, not only asset/result storage.

- A new graph should be usable with local SQLite storage and the Git-friendly exchange format.
- The default asset setup should be one primary result library per design graph.
- Different result types should usually be separated by storage mounts inside that library, not by creating many libraries.
- `LibraryRoutingPolicy` can route different generated-result types or output roles to the right mount by default, while still allowing an explicit override per output reference.
- Multiple result libraries are still supported for different governance boundaries, such as exploration, production, outsourcing, archive, or runtime export.
- Advanced teams can add custom storage engines, adapter mappings, routing policies, review rules, template packs, and generation providers without changing the core model.

Template compatibility is schema/capability based, not tied to the root project version. `TemplatePack.version` is the pack content version, `GeneTemplate.version` is the template definition version, `compatibility.dnaSchema` declares supported DNA schema compatibility, and `compatibility.capabilities` declares required product capabilities.

## Monorepo Modules

| Module | Responsibility | Adapter boundary |
| --- | --- | --- |
| `@dna/core` | Zod schemas, domain types, default objects, compile policies, review logic, version rules, impact analysis, provider contracts | No database, CLI, or UI dependency |
| `@dna/storage` | Repository ports, storage engine interface, transactions, in-memory implementation, service contracts | Defines what SQLite/server adapters must implement |
| `@dna/application` | Reusable orchestration for compile input assembly, impact collection, generation preparation, and status transitions | Depends on core/storage ports, not CLI or SQLite implementations |
| `@dna/sqlite` | Local SQLite adapter, migrations, repositories, Git-friendly import/export | Can be replaced by another storage engine |
| `@dna/cli` | Local `dna` command entrypoint, preview/apply workflow, local project operations | Uses services and repositories instead of owning domain rules |
| `@dna/template-packs` | Starter gene templates for game art and UI/icon assets | Domain packs can be added without changing core schemas |
| `@dna/server` | Local HTTP API baseline and collaboration-oriented service adapter surface | Future hosted/team mode can share the same ports |
| `@dna/web` | Read-only Explorer for graph maps, graph interiors, generation traces, phenotype libraries, result previews, and inspector search | UI loads service/API data and must not write core data directly |
| `codex-skills/dna-graph-modeling` | Maps new design scenarios into graph, species, design relationships, facets, planned phenotypes, and write strategy | Does not duplicate CLI help or write storage directly |
| `codex-skills/dna-graph-editing` | Evaluates changes to existing graphs with reasonableness, impact, risk, and review guidance | Does not bypass preview, change-set review, or proposal flows |
| `codex-skills/dna-phenotype-generation` | Orchestrates generated-result planning from existing graph constraints, compile artifacts, review, and output registration | Does not invent graph facts or call providers when blocking questions remain |

Skills are scenario workflows for complex design reasoning. They help an Agent map a user's domain into DNA concepts, decide review/write strategy, and prepare compile or generation plans. CLI syntax belongs in `dna --help`; persisted compile outputs remain `SpeciesCompileArtifact` and `PhenotypeCompileArtifact`, not standalone skills.

## Adaptability

DNA is designed to fit into different production environments instead of forcing one asset workflow.

### Storage Engines

- Default local runtime: SQLite.
- Open exchange format: Git-friendly directory JSON.
- Future-compatible targets: server-backed storage, cloud database, team sync service, or project-specific repositories.

### Result Libraries

DNA can manage an optional searchable result library. Internally this is represented by `PhenotypeLibrary`.

- The default convention is one primary result library for one design graph.
- That library can contain multiple storage mounts, such as Eagle for browsing, Git for source files, NAS for raw media, and an engine export folder for runtime assets.
- One result library can still serve multiple design graphs when teams intentionally share an asset catalog.
- One design graph can bind to multiple result libraries when governance boundaries differ.
- SQLite migration backfills `PhenotypeLibrary.graphIds` from existing graph bindings, so projects created before v0.4 keep exports consistent after upgrade.
- Routing policies decide which storage mount should receive a generated-result reference when the caller only specifies a library.
- One generated-result version can have multiple output references.
- An output reference can point directly to an external system even when no DNA result library is used.

### Asset-Library Adapters

DNA separates normalized metadata from adapter-specific metadata.

- `StorageMount` describes where an external library lives and which capabilities it supports.
- `ExternalLibraryMapping` records how external fields such as tags, folders, ratings, collections, or annotations map into DNA metadata.
- Eagle is only one possible adapter target. The same model can support NAS folders, Git repositories, object storage, databases, Figma, engine exports, or custom DAM systems.

### Generation Providers

Generation providers should receive compiled constraints and prompts, then return generation results. Providers should not own graph mutation, API-key storage, or formal version decisions.

v0.4 and later include the provider contract, mock provider execution, and a generic HTTP provider primitive. Runtime credentials and sensitive parameters are sanitized from generation jobs and export snapshots.

Formal compile is layered. `dna compile atlas|graph|group|species|phenotype` produces compile frames, dependency vectors, feedback, conflicts, and open questions without mutating graph facts. Atlas/graph/group frames can be stored as `EntityCompileArtifact`; species and phenotype generation keep using `SpeciesCompileArtifact` and `PhenotypeCompileArtifact` with the same layered frame model.

Formal `dna phenotype generate` uses layered compile artifacts as the provenance path. The command accepts optional `--species-artifact <id>` and `--phenotype-artifact <id>` for deterministic replay; when they are omitted it prepares a new layered `SpeciesCompileArtifact` and `PhenotypeCompileArtifact` automatically. Supplied artifacts must match the graph, node, phenotype type, task brief, species link, frame shape, and dependency vector; stale artifacts require explicit historical replay. Preview returns artifacts, phenotype, phenotype version, generation job, and prompt without persistence. `--apply` persists the new artifacts, phenotype/version, and generation job in one transaction, and the generated `PhenotypeVersion` records `speciesCompileArtifactId`, `phenotypeCompileArtifactId`, and a bounded `compileArtifactSnapshot` with frame, conflict, decision, feedback, and validity summaries. New generated versions start as `candidate`.

Phenotype result lifecycle is governed on `PhenotypeVersion`, not on `GenerationJob` or `PhenotypeGenerationTask`. `GenerationJob` remains the execution-attempt record; `PhenotypeVersion.status`, `PhenotypeVersion.feedback`, and `Phenotype.currentAcceptedVersion` are the production lifecycle chain. `dna phenotype-version accept|reject|replace|deprecate|rollback|archive|delete` previews by default and applies only with `--apply` or `--yes`. Lifecycle writes may change only status, feedback, and the accepted pointer; prompt snapshots, generation recipes, compile artifact ids, asset ids, and created timestamps remain immutable.

Generation planning is a production orchestration layer above manual generation. `PhenotypeGenerationPlan` covers graph, species-group, species-node, or phenotype scope and expands deterministically into `PhenotypeGenerationTask` records for planned phenotypes. Tasks may also be created without a plan. `versionBinding` defaults to `latest-at-execution`; pinned node versions or compile artifacts are allowed but stale artifacts require explicit historical replay. `dna generation-plan update` and `dna generation-task update` preview orchestration metadata changes by default and apply only with `--apply` or `--yes`; they may update non-sensitive planning metadata, tags, requirements, preferences, notes, and task blocking state, but not immutable target identity or execution trace links. `dna phenotype generate --task <taskId> --apply` writes the generated compile artifacts, `GenerationJob`, and `PhenotypeVersion` back to the task for reviewable traceability. Plans and tasks can store non-sensitive model/tool preference, `llmInstructions`, `operatorNotes`, metadata, and extensions, but never provider credentials or complete private links.

Reference generation is separate from phenotype generation. `dna reference-generation prepare|run-mock` creates graph- or species-group-scoped prompts and optional persisted `EntityCompileArtifact` plus reference `GenerationJob` records without creating synthetic `SpeciesNode`, `Phenotype`, or `PhenotypeVersion` objects. `dna reference-generation link-asset` registers a safe pointer in `AssetIndex` for a reference job; it does not copy binaries and rejects private or credential-bearing asset URIs. External outputs can be marked complete with `dna reference-generation complete --job <id> --apply` after linked asset evidence exists, or atomically during `link-asset --mark-generated --apply`; completion stores only safe notes/tool labels/metadata and preserves the original prompt, target, and input snapshots. Later phenotype tasks should cite reference jobs/assets by ids in requirements or metadata instead of copying private URLs.

### Local HTTP API And Web Workbench

DNA includes a local HTTP API baseline for health checks, graph tree data, generation plan/task data, and read-only explorer snapshots. HTTP access to the DNA web page is disabled by default. When explicitly enabled with `dna serve --web` or `createDnaHttpHandler(store, { webEnabled: true })`, it serves the DNA Read-only Explorer from `/api/workbench/snapshot`. The default page is `Atlas Map`, with `Graph Explorer`, `Generation Board`, `Phenotype Library`, and a shared `Inspector`; additional read-only view endpoints expose `/api/workbench/graph-map`, `/api/workbench/graphs/:graphId`, `/api/workbench/generation`, and `/api/workbench/library`. The Explorer shows safe result/gallery previews, graph-level DesignRelationship routes, graph interiors, generation trace paths, and mobile-friendly read-only navigation. It does not accept, reject, archive, run tasks, apply sync, or otherwise durably mutate DNA records. The legacy `/api/workbench/phenotypes` endpoint remains available as a narrow generated-result snapshot for existing local integrations.

### Review And Confirmation Workflow

`dna changeset list/show/review/apply/discard` turns preview writes into a reviewable loop. Graph, node, and design relationship previews remain out of the formal graph until a preview change-set is applied. `--mode changeset-apply --change-set <id>` is also supported for existing graph, node, and relationship create commands.

## Technical Data Model

Core objects:

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `DesignRelationship`
- `Phenotype` - internal name for a generated or curated result object
- `PhenotypeGenerationPlan` - graph/group/node/phenotype scoped production plan
- `PhenotypeGenerationTask` - executable generation work item with trace links
- `PhenotypeVersion` - versioned snapshot of a generated or curated result
- `OutputReference`
- `PhenotypeLibrary` - optional searchable result library
- `StorageMount`
- `PhenotypeLibraryGraphBinding`
- `ExternalLibraryMapping`
- `LibraryRoutingPolicy`
- `AssetIndex`
- `GenerationJob`
- `ReviewRecord`
- `ImpactRecord`
- `ChangeSet`

When two objects sound similar, use [docs/design/concept-registry.md](docs/design/concept-registry.md) as the product terminology owner and `packages/core` as the implementation source of truth.

## Exchange Format

`dna export --out <dir>` writes a Git-friendly project directory with a versioned `dna.project.json` manifest. The manifest includes `projectVersion`, `exchangeVersion`, `capabilities`, and `exportProfile` so future imports can reject unsupported exchange versions clearly and reviewers can distinguish full backups from review packages.

The default `full` export preserves all change-sets and proposals for backup, migration, and audit. `--profile review-current` exports current formal state without `change-sets/` or `proposals/` and records omitted counts plus clean review metadata in the manifest. `--profile proposal-review --proposal <id>` exports the target proposal plus its linked change-sets and fails on broken links.

The stable exchange contract includes change-sets, proposals, facets, contexts, templates, libraries, atlases, graph lineage, species groups, compile artifacts, generation plans, generation tasks, generation jobs, output references, reviews, and impacts. The full directory map is maintained in [docs/design/system-architecture.md](docs/design/system-architecture.md).

## Install

Requirements:

- Node.js 20+
- pnpm 11+

```bash
git clone https://github.com/winx402/Design-Network-Atlas.git
cd Design-Network-Atlas
pnpm install
pnpm dna --help
```

The CLI includes `dna graph tree --id <graph_id>` for a readable species tree, `dna graph tree --include-groups` for reviewer-visible group overlays, and `dna graph tree --include-phenotypes` for planned phenotype coverage. It also includes `dna compile atlas|graph|group|species|phenotype` for layered compile previews/persisted artifacts, `dna generation-plan create/list/show/update/expand`, `dna generation-task create/list/show/update/run-mock/link-result`, `dna reference-generation prepare|run-mock|link-asset|complete`, `dna phenotype-version ...` for candidate/accepted/replaced/rolled-back lifecycle metadata, `dna facet definition/schema/assignment ...` for facet write paths, `dna modeling check` for reusable modeling-quality review, `dna changeset list/show/review/apply/discard` for preview review, `dna proposal import-batch --in <file>` for `dna.modeling-batch.v1` initial modeling drafts, `dna sync export/import` for explicit directory exchange, and `dna serve` for the local HTTP API. Root CLI version discovery uses `dna --cli-version` or `dna -V`, while subcommands may own their domain `--version` options. Web page access remains off unless `dna serve --web` is used; when enabled, it is a read-only local Explorer with Atlas Map, Graph Explorer, Generation Board, Phenotype Library, and Inspector surfaces.
`dna.modeling-batch.v1` can declare graphs, species groups, design relationships, facets, and `phenotypePlans`. Default import mode creates a proposal with preview change-sets and a compact review report. Explicit `--mode draft-write` writes local seed objects through the service boundary and reports that it skips proposal review.
For formal generation, `dna phenotype generate --graph <id> --node <id> --type <type> --name <name> --brief <brief>` compiles or reuses layered species and phenotype artifacts; add `--apply` to persist the generated artifacts, phenotype version, and generation job. Use `dna phenotype generate --task <taskId> --apply` when the work should update a generation task with artifact/job/version links. Stale supplied artifacts require explicit historical replay. Graph/group reference prompts use `dna reference-generation prepare|run-mock|link-asset|complete`; they create scoped reference `GenerationJob` records and safe `AssetIndex` pointers without creating synthetic phenotype records.

The root `package.json` currently uses `private: true` to prevent accidental npm publishing from the monorepo. The GitHub source is open under the MIT license.

## Development Checks

```bash
pnpm version:sync
pnpm version:check
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
```

## Versioning

DNA uses three-segment numeric versions: `MAJOR.MINOR.PATCH`.

Every push to the remote repository that changes tracked project files must include a version bump. Routine documentation or compatible fixes use a patch bump; compatible features use a minor bump; breaking schema, storage, CLI, import/export, or API changes use a major bump.

The root `package.json` is the only hand-authored version source. Generated runtime version constants must be synced from it with `pnpm version:sync`, and workspace packages should not define their own versions. Run `pnpm version:check` before pushing.

## Maturity

DNA is currently a local-first project suitable for pilot use, local design-graph governance, graph modeling/editing/phenotype generation scenario skills, graph tree inspection, preview change-set review, prompt/brief generation, result-library routing, output reference management, review records, impact analysis, versioned Git-friendly exchange, local HTTP API integration, and a DNA Read-only Explorer for graph maps, generation traces, library previews, and result inspection.

Production npm publishing, first-party image-model provider packages, a full connected Web client, hosted team permissions, approval workflows, and multi-user sync services are future work.

## Contact

Project contact: [winx402@agent.qq.com](mailto:winx402@agent.qq.com)

## License

MIT License. See [LICENSE](LICENSE).

---

# 中文

DNA 是一个本地优先的开源“设计基因图谱”架构，用来通过结构化图谱管理设计资产。它帮助团队描述设计规则、稳定设计对象、风格演化、生成结果、素材引用、审查记录和下游影响。

DNA 默认不是二进制素材仓库。它更像图谱治理层，可以连接 Git 仓库、本地目录、NAS、Eagle、Figma、数据库、对象存储、引擎导出目录或未来自定义素材库。

## 面向 LLM 的设计生成定位

DNA 的核心产品场景是辅助 LLM 完成设计生成。图谱是可长期复用的设计上下文，让 LLM 可以基于稳定对象、演化规则、审查约束和历史结果来生成、修改、审查和登记输出，而不是把每次 prompt 都当成孤立请求。

原则：

- 持久设计事实属于图谱；prompt 和 brief 只是这些事实的编译视图。
- LLM 工作应从已有物种、DesignRelationship、planned phenotype surfaces、设计上下文、参考、rubric 和编译产物出发。
- 计划中的输出面以 `status: "planned"` 的 `Phenotype` 容器表示；具体生成尝试稍后再创建 `PhenotypeVersion` 和 `GenerationJob`。
- 生成输出在通过审查前只是 `Phenotype` / `PhenotypeVersion`，不能自动等同于已接受资产。
- provider 调用不能直接修改正式图谱，不能持久化原始凭证，也不能把未确认推断写成事实。
- 每条输出引用都应能追溯到图谱对象、版本、任务 brief、编译产物、审查记录和影响分析闭环。

## DNA 建模什么

- **基因层**：可复用的设计维度、约束、模板和审查问题。
- **物种层**：稳定设计对象，例如图标家族、角色、道具、组件或风格族。
- **关系层**：`DesignRelationship` 记录 graph/group/node 关系，包含 endpoint、design-language contract、review 字段、provenance 和 audit metadata。
- **结果层**：某个具体任务中生成或整理出的结果，例如图片、prompt、brief、源文件、预览图或运行时导出。
- **影响层**：上游设计对象或演化规则变化后，对下游对象产生的审查或重生成信号。

在内部 schema 里，结果层对象使用 `Phenotype` 这个名字。对外可以把它理解成“生成结果”“素材结果”或“设计输出”。
持久设计事实、编译视图、运行任务、生成输出、外部指针和审计记录之间的边界，以 [docs/design/concept-registry.md](docs/design/concept-registry.md) 为统一术语入口。
对象级写入语义以 [docs/design/write-boundary-matrix.md](docs/design/write-boundary-matrix.md) 为准：正式 graph/context/facet facts 默认 preview/change-set，生成 trace/output/audit records 通过 CLI/application service 使用 `direct audit write` 或 `draft-write`。

## 架构

DNA 拆分为可复用领域核心、存储端口、具体适配器和用户入口。

```text
Human / Agent / LLM 设计任务
        |
        v
CLI / Codex Skills / Web / Local API
        |
        v
应用服务 + preview ChangeSet 审阅
        |
        v
@dna/core 领域模型 + @dna/storage repository ports
        |
        +--> Graph/Atlas: SpeciesNode, SpeciesGroup, DesignRelationship
        +--> Context: DesignContext, facts, principles, motifs, references, rubrics
        +--> Compile: SpeciesCompileArtifact, PhenotypeCompileArtifact, trace/conflicts
        +--> Generation: GenerationJob, provider ports, 脱敏参数
        +--> Results: Phenotype, PhenotypeVersion, AssetIndex, OutputReference
        +--> Governance: ReviewRecord, ImpactRecord, library routing
        |
        v
SQLite / Git 目录导出 / 本地 HTTP 快照 / 外部素材库
```

核心边界：

- 核心领域逻辑不依赖 SQLite、CLI、Web 或任何具体素材管理系统。
- 持久化写入应通过 service、repository 和 change-set 语义完成。
- 存储实现可替换，因为领域层只依赖 repository ports。
- 外部素材库是 adapter target，不是硬编码产品假设。
- 即使团队不使用 DNA 的可选结果库，也可以记录生成结果位置。
- 图谱谱系可以被投影成可读的物种树或 JSON 结构，不需要改变已有节点和边数据。
- preview change-set 可以作为一等审阅对象被列出、查看、审查、确认、废弃、导出和导入。

## 默认优先

DNA 应该先靠强默认值开箱即用，再允许团队做复杂配置。这个规则适用于整个系统，不只适用于素材或结果存储。

- 新图谱默认可以直接使用本地 SQLite 和 Git 友好目录交换格式。
- 默认素材管理结构应该是一个设计图谱对应一个主结果库。
- 不同类型的生成结果通常应该通过结果库下面的多个存储挂载来区分，而不是创建很多库。
- `LibraryRoutingPolicy` 可以把不同生成结果类型或输出角色默认路由到合适的挂载，同时仍允许单条输出引用显式覆盖。
- 多结果库仍然保留给治理边界不同的场景，例如探索库、正式库、外包交付库、归档库或运行时导出库。
- 高阶团队可以继续定制存储引擎、adapter 映射、路由策略、审查规则、模板包和生成 provider，但不需要改变核心模型。

## Monorepo 模块

| 模块 | 职责 | 适配边界 |
| --- | --- | --- |
| `@dna/core` | Zod schema、领域类型、默认对象、编译策略、审查逻辑、版本规则、影响分析、provider contract | 不依赖数据库、CLI 或 UI |
| `@dna/storage` | repository ports、storage engine、事务、内存实现、service contract | 定义 SQLite/server adapter 必须实现的能力 |
| `@dna/application` | 可复用编排层，负责 compile input assembly、impact collection、generation preparation 和 status transitions | 依赖 core/storage ports，不依赖 CLI 或 SQLite 具体实现 |
| `@dna/sqlite` | 本地 SQLite adapter、migration、repository、Git 目录导入导出 | 可以替换为其他存储引擎 |
| `@dna/cli` | 本地 `dna` 命令入口、preview/apply 流程、本地项目操作 | 调用 service/repository，不拥有领域规则 |
| `@dna/template-packs` | 游戏美术、UI/图标等初始基因模板 | 领域模板包可以扩展，不需要改 core schema |
| `@dna/server` | 本地 HTTP API 基线和面向协作模式的服务端 adapter 边界 | 未来团队模式复用同一套 ports |
| `@dna/web` | 面向生成结果、素材引用、审查和搜索的工作台方向 | UI 读取 service/API 数据，不直接写核心数据 |
| `codex-skills/dna-graph-modeling` | 将新设计场景映射成图谱、物种、DesignRelationship、facets、planned phenotypes 和生效策略 | 不复制 CLI help，也不直接写存储 |
| `codex-skills/dna-graph-editing` | 面向已有图谱变更，给出合理性、影响、风险和审阅建议 | 不绕过 preview、change-set review 或 proposal 流程 |
| `codex-skills/dna-phenotype-generation` | 基于已有图谱约束、编译产物、审查规则和输出登记，编排生成结果工作流 | 不发明图谱事实，也不在阻塞问题未解决时调用 provider |

Skill 是复杂场景工作流，用来帮助 Agent 把用户场景映射到 DNA 概念，判断审阅/写入策略，并准备编译或生成计划。CLI 参数说明由 `dna --help` 承担；持久化编译产物仍然是 `SpeciesCompileArtifact` 和 `PhenotypeCompileArtifact`，不是独立 skill。

模板兼容性按 schema/capability 判断，不绑定 root project version。`TemplatePack.version` 是模板包内容版本，`GeneTemplate.version` 是单个模板定义版本，`compatibility.dnaSchema` 表达 DNA schema 兼容范围，`compatibility.capabilities` 表达所需产品能力。

## 适配性

DNA 的目标是接入不同生产环境，而不是强迫所有团队采用同一种素材流程。

### 存储引擎

- 默认本地运行存储：SQLite。
- 开放交换格式：Git 友好的目录化 JSON。
- 未来可兼容目标：服务端存储、云数据库、团队同步服务或项目自定义 repository。

### 结果库

DNA 可以管理一个可选的、可搜索的结果库。内部对象名是 `PhenotypeLibrary`。

- 默认约定是一个设计图谱对应一个主结果库。
- 这个结果库下面可以有多个存储挂载，例如 Eagle 用于浏览，Git 用于源文件，NAS 用于原始素材，引擎导出目录用于运行时资产。
- 当团队有意共享同一个资产目录时，一个结果库仍然可以服务多个设计图谱。
- 当治理边界不同时，一个设计图谱也可以绑定多个结果库。
- SQLite migration 会根据既有图谱绑定回填 `PhenotypeLibrary.graphIds`，所以 v0.4 之前创建的项目升级后导出仍能保持一致。
- 路由策略负责在调用方只指定结果库时，自动判断生成结果引用应该进入哪个存储挂载。
- 一个生成结果版本可以有多个输出引用。
- 输出引用可以直接指向外部系统，不要求绑定 DNA 结果库。

### 素材库适配器

DNA 把标准化元数据和外部系统元数据隔离。

- `StorageMount` 描述外部库的位置和能力。
- `ExternalLibraryMapping` 记录外部字段如何映射到 DNA 元数据，例如标签、目录、评分、集合、注释。
- Eagle 只是一个可能的适配目标。同一模型也可以支持 NAS、Git、对象存储、数据库、Figma、引擎导出目录或自定义 DAM。

### 生成模型适配器

生成 provider 应接收已经编译好的约束和 prompt，然后返回生成结果。provider 不应该负责图谱写入、API key 保存或正式版本决策。

v0.4 及后续版本已包含 provider contract、mock provider 执行和通用 HTTP provider 基础能力。运行时凭据和敏感参数会从 generation job 与导出快照中清理掉。

正式 compile 是 layered pipeline。`dna compile atlas|graph|group|species|phenotype` 会生成 compile frames、dependency vectors、feedback、conflicts 和 open questions，但不修改图谱事实。atlas/graph/group frames 可持久化为 `EntityCompileArtifact`；species 和 phenotype generation 继续使用带同一 layered frame 模型的 `SpeciesCompileArtifact` 与 `PhenotypeCompileArtifact`。

正式 `dna phenotype generate` 以 layered compile artifacts 作为 provenance 路径。命令支持可选 `--species-artifact <id>` 和 `--phenotype-artifact <id>` 做确定性 replay；省略时会自动准备新的 layered `SpeciesCompileArtifact` 与 `PhenotypeCompileArtifact`。传入 artifact 必须校验 graph、node、phenotype type、task brief、species link、frame shape 和 dependency vector；stale artifact 需要显式 historical replay。Preview 会返回 artifacts、phenotype、phenotype version、generation job 和 prompt，但不持久化；`--apply` 在一个 transaction 中持久化新 artifacts、phenotype/version 和 generation job，并让 `PhenotypeVersion` 记录 `speciesCompileArtifactId`、`phenotypeCompileArtifactId` 与包含 frame、conflict、decision、feedback、validity 摘要的有界 `compileArtifactSnapshot`。新生成版本默认进入 `candidate`。

表型结果生命周期由 `PhenotypeVersion` 治理，不由 `GenerationJob` 或 `PhenotypeGenerationTask` 治理。`GenerationJob` 仍是一轮生成执行记录；生产链真源是 `PhenotypeVersion.status`、`PhenotypeVersion.feedback` 和 `Phenotype.currentAcceptedVersion`。`dna phenotype-version accept|reject|replace|deprecate|rollback|archive|delete` 默认 preview，只有 `--apply` 或 `--yes` 才写入。生命周期写入只能改变 status、feedback 和 accepted 指针；prompt snapshot、generation recipe、compile artifact ids、asset ids 和 created timestamp 保持不可变。

生成计划是手动生成之上的生产编排层。`PhenotypeGenerationPlan` 覆盖 graph、species-group、species-node 或 phenotype 粒度，并确定性展开为面向 planned phenotypes 的 `PhenotypeGenerationTask`；task 也可以不依赖 plan 独立创建。`versionBinding` 默认是 `latest-at-execution`；也可 pinned 到 NodeVersion 或 compile artifact，但 stale artifact 需要显式 historical replay。`dna generation-plan update` 和 `dna generation-task update` 默认 preview，只有 `--apply` 或 `--yes` 才写入；它们可修改非敏感编排 metadata、tags、requirements、preference、notes 和 task blocking 状态，但不得修改不可变目标身份或执行 trace links。`dna phenotype generate --task <taskId> --apply` 会把生成出的 compile artifacts、`GenerationJob` 和 `PhenotypeVersion` 回写到 task，便于审阅追踪。plan/task 可以保存非敏感 model/tool preference、`llmInstructions`、`operatorNotes`、metadata 和 extensions，但不得保存 provider credentials 或完整私密链接。

参考生成独立于表型生成。`dna reference-generation prepare|run-mock` 面向 graph 或 species-group 生成参考提示，并可显式持久化 `EntityCompileArtifact` 与 reference `GenerationJob`；它不会创建 synthetic `SpeciesNode`、`Phenotype` 或 `PhenotypeVersion`。`dna reference-generation link-asset` 只登记安全 `AssetIndex` 指针，不复制二进制，并拒绝私密或携带凭据的 asset URI。外部产出的参考图可在已有 linked asset evidence 后通过 `dna reference-generation complete --job <id> --apply` 标记完成，也可用 `link-asset --mark-generated --apply` 在同一事务中创建 asset 指针并更新 job；completion 只保存安全 note/tool label/metadata，并保留原 prompt、target 和 input snapshots。后续 phenotype task 应通过 requirements 或 metadata 引用 reference job/asset ids，而不是复制私密 URL。

### 本地 HTTP API 与 Web 工作台

DNA 已包含本地 HTTP API 基线，用于 health check、图谱树数据、generation plan/task 数据和只读 Explorer 快照。通过 HTTP 访问 DNA 网页默认关闭；使用 `dna serve --web` 或 `createDnaHttpHandler(store, { webEnabled: true })` 显式开启后，提供从 `/api/workbench/snapshot` 读取数据的 DNA Read-only Explorer。默认首页是 `Atlas Map`，并提供 `Graph Explorer`、`Generation Board`、`Phenotype Library` 与共享 `Inspector`；额外只读视图接口包括 `/api/workbench/graph-map`、`/api/workbench/graphs/:graphId`、`/api/workbench/generation` 和 `/api/workbench/library`。Explorer 支持安全结果/图库预览、graph-level DesignRelationship 路线、图谱内部结构、生成追溯链和移动端只读导航。Web 不接受、拒绝、归档、运行 task、apply sync 或以其他方式持久修改 DNA 记录。旧 `/api/workbench/phenotypes` 仍作为窄范围生成结果 snapshot 供既有本地集成读取。

### 审阅确认工作流

`dna changeset list/show/review/apply/discard` 会把 preview 写入变成可审阅闭环。Graph、node、DesignRelationship 预览在 apply 前不会进入正式图谱。既有 graph、node、relationship create 命令也支持 `--mode changeset-apply --change-set <id>`。

## 技术数据模型

核心对象：

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `DesignRelationship`
- `Phenotype` - 生成结果或整理结果对象的内部名称
- `PhenotypeGenerationPlan` - graph/group/node/phenotype 粒度生产计划
- `PhenotypeGenerationTask` - 带 trace links 的具体生成任务
- `PhenotypeVersion` - 生成结果或整理结果的版本快照
- `OutputReference`
- `PhenotypeLibrary` - 可选的、可搜索的结果库
- `StorageMount`
- `PhenotypeLibraryGraphBinding`
- `ExternalLibraryMapping`
- `LibraryRoutingPolicy`
- `AssetIndex`
- `GenerationJob`
- `ReviewRecord`
- `ImpactRecord`
- `ChangeSet`

如果两个对象名称相近，以 [docs/design/concept-registry.md](docs/design/concept-registry.md) 作为产品术语入口，以 `packages/core` 作为实现真源。

## 交换格式

`dna export --out <dir>` 会写出 Git 友好的项目目录，并在 `dna.project.json` 中记录版本化 manifest。manifest 包含 `projectVersion`、`exchangeVersion`、`capabilities` 和 `exportProfile`，后续 import 可以对不支持的交换格式版本给出明确错误，reviewer 也能区分完整备份和审阅包。

默认 `full` 导出保留全部 change-sets 和 proposals，用于备份、迁移和完整审计。`--profile review-current` 导出当前正式 state，不生成 `change-sets/` 或 `proposals/`，并在 manifest 中记录省略计数和 clean review metadata。`--profile proposal-review --proposal <id>` 只导出目标 proposal 与其 linked change-sets，遇到断链会失败。

当前稳定交换契约覆盖 change-set、proposals、facets、contexts、templates、libraries、atlases、图谱谱系、species groups、compile artifacts、generation plans、generation tasks、generation jobs、output references、reviews 和 impacts。完整目录结构以 [docs/design/system-architecture.md](docs/design/system-architecture.md) 为准。

## 安装

要求：

- Node.js 20+
- pnpm 11+

```bash
git clone https://github.com/winx402/Design-Network-Atlas.git
cd Design-Network-Atlas
pnpm install
pnpm dna --help
```

CLI 提供 `dna graph tree --id <graph_id>` 输出可读物种树，`dna graph tree --include-groups` 可显示 group overlay，`dna graph tree --include-phenotypes` 可显示 planned phenotype 覆盖；提供 `dna compile atlas|graph|group|species|phenotype` 做 layered compile preview/persisted artifacts；提供 `dna generation-plan create/list/show/update/expand`、`dna generation-task create/list/show/update/run-mock/link-result` 做生成计划和任务编排；提供 `dna reference-generation prepare|run-mock|link-asset|complete` 做 graph/group scoped reference generation；提供 `dna phenotype-version ...` 治理 candidate/accepted/replaced/rolled-back 生命周期 metadata；提供 `dna facet definition/schema/assignment ...` 做 facet 写入路径；提供 `dna modeling check` 做可复用建模质量检查；提供 `dna changeset list/show/review/apply/discard` 做 preview 审阅确认；提供 `dna proposal import-batch --in <file>` 导入 `dna.modeling-batch.v1` 初始建模草案；提供 `dna sync export/import` 做显式目录交换，也提供 `dna serve` 启动本地 HTTP API。根 CLI 版本使用 `dna --cli-version` 或 `dna -V` 查看，子命令可继续拥有自己的领域 `--version` 参数。网页访问默认关闭；使用 `dna serve --web` 开启后，它是包含 Atlas Map、Graph Explorer、Generation Board、Phenotype Library 和 Inspector 的只读本地 Explorer。
`dna.modeling-batch.v1` 可声明 graphs、species groups、DesignRelationship、facets 与 `phenotypePlans`。默认导入会创建 proposal + preview change-sets，并输出紧凑审阅报告；显式 `--mode draft-write` 通过 service boundary 写入本地 seed objects，并说明它跳过 proposal review。
正式生成使用 `dna phenotype generate --graph <id> --node <id> --type <type> --name <name> --brief <brief>`，该命令会编译或复用 layered species/phenotype artifacts；加 `--apply` 才会持久化生成 artifacts、phenotype version 和 generation job。需要更新生成任务时使用 `dna phenotype generate --task <taskId> --apply`，它会把 artifact/job/version links 回写到 task。传入 stale artifact 时需要显式 historical replay。graph/group 粒度参考提示使用 `dna reference-generation prepare|run-mock|link-asset|complete`，只写入 scoped reference `GenerationJob` 和安全 `AssetIndex` 指针，不创建伪造的 phenotype records。

根目录 `package.json` 目前使用 `private: true`，用于避免 monorepo 被误发到 npm。GitHub 源码按 MIT License 开源。

## 开发检查

```bash
pnpm version:sync
pnpm version:check
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
```

## 版本规则

DNA 使用三段数字版本号：`MAJOR.MINOR.PATCH`。

每次向远端仓库 push 且包含 tracked 文件变更时，都必须升级版本。普通文档或兼容修复使用 patch；兼容的新能力使用 minor；破坏 schema、存储、CLI、导入导出或 API 的变化使用 major。

根 `package.json` 是唯一手写版本源。运行时版本常量必须通过 `pnpm version:sync` 从根版本生成，workspace 子包不再定义自己的版本。push 前运行 `pnpm version:check`。

## 成熟度

DNA 当前是本地优先项目，适合试点使用、本地设计图谱治理、图谱建模/编辑/表型生成场景 skill、图谱树检查、preview change-set 审阅确认、prompt / brief 生成、结果库路由、输出引用管理、审查记录、影响分析、版本化 Git 友好交换、本地 HTTP API 集成，以及只读本地工作台基线。

npm 正式发布、第一方图片生成 provider package、完整接入 API 的 Web 客户端、托管团队权限、审批流和多人同步服务属于后续工作。

## 联系方式

项目联系邮箱：[winx402@agent.qq.com](mailto:winx402@agent.qq.com)

## 许可证

MIT License。详见 [LICENSE](LICENSE)。
