# DNA 系统技术设计

状态：active
最后审阅：2026-06-27
来源级别：authoritative technical design
上游输入：视觉基因谱系系统 PRD、阶段开发路线图
下游交付：[阶段开发路线图](../implementation/development-roadmap.md)、[测试策略](../testing/test-strategy.md)

## 1. 系统定位

DNA: Design Network Atlas 是一套本地优先、可扩展、可版本化的设计基因图谱系统。系统目标不是保存素材文件，也不是单纯保存提示词，而是把设计对象的来源、约束、演化、生成、审查、素材指针和版本影响结构化。

完整系统由三层逐步合并完成：

1. 本地核心：CLI、核心库、SQLite、Git 目录交换格式、Codex Skill。
2. 生产适配：生成模型 adapter、设计工具 / 引擎 / token export pipeline。
3. 平台协作：只读 Explorer、中心服务、双模式同步、权限和审查流。

## 2. 命名与产品边界

- 产品名：DNA
- 展开：Design Network Atlas
- 中文名：设计基因图谱系统
- CLI：`dna`
- npm 包命名空间：`@dna/*`

DNA 的核心对象是图谱和谱系，不是二进制文件仓库。生成结果通过 `OutputReference` 和 `AssetIndex` 保存位置和元数据，文件本体由用户指定的 Git、NAS、Eagle、Figma、数据库、对象存储、引擎导出目录或其他外部存储负责。`PhenotypeLibrary` 是可选的统一目录层，可以和多个图谱多对多绑定，也可以完全不用。

对象术语和相近概念边界以 [docs/design/concept-registry.md](concept-registry.md) 为公开产品入口；`packages/core` 仍是实现真源。该 registry 明确区分 durable design facts、compiled views、runtime jobs、generated outputs、external pointers 和 audit records。
对象级写入策略以 [docs/design/write-boundary-matrix.md](write-boundary-matrix.md) 为准；正式 graph/context/facet facts 默认 preview/change-set，生成 trace/output/audit records 通过 service 边界使用 direct audit write 或 draft-write。

### 2.1 默认优先

DNA 的产品原则是默认优先，而不是要求使用者先配置完整体系：

- 默认创建图谱后即可使用本地 SQLite、内置模板包和 Git 友好目录交换格式。
- 默认素材管理结构是一个图谱对应一个主 `PhenotypeLibrary`。
- 多种生成结果类型优先通过同一个结果库下的多个 `StorageMount` 承载。
- 多个 `PhenotypeLibrary` 只用于治理边界不同的场景，例如探索库、正式库、外包交付库、归档库、运行时导出库。
- 高阶用户可以定制存储引擎、外部库字段映射、`LibraryRoutingPolicy` 输出路由策略、审查规则、模板包和生成 provider。

## 3. 分层架构

### 3.1 包结构

| 包 | 职责 | 不负责 |
| --- | --- | --- |
| `@dna/core` | 领域类型、schema、状态机、编译策略、影响分析、审查逻辑、生成 provider port | SQLite、CLI 参数解析、UI |
| `@dna/storage` | repository ports、storage engine、transaction、change-set port | 具体数据库实现 |
| `@dna/application` | compile input assembly、impact collection、formal generation preparation、status transition 等可复用编排服务 | CLI 参数解析、SQLite 实现细节、Web UI |
| `@dna/sqlite` | SQLite adapter、migration、Git 目录 import/export | 业务规则裁决 |
| `@dna/template-packs` | 内置模板包和模板包加载 | 核心 schema 固化领域字段 |
| `@dna/cli` | 本地命令行入口、preview/apply 写入流程 | 直接绕过 service/repository 写库 |
| `@dna/server` | 后续中心服务 API，实现同一套 ports | 替代本地模式 |
| `@dna/web` | DNA Read-only Explorer UI，用于 Atlas Map、Graph Explorer、Generation Board、Phenotype Library 和 Inspector | 直接持久化核心对象 |
| `codex-skills/dna-graph-modeling` | 从用户场景映射 Graph、SpeciesGroup、SpeciesNode、DesignRelationship、facets、Phenotype 和写入策略 | 代替用户确认不确定的设计事实 |
| `codex-skills/dna-graph-editing` | 基于已有图谱评估变更合理性、影响范围、风险等级和审阅路径 | 绕过 preview、change-set review 或 proposal |

