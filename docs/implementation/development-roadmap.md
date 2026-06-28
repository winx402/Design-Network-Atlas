# DNA 分阶段开发路线图

状态：completed
最后审阅：2026-06-27
来源级别：authoritative implementation plan
上游输入：[系统技术设计](../design/system-architecture.md)
下游交付：代码实现、阶段验收记录、发布说明

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按阶段完成 DNA 的完整系统开发，每个阶段都有独立测试和验收，所有阶段合并后形成完整产品。

**Architecture:** 先固定领域模型和 service/storage ports，再实现 SQLite、本地 CLI、编译/表型、审查/影响分析、生成 adapter、资产工作台和双模式协作。每个阶段只向前扩展，不用一次性原型替代完整设计。

**Tech Stack:** TypeScript, Node.js, pnpm workspace, Zod, SQLite, Commander.js, Vitest, Vite/React, local HTTP API, future hosted server adapter.

## 当前状态

Phase 0-16 已完成并由测试覆盖。本文件保留为历史执行计划、验收映射和 post-v1 拆分参照；后续新增能力必须继续落到明确阶段、测试和完成边界中。

---

## 阶段总览

| 阶段 | 名称 | 目标 | 主要测试 |
| --- | --- | --- | --- |
| Phase 0 | 设计冻结与工程基线 | 完成设计文档、工程结构、测试框架 | 文档检查、CLI smoke、空测试套件 |
| Phase 1 | 核心领域模型 | 完整实现核心对象、schema、状态机、facets | schema/unit tests |
| Phase 2 | Service / Storage Ports | 建立 application service、repository ports、change-set | service unit tests、contract tests |
| Phase 3 | SQLite 本地存储 | 实现 migration、repository、事务、版本不可变 | SQLite integration tests |
| Phase 4 | CLI 本地闭环 | 实现 graph/template/node/relationship/import/export | CLI integration tests |
| Phase 5 | 编译与表型 | 实现 compile policy、generation job、phenotype/version/asset | golden tests、E2E prompt/brief |
| Phase 6 | 审查与影响分析 | 实现 review、style distance、impact records | review/impact unit + integration |
| Phase 7 | Codex Skill | Skill 将复杂设计场景映射到 DNA 图谱建模、编辑、审阅和写入策略 | scenario skill tests |
| Phase 8 | 生成模型 Adapter | mock provider + provider port + 安全边界 | adapter contract + security tests |
| Phase 9 | 资产工作台 | Web 资产工作台生产流 | web unit + browser QA |
| Phase 10 | 双模式协作 | server adapter、同步、权限、审批 | contract tests、API tests、权限 tests |
| Phase 11 | 完整系统验收 | 跑通 PRD 全量场景和发布检查 | E2E suite、release checklist |
| Phase 12 | 表型库与输出引用 | 可选结果库、存储挂载、外部库映射、无库输出指针 | schema、SQLite、CLI、import/export |
| Phase 13 | 结果库路由策略 | 一个结果库下按类型/角色/标签自动选择存储挂载 | routing unit、SQLite、CLI E2E |
| Phase 14 | 图谱树状输出 | 将物种节点和进化边投影成可读树与 JSON | tree unit、CLI E2E |
| Phase 15 | 本地生产基线补齐 | HTTP API、显式 sync、provider job、routing fallback/metadata、library graphIds 同步 | API tests、CLI E2E、provider security |
| Phase 16 | 审阅确认工作流 | ChangeSet 一等 CLI、review/apply/discard、导入导出待审阅草案 | CLI E2E、import/export |

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
- `DesignRelationship`
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
- `design_relationships`
- `node_relations`
- `phenotype_types`
- `phenotypes`
- `phenotype_versions`
- `phenotype_version_assets`
- `assets`
- `generation_jobs`
- `phenotype_generation_plans`
- `phenotype_generation_tasks`
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
- `dna relationship create/list/show`
- `dna export`
- `dna import`

测试：

- `dna --help` 可用。
- 创建两套互不影响图谱。
- 安装内置模板包。
- 创建多个 root node。
- 创建 species-first 节点。
- 后补节点级 DesignRelationship 使节点进入 complete。
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

- 表型版本能回答来自哪个 graph、node version、relationship trace、compile policy、prompt snapshot。

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
- DesignRelationship 变化影响目标物种及下游。
- impact records 可持久化和查询。

验收：

- 系统不自动覆盖下游版本。
- rejected / superseded 表型版本保留审查原因。

## Phase 7：Codex Skill

目标：让 Codex 作为复杂场景引导层，把用户的设计问题映射到 DNA 图谱建模、图谱编辑、审阅和写入策略；正式写入仍走 CLI/service。

