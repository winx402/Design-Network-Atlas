# DNA 分阶段开发路线图

状态：v0.1-completed
最后审阅：2026-06-26
来源级别：authoritative implementation plan
上游输入：[系统技术设计](../design/system-architecture.md)
下游交付：代码实现、阶段验收记录、发布说明

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按阶段完成 DNA 的完整系统开发，每个阶段都有独立测试和验收，所有阶段合并后形成完整产品。

**Architecture:** 先固定领域模型和 service/storage ports，再实现 SQLite、本地 CLI、编译/表型、审查/影响分析、生成 adapter、资产工作台和双模式协作。每个阶段只向前扩展，不用一次性原型替代完整设计。

**Tech Stack:** TypeScript, Node.js, pnpm workspace, Zod, SQLite, Commander.js, Vitest, Vite/React, future server adapter.

## 当前状态

Phase 0-11 已完成并由测试覆盖。本文件保留为历史执行计划、验收映射和 post-v1 拆分参照；后续新增能力必须继续落到明确阶段、测试和完成边界中。

---

## 阶段总览

| 阶段 | 名称 | 目标 | 主要测试 |
| --- | --- | --- | --- |
| Phase 0 | 设计冻结与工程基线 | 完成设计文档、工程结构、测试框架 | 文档检查、CLI smoke、空测试套件 |
| Phase 1 | 核心领域模型 | 完整实现核心对象、schema、状态机、facets | schema/unit tests |
| Phase 2 | Service / Storage Ports | 建立 application service、repository ports、change-set | service unit tests、contract tests |
| Phase 3 | SQLite 本地存储 | 实现 migration、repository、事务、版本不可变 | SQLite integration tests |
| Phase 4 | CLI 本地闭环 | 实现 graph/template/node/edge/import/export | CLI integration tests |
| Phase 5 | 编译与表型 | 实现 compile policy、generation job、phenotype/version/asset | golden tests、E2E prompt/brief |
| Phase 6 | 审查与影响分析 | 实现 review、style distance、impact records | review/impact unit + integration |
| Phase 7 | Codex Skill | Skill 引导 CLI，预览、确认、审查写入 | command transcript tests |
| Phase 8 | 生成模型 Adapter | mock provider + provider port + 安全边界 | adapter contract + security tests |
| Phase 9 | 资产工作台 | Web 资产工作台生产流 | web unit + browser QA |
| Phase 10 | 双模式协作 | server adapter、同步、权限、审批 | contract tests、API tests、权限 tests |
| Phase 11 | 完整系统验收 | 跑通 PRD 全量场景和发布检查 | E2E suite、release checklist |

## Phase 0：设计冻结与工程基线

目标：先完成设计和计划，不进入功能扩张。

交付：

- `docs/design/system-architecture.md`
- `docs/implementation/development-roadmap.md`
- `docs/testing/test-strategy.md`
- pnpm workspace。
- 基础 README。
- `.gitignore` 和 AGENTS 边界。

测试：

- `pnpm install`
- `pnpm test`
- `pnpm typecheck`
- `pnpm --silent tsx apps/cli/src/index.ts --help`
- 文档链接检查：所有 docs/index 链接存在。

验收：

- 技术设计能解释完整系统的对象、边界、依赖方向、写入机制、版本机制、测试策略。
- 路线图把所有 PRD 能力映射到阶段。
- Phase 0 阶段只能标记为工程基线；v0.1 完成状态以后续 Phase 11 验收为准。

提交边界：

- 只提交设计、计划、工程基线。
- 不新增业务能力。

## Phase 1：核心领域模型

目标：实现 DNA 的核心领域语言，保证后续所有模块使用同一套对象。

交付：

- `packages/core/src/schemas.ts`
- `packages/core/src/defaults.ts`
- `packages/core/src/status.ts`
- `packages/core/src/versioning.ts`
- `packages/core/test/domain.test.ts`

必须覆盖对象：

- `Graph`
- `TemplatePack`
- `GeneTemplate`
- `SpeciesNode`
- `NodeVersion`
- `EvolutionEdge`
- `EdgeVersion`
- `Phenotype`
- `PhenotypeVersion`
- `AssetIndex`
- `GenerationJob`
- `ReviewRecord`
- `ImpactRecord`
- `ChangeSet`
- `CompilePolicy`