### 3.2 依赖方向

依赖只能向内：

```text
web / cli / skill / server
        ↓
application service
        ↓
storage ports + core
        ↓
sqlite adapter / server adapter
```

规则：

- `@dna/core` 不依赖任何外层包。
- CLI、Skill、Web、Server 不重复定义核心对象。
- SQLite 和 Server 都实现同一组 repository contract tests。
- LLM 或生成模型不能直接写正式图谱，必须通过 service 和 change-set。

## 4. 核心领域模型

### 4.1 对象关系

```text
Graph
  ├─ TemplatePack / GeneTemplate
  ├─ SpeciesNode
  │   ├─ NodeVersion
  │   ├─ incoming DesignRelationship
  │   └─ Phenotype
  │       ├─ PhenotypeUsageGuide
  │       └─ PhenotypeVersion
  │           └─ AssetIndex[]
  ├─ GenerationJob
  ├─ ReviewRecord
  └─ ImpactRecord

PhenotypeLibrary
  ├─ StorageMount
  ├─ PhenotypeLibraryGraphBinding
  ├─ ExternalLibraryMapping
  └─ LibraryRoutingPolicy

PhenotypeVersion
  ├─ references PhenotypeUsageGuide revision
  ├─ OutputReference[]
  └─ AssetIndex[]
```

### 4.2 核心对象

| 对象 | 稳定身份 | 版本对象 | 说明 |
| --- | --- | --- | --- |
| `Graph` | `graphId` | 图谱版本字段 | 一套设计宇宙和约束集合 |
| `TemplatePack` | `templatePackId` | `version` | 可发布模板包 |
| `GeneTemplate` | `templateId` | `version` | 设计维度、必填项、审查问题 |
| `SpeciesNode` | `nodeId` | `NodeVersion` | 稳定设计对象 |
| `DesignRelationship` | `relationshipId` | 无独立版本 | 同层级核心实体之间的设计语言关系 |
| `Phenotype` | `phenotypeId` | `PhenotypeVersion` | 物种在任务中的结果对象 |
| `PhenotypeUsageGuide` | `usageGuideId` | 轻量 `revision` | 稳定绑定到 `Phenotype` 的使用说明、使用场景、制作提示和审阅清单；同一 phenotype 同时最多一个 active guide |
| `OutputReference` | `outputReferenceId` | 无独立版本 | 表型版本的输出位置，可不绑定表型库 |
| `PhenotypeLibrary` | `libraryId` | 无独立版本 | 可选结果目录；默认一个图谱一个主库，高级场景可多对多绑定 |
| `StorageMount` | `mountId` | 无独立版本 | 表型库对外部存储介质的挂载 |
| `PhenotypeLibraryGraphBinding` | `bindingId` | 无独立版本 | 表型库和图谱的绑定关系 |
| `ExternalLibraryMapping` | `mappingId` | 无独立版本 | Eagle/NAS/DB 等外部库字段与 DNA 字段的兼容映射 |
| `LibraryRoutingPolicy` | `routingPolicyId` | 无独立版本 | 根据表型类型、输出角色、引用类型和标签选择默认存储挂载 |
| `AssetIndex` | `assetId` | 无独立版本 | 素材指针，不保存素材本体 |
| `GenerationJob` | `generationJobId` | 无独立版本 | 一次生成或整理运行 |
| `ReviewRecord` | `reviewRecordId` | 无独立版本 | 审查结论和输入快照 |
| `ImpactRecord` | `impactRecordId` | 无独立版本 | 上游变化后的影响记录 |

Template compatibility is not root project version compatibility. `TemplatePack.version` is the pack content version, `GeneTemplate.version` is the individual template definition version, `compatibility.dnaSchema` declares supported DNA schema compatibility, and `compatibility.capabilities` declares required product capabilities.

