# DNA: Design Network Atlas

> English | [中文](#中文)

DNA is a local-first, open-source architecture for design genome graphs. It models design dimensions, stable design species, evolution relationships, generated phenotypes, output references, optional phenotype libraries, review records, and downstream impact.

DNA is not a binary asset store by default. It is a graph and governance layer that can point to Git repositories, local folders, NAS, Eagle, Figma, databases, object storage, engine exports, or future custom libraries.

## What DNA Models

- **Gene layer**: reusable design dimensions, constraints, templates, and review questions.
- **Species layer**: stable design objects such as icon families, characters, props, components, or style families.
- **Evolution layer**: directed parent-to-child relationships with deltas, value resolution, preservation rules, and negative cases.
- **Phenotype layer**: concrete generated or curated results for a task, with versions, output references, review records, and optional library bindings.
- **Impact layer**: downstream review or regeneration signals when an upstream species or evolution edge changes.

## Architecture

DNA is split into a reusable core, storage ports, concrete adapters, and user-facing interfaces.

```text
CLI / Web / Skill / Server
        |
Application services and change-set workflow
        |
@dna/core + @dna/storage ports
        |
SQLite / Git directory / provider adapters / library adapters
```

Key boundaries:

- Core domain logic does not depend on SQLite, CLI, Web, or any specific asset system.
- All persistent writes are expected to flow through services, repositories, and change-set semantics.
- Storage implementations are replaceable because the domain layer talks to repository ports.
- External libraries are adapter targets, not hard-coded product assumptions.
- Generated outputs can be recorded without using DNA's optional phenotype library layer.

## Monorepo Modules

| Module | Responsibility | Adapter boundary |
| --- | --- | --- |
| `@dna/core` | Zod schemas, domain types, defaults, compile policies, review logic, version rules, impact analysis, provider contracts | No database, CLI, or UI dependency |
| `@dna/storage` | Repository ports, storage engine interface, transactions, in-memory implementation, service contracts | Defines what SQLite/server adapters must implement |
| `@dna/sqlite` | Local SQLite adapter, migrations, repositories, Git-friendly import/export | Can be replaced by another storage engine |
| `@dna/cli` | Local `dna` command entrypoint, preview/apply workflow, local project operations | Uses services and repositories instead of owning domain rules |
| `@dna/template-packs` | Starter gene templates for game art and UI/icon assets | Domain packs can be added without changing core schemas |
| `@dna/server` | Collaboration-oriented service adapter surface | Future hosted/team mode can share the same ports |
| `@dna/web` | Workbench UI direction for phenotype and asset operations | UI should call service/API boundaries, not write core data directly |
| `codex-skills/dna` | Agent guidance layer for operating DNA from Codex | Skills guide workflow, but persistence remains in CLI/service layers |

## Adaptability

DNA is designed to integrate with different production environments instead of forcing one asset workflow.

### Storage Engines

- Default local runtime: SQLite.
- Open exchange format: Git-friendly directory JSON.
- Future-compatible targets: server-backed storage, cloud database, team sync service, or project-specific repositories.

### Phenotype Libraries

`PhenotypeLibrary` is optional and decoupled from `Graph`.

- One graph can bind to multiple phenotype libraries.
- One phenotype library can serve multiple graphs.
- A phenotype version can have multiple output references.
- An output reference can point directly to an external system even when no DNA library is used.

### External Library Adapters

DNA separates normalized metadata from external-system metadata.

- `StorageMount` describes where a library lives and which capabilities it supports.
- `ExternalLibraryMapping` records how external fields such as tags, folders, rating, collections, or annotations map into DNA metadata.
- Eagle is only one possible adapter target. The same model can support NAS folders, Git repositories, object storage, databases, Figma, engine exports, or custom DAM systems.

### Generation Providers

Generation providers should receive compiled constraint packages and prompts, then return generation job results. They should not own graph mutation, API-key storage, or formal version decisions.

## Data Model

Core objects:

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `EvolutionEdge`
- `EdgeVersion`
- `Phenotype`
- `PhenotypeVersion`
- `OutputReference`
- `PhenotypeLibrary`
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

DNA is currently a local-first v0.1 project. It is suitable for pilot use, local graph governance, prompt/brief generation, output reference management, review records, impact analysis, and Git-friendly exchange.

Production npm publishing, real image-model provider adapters, a persistent HTTP API, a connected Web client, team permissions, and sync workflows are future work.

## License

MIT License. See [LICENSE](LICENSE).

---

# 中文

DNA 是一个本地优先的开源“设计基因图谱”架构，用来建模设计维度、稳定设计对象、演化关系、生成表型、输出引用、可选表型库、审查记录和下游影响。

DNA 默认不是二进制素材仓库。它更像图谱治理层，可以指向 Git 仓库、本地目录、NAS、Eagle、Figma、数据库、对象存储、引擎导出目录或未来自定义库。

## DNA 建模什么

- **基因层**：可复用的设计维度、约束、模板和审查问题。
- **物种层**：稳定设计对象，例如图标家族、角色、道具、组件或风格族。
- **进化层**：从父物种到子物种的方向性关系，包含 delta、value resolution、保留规则和反例。
- **表型层**：某个具体任务中生成或整理出的结果，包含版本、输出引用、审查记录和可选库绑定。
- **影响层**：上游物种或进化边变化后，对下游对象产生的审查或重生成信号。

## 架构

DNA 拆分为可复用核心、存储端口、具体适配器和用户入口。

```text
CLI / Web / Skill / Server
        |
应用服务与 change-set 写入流程
        |
@dna/core + @dna/storage ports
        |
SQLite / Git 目录 / 生成 provider adapter / 表型库 adapter
```

核心边界：

- 核心领域逻辑不依赖 SQLite、CLI、Web 或任何具体素材系统。
- 持久化写入应通过 service、repository 和 change-set 语义完成。
- 存储实现可替换，因为领域层只依赖 repository ports。
- 外部素材库是 adapter target，不是硬编码产品假设。
- 即使不使用 DNA 的可选表型库，也可以记录生成结果位置。

## Monorepo 模块

| 模块 | 职责 | 适配边界 |
| --- | --- | --- |
| `@dna/core` | Zod schema、领域类型、默认对象、编译策略、审查逻辑、版本规则、影响分析、provider contract | 不依赖数据库、CLI 或 UI |
| `@dna/storage` | repository ports、storage engine、事务、内存实现、service contract | 定义 SQLite/server adapter 必须实现的能力 |
| `@dna/sqlite` | 本地 SQLite adapter、migration、repository、Git 目录导入导出 | 可以替换为其他存储引擎 |
| `@dna/cli` | 本地 `dna` 命令入口、preview/apply 流程、本地项目操作 | 调用 service/repository，不拥有领域规则 |
| `@dna/template-packs` | 游戏美术、UI/图标等初始基因模板 | 领域模板包可以扩展，不需要改 core schema |
| `@dna/server` | 面向协作模式的服务端 adapter 边界 | 未来团队模式复用同一套 ports |
| `@dna/web` | 面向表型和资产操作的工作台方向 | UI 应调用 service/API 边界，不直接写核心数据 |
| `codex-skills/dna` | Codex 操作 DNA 的引导层 | Skill 负责引导流程，持久化仍由 CLI/service 完成 |

## 适配性

DNA 的目标是接入不同生产环境，而不是强迫所有团队采用同一种素材流程。

### 存储引擎

- 默认本地运行存储：SQLite。
- 开放交换格式：Git 友好的目录化 JSON。
- 未来可兼容目标：服务端存储、云数据库、团队同步服务或项目自定义 repository。

### 表型库

`PhenotypeLibrary` 是可选能力，并且和 `Graph` 解耦。

- 一个图谱可以绑定多个表型库。
- 一个表型库可以服务多个图谱。
- 一个表型版本可以有多个输出引用。
- 输出引用可以直接指向外部系统，不要求绑定 DNA 表型库。

### 外部库适配器

DNA 把标准化元数据和外部系统元数据隔离。

- `StorageMount` 描述库的位置和能力。
- `ExternalLibraryMapping` 记录外部字段如何映射到 DNA 元数据，例如标签、目录、评分、集合、注释。
- Eagle 只是一个可能的适配目标。同一模型也可以支持 NAS、Git、对象存储、数据库、Figma、引擎导出目录或自定义 DAM。

### 生成模型适配器

生成 provider 应接收已经编译好的约束包和 prompt，然后返回 generation job 结果。provider 不应该负责图谱写入、API key 保存或正式版本决策。

## 数据模型

核心对象：

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `EvolutionEdge`
- `EdgeVersion`
- `Phenotype`
- `PhenotypeVersion`
- `OutputReference`
- `PhenotypeLibrary`
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

DNA 当前是本地优先的 v0.1 项目，适合试点使用、本地图谱治理、prompt / brief 生成、输出引用管理、审查记录、影响分析和 Git 友好交换。

npm 正式发布、真实图片生成 provider、持久化 HTTP API、接入 API 的 Web 客户端、团队权限和同步流程属于后续工作。

## 许可证

MIT License。详见 [LICENSE](LICENSE)。