测试：

- 合法对象 parse 成功。
- 非法状态 parse 失败。
- `primaryParent` 不在 `parentNodes` 时失败。
- `parentRoles` 只能引用已声明父节点。
- 一个图谱支持多个 root node。
- 一个物种支持多个父节点和父节点角色。
- 一个表型版本支持多个素材。
- `facets` 可挂载任意领域扩展。
- 视觉母题与 `facets` 字段不混淆。

验收：

- `pnpm vitest run packages/core/test/domain.test.ts` 通过。
- `pnpm typecheck` 通过。

## Phase 2：Service / Storage Ports

目标：先定义业务服务和存储接口，避免 CLI、Web、Skill 直接写库。

交付：

- `packages/storage/src/index.ts`
- `packages/core/src/change-set.ts`
- `packages/core/src/services/*.ts`
- repository contract test helpers。

服务边界：

- `GraphService`
- `TemplateService`
- `LineageService`
- `PhenotypeService`
- `AssetService`
- `ReviewService`
- `ImpactService`
- `ImportExportService`

写入流程：

1. validate input。
2. build change-set。
3. preview diff / impact / missing fields。
4. apply in transaction。
5. create immutable version snapshot。

测试：

- preview 不写入。
- apply 写入并返回 change summary。
- failed apply rollback。
- `draft-write` 直接写入 draft。
- `changeset-apply` 只能 apply 已存在 change-set。

验收：

- 所有写入入口都有 service 测试。
- 没有 CLI 或 Web 绕过 service 直接调用 repository 的业务写入。

## Phase 3：SQLite 本地存储

目标：实现本地运行存储，使 Phase 2 的 repository ports 有 SQLite 实现。

交付：

- `packages/sqlite/src/schema.ts`
- `packages/sqlite/src/migrations/*`
- `packages/sqlite/src/store.ts`
- `packages/sqlite/test/sqlite.test.ts`
- SQLite repository contract tests。

表范围：

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
- `change_sets`

测试：

- 空库 migration 成功。
- 所有 repository CRUD 成功。
- 事务 rollback 后无残留。
- 版本对象不能 update。
- 逻辑删除后历史仍可查询。
- 跨 graph 查询隔离。

验收：

- `pnpm vitest run packages/sqlite/test/sqlite.test.ts` 通过。
- contract tests 对 SQLite adapter 全部通过。

## Phase 4：CLI 本地闭环

目标：用户可以通过 CLI 完成图谱、模板、物种、进化边、导入导出基础闭环。

交付：

- `apps/cli/src/index.ts`
- `apps/cli/src/commands/*.ts`
- `apps/cli/test/cli.test.ts`

命令：

- `dna graph create/list/show/archive`
- `dna template install/list/export`
- `dna node create/list/show/update/archive`
- `dna edge create/list/show/update/archive`
- `dna export`
- `dna import`

测试：

- `dna --help` 可用。
- 创建两套互不影响图谱。
- 安装内置模板包。
- 创建多个 root node。
- 创建 species-first 节点。
- 后补 edge 使节点进入 complete。
- 多父节点和 parent role 持久化。
- Git 目录 export/import 后对象一致。

验收：

- CLI 默认 preview，不加 `--yes` 不写入。
- `--mode draft-write` 和 `--mode changeset-apply` 行为可测。

## Phase 5：编译与表型

目标：把图谱约束编译成 prompt / brief，并创建可追踪表型和素材组。

交付：

- `packages/core/src/compile.ts`
- `packages/core/src/phenotype.ts`
- CLI phenotype 和 asset 命令。
- golden fixtures。

必须实现：

- `system-rule-first`
- `snapshot-fixed`
- conflict list。
- resolved gene snapshot。
- prompt snapshot。
- generation recipe。
- generation job。
- phenotype。
- phenotype version。
- phenotype version assets。

测试：

- 同一物种生成 `image-prompt`。
- 同一物种生成 `art-brief`。
- 同一物种生成 `review-checklist`。
- 同一表型多个版本。
- 同一表型版本多个素材变体。
- golden prompt / brief 稳定。
- 发生冲突时记录来源和处理方式。