### 4.3 facets 与视觉母题

- `facets` 是跨核心对象复用的领域扩展容器。
- 视觉母题是具体可识别的视觉内容或结构。
- 母题可以作为基因维度，也可以被领域模板放进 `facets`，但母题本身不是 `facets`。

实现约束：

- 核心 schema 保留 `facets: Record<string, unknown>`。
- 核心 schema 不把游戏美术、UI/图标、品牌视觉字段写死。
- 模板包可以定义自己的 `facets` 约定和校验规则。

## 5. 写入与版本机制

### 5.1 写入模式

系统支持三种写入模式：

| 模式 | 用途 | 行为 |
| --- | --- | --- |
| `preview-confirm` | 默认模式 | 先生成 change-set preview，用户确认后 apply |
| `draft-write` | 高频探索 | 直接写入 draft 状态，但保留输入快照 |
| `changeset-apply` | 严格审查 | 先保存 change-set 文件或记录，后续明确 apply |

所有关键写入必须经过 application service，不允许 CLI、Web 或 Skill 直接绕过业务层。
Generated trace/output/audit records 和 external pointers 可以通过 application service 执行 `direct audit write`；这类写入必须保留 provenance，且不能被描述成 formal graph facts mutation。

### 5.2 不可变版本

- `NodeVersion`、`PhenotypeVersion` 创建后不可变。
- 修改物种时，创建新版本，不覆盖旧版本；关系本身是受审查的 durable design fact。
- 表型版本保存当次生成所用物种版本、关系 trace、基因快照、prompt / brief、工具参数摘要。
- 删除和归档优先使用状态字段，历史版本仍可查询。
- `PhenotypeVersion` is content immutable after creation. Lifecycle changes use the repository `status + feedback` metadata path and must validate transitions with `assertCanTransitionStatus("phenotype-version", from, to)`; accepting, replacing, rolling back, archiving, or deleting a version may also update `Phenotype.currentAcceptedVersion`.

### 5.3 影响分析

上游变化后，系统只生成影响记录，不自动重写下游：

1. 物种版本变化：标记下游物种和表型版本。
2. 进化边版本变化：标记目标物种及其下游。
3. 表型版本不自动覆盖；用户选择重新生成时创建新表型版本。

## 6. 编译与表型生成

### 6.1 编译输入

编译器输入包括：

- 图谱默认规则和编译策略。
- 模板维度和模板版本。
- 父物种版本快照。
- 进入当前物种的进化边版本。
- 当前物种自身基因。
- 本次任务 brief。
- 目标工具和表型类型。

### 6.2 编译策略

本地核心必须实现：

- `system-rule-first`：系统按确定规则合并基因、记录冲突、生成 prompt / brief。
- `snapshot-fixed`：使用物种已保存的 resolved snapshot，叠加任务 brief。

后续阶段实现或接入：

- `dynamic-assembly`
- `llm-conflict-resolution`
- `manual-resolution`
- `hybrid`

### 6.3 表型生成边界

本地核心阶段只生成 prompt / brief / review checklist 等生产说明，不直接调用外部模型。

正式 `phenotype generate` 不再直接走 legacy `compileSpecies` prompt helper；它必须基于 layered compile artifacts。CLI 可以自动创建缺失的 `SpeciesCompileArtifact` 和 `PhenotypeCompileArtifact`，也可以通过 `--species-artifact` 或 `--phenotype-artifact` 复用既有 artifact。传入 `--phenotype-artifact` 时，必须校验 graph、node、phenotype type、task brief、species artifact link、layered frames 和 dependency version vector。stale artifact 默认不能作为 current input 使用，除非用户显式选择 historical replay。

Layered compile 按 atlas -> graph -> species-group -> species-node -> phenotype 的顺序生成 `CompileFrame`。Graph/group/node/relationship/context/facet/template 等正式事实只被读取；低层冲突只能形成 feedback、open question、impact/proposal seed，不能由 compile 自动改写上游事实。LLM/Agent-assisted compile 只能产生 bounded `CompileDecisionRequest` 和 replayable `CompileDecisionPatch`，不调用 provider，也不保存 credentials 或 raw provider payload。

