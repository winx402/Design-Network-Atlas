# DNA 系统技术设计

状态：draft
最后审阅：2026-06-26
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

DNA 的核心对象是图谱和谱系，不是素材库。素材只通过 `AssetIndex` 保存位置和元数据，文件本体由用户指定的外部存储负责。

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

v0.1 必须实现：

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
- `generation_jobs`
- `review_records`
- `tags`
- `object_tags`
- `impact_records`

### 7.2 开放交换格式

开放交换格式优先采用 Git 友好的目录化 JSON：

```text
dna.project.json
templates/
graphs/<graph_id>/graph.json
graphs/<graph_id>/nodes/
graphs/<graph_id>/edges/
graphs/<graph_id>/phenotypes/
graphs/<graph_id>/assets/
graphs/<graph_id>/reviews/
graphs/<graph_id>/impacts/
```

目录化 JSON 用于审阅、版本控制、迁移、开源模板包分发。SQLite 用于本地运行效率和事务一致性。

## 8. Skill、CLI、Web、Server 边界

### 8.1 CLI

CLI 是本地核心阶段的主要产品入口。CLI 必须支持：

- graph
- template
- node
- edge
- phenotype
- asset
- review
- impact
- import
- export

CLI 写入默认展示 preview，不确认不落库。

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

### 8.4 中心服务

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

当前仓库已有一个早期工程骨架，用于验证方向：

- TypeScript workspace。
- 核心 schema。
- SQLite adapter。
- CLI 最小闭环。
- Skill 说明。
- Web 资产工作台骨架。

这不是完整开发完成态。后续必须按[阶段开发路线图](../implementation/development-roadmap.md)重新审查、补齐、重构和验收。