交付：

- `codex-skills/dna-graph-modeling/SKILL.md`
- `codex-skills/dna-graph-editing/SKILL.md`
- scenario skill tests。

测试：

- 不保留浅层 `dna` 路由/CLI 说明 skill，CLI 说明由 `dna --help` 承担。
- 图谱建模 skill 能覆盖 SpeciesNode、DesignRelationship、facets、Phenotype、phenotype library 和写入策略。
- 图谱编辑 skill 能覆盖当前图谱、合理性、影响分析、风险等级、outdated、替代方案和写入策略。
- Skill 不直接写数据库内部结构、导出目录或外部素材库。
- Skill 不保存 API key 或敏感链接。

验收：

- 新项目能通过图谱建模 skill 形成可审阅图谱草案。
- 既有图谱变更能通过图谱编辑 skill 形成影响分析和推荐写入路径。

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

目标：提供第一版只读 Web 工作台基线，优先服务表型和素材治理轨迹检查。

交付：

- `apps/web`
- asset workbench。
- phenotype detail。
- version compare。
- review panel。
- outdated banner。
- loading / empty / error states。

测试：

- 浏览器打开资产工作台。
- 搜索标签和状态。
- 查看表型版本。
- 从本地 HTTP API 读取真实 workbench snapshot。
- 空库和 API 失败状态可读且不破坏数据。
- 不显示 accept / reject / archive 等 durable write 按钮。
- 查看审查结果。
- 查看 outdated 提示。

验收：

- UI 不直接写核心数据，MVP 只读；未来 Web 写入必须另走 PRD 并通过 service/change-set 边界。
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

## Phase 12：表型库与输出引用

目标：让 DNA 能在不保存二进制文件的前提下，提供统一的结果库、外部存储挂载和输出引用管理能力。

交付：

- `PhenotypeLibrary`
- `StorageMount`
- `PhenotypeLibraryGraphBinding`
- `ExternalLibraryMapping`
- `OutputReference`
- SQLite repository、CLI 命令、Git 目录导入导出。

测试：

- 一个图谱默认可绑定一个主结果库。
- 一个结果库可以拥有多个挂载。
- 一个结果库可以绑定多个图谱，一个图谱也可以绑定多个结果库。
- 不启用结果库时，输出引用仍可直接指向外部 URI。
- 外部库字段映射能保存标签、目录、评分、集合等兼容关系。
- 导出导入保留结果库、挂载、映射和输出引用。

验收：

- 结果库和图谱 ID 解耦，多对多关系清晰。
- DNA 仍不接管二进制素材生命周期，只管理可搜索、可审查、可追踪的结果指针。

## Phase 13：结果库路由策略

目标：落实“默认大于约定，可开箱即用，也可深度定制”的结果库策略。默认一个图谱绑定一个主结果库，多个结果类型和输出角色通过该库下的多个 `StorageMount` 承载。

交付：

- `LibraryRoutingPolicy`
- Core routing resolver。
- Repository port、内存实现、SQLite repository 和 migration。
- CLI：`dna library routing add/list`。
- `output-ref add` 在未显式指定 `--storage-mount` 时，根据 `libraryId`、表型类型、输出角色、引用类型和标签自动选择挂载。
- Git 目录：`libraries/<library_id>/routing-policies/`。

测试：

- schema 接受合法路由策略并拒绝非法对象。
- resolver 只选择 active 策略。
- resolver 按 priority 降序选择最高优先级匹配策略。
- 标签匹配要求策略标签全部出现在请求标签中。
- SQLite migration 创建 `library_routing_policies`。
- repository 支持 create/update/get/listByLibrary。
- CLI 能创建路由策略。
- CLI 创建输出引用时能自动填入路由得到的 `storageMountId`。
- 显式 `--storage-mount` 优先于路由策略。
- export/import 保留路由策略目录。

验收：

- 简单项目可以只创建一个结果库和几条路由策略就开始登记输出。
- 复杂项目仍可按治理边界创建多个结果库，并用路由策略细分挂载。

## Phase 14：图谱树状输出

目标：让使用者不用读取原始 JSON，也能直观看到图谱中有哪些物种，以及物种之间的父子、融合和附加父关系。

交付：

- Core：`buildGraphTree`，把 `Graph`、`SpeciesNode[]`、`DesignRelationship[]` 投影成稳定树结构。
- Core：`formatGraphTreeText`，输出 CLI 可读文本树。
- CLI：`dna graph tree --id <graph_id>`。
- CLI：`dna graph tree --id <graph_id> --format json`。

测试：