Preview 模式返回 artifacts、Phenotype、PhenotypeVersion、GenerationJob 和 prompt，不持久化 artifacts、versions、jobs、assets 或 references。`--apply` 通过 application service 和 repository transaction 写入新的 layered artifacts、phenotype/version 和 generation job。`PhenotypeVersion` 必须记录 `speciesCompileArtifactId`、`phenotypeCompileArtifactId` 和有界 `compileArtifactSnapshot`，包含 frame/conflict/decision/feedback counts 与 artifact validity；phenotype `GenerationJob.inputSnapshot` 必须记录 graph、node、task brief、phenotype type、compile mode/current-or-historical 状态以及 artifact IDs。

`PhenotypeUsageGuide` 是绑定到 `Phenotype` 的稳定使用说明，不是 version feedback、ReviewRecord 或 OutputReference metadata。一个 phenotype 同时最多一个 active guide，更新 guide 只递增轻量 `revision`，不创建独立 guide version 表。正式 phenotype compile 和 generation preparation 会把 active guide 的 id、revision、summary、usage scenarios、must preserve / must avoid、variant plan、production hints 和 review checklist 摘要写入 `PhenotypeCompileArtifact.usageGuideSnapshot`；`GenerationJob.inputSnapshot` 记录当次使用的 guide revision 摘要；`PhenotypeVersion` 与 `OutputReference` 可以引用 guide id/revision，但不成为 guide 真源。缺失 guide 只形成 non-blocking warning，系统不编造 guide，也不因新版本生成自动改写 guide。

`dna.modeling-batch.v1` 可以声明 `phenotypePlans`，但它们只是输入概念；proposal apply 或显式 `draft-write` 后会创建 `status: "planned"` 的 `Phenotype` 容器，不创建 `PhenotypeVersion`、`GenerationJob`、`AssetIndex` 或 `OutputReference`。planned phenotype 可以使用 `productionSliceRole` 区分同一 graph/node/type 下的多个生产切片；缺省 slice 仍为 default，重复 default 仍被拒绝。后续正式 `phenotype generate --phenotype-id <id>` 会复用这个 planned phenotype 容器，生成版本默认是 `candidate`；`phenotype-version accept|replace|rollback|deprecate|archive|delete` 只更新生命周期 metadata 和 `currentAcceptedVersion` 指针。

`PhenotypeGenerationPlan` 和 `PhenotypeGenerationTask` 是 production orchestration records，不是 graph facts。Plan 可绑定 graph、species-group、species-node 或 phenotype scope，并确定性展开 planned phenotypes 为 tasks；task 也可独立创建。Task 可保存结构化、领域中立的 `productionIntent`，由 active usage guide、planned phenotype、species node、plan/task overrides 等输入合成或显式提供，并进入正式 compile artifact、GenerationJob input snapshot 和 PhenotypeVersion generation recipe。`versionBinding` 默认是 `latest-at-execution`，也可 pinned 到 `NodeVersion`、`SpeciesCompileArtifact` 或 `PhenotypeCompileArtifact`。task-based `phenotype generate --task` 必须通过 application service 复用 formal artifact-backed generation path，并在 apply 后把 compile artifact ids、GenerationJob ids 和 PhenotypeVersion ids 回写到 task。`generation-plan update` 和 `generation-task update` 只能通过 application service 更新非敏感 orchestration metadata、tags、requirements、preferences、notes、task production intent 和 task blocking state；ids、scope/target identity、createdAt、compile artifact links、job links、version links 等 trace 字段不可作为普通 update 修改。Plan/task 的 model/provider/tool preference、`llmInstructions`、`operatorNotes`、metadata 和 extensions 是非敏感编排上下文，不得保存 provider credentials、raw provider payloads 或完整私密链接。

