# DNA Documentation

状态：active
最后审阅：2026-06-26
来源级别：documentation entrypoint

本目录是 DNA: Design Network Atlas 的项目设计与开发计划入口。当前本地优先版本已经按阶段完成到 Phase 12，覆盖基础图谱、表型生成、审查影响分析、可选表型库、输出引用和 Git 目录交换；后续文档用于维护实现边界、测试策略和 post-v1 路线。

## 文档地图

| 文档 | 主要回答的问题 |
| --- | --- |
| [系统技术设计](design/system-architecture.md) | DNA 完整系统应该如何分层、建模、存储、编译、审查和扩展 |
| [阶段开发路线图](implementation/development-roadmap.md) | 如何把完整系统拆成多个可开发、可测试、可合并的阶段 |
| [版本与发布规范](implementation/versioning-policy.md) | 默认优先原则、三段式版本号、远端 push 前的版本升级规则 |
| [测试策略](testing/test-strategy.md) | 每类测试覆盖什么，如何证明每个阶段达到验收标准 |

## 当前实现边界

- v0.1 已完成本地 SQLite + CLI + 核心库 + 导入导出 + 审查/影响分析 + mock provider 安全边界。
- Phase 12 已补充 `PhenotypeLibrary`、外部库挂载/映射、`OutputReference`，支持不启用 DNA 表型库时直接登记外部结果位置。
- Web workbench 当前是前端工作台样例和状态模型，不是已接入 SQLite/API 的生产 Web 客户端。
- `server adapter` 当前是协作端口和权限/冲突模型，不是完整 HTTP 服务。
- npm CLI 发布、真实生成模型 provider、团队账户/权限/同步服务属于 post-v1。
