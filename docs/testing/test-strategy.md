# DNA 测试策略

状态：v0.1-active
最后审阅：2026-06-26
来源级别：authoritative test strategy
上游输入：[系统技术设计](../design/system-architecture.md)、[阶段开发路线图](../implementation/development-roadmap.md)

## 1. 测试原则

- 每个开发阶段必须先定义测试，再实现功能。
- 测试必须覆盖该阶段交付边界，不能只覆盖 happy path。
- 阶段测试通过只代表该阶段完成，不代表完整系统完成。
- 完整系统只有在 Phase 11 全量验收通过后才能宣布完成。
- 当前 v0.1 已按 Phase 11 验收口径完成；post-v1 能力必须单独声明，不能混入 v0.1 完成声明。

## 2. 测试分层

| 测试类型 | 覆盖对象 | 运行命令 |
| --- | --- | --- |
| unit tests | schema、状态机、编译、审查、影响分析 | `pnpm vitest run packages/core` |
| contract tests | repository / service ports 的统一行为 | `pnpm vitest run packages/*/contract` |
| integration tests | SQLite、CLI、import/export、adapter | `pnpm vitest run packages/sqlite apps/cli` |
| golden tests | prompt、brief、review summary、Git export | `pnpm vitest run **/*.golden.test.ts` |
| E2E tests | PRD 13 条端到端场景 | `pnpm e2e` |
| UI tests | 资产工作台前端状态流与浏览器 QA | `pnpm vitest run apps/web` |
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
| Phase 9 | web unit + browser QA | 资产工作台主要流程可操作，无布局重叠 |
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

## 5. 具体测试 Case 清单

### 5.1 Phase 1 Core Domain Cases

- `GraphSchema` 接受多个 `rootNodes`，并保留 graph 级 `facets`。
- `GraphSchema` 拒绝空 `graphId`、空 `name`、非法 `status`、非法 `compilePolicy.type`。
- `TemplatePackSchema` 支持 `draft / active / deprecated / archived` 状态。
- `GeneTemplateSchema` 区分 required、recommended、optional、forbidden dimensions。
- `GeneTemplateSchema` 保留 `phenotypeTypeSuggestions`，用于后续表型类型建议。
- `SpeciesNodeSchema` 接受 `species-first` 且无父节点的物种。
- `SpeciesNodeSchema` 接受多父节点，并要求 `parentRoles` 只引用已声明父节点。
- `SpeciesNodeSchema` 拒绝 `primaryParent` 不在 `parentNodes` 中的对象。
- `SpeciesNodeSchema` 保留视觉母题字段，并把 `facets` 作为扩展元数据。
- `NodeVersionSchema` 保存 parent node versions、incoming edge versions、resolved gene snapshot、compile snapshot。
- `EvolutionEdgeSchema` 接受所有 PRD 指定 edge type。
- `EvolutionEdgeSchema` 保存 `deltaGenes`、`valueResolution`、`mustPreserve`、`mustAvoid`。
- `EdgeVersionSchema` 创建后被 repository contract 视为不可变。
- `PhenotypeSchema` 支持 built-in、template、custom 三种表型类型来源。
- `PhenotypeVersionSchema` 默认状态为 `pending-confirmation`，并支持多个 asset ids。
- `AssetIndexSchema` 支持多种 storage type、asset type、role、variant role。
- `GenerationJobSchema` 保存输入快照、输出快照和非敏感工具参数。
- `ReviewRecordSchema` 保存缺失维度、约束违反、风格距离摘要、人工确认状态。
- `ImpactRecordSchema` 保存 changed object、affected object、建议动作和 review status。
- `ChangeSetSchema` 支持 `preview-confirm`、`draft-write`、`changeset-apply` 三种模式。

### 5.2 Phase 2 Service / Change-Set Cases

- `createGraph` preview 只返回 change-set，不写 repository。
- `createGraph` apply 写入 graph 并返回 applied change-set。
- `createNode` 自动创建初始 `NodeVersion`。
- `createEdge` 更新目标 node lineage 状态但不覆盖旧 node version。
- `updateNode` 创建新 `NodeVersion`，旧版本仍可查询。
- `applyChangeSet` 遇到 repository error 必须 rollback。
- `draft-write` 写入对象状态为 draft，并保留输入快照。
- `changeset-apply` 只能 apply 未应用的 change-set。

### 5.3 Phase 3 SQLite Cases