Reference generation 是 graph 或 species-group 粒度的参考提示/素材链路，不是 phenotype generation。`reference-generation prepare|run-mock` 使用 `EntityCompileArtifact` 和 scoped reference `GenerationJob.target` 表达所有权；reference jobs 不需要 `nodeId`、`phenotypeId` 或 `phenotypeVersionId`，也不得通过 synthetic SpeciesNode/Phenotype/PhenotypeVersion 填补。`reference-generation link-asset` 只创建指向 reference job 的 `AssetIndex` pointer，不复制二进制，不自动创建 `ContextReference`、`ReviewRecord` 或 `OutputReference`；它从安全 URI scheme 推断 storage type，例如 `eagle://`、`local://`、`nas://`、Git、URL 和对象存储。真实外部完成路径使用 `reference-generation complete --job <id> --apply`，或 `link-asset --mark-generated --apply` 原子登记 pointer 并把 reference job 从 `created` 标记为 `generated`；completion 必须有 active linked asset evidence，只能写安全 note/tool label/metadata，并保留原 target、inputSnapshot、prompt、artBrief 和 reviewChecklist。参考资产从本地临时位置迁入 Eagle/NAS 等外部目录时，`reference-generation replace-asset` 创建新的 active pointer、把旧 pointer 标记为 `archived` 历史证据，并在 generated job 上更新 current completion evidence；它不得重写 prompt、target、inputSnapshot 或 compile artifact provenance。后续 phenotype tasks 通过 `referenceGenerationJobIds`、`referenceAssetIds` 或 `contextReferenceIds` 等 id 引用参考资产，避免复制私密 URL。

生成模型 adapter 阶段才允许调用 provider，但必须满足：

- adapter 只接收已编译约束包。
- adapter 不保存 API key。
- 失败不能污染正式表型版本。
- 生成结果仍需要登记为 `GenerationJob`、`PhenotypeVersion`、`AssetIndex`。

## 7. 存储设计

### 7.1 运行存储

默认运行存储为 SQLite。业务层只依赖 repository ports，不依赖 SQLite 方言。

结果库和存储挂载的默认关系：

```text
Graph
  └─ primary PhenotypeLibrary
       ├─ StorageMount: browse/search library
       ├─ StorageMount: source or raw asset storage
       ├─ StorageMount: runtime export target
       └─ StorageMount: prompt/brief/document storage
```

默认策略是先使用一个主结果库管理同一图谱的生成结果，再通过不同 `StorageMount` 适配 Eagle、Git、NAS、数据库、对象存储、Figma 或引擎导出目录。多结果库是权限、生命周期、团队协作或交付边界不同的时候使用的高级结构。

`LibraryRoutingPolicy` 负责把“一个主结果库、多个存储挂载”的默认约定变成可执行规则。调用方只指定 `libraryId` 时，系统可以根据表型类型、输出角色、引用类型和标签自动选择 `targetMountId`；调用方显式传入 `storageMountId` 时，显式选择优先。这样既能开箱即用，也保留深度定制空间。

核心表：

- `graphs`
- `template_packs`
- `gene_templates`
- `nodes`
- `node_versions`
- `design_relationships`
- `node_relations`
- `phenotype_types`
- `phenotypes`
- `phenotype_usage_guides`
- `phenotype_versions`
- `phenotype_version_assets`
- `assets`
- `output_references`
- `phenotype_libraries`
- `storage_mounts`
- `phenotype_library_graph_bindings`
- `external_library_mappings`
- `library_routing_policies`
- `generation_jobs`
- `phenotype_generation_plans`
- `phenotype_generation_tasks`
- `review_records`
- `tags`
- `object_tags`
- `impact_records`

`SqliteDnaStore.migrate()` is the runtime schema authority for the current SQLite product. `packages/sqlite/src/schema.ts` is retained as reference/type mapping only and is not the runtime migration authority.

Historical compatibility tables:

- `node_relations`: deprecated/migration-only compatibility table; not a first-class product concept.
- `phenotype_types`: deprecated/migration-only compatibility table; phenotype type is represented on phenotype/template-related records, not as a standalone product object.

### 7.2 开放交换格式

开放交换格式优先采用 Git 友好的目录化 JSON。`dna.project.json` 是版本化 manifest，必须包含：