- 多 root 节点按图谱 root 顺序输出。
- 主父节点关系进入主树。
- 多父节点/融合关系保留在 `additionalRelations`，避免误表达为单父结构。
- 文本输出能显示物种名称、节点 ID、谱系状态和附加父关系。
- JSON 输出保留 roots、relations、additionalRelations。

验收：

- 用户可以从 CLI 直接看出物种层级。
- Agent 和后续 Web 工作台可以复用 JSON 结构做进一步可视化。

## Phase 15：本地生产基线补齐

目标：修复首次真实接入暴露的问题，把本地试点从“CLI 工程骨架”推进到可集成的 local-first baseline，但不冒充完整托管团队平台。

交付：

- `LibraryRoutingPolicy` 的 `fallbackMountId`、`metadataDefaults`、`requiredMetadata` 在 resolver 和 `output-ref add` 中实际生效。
- `library bind-graph` 后同步更新 `PhenotypeLibrary.graphIds`，避免 binding 表和 library export 出现双源状态歧义。
- `GenerationJobRepository.listByGraph`，并把 generation jobs 纳入 Git 目录导入导出。
- `PhenotypeGenerationPlan` / `PhenotypeGenerationTask` repositories、CLI preview/apply、task-linked generation 回写、Git 目录导入导出和只读 API/workbench snapshot。
- SQLite migration 自动修复旧库：根据既有 `phenotype_library_graph_bindings` 回填 `PhenotypeLibrary.graphIds`。
- `provider run-mock` 与 `provider job show`，用于本地 provider job 验证和敏感参数清理。
- generic HTTP provider primitive，供后续真实模型 adapter 复用，不保存 API key。
- `sync export/import`，作为显式项目目录交换命令。
- 本地 HTTP API handler 和 `dna serve`，提供 health、graph tree、workbench generated-result 和 generation plan/task snapshot。
- DNA 网页 HTTP 访问可开关，默认关闭；只有 `dna serve --web` 或 handler `webEnabled: true` 才返回只读工作台页面。
- Web workbench 数据加载函数可以从本地 HTTP API 读取，而不是只使用静态样例。

测试：

- routing unit 覆盖 target mount 不可用时 fallback 到 active fallback mount。
- CLI E2E 覆盖 metadata defaults 自动补齐、显式 metadata 覆盖默认值、required metadata 缺失时报错。
- CLI E2E 覆盖 `library bind-graph` 后导出 `library.json.graphIds`。
- provider security 覆盖 runtime API key / secret 不进入 job、DB 或导出。
- sync E2E 覆盖 generation plans、generation tasks 和 generation jobs 随项目目录导出和导入。
- migration test 覆盖旧库已有 binding、library.graphIds 为空、重新 migrate 后导出 graphIds 不为空。
- HTTP API test 覆盖 health、graph tree、workbench snapshots 和 generation plan/task summaries。
- HTTP web access test 覆盖默认 `/` 为 404，显式开启后返回 HTML。

验收：

- 补天这类项目可以用 CLI + SQLite + export + local API 做本地图谱治理和上层接入。
- 结果库路由策略字段不再只是 schema 预留字段。
- library graph binding 和 library export 不再互相打架。
- 团队账户、权限、审批、多人同步、完整 Web 客户端仍明确归入 post-v1。

## Phase 16：审阅确认工作流

目标：让“先生成草案、审阅确认后正式写入 DNA”成为本地 CLI 内的一等闭环，而不是只能依赖外部 Markdown 草稿。

交付：

- `dna changeset list --status preview --object-type node`
- `dna changeset show <changeSetId>`
- `dna changeset review <changeSetId>`
- `dna changeset apply <changeSetId>`
- `dna changeset discard <changeSetId>`
- 全局 `--change-set <id>`，让 `--mode changeset-apply` 可以真正引用既有 preview change-set。
- graph/node/relationship create 在 `changeset-apply` 模式下不要求重复传入 create 参数。
- Git-friendly export/import 增加顶层 `change-sets/`，让 pending change-sets 能进入代码审查或跨库迁移。

测试：

- CLI E2E 覆盖 preview node 不写正式 nodes，但产生 preview change-set。
- CLI E2E 覆盖 list/show/review/apply/discard。
- CLI E2E 覆盖 `--mode changeset-apply --change-set <id>` 不重复 create 参数也能 apply。
- CLI E2E 覆盖 pending change-set 被 export/import 保留。

验收：

- 单个 graph/node/relationship preview 可以被审阅、确认或废弃。
- 用户可以先用 preview change-set 承载物种草案，再由人工决定是否 apply。
- 多节点/多边 proposal/batch、tree diff 和团队审批仍是后续阶段，不混入 Phase 16 完成边界。