- migration 可在空库重复运行。
- 所有表存在，包含 PRD 指定核心表。
- graph、template、node、edge、phenotype、asset、review、impact CRUD 成功。
- `NodeVersion`、`EdgeVersion`、`PhenotypeVersion` 没有 update 入口。
- rollback 后 graph/node/edge 都不残留。
- 归档 graph 不删除其 nodes、edges、phenotypes。
- asset search 支持 tag、status、linked object、graph 过滤。
- Git 目录 export/import 后对象数量和核心 id 一致。

### 5.4 Phase 4 CLI Cases

- `dna --help` 显示产品名和命令清单。
- 所有写入命令默认输出 `ChangeSet preview`。
- 所有写入命令加 `--yes` 后才落库。
- `dna graph create/list/show/archive` 覆盖图谱生命周期。
- `dna node create` 支持 root、species-first、多父节点。
- `dna edge create` 支持 edge type、delta、value resolution。
- `dna export/import` 可在新库重放。
- CLI 错误时退出码非 0，并输出可读错误。

### 5.5 Phase 5 Compile / Phenotype Cases

- `system-rule-first` 按父节点、edge、node、task 顺序合并基因。
- 冲突必须进入 conflict list，不允许静默覆盖。
- `snapshot-fixed` 使用已保存 snapshot，不重新计算父节点链。
- 同一物种可生成 `image-prompt`、`art-brief`、`review-checklist`。
- 表型版本记录 graph id、node version id、edge version trace、compile policy。
- 一个 phenotype version 可以关联 size、angle、format、crop 多个 asset variants。
- golden prompt / brief 在无设计规则变更时稳定。

### 5.6 Phase 6 Review / Impact Cases

- node review 能发现缺失 required dimensions。
- phenotype review 能发现 prompt / brief 缺失必须保留母题。
- style distance 能列出 shared motifs、different motifs、different constraints。
- 父 node 变化影响所有下游 node 和 phenotype versions。
- edge 变化影响目标 node 及其下游。
- impact check 不自动创建新 phenotype version。
- rejected / superseded phenotype version 保留 review reason。

### 5.7 Phase 7 Skill Cases

- Skill 输出 preview 命令而不是直接写库。
- 用户确认后 Skill 才输出带 `--yes` 的 apply 命令。
- Skill 能把模板问题转成 CLI 参数或待确认字段。
- Skill 不把未经确认的 LLM 推断写入正式图谱。

### 5.8 Phase 8 Adapter / Security Cases

- mock provider 成功返回后创建 generation job。
- provider 失败时不创建 accepted phenotype version。
- API key、password、secret、private key 不进入 DB、export、log。
- adapter 只保存 provider name、model name、非敏感参数、asset pointer。

### 5.9 Phase 9 Web Workbench Cases

- 资产工作台可以搜索表型、标签、状态。
- 表型详情展示版本列表、素材组、review records。
- 用户可以接受、拒绝、归档表型版本。
- outdated phenotype version 显示明确提示。
- 桌面和移动视口无控件重叠、文字溢出。

### 5.10 Phase 10 Collaboration Cases

- local adapter 与 server adapter 通过同一套 repository contract tests。
- 未授权用户不能写正式 graph/node/phenotype。
- 同步冲突生成 change-set，而不是静默覆盖。
- 审批通过后状态、审批人、时间和输入快照可追踪。

### 5.11 Phase 11 Full Acceptance Cases

- PRD 13 条验收场景全部端到端通过。
- README、CLI help、Skill 文档、系统设计术语一致。
- 全量测试命令通过。
- 未完成的长期能力被标记为 post-v1，不得写成已完成。

## 6. Golden 输出规则

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

## 7. 安全测试规则

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

## 8. 完成声明规则

允许声明：

- “Phase N 通过验收”，前提是该阶段测试新鲜通过。
- “本地核心通过验收”，前提是 Phase 0-6 全部通过。
- “完整系统通过验收”，前提是 Phase 0-11 全部通过。

禁止声明：

- 只跑 unit tests 就说系统完成。
- 只完成 CLI 就说完整产品完成。
- 只完成前端样例就说生产级 Web 工作台完成。
- mock provider 通过就说真实 provider 已接入。

当前 v0.1 允许声明为“本地优先系统通过验收”。不得把它表述为“生产级托管平台已完成”，因为真实 provider、npm 分发、HTTP 服务、Web/API 持久化接入、团队账户权限与同步仍属于 post-v1。