- `format: "dna.git-directory"`
- `version` / `projectVersion`：当前项目版本。
- `exchangeVersion`：当前交换格式版本。
- `capabilities`：本次导出包含的能力集合。
- `exportProfile`：`full`、`review-current` 或 `proposal-review`。
- `omitted`：review profile 省略的 section 和计数摘要。
- `review`：`review-current` profile 下记录 `stage: "reviewed"` 和 `cleanCurrentState: true`，同时仍不导出 `change-sets/` 或 `proposals/`。

当前稳定目录结构：

```text
dna.project.json
change-sets/
proposals/
facets/definitions/
facets/schemas/
facets/assignments/
contexts/contexts/
contexts/facts/
contexts/principles/
contexts/motifs/
contexts/references/
contexts/review-rubrics/
contexts/attachments/
contexts/policies/
templates/
libraries/<library_id>/library.json
libraries/<library_id>/mounts/
libraries/<library_id>/bindings/
libraries/<library_id>/mappings/
libraries/<library_id>/routing-policies/
atlases/<atlas_id>/atlas.json
atlases/<atlas_id>/compile/
graphs/<graph_id>/graph.json
graphs/<graph_id>/groups/
graphs/<graph_id>/group-memberships/
graphs/<graph_id>/nodes/
relationships/<relationship_id>.json
graphs/<graph_id>/phenotypes/
graphs/<graph_id>/phenotypes/<phenotype_id>/usage-guide.json
graphs/<graph_id>/phenotypes/<phenotype_id>/usage-guide.md
graphs/<graph_id>/compile/graph/
graphs/<graph_id>/compile/groups/
graphs/<graph_id>/compile/species/
graphs/<graph_id>/compile/phenotypes/
graphs/<graph_id>/assets/
graphs/<graph_id>/generation-jobs/
graphs/<graph_id>/generation-plans/
graphs/<graph_id>/generation-tasks/
graphs/<graph_id>/output-references/
graphs/<graph_id>/reviews/
graphs/<graph_id>/impacts/
```

目录化 JSON 用于审阅、版本控制、迁移、开源模板包分发。SQLite 用于本地运行效率和事务一致性。缺失 manifest 的历史导出可以作为 legacy 目录导入；存在 manifest 但 `exchangeVersion` 不受支持时，导入必须明确失败。

导出 profile：

- `full`：默认完整备份/迁移/审计导出，包含全部 change-sets 和 proposals。
- `review-current`：导出当前正式 project state，默认不生成 `change-sets/` 和 `proposals/`，manifest 记录省略摘要；可以作为当前正式 state 导入。
- `proposal-review`：要求 `--proposal <proposalId>`，只导出目标 proposal 和 linked change-sets，并保留 review 所需的当前上下文对象；若 proposal 引用缺失 change-set 必须失败。该 profile 是 review-only package，import 必须明确拒绝，不得静默半导入。

`dna.modeling-batch.v1` 是独立于 Git-friendly project exchange 的初始建模批次格式，面向 LLM/Agent 生成的本地 modeling draft。它通过 `dna proposal import-batch --in <file>` 进入 proposal workflow，默认生成 proposal 和有序 preview change-sets，不直接写正式 graph facts；显式 `--mode draft-write` 只用于本地种子导入，并跳过 proposal review。批次格式支持 graphs、atlases、species groups、memberships、DesignRelationship、facet definitions/schemas/assignments、planned phenotype surfaces、planned phenotype production slices、libraries、mounts、routing policies 和相关映射。

导入报告默认是紧凑审阅报告，包含 mode、review stage、proposal id、planned/applied/skipped counts、cross-graph/library flags、warnings 和 next suggested command。完整 change-set ids 只在显式 JSON/id 输出中展示。`dna modeling check` 使用 core/application 的同一份质量检查模型，可检查 batch、persisted graph 或 proposal package，并输出 stable JSON 或文本 findings；检查项包括 SpeciesNode phenotype readiness、graph split pressure、group quality、DesignRelationship contract quality、context/facet coverage 和 review readiness。

