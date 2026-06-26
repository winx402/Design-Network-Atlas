# DNA 测试策略

状态：draft
最后审阅：2026-06-26
来源级别：authoritative test strategy
上游输入：[系统技术设计](../design/system-architecture.md)、[阶段开发路线图](../implementation/development-roadmap.md)

## 1. 测试原则

- 每个开发阶段必须先定义测试，再实现功能。
- 测试必须覆盖该阶段交付边界，不能只覆盖 happy path。
- 阶段测试通过只代表该阶段完成，不代表完整系统完成。
- 完整系统只有在 Phase 11 全量验收通过后才能宣布完成。

## 2. 测试分层

| 测试类型 | 覆盖对象 | 运行命令 |
| --- | --- | --- |
| unit tests | schema、状态机、编译、审查、影响分析 | `pnpm vitest run packages/core` |
| contract tests | repository / service ports 的统一行为 | `pnpm vitest run packages/*/contract` |
| integration tests | SQLite、CLI、import/export、adapter | `pnpm vitest run packages/sqlite apps/cli` |
| golden tests | prompt、brief、review summary、Git export | `pnpm vitest run **/*.golden.test.ts` |
| E2E tests | PRD 13 条端到端场景 | `pnpm e2e` |
| UI tests | 资产工作台生产流 | `pnpm playwright test` |
| security tests | 敏感信息不入库、不导出、不进日志 | `pnpm security:test` |
| docs tests | 文档链接和阶段覆盖 | `pnpm docs:check` |

## 3. 阶段测试矩阵

| 阶段 | 必跑测试 | 不能跳过的断言 |
| --- | --- | --- |
| Phase 0 | docs check、CLI smoke | 设计文档存在，路线图覆盖所有 PRD 能力 |
| Phase 1 | core unit tests | `facets` 与母题分离，多父节点校验正确 |
| Phase 2 | service unit tests | preview 不写入，apply 才写入，rollback 无残留 |
| Phase 3 | SQLite integration tests | migration、CRUD、不可变版本、逻辑删除 |
| Phase 4 | CLI integration tests | 默认 preview，`--yes` 才落库，import/export 可重放 |
| Phase 5 | golden + E2E subset | prompt/brief 稳定，表型版本记录完整 recipe |
| Phase 6 | review/impact tests | 上游变化只生成影响记录，不覆盖下游 |
| Phase 7 | skill transcript tests | Skill 调 CLI，不直接写库 |
| Phase 8 | adapter contract + security | provider 失败不污染正式数据，API key 不落盘 |
| Phase 9 | Playwright | 资产工作台主要流程可操作，无布局重叠 |
| Phase 10 | server/local contract tests | local 和 server adapter 行为一致，权限生效 |
| Phase 11 | full E2E + release checks | PRD 13 条验收场景全通过 |

## 4. 关键测试数据

最小测试图谱必须包含：

- 两套 graph。
- 两个 template pack。
- 多个 root nodes。
- 一个 species-first node。
- 一个后补 edge 的 node。
- 一个多父节点 node。
- 一个 image-prompt phenotype。
- 一个 art-brief phenotype。
- 一个 review-checklist phenotype。
- 一个 phenotype version 关联多个 asset variants。
- 一个被上游变化标记 outdated 的 phenotype version。

## 5. Golden 输出规则

Golden tests 覆盖：

- prompt snapshot。
- art brief。
- review checklist。
- style distance summary。
- Git 目录 export。

规则：

- 只有设计文档或编译规则变化时才能更新 golden。
- 更新 golden 的提交必须说明为什么输出变化。
- 不允许因为测试失败直接重录 golden。

## 6. 安全测试规则

测试必须证明以下字符串不会出现在 SQLite、导出 JSON 和日志：

- `OPENAI_API_KEY`
- `sk-`
- `password`
- `secret`
- `private_key`
- 完整私密 URL token 参数。

provider adapter 只能保存：

- provider name。
- model name。
- 非敏感参数。
- 脱敏错误码。
- 生成结果 asset pointer。

## 7. 完成声明规则

允许声明：

- “Phase N 通过验收”，前提是该阶段测试新鲜通过。
- “本地核心通过验收”，前提是 Phase 0-6 全部通过。
- “完整系统通过验收”，前提是 Phase 0-11 全部通过。

禁止声明：

- 只跑 unit tests 就说系统完成。
- 只完成 CLI 就说完整产品完成。
- UI 骨架存在就说资产工作台完成。
- mock provider 通过就说真实 provider 已接入。
