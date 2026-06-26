# DNA 系统技术设计

状态：v0.5.0-active
最后审阅：2026-06-27
来源级别：authoritative technical design
上游输入：视觉基因谱系系统 PRD、阶段开发路线图
下游交付：[阶段开发路线图](../implementation/development-roadmap.md)、[测试策略](../testing/test-strategy.md)

## 1. 系统定位

DNA: Design Network Atlas 是一套本地优先、可扩展、可版本化的设计基因图谱系统。系统目标不是保存素材文件，也不是单纯保存提示词，而是把设计对象的来源、约束、演化、生成、审查、素材指针和版本影响结构化。

完整系统由三层逐步合并完成：

1. 本地核心：CLI、核心库、SQLite、Git 目录交换格式、Codex Skill。
2. 生产适配：生成模型 adapter、设计工具 / 引擎 / token export pipeline。
3. 平台协作：资产工作台、中心服务、双模式同步、权限和审查流。

## 2. 命名与产品边界

- 产品名：DNA
- 展开：Design Network Atlas
- 中文名：设计基因图谱系统
- CLI：`dna`
- npm 包命名空间：`@dna/*`

DNA 的核心对象是图谱和谱系，不是二进制文件仓库。生成结果通过 `OutputReference` 和 `AssetIndex` 保存位置和元数据，文件本体由用户指定的 Git、NAS、Eagle、Figma、数据库、对象存储、引擎导出目录或其他外部存储负责。`PhenotypeLibrary` 是可选的统一目录层，可以和多个图谱多对多绑定，也可以完全不用。

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
| `@dna/sqlite` | SQLite adapter、migration、Git 目录 import/export | 业务规则裁决 |
| `@dna/template-packs` | 内置模板包和模板包加载 | 核心 schema 固化领域字段 |
| `@dna/cli` | 本地命令行入口、preview/apply 写入流程 | 直接绕过 service/repository 写库 |
| `@dna/server` | 后续中心服务 API，实现同一套 ports | 替代本地模式 |
| `@dna/web` | 后续资产工作台 UI | 直接持久化核心对象 |
| `codex-skills/dna` | Codex 引导层，调用 CLI 和解释 diff | 直接写 SQLite 或导出目录 |

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
  │   ├─ incoming EvolutionEdge
  │   └─ Phenotype
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
| `EvolutionEdge` | `edgeId` | `EdgeVersion` | 父节点到子节点的演化关系 |
| `Phenotype` | `phenotypeId` | `PhenotypeVersion` | 物种在任务中的结果对象 |
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

### 5.2 不可变版本

- `NodeVersion`、`EdgeVersion`、`PhenotypeVersion` 创建后不可变。
- 修改物种或进化边时，创建新版本，不覆盖旧版本。
- 表型版本保存当次生成所用物种版本、边版本链、基因快照、prompt / brief、工具参数摘要。
- 删除和归档优先使用状态字段，历史版本仍可查询。

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
- `edges`
- `edge_versions`
- `node_relations`
- `phenotype_types`
- `phenotypes`
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
- `review_records`
- `tags`
- `object_tags`
- `impact_records`

### 7.2 开放交换格式

开放交换格式优先采用 Git 友好的目录化 JSON：

```text
dna.project.json
change-sets/
templates/
libraries/<library_id>/library.json
libraries/<library_id>/mounts/
libraries/<library_id>/bindings/
libraries/<library_id>/mappings/
libraries/<library_id>/routing-policies/
graphs/<graph_id>/graph.json
graphs/<graph_id>/nodes/
graphs/<graph_id>/edges/
graphs/<graph_id>/phenotypes/
graphs/<graph_id>/assets/
graphs/<graph_id>/generation-jobs/
graphs/<graph_id>/output-references/
graphs/<graph_id>/reviews/
graphs/<graph_id>/impacts/
```

目录化 JSON 用于审阅、版本控制、迁移、开源模板包分发。SQLite 用于本地运行效率和事务一致性。

## 8. Skill、CLI、Web、Server 边界

### 8.1 CLI

CLI 是本地核心阶段的主要产品入口。CLI 必须支持：

- graph
  - `graph tree`：把物种和进化边投影成可读树或 JSON。
- template
- node
- edge
- phenotype
- asset
- output-ref
- changeset
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

- 负责解释模板问题。
- 负责收集用户输入。
- 负责展示 diff 和风险。
- 负责调用 CLI。
- 不直接改 SQLite 和导出目录。

### 8.3 Web 资产工作台

第一版 UI 优先做资产工作台，而不是图谱编辑器：

- 表型列表。
- 表型版本对比。
- 素材组和素材变体。
- 状态流转。
- 标签搜索。
- 审查结果。
- outdated 提示。

v0.5 Web 工作台仍是轻量工作台方向和数据状态模型，但已可以通过本地 HTTP API 读取 generated-result snapshot。完整生产 Web 客户端、图谱编辑器和团队审批界面属于 post-v1。

### 8.4 本地 HTTP API

本地 HTTP API 是 local-first 集成边界，不等同于托管中心服务：

- `GET /api/health`：返回版本与本地存储状态。
- `GET /api/graphs`：返回图谱列表。
- `GET /api/graphs/:graphId/tree`：返回图谱树 JSON。
- `GET /api/workbench/phenotypes?graphId=`：返回工作台需要的生成结果、版本、素材和审查快照。

网页入口 `/` 和 `/index.html` 必须默认关闭。只有 `dna serve --web` 或 `createDnaHttpHandler(store, { webEnabled: true })` 明确开启时，才返回 HTML 页面。

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

当前仓库已完成 v0.5.0 local-first 实现，并通过 Phase 16 端到端验收：

- TypeScript workspace 与核心领域模型。
- SQLite 本地存储、repository ports、ChangeSet 写入流。
- CLI 本地闭环，覆盖 graph/template/node/edge/phenotype/asset/review/impact/import/export。
- 图谱树状输出，支持文本树和 JSON 投影。
- 编译策略、表型版本、素材索引、审查记录、影响分析。
- Git-friendly JSON 目录导入导出。
- 结果库、存储挂载、外部库字段映射和输出路由策略。
- 输出路由 fallback、metadata defaults、required metadata 执行。
- SQLite migration 自动修复历史结果库绑定，把既有 binding 回填到 `PhenotypeLibrary.graphIds`。
- Preview change-set 一等审阅确认闭环，支持 list/show/review/apply/discard、`--change-set` 和导入导出。
- Mock provider / generic HTTP provider adapter 与敏感参数清理。
- Generation job 随 Git-friendly JSON 目录导入导出。
- 本地 HTTP API、`dna serve` 和可选 Web page access。
- Codex Skill preview-first 命令说明。
- Web asset workbench 的前端样例、状态模型和 API-backed snapshot loader。
- local/server collaboration adapter 的权限与冲突模型。

v0.5.0 的完成边界是“本地优先试点可用、可被本地 API 集成，并能完成 preview 草案审阅确认闭环”，不是生产级托管平台。npm CLI 发布、proposal/batch 高阶建模、第一方真实模型 provider package、完整 Web 客户端、团队账户权限、审批流与多人同步服务属于 post-v1 路线。