验收：

- 表型版本能回答来自哪个 graph、node version、edge version trace、compile policy、prompt snapshot。

## Phase 6：审查与影响分析

目标：图谱变化可解释，表型适配度可审查。

交付：

- `packages/core/src/review.ts`
- `packages/core/src/impact.ts`
- `apps/cli/src/commands/review.ts`
- `apps/cli/src/commands/impact.ts`

测试：

- 物种审查输出缺失维度。
- 表型审查输出约束违反。
- 风格距离输出 shared/different motifs 和 constraints。
- 父物种变化影响子物种和表型版本。
- edge 变化影响目标物种及下游。
- impact records 可持久化和查询。

验收：

- 系统不自动覆盖下游版本。
- rejected / superseded 表型版本保留审查原因。

## Phase 7：Codex Skill

目标：让 Codex 作为引导层管理图谱，但正式写入仍走 CLI/service。

交付：

- `codex-skills/dna/SKILL.md`
- skill command recipes。
- skill transcript tests 或 fixtures。

测试：

- Skill 先展示 preview 命令。
- 用户确认后才生成 `--yes` 命令。
- Skill 不直接写 SQLite。
- Skill 不保存 API key 或敏感链接。

验收：

- 同一条创建物种流程能通过 Skill 引导并落到 CLI。

## Phase 8：生成模型 Adapter

目标：把 prompt / brief 交给生成 provider，并安全登记结果。

交付：

- `packages/core/src/provider.ts`
- `packages/adapters/*`
- mock provider。
- provider contract tests。

测试：

- mock provider 成功返回结果并创建 generation job。
- provider 失败时不创建 accepted phenotype version。
- API key 不进入数据库、导出目录、日志、generation recipe。
- provider output 只通过 asset pointer 登记。

验收：

- adapter 可以替换，不影响核心编译和表型模型。

## Phase 9：资产工作台

目标：提供第一版 Web 生产界面，优先服务表型和素材管理。

交付：

- `apps/web`
- asset workbench。
- phenotype detail。
- version compare。
- review panel。
- outdated banner。

测试：

- 浏览器打开资产工作台。
- 搜索标签和状态。
- 查看表型版本。
- 接受 / 拒绝 / 归档表型版本。
- 查看审查结果。
- 查看 outdated 提示。

验收：

- UI 不直接写核心数据，必须调用 service/API。
- 页面在桌面和移动宽度不出现文字溢出或控件重叠。

## Phase 10：双模式协作

目标：本地模式和中心服务模式共用领域模型和 contract tests。

交付：

- `@dna/server`
- server adapter。
- auth / permission model。
- sync change-set。
- approval workflow。

测试：

- local adapter 和 server adapter 跑同一套 repository contract tests。
- 权限不足不能写正式版本。
- 同步冲突生成 change-set，不静默覆盖。
- 审批通过后状态变更可追踪。

验收：

- 本地模式不依赖中心服务仍可完整运行。
- 中心服务只扩展协作，不替代本地核心。

## Phase 11：完整系统验收

目标：合并所有阶段能力，证明 PRD 要求被覆盖。

E2E 场景：

1. 创建两套图谱，分别绑定不同模板包。
2. 在一套图谱中创建多个起始物种。
3. 创建 species-first 物种并后补进化边。
4. 创建多父节点物种并记录父节点角色。
5. 为进化边填写类型、方向、操作、delta、value resolution、正反例。
6. 基于物种生成 prompt / brief，并保存 generation recipe。
7. 创建一个表型对象和多个表型版本。
8. 给同一表型版本登记多个素材索引。
9. 对物种和表型版本运行适配度审查。
10. 修改父物种后生成影响分析。
11. 通过标签、状态、图谱、物种、表型类型搜索素材。
12. 导出 Git 目录并导入到新库。
13. 归档对象后仍能查询历史版本。

发布前测试：

- `pnpm test`
- `pnpm typecheck`
- `pnpm e2e`
- `pnpm security:test`
- `pnpm docs:check`

验收：

- 所有阶段测试通过。
- 所有 PRD v0.1 验收场景通过。
- README、设计文档、CLI help、Skill 文档一致。
- 未完成的长期能力明确标记为 post-v1，而不是混入完成声明。
