# DNA Documentation

状态：active
最后审阅：2026-06-27
来源级别：documentation entrypoint

本目录是 DNA: Design Network Atlas 的项目设计与开发计划入口。当前本地优先版本已经按阶段完成到 Phase 16，并补强场景 skill、只读 Web 工作台、provider 失败脱敏和版本化交换格式，覆盖基础图谱、图谱建模/编辑/表型生成引导、图谱树输出、表型生成、审查影响分析、可选表型库、输出引用、结果库路由、preview change-set 审阅确认、Git 目录交换、本地 HTTP API 基线和生成 provider 基线；后续文档用于维护实现边界、测试策略和 post-v1 路线。

## 当前产品定位

DNA 现阶段主要服务于 LLM 的设计生成类场景：围绕设计图谱、约束、谱系、生成任务、输出引用、审查记录和影响记录，为 LLM 生成或整理设计结果提供可追踪、可审阅、可版本化的上下文与治理层。DNA 仍不是默认二进制素材仓库；素材本体由外部存储或素材库承载，DNA 记录图谱意义、生成结果元数据、外部输出位置和审阅确认过程。

## 文档地图

| 文档 | 主要回答的问题 |
| --- | --- |
| [系统技术设计](design/system-architecture.md) | DNA 完整系统应该如何分层、建模、存储、编译、审查和扩展 |
| [阶段开发路线图](implementation/development-roadmap.md) | 如何把完整系统拆成多个可开发、可测试、可合并的阶段 |
| [版本与发布规范](implementation/versioning-policy.md) | 默认优先原则、三段式版本号、远端 push 前的版本升级规则 |
| [测试策略](testing/test-strategy.md) | 每类测试覆盖什么，如何证明每个阶段达到验收标准 |

## 当前实现边界

- 当前公开代码已完成本地 SQLite + CLI + 核心库 + 版本化导入导出 + 审查/影响分析 + mock provider / generic HTTP provider 安全边界，并包含图谱建模、图谱编辑和表型生成 MVP 场景 skill。
- Phase 12 已补充 `PhenotypeLibrary`、外部库挂载/映射、`OutputReference`，支持不启用 DNA 表型库时直接登记外部结果位置。
- Phase 13 已补充 `LibraryRoutingPolicy`，支持一个图谱默认绑定一个结果库，再按生成结果类型、输出角色、引用类型和标签自动路由到不同 `StorageMount`；fallback mount、metadata defaults 和 required metadata 已在 resolver 与 CLI 写入流程中执行。
- Phase 14 已补充 `graph tree`，支持把物种节点和进化边投影成可读树状输出和 JSON 结构，便于直观看到物种关系。
- Phase 15 已补充本地 HTTP API baseline、`dna serve`、`dna sync export/import`、generation job 导入导出和 API-backed 只读 workbench 数据加载。
- v0.4.1 已让 SQLite migration 从历史 `phenotype_library_graph_bindings` 自动回填 `PhenotypeLibrary.graphIds`，避免旧库只 list/export 时继续保留空 graphIds。
- Phase 16 已补充 `dna changeset list/show/review/apply/discard`、`--change-set` 全局参数和 `change-sets/` 导入导出，让 preview 草案能在 DNA 内完成审阅确认闭环。
- Phase 7 已从 CLI 命令配方调整为场景技能：不再保留浅层 `dna` 说明 skill，`dna-graph-modeling` 负责从新场景映射图谱，`dna-graph-editing` 负责已有图谱变更评估。
- HTTP API 可以读取 SQLite 数据；DNA 网页 HTTP 访问默认关闭，必须通过 `--web` 或 handler option 显式开启。
- Web workbench 当前是只读本地工作台基线，不提供 durable write 按钮；完整生产 Web 客户端、团队账户/权限/审批/多人同步服务属于 post-v1。