## 8. Skill、CLI、Web、Server 边界

### 8.1 CLI

CLI 是本地核心阶段的主要产品入口。CLI 必须支持：

- graph
  - `graph tree`：把物种和节点级 DesignRelationship 投影成可读树或 JSON。
  - `graph tree --include-groups`：在默认 tree 后追加 species group、membership、ungrouped nodes 和 group-level DesignRelationship overlay。
- template
- node
- relationship
- facet
- phenotype
- asset
- output-ref
- changeset
- proposal
  - `proposal import-batch`：导入 `dna.modeling-batch.v1` 本地建模草案，默认生成 proposal + preview change-sets。
- modeling
  - `modeling check`：只读检查 batch、graph 或 proposal 的建模质量，不写 graph、context、facet 或 phenotype 记录。
- library
- review
- impact
- provider
- serve
- sync
- import
- export

CLI 写入默认展示 preview，不确认不落库。
`dna serve` 只启动本地 HTTP API；DNA 网页 HTTP 访问默认关闭，必须显式传入 `--web`。

### 8.2 Codex Skill

Skill 是引导层，不是持久化层：

- `dna-graph-modeling` 负责从新场景建立图谱草案，串起物种划分、进化边、facets、表型和写入策略。
- `dna-graph-editing` 负责已有图谱修改，先判断合理性、影响范围和风险等级，再推荐 preview、change-set review 或 proposal。
- CLI 用法说明由 `dna --help` 和子命令 help 承担，不再通过 skill 复制。
- Skill 可以解释 diff、风险和待确认问题，但正式持久化仍必须走 CLI/service。
- Skill 不直接改数据库内部结构、导出目录或外部素材库。

### 8.3 DNA Read-only Explorer

Web UI 是本地只读 Explorer，优先用于检查图谱关系、图谱内部结构、生成编排、表型版本、结果库和追溯链，而不是图谱编辑器、任务执行器或生产 Web 客户端。一级模块必须围绕 DNA 的对象关系组织：

- `Atlas Map`：默认首页，多 graph 关系地图，graph 作为地图板块，graph-level `DesignRelationship` 作为路线/连线。
- `Graph Explorer`：单 graph 内部结构，展示 species groups、species nodes、DesignRelationship、附加语义摘要、phenotype overlay 和 compile trace。
- `Generation Board`：generation plans、generation tasks、generation jobs，并追溯到 phenotype versions、compile artifacts、assets 和 output references。
- `Phenotype Library`：phenotype libraries、storage mounts、routing policies、output references、asset pointers，以及 gallery-first 只读结果预览。
- `Inspector`：共享详情抽屉，按 Identity、Bound Semantics、Relationships、Generation Links、Phenotype / Assets、Provenance、Governance、External pointers 和折叠 Raw JSON 展示选中对象。

Web Explorer 通过 `/api/workbench/snapshot` 读取 server-side view model，并可按用途读取 `/api/workbench/graph-map`、`/api/workbench/graphs/:graphId`、`/api/workbench/generation` 和 `/api/workbench/library` 只读视图；必须提供 loading、empty、error、missing linked object 和 missing graph 状态。素材型结果只能展示安全的只读 preview URL 或类型化占位；API key、provider credentials、runtime credentials、raw provider payload、完整私密链接和不必要的本机绝对路径不得进入 Web snapshot 或页面源数据。它不提供 accept / reject / archive / run task / apply sync 等持久写按钮，也不直接写 graph、phenotype、review、impact、asset、output reference、plan/task 或 change-set。旧 `/api/workbench/phenotypes` 仅作为窄范围 generated-result snapshot 保留给既有本地集成。完整生产 Web 客户端、图谱编辑器、Web 审批、团队账户权限和多人同步界面属于 post-v1。

### 8.4 本地 HTTP API

本地 HTTP API 是 local-first 集成边界，不等同于托管中心服务：

