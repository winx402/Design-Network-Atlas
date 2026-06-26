# DNA: Design Network Atlas

> English | [中文](#中文)

DNA is a local-first, open-source architecture for managing design assets through a structured design graph. It helps teams describe design rules, stable design objects, style evolution, generated results, asset references, review records, and downstream impact.

DNA is not a binary asset store by default. It is a graph and governance layer that can connect to Git repositories, local folders, NAS, Eagle, Figma, databases, object storage, engine export folders, or future custom asset libraries.

## What DNA Models

- **Gene layer**: reusable design dimensions, constraints, templates, and review questions.
- **Species layer**: stable design objects such as icon families, characters, props, components, or style families.
- **Evolution layer**: directed parent-to-child relationships with style changes, value resolution, preservation rules, and negative cases.
- **Result layer**: concrete generated or curated outputs for a task, such as images, prompts, briefs, source files, previews, or runtime exports.
- **Impact layer**: downstream review or regeneration signals when an upstream design object or evolution rule changes.

In the internal schema, the result layer uses the term `Phenotype`. Public-facing docs can read this as "generated result", "asset result", or "design output".

## Architecture

DNA is split into a reusable domain core, storage ports, concrete adapters, and user-facing entrypoints.

```text
CLI / Web / Skill / Server
        |
Application services and change-set workflow
        |
@dna/core + @dna/storage ports
        |
SQLite / Git directory / generation providers / asset-library adapters
```

Key boundaries:

- Core domain logic does not depend on SQLite, CLI, Web, or any specific asset-management system.
- Persistent writes are expected to flow through services, repositories, and change-set semantics.
- Storage implementations are replaceable because the domain layer talks to repository ports.
- External asset libraries are adapter targets, not hard-coded product assumptions.
- Generated results can be recorded even when a team does not use DNA's optional result-library layer.

## Defaults First

DNA should work with strong defaults before a team configures advanced policies.

- A new graph should be usable with local SQLite storage and the Git-friendly exchange format.
- The default asset setup should be one primary result library per design graph.
- Different result types should usually be separated by storage mounts inside that library, not by creating many libraries.
- Multiple result libraries are still supported for different governance boundaries, such as exploration, production, outsourcing, archive, or runtime export.
- Advanced teams can add custom storage engines, adapter mappings, routing policies, review rules, and template packs without changing the core model.

## Monorepo Modules

| Module | Responsibility | Adapter boundary |
| --- | --- | --- |
| `@dna/core` | Zod schemas, domain types, default objects, compile policies, review logic, version rules, impact analysis, provider contracts | No database, CLI, or UI dependency |
| `@dna/storage` | Repository ports, storage engine interface, transactions, in-memory implementation, service contracts | Defines what SQLite/server adapters must implement |
| `@dna/sqlite` | Local SQLite adapter, migrations, repositories, Git-friendly import/export | Can be replaced by another storage engine |
| `@dna/cli` | Local `dna` command entrypoint, preview/apply workflow, local project operations | Uses services and repositories instead of owning domain rules |
| `@dna/template-packs` | Starter gene templates for game art and UI/icon assets | Domain packs can be added without changing core schemas |
| `@dna/server` | Collaboration-oriented service adapter surface | Future hosted/team mode can share the same ports |
| `@dna/web` | Workbench direction for generated results, asset references, review, and search | UI should call service/API boundaries, not write core data directly |
| `codex-skills/dna` | Agent guidance layer for operating DNA from Codex | Skills guide workflows, but persistence remains in CLI/service layers |

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
- One generated-result version can have multiple output references.
- An output reference can point directly to an external system even when no DNA result library is used.

### Asset-Library Adapters

DNA separates normalized metadata from adapter-specific metadata.

- `StorageMount` describes where an external library lives and which capabilities it supports.
- `ExternalLibraryMapping` records how external fields such as tags, folders, ratings, collections, or annotations map into DNA metadata.
- Eagle is only one possible adapter target. The same model can support NAS folders, Git repositories, object storage, databases, Figma, engine exports, or custom DAM systems.

### Generation Providers

Generation providers should receive compiled constraints and prompts, then return generation results. Providers should not own graph mutation, API-key storage, or formal version decisions.

## Technical Data Model

Core objects:

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `EvolutionEdge`
- `EdgeVersion`
- `Phenotype` - internal name for a generated or curated result object
- `PhenotypeVersion` - versioned snapshot of a generated or curated result
- `OutputReference`
- `PhenotypeLibrary` - optional searchable result library
- `StorageMount`
- `PhenotypeLibraryGraphBinding`
- `ExternalLibraryMapping`
- `AssetIndex`
- `GenerationJob`
- `ReviewRecord`
- `ImpactRecord`
- `ChangeSet`

## Exchange Format

`dna export --out <dir>` writes a Git-friendly project directory:

- `dna.project.json`
- `templates/`
- `libraries/<library_id>/library.json`
- `libraries/<library_id>/mounts/`
- `libraries/<library_id>/bindings/`
- `libraries/<library_id>/mappings/`
- `graphs/<graph_id>/graph.json`
- `graphs/<graph_id>/nodes/`
- `graphs/<graph_id>/edges/`
- `graphs/<graph_id>/phenotypes/`
- `graphs/<graph_id>/assets/`
- `graphs/<graph_id>/output-references/`
- `graphs/<graph_id>/reviews/`
- `graphs/<graph_id>/impacts/`

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

The root `package.json` currently uses `private: true` to prevent accidental npm publishing from the monorepo. The GitHub source is open under the MIT license.

## Development Checks

```bash
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
```

## Maturity

DNA is currently a local-first v0.1 project. It is suitable for pilot use, local design-graph governance, prompt/brief generation, output reference management, review records, impact analysis, and Git-friendly exchange.

Production npm publishing, real image-model provider adapters, a persistent HTTP API, a connected Web client, team permissions, and sync workflows are future work.

## License

MIT License. See [LICENSE](LICENSE).

---

# 中文

DNA 是一个本地优先的开源“设计基因图谱”架构，用来通过结构化图谱管理设计资产。它帮助团队描述设计规则、稳定设计对象、风格演化、生成结果、素材引用、审查记录和下游影响。

DNA 默认不是二进制素材仓库。它更像图谱治理层，可以连接 Git 仓库、本地目录、NAS、Eagle、Figma、数据库、对象存储、引擎导出目录或未来自定义素材库。

## DNA 建模什么

- **基因层**：可复用的设计维度、约束、模板和审查问题。
- **物种层**：稳定设计对象，例如图标家族、角色、道具、组件或风格族。
- **进化层**：从父物种到子物种的方向性关系，包含风格变化、value resolution、保留规则和反例。
- **结果层**：某个具体任务中生成或整理出的结果，例如图片、prompt、brief、源文件、预览图或运行时导出。
- **影响层**：上游设计对象或演化规则变化后，对下游对象产生的审查或重生成信号。

在内部 schema 里，结果层对象使用 `Phenotype` 这个名字。对外可以把它理解成“生成结果”“素材结果”或“设计输出”。

## 架构

DNA 拆分为可复用领域核心、存储端口、具体适配器和用户入口。

```text
CLI / Web / Skill / Server
        |
应用服务与 change-set 写入流程
        |
@dna/core + @dna/storage ports
        |
SQLite / Git 目录 / 生成 provider / 素材库 adapter
```

核心边界：

- 核心领域逻辑不依赖 SQLite、CLI、Web 或任何具体素材管理系统。
- 持久化写入应通过 service、repository 和 change-set 语义完成。
- 存储实现可替换，因为领域层只依赖 repository ports。
- 外部素材库是 adapter target，不是硬编码产品假设。
- 即使团队不使用 DNA 的可选结果库，也可以记录生成结果位置。

## 默认优先

DNA 应该先靠强默认值开箱即用，再允许团队做复杂配置。

- 新图谱默认可以直接使用本地 SQLite 和 Git 友好目录交换格式。
- 默认素材管理结构应该是一个设计图谱对应一个主结果库。
- 不同类型的生成结果通常应该通过结果库下面的多个存储挂载来区分，而不是创建很多库。
- 多结果库仍然保留给治理边界不同的场景，例如探索库、正式库、外包交付库、归档库或运行时导出库。
- 高阶团队可以继续定制存储引擎、adapter 映射、路由策略、审查规则和模板包，但不需要改变核心模型。

## Monorepo 模块

| 模块 | 职责 | 适配边界 |
| --- | --- | --- |
| `@dna/core` | Zod schema、领域类型、默认对象、编译策略、审查逻辑、版本规则、影响分析、provider contract | 不依赖数据库、CLI 或 UI |
| `@dna/storage` | repository ports、storage engine、事务、内存实现、service contract | 定义 SQLite/server adapter 必须实现的能力 |
| `@dna/sqlite` | 本地 SQLite adapter、migration、repository、Git 目录导入导出 | 可以替换为其他存储引擎 |
| `@dna/cli` | 本地 `dna` 命令入口、preview/apply 流程、本地项目操作 | 调用 service/repository，不拥有领域规则 |
| `@dna/template-packs` | 游戏美术、UI/图标等初始基因模板 | 领域模板包可以扩展，不需要改 core schema |
| `@dna/server` | 面向协作模式的服务端 adapter 边界 | 未来团队模式复用同一套 ports |
| `@dna/web` | 面向生成结果、素材引用、审查和搜索的工作台方向 | UI 应调用 service/API 边界，不直接写核心数据 |
| `codex-skills/dna` | Codex 操作 DNA 的引导层 | Skill 负责引导流程，持久化仍由 CLI/service 完成 |

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
- 一个生成结果版本可以有多个输出引用。
- 输出引用可以直接指向外部系统，不要求绑定 DNA 结果库。

### 素材库适配器

DNA 把标准化元数据和外部系统元数据隔离。

- `StorageMount` 描述外部库的位置和能力。
- `ExternalLibraryMapping` 记录外部字段如何映射到 DNA 元数据，例如标签、目录、评分、集合、注释。
- Eagle 只是一个可能的适配目标。同一模型也可以支持 NAS、Git、对象存储、数据库、Figma、引擎导出目录或自定义 DAM。

### 生成模型适配器

生成 provider 应接收已经编译好的约束和 prompt，然后返回生成结果。provider 不应该负责图谱写入、API key 保存或正式版本决策。

## 技术数据模型

核心对象：

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `EvolutionEdge`
- `EdgeVersion`
- `Phenotype` - 生成结果或整理结果对象的内部名称
- `PhenotypeVersion` - 生成结果或整理结果的版本快照
- `OutputReference`
- `PhenotypeLibrary` - 可选的、可搜索的结果库
- `StorageMount`
- `PhenotypeLibraryGraphBinding`
- `ExternalLibraryMapping`
- `AssetIndex`
- `GenerationJob`
- `ReviewRecord`
- `ImpactRecord`
- `ChangeSet`

## 交换格式

`dna export --out <dir>` 会写出 Git 友好的项目目录：

- `dna.project.json`
- `templates/`
- `libraries/<library_id>/library.json`
- `libraries/<library_id>/mounts/`
- `libraries/<library_id>/bindings/`
- `libraries/<library_id>/mappings/`
- `graphs/<graph_id>/graph.json`
- `graphs/<graph_id>/nodes/`
- `graphs/<graph_id>/edges/`
- `graphs/<graph_id>/phenotypes/`
- `graphs/<graph_id>/assets/`
- `graphs/<graph_id>/output-references/`
- `graphs/<graph_id>/reviews/`
- `graphs/<graph_id>/impacts/`

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

根目录 `package.json` 目前使用 `private: true`，用于避免 monorepo 被误发到 npm。GitHub 源码按 MIT License 开源。

## 开发检查

```bash
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
```

## 成熟度

DNA 当前是本地优先的 v0.1 项目，适合试点使用、本地设计图谱治理、prompt / brief 生成、输出引用管理、审查记录、影响分析和 Git 友好交换。

npm 正式发布、真实图片生成 provider、持久化 HTTP API、接入 API 的 Web 客户端、团队权限和同步流程属于后续工作。

## 许可证

MIT License。详见 [LICENSE](LICENSE)。