- `GET /api/health`：返回版本与本地存储状态。
- `GET /api/graphs`：返回图谱列表。
- `GET /api/graphs/:graphId/tree`：返回图谱树 JSON。
- `GET /api/workbench/snapshot?graphId=`：返回 DNA Read-only Explorer 需要的 Atlas Map、Graph Explorer、Generation Board、Phenotype Library、usage guide coverage、result preview 和 inspector 快照。
- `GET /api/workbench/graph-map?graphId=`：返回 graph board 节点和 graph-level `DesignRelationship` 路线。
- `GET /api/workbench/graphs/:graphId`：返回单 graph 内部 group/species/relationship/semantics/phenotype/generation/asset/compile view model。
- `GET /api/workbench/generation?graphId=`：返回 generation board、trace path 和结果链摘要。
- `GET /api/workbench/library?graphId=`：返回 Phenotype Library gallery、results、mounts 和安全 preview view model。
- `GET /api/workbench/phenotypes?graphId=`：返回窄范围生成结果、版本、素材和审查快照，供既有本地集成使用。
- `GET /api/generation-plans?graphId=`：返回只读 generation plan 摘要与 task count。
- `GET /api/generation-tasks?graphId=`：返回只读 generation task 状态、blockingReason 和 artifact/job/version links。

网页入口 `/` 和 `/index.html` 必须默认关闭。只有 `dna serve --web` 或 `createDnaHttpHandler(store, { webEnabled: true })` 明确开启时，才返回只读工作台 HTML 页面。

### 8.5 中心服务

中心服务是双模式协作阶段能力。它必须实现同一套 repository / service ports，使本地 adapter 和 server adapter 通过同一套 contract tests。

## 9. 安全与敏感信息

禁止保存：

- API key。
- 密码。
- 完整私密链接。
- 支付信息。
- 私钥。
- provider 认证凭据。

允许保存：

- provider 名称。
- 非敏感生成参数。
- seed、尺寸、模式、工具版本。
- 脱敏后的失败原因。

## 10. 当前代码状态说明

当前仓库已完成 local-first 试点实现，并通过公开测试覆盖核心本地工作流、审阅确认闭环、场景 skill、provider 安全边界、DNA Read-only Explorer 和版本化交换格式：

- TypeScript workspace 与核心领域模型。
- SQLite 本地存储、repository ports、ChangeSet 写入流。
- CLI 本地闭环，覆盖 graph/template/node/relationship/phenotype/asset/review/impact/import/export。
- 图谱树状输出，支持文本树和 JSON 投影。
- 编译策略、表型版本、素材索引、审查记录、影响分析。
- 版本化 Git-friendly JSON 目录导入导出，manifest 包含 projectVersion、exchangeVersion 和 capabilities。
- 结果库、存储挂载、外部库字段映射和输出路由策略。
- 输出路由 fallback、metadata defaults、required metadata 执行。
- SQLite migration 自动修复历史结果库绑定，把既有 binding 回填到 `PhenotypeLibrary.graphIds`。
- Preview change-set 一等审阅确认闭环，支持 list/show/review/apply/discard、`--change-set` 和导入导出。
- Mock provider / generic HTTP provider primitive 与敏感参数、失败摘要清理。
- Generation job 随 Git-friendly JSON 目录导入导出。
- 本地 HTTP API、`dna serve` 和显式开启的只读 Web Explorer。
- Codex scenario skills for graph modeling, graph editing, and phenotype generation MVP orchestration.
- DNA Read-only Explorer 的 server-side snapshot、Atlas Map、Graph Explorer、Generation Board、Phenotype Library、Inspector、结果/图库安全预览、loading/empty/error/missing 状态和移动端只读布局。
- local/server collaboration adapter 的权限与冲突模型。

当前完成边界是“本地优先试点可用、可被本地 API 集成，能完成 preview 草案审阅确认闭环，提供图谱建模/图谱编辑/表型生成场景技能，并通过版本化目录交换进行审阅和迁移，Web 可只读观测图谱、生成和结果库追溯链”，不是生产级托管平台。npm CLI 发布、第一方真实模型 provider package、Web 写入/审批、团队账户权限、审批流与多人同步服务属于 post-v1 路线。
