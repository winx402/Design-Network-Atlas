# DNA 测试策略

状态：active
最后审阅：2026-06-27
来源级别：authoritative test strategy
上游输入：[系统技术设计](../design/system-architecture.md)、[阶段开发路线图](../implementation/development-roadmap.md)

## 1. 测试原则

- 每个开发阶段必须先定义测试，再实现功能。
- 测试必须覆盖该阶段交付边界，不能只覆盖 happy path。
- 阶段测试通过只代表该阶段完成，不代表完整系统完成。
- 基础完整系统只有在 Phase 11 全量验收通过后才能宣布完成。
- Phase 12-16 属于本地优先系统的增强能力，必须单独声明、单独测试，不能反向修改 Phase 11 的完成口径。
- 当前本地优先能力已按公开阶段验收口径覆盖到 Phase 28，并补充场景 skill、DNA Read-only Explorer、provider 安全和 exchange manifest 验收；post-v1 能力必须单独声明，不能混入当前完成声明。

## 2. 测试分层

| 测试类型 | 覆盖对象 | 运行命令 |
| --- | --- | --- |
| unit tests | schema、状态机、编译、审查、影响分析 | `pnpm vitest run packages/core` |
| contract tests | repository / service ports 的统一行为 | `pnpm vitest run packages/*/contract` |
| integration tests | SQLite、CLI、import/export、adapter | `pnpm vitest run packages/sqlite apps/cli` |
| golden tests | prompt、brief、review summary、Git export | `pnpm vitest run **/*.golden.test.ts` |
| E2E tests | PRD 13 条端到端场景 | `pnpm e2e` |
| UI tests | DNA Read-only Explorer 前端状态流与浏览器 QA | `pnpm vitest run apps/web` |
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
| Phase 7 | scenario skill tests | Skill 将复杂场景映射到建模/编辑工作流，不复制 CLI help，不直接写库 |
| Phase 8 | adapter contract + security | provider 失败不污染正式数据，API key 不落盘 |
| Phase 9 | web unit + browser QA | 早期结果视图主要流程可操作；Phase 28 Explorer 无布局重叠 |
| Phase 10 | server/local contract tests | local 和 server adapter 行为一致，权限生效 |
| Phase 11 | full E2E + release checks | PRD 13 条验收场景全通过 |
| Phase 12 | result library schema + SQLite + CLI | 图谱和结果库多对多，输出引用可不用 DNA 结果库 |
| Phase 13 | routing unit + SQLite + CLI E2E | 输出引用按策略路由到挂载，显式挂载优先 |
| Phase 14 | graph tree unit + CLI E2E | 多 root、多父节点和附加关系输出清晰；`--include-groups` 可审阅 groups、memberships、ungrouped nodes 和 group relations |
| Phase 15 | HTTP API + sync + provider baseline | API 可读本地数据，网页默认关闭，routing fallback/metadata 生效，generation jobs 可导入导出 |
| Phase 16 | change-set/proposal review CLI E2E | preview change-set 可 list/show/review/apply/discard；proposal 可批量导入建模草案；export profile 可区分 full、review-current 和 proposal-review |
| Phase 24 | modeling intake quality + facet closure + planned phenotype CLI E2E | `context create --version` 不被 root version 截获；facet definition/schema/assignment 有 service/change-set 写入路径；`dna.modeling-batch.v1` 支持 facets 与 `phenotypePlans`；import report 紧凑且显式 review stage；`modeling check` 对 batch/graph/proposal 输出稳定 findings |
| Phase 26 | generation planning orchestration | `PhenotypeGenerationPlan`/`PhenotypeGenerationTask` schema、planned phenotype `productionSliceRole`、task `productionIntent` synthesis、service expansion、CLI preview/apply、task-linked generation、export/import、read-only API/workbench 和 secret redaction |
| Phase 27 | phenotype version lifecycle | `PhenotypeVersion` candidate/accepted/replaced/rolled-back lifecycle、feedback metadata、single accepted invariant、task/job provenance projection、export/import 和 secret redaction |
| Phase 28 | Web read-only information architecture | `/api/workbench/snapshot` server-side view model；Atlas Map、Graph Explorer、Generation Board、Phenotype Library、Inspector；安全图库预览；empty/error/missing 状态；移动端无宽表和文本溢出 |
| Phase 29 | generation update + scoped reference generation | `generation-plan update` / `generation-task update` 默认 preview、apply 后只改 mutable orchestration metadata；批量 task selector 防止 update-all 并跳过已有执行链接；graph/group scoped `reference-generation` 不创建 synthetic phenotype records；external reference completion 需要 active linked asset evidence 并支持 atomic `link-asset --mark-generated`；`replace-asset` 覆盖 local -> Eagle pointer migration、旧 pointer 归档、新 pointer current evidence、URI storageType 推断和冲突拒绝；reference jobs/assets export/import round-trip 且脱敏私密链接和 provider credentials |
| Phase 31 | phenotype usage guide | `PhenotypeUsageGuide` schema/defaults、同 phenotype 单 active guide、revision update、CLI preview/apply、compile/generation usageGuideSnapshot、GenerationJob input snapshot、export/import `usage-guide.json/md`、Web Inspector coverage、skill contract 和 secret/project-path redaction |
| Phase 33 | managed generation execution evidence | `GenerationJob` evidence schema/defaults、managed mock-runner run/verify services、external-linked ceiling、strict/warn phenotype-version acceptance gate、CLI `generation-job show/run/verify`、task-backed `phenotype generate --runner`、SQLite export/import round-trip 和 secret/raw provider payload redaction |

## 4. 关键测试数据

最小测试图谱必须包含：

- 两套 graph。
- 两个 template pack。
- 多个 root nodes。
- 一个 species-first node。
- 一个后补节点级 DesignRelationship 的 node。
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
- `NodeVersionSchema` 保存 parent node versions、incoming relationship ids、resolved gene snapshot、compile snapshot。
- `DesignRelationshipSchema` 接受 graph/group/node 三种同层级 endpoint。
- `DesignRelationshipSchema` 保存 relationship type、direction、designContract、auxiliaryRefs、review/provenance metadata。
- `PhenotypeSchema` 支持 built-in、template、custom 三种表型类型来源。
- `PhenotypeSchema` 支持 `planned` 状态、bounded `outputPlan` 和可选 `productionSliceRole`，用于 batch/planned phenotype coverage 与同一 graph/node/type 下的多生产切片。
- `PhenotypeVersionSchema` 默认状态为 `candidate`，并支持多个 asset ids 和轻量 `feedback` lifecycle metadata。
- `AssetIndexSchema` 支持多种 storage type、asset type、role、variant role。
- `GenerationJobSchema` 保存输入快照、输出快照和非敏感工具参数。
- `ReviewRecordSchema` 保存缺失维度、约束违反、风格距离摘要、人工确认状态。
- `ImpactRecordSchema` 保存 changed object、affected object、建议动作和 review status。
- `ChangeSetSchema` 支持 `preview-confirm`、`draft-write`、`changeset-apply` 三种模式。

### 5.2 Phase 2 Service / Change-Set Cases

- `createGraph` preview 只返回 change-set，不写 repository。
- `createGraph` apply 写入 graph 并返回 applied change-set。
- `createNode` 自动创建初始 `NodeVersion`。
- `createRelationship` 更新目标 node lineage 状态但不覆盖旧 node version。
- `updateNode` 创建新 `NodeVersion`，旧版本仍可查询。
- `applyChangeSet` 遇到 repository error 必须 rollback。
- `draft-write` 写入对象状态为 draft，并保留输入快照。
- `changeset-apply` 只能 apply 未应用的 change-set。

### 5.3 Phase 3 SQLite Cases

- migration 可在空库重复运行。
- 所有表存在，包含 PRD 指定核心表。
- graph、template、node、design relationship、phenotype、asset、review、impact CRUD 成功。
- `NodeVersion`、`PhenotypeVersion` 没有通用内容 update 入口。
- rollback 后 graph/node/design relationship 都不残留。
- 归档 graph 不删除其 nodes、relationships、phenotypes。
- asset search 支持 tag、status、linked object、graph 过滤。
- Git 目录 export/import 后对象数量和核心 id 一致。

### 5.4 Phase 4 CLI Cases

- `dna --help` 显示产品名和命令清单。
- 所有写入命令默认输出 `ChangeSet preview`。
- 所有写入命令加 `--yes` 后才落库。
- `dna graph create/list/show/archive` 覆盖图谱生命周期。
- `dna node create` 支持 root、species-first、多父节点。
- `dna relationship create` 支持 relationship type、contract、review fields。
- `dna export/import` 可在新库重放。
- CLI 错误时退出码非 0，并输出可读错误。

### 5.5 Phase 5 Compile / Phenotype Cases

- `system-rule-first` 按父节点、DesignRelationship、node、task 顺序合并基因。
- 冲突必须进入 conflict list，不允许静默覆盖。
- `snapshot-fixed` 使用已保存 snapshot，不重新计算父节点链。
- 同一物种可生成 `image-prompt`、`art-brief`、`review-checklist`。
- 表型版本记录 graph id、node version id、relationship trace、compile policy。
- 一个 phenotype version 可以关联 size、angle、format、crop 多个 asset variants。
- golden prompt / brief 在无设计规则变更时稳定。

### 5.6 Phase 6 Review / Impact Cases

- node review 能发现缺失 required dimensions。
- phenotype review 能发现 prompt / brief 缺失必须保留母题。
- style distance 能列出 shared motifs、different motifs、different constraints。
- 父 node 变化影响所有下游 node 和 phenotype versions。
- DesignRelationship 变化影响目标 node 及其下游。
- impact check 不自动创建新 phenotype version。
- rejected / replaced phenotype version 保留 lifecycle feedback reason。

### 5.7 Phase 7 Skill Cases

- 不保留浅层 `dna` 路由/CLI 说明 skill；CLI 命令说明由 `dna --help` 和子命令 help 承担。
- `dna-graph-modeling` 能把新场景映射到 SpeciesNode、DesignRelationship、facets、Phenotype、phenotype library 和生效策略。
- `dna-graph-editing` 能对已有图谱变更输出合理性、影响分析、风险等级、outdated 风险、替代方案和推荐写入路径。
- `dna-phenotype-generation` 是正式 MVP 场景 skill，覆盖 missing compile artifact、blocking open questions、generationPlan、planningMode、planOrTaskProposal、versionBinding、registrationPlan 和 writeStrategy。
- generation orchestration 测试覆盖 plan/task update preview/apply、immutable identity/trace links、batch selector safeguards、referenceGenerationJobIds/referenceAssetIds/contextReferenceIds 只保存 id、graph/group scoped reference generation、reference AssetIndex pointers、external completion preview/apply、atomic `link-asset --mark-generated`、reference asset pointer replacement/migration、managed runner evidence、verification summary、strict provenance acceptance gate，以及 export/import/security redaction。
- Layered compile golden tests 覆盖 atlas、graph、species-group、species-node、phenotype frame 顺序，dependency vector，staleness/current/historical 判断，decision request/patch replay，以及 compile feedback 不改写上游 graph/context/facet/template facts。
- Skill 不建议保存 provider credentials、完整私密链接或 raw Agent host responses。
- Skill 不把未经确认的 LLM 推断写入正式图谱，也不直接写数据库内部结构、导出目录或外部素材库。

### 5.8 Phase 8 Adapter / Security Cases

- mock provider 成功返回后创建 generation job。
- provider 失败时不创建 accepted phenotype version。
- provider 失败只保存 provider name、failure category、可选 HTTP status 和安全 retry hint。
- API key、password、secret、private key 不进入 DB、export、log。
- adapter 只保存 provider name、model name、非敏感参数、asset pointer。

### 5.9 Phase 9 Web Explorer Baseline Cases

- 早期表型结果视图可以搜索表型、标签、状态；Phase 28 后默认入口已收敛为 DNA Read-only Explorer。
- 表型详情展示版本列表、素材组、review records。
- `dna serve --web` 暴露只读本地 Explorer。
- 空 SQLite store 显示空状态，API 失败显示非破坏性错误状态。
- Web MVP 不显示 accept / reject / archive 等持久写按钮。
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

### 5.12 Phase 12 Result Library / Output Reference Cases

- 一个图谱可以绑定一个或多个结果库。
- 一个结果库可以绑定一个或多个图谱。
- 一个结果库可以包含 Eagle、Git、NAS、engine export 等多个 storage mounts。
- output reference 可以直接记录外部位置，不要求启用 DNA 结果库。
- external library mapping 能记录 tags、folders、rating、collections、annotations 等字段对齐关系。

### 5.13 Phase 13 Routing Policy Cases

- resolver 只选择 active policy。
- priority 高的 policy 优先，priority 相同按 routingPolicyId 稳定排序。
- target mount active 时使用 target。
- target mount 缺失或不可用时，如果 fallback mount active，使用 fallback。
- `metadataDefaults` 会自动补到 output reference metadata。
- 显式 metadata 覆盖 defaults。
- `requiredMetadata` 缺失时 CLI 写入失败。
- 显式 `--storage-mount` 优先于 routing policy。

### 5.14 Phase 14 Graph Tree Cases

- 多 root 节点按 graph rootNodes 顺序输出。
- 主父节点关系进入主树。
- 多父节点/融合关系进入 additionalRelations，不伪装成单父树。
- 文本输出展示物种名称、node id、谱系状态和附加关系。
- JSON 输出保留 roots、relations、additionalRelations，供后续 Web 或 Agent 使用。

### 5.15 Phase 15 Local Production Baseline Cases

- local HTTP API `GET /api/health` 返回版本和 SQLite 状态。
- local HTTP API 能返回 graph tree 和 workbench generated-result snapshot。
- local HTTP API 能返回 generation plan/task 只读摘要，workbench snapshot 包含 generationPlans 和 generationTasks。
- HTTP web page access 默认关闭，访问 `/` 返回 404。
- 显式开启 `webEnabled` 或 `dna serve --web` 后才返回只读 DNA Explorer HTML 页面。
- `provider run-mock` 能生成 sanitized generation job。
- generic HTTP provider 通过注入 fetcher 调用外部 endpoint，runtime headers 不进入 job。
- `sync export/import` 能重放 graph、generation job 和相关引用。
- `dna.project.json` manifest 包含 projectVersion、exchangeVersion 和 capabilities；不支持的 exchangeVersion 必须明确失败。
- `sync export/import` 能重放 facets、contexts、atlases、groups、group memberships/relations、entity/species/phenotype compile artifacts、dependency vectors、generation plans、generation tasks、generation jobs、output references、reviews、impacts 和 change-sets。
- `library bind-graph` 后导出的 `library.json.graphIds` 与 binding 保持一致。
- 旧库已经存在 binding 但 `library.graphIds` 为空时，重新执行 SQLite migration 后会自动回填，并且导出的 `library.json.graphIds` 不为空。

### 5.16 Phase 16 ChangeSet Review Workflow Cases

- preview create node 不写正式 node，但生成 preview change-set。
- `changeset list --status preview` 能看到待审阅 change-set。
- `changeset show <id>` 能展示 preview summary、diff 和 payload。
- `changeset review <id>` 能输出 pass / needs-review / fail、缺失维度、约束问题和建议动作。
- `changeset apply <id>` 会正式写入 graph/node/relationship，并把 change-set 标记为 applied。
- `changeset discard <id>` 会标记 discarded，且后续 apply 会失败。
- `--mode changeset-apply --change-set <id>` 可在 graph/node/relationship create 命令上引用既有 preview change-set，不要求重复 create 参数。
- Git-friendly export/import 保留顶层 `change-sets/` 目录。
- `dna export --profile review-current` 不生成 `change-sets/` 或 `proposals/`，manifest 记录省略摘要，且当前正式 state 可导入。
- `dna export --profile proposal-review --proposal <id>` 只导出目标 proposal 与 linked change-sets，遇到缺失 change-set 必须失败。
- `dna proposal import-batch --in <file>` 接受 `format: "dna.modeling-batch.v1"`，默认生成 proposal + 有序 preview change-sets，不写正式 graph/node/group/library objects。
- `dna proposal import-batch --in <file>` 的默认报告必须是紧凑 review-oriented report；完整 change-set ids 只能通过显式 JSON/id 输出取得。
- `dna.modeling-batch.v1` 支持 `facetDefinitions`、`facetSchemas`、`facetAssignments` 和带 `productionSliceRole` 的 `phenotypePlans`，并对 duplicate id、引用、allowed values、planned phenotype graph/node/type/slice target、expected asset type 做 all-or-nothing validation。
- `dna modeling check` 可检查 batch、persisted graph 和 proposal package，输出 stable JSON + text，并覆盖 species phenotype readiness、graph split quality、group quality、relationship contract quality、context/facet coverage 和 review readiness。
- invalid modeling batch 必须 all-or-nothing 失败，不留下 proposal、change-set 或正式对象。
- `dna graph tree --include-groups` 在默认 tree 之外展示 `Groups:`、`Ungrouped nodes:` 和 `Group relations:`；默认 text/json 输出保持兼容。

### 5.17 Phase 28 Web Read-only IA Cases

- `GET /api/workbench/snapshot` 返回 server-side view model，包含 Atlas Map、Graph Explorer、Generation Board、Phenotype Library、results/gallery preview 和 Inspector 所需摘要。
- `GET /api/workbench/graph-map`、`GET /api/workbench/graphs/:graphId`、`GET /api/workbench/generation` 和 `GET /api/workbench/library` 提供只读 view model，前端不直接拼大量底层 repository 数据。
- Web 默认首页是 Atlas Map，一级导航包含 Atlas Map、Graph Explorer、Generation Board、Phenotype Library，且不展示写入按钮，不调用 mutating endpoint。
- Graph Explorer 必须展示 group lanes、species cards、DesignRelationship、bound semantics、phenotype overlay 和 compile trace；不能只展示数量或默认 Raw JSON。
- Generation Board 必须展示 plan/task/job/version/result trace path；Phenotype Library 默认展示 gallery，安全图片 preview 可显示缩略图，不可访问、不可支持或敏感 URI 展示明确占位。
- Snapshot 和页面源数据不得包含 API key、provider credentials、runtime credentials、raw provider payload、完整私密链接或不必要的本机绝对路径。
- API failure、empty store、missing graph、missing linked object 均有明确只读错误或空状态。
- 桌面和移动浏览器 QA 必须验证无文本重叠和水平溢出；移动端使用紧凑导航、Map/Graph drill-down、filter sheet/detail drawer 和单/双列 gallery，而不是桌面宽表压窄。

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

v0.1 作为历史基础边界，允许声明为“本地优先基础系统通过验收”。不得把它表述为“生产级托管平台已完成”，因为真实 provider、npm 分发、托管 HTTP 服务、完整 Web/API 客户端、团队账户权限与同步仍属于 post-v1。

当前 v0.2 允许补充声明“结果库路由策略通过验收”。不得把它表述为“成熟 DAM 或生产级 Web 素材库已完成”，因为缩略图服务、二进制生命周期、批量整理、外部库实时同步和生产级 Web/API 仍属于后续阶段。

当前 v0.3 允许补充声明“图谱树状输出通过验收”。不得把它表述为“完整图谱可视化工作台已完成”，因为交互式布局、折叠筛选、Web 图谱编辑和大规模图布局仍属于后续阶段。

当前 v0.4 允许补充声明“本地 HTTP API、provider baseline、显式 sync、routing fallback/metadata 和 library graphIds 同步通过验收”。不得把它表述为“完整团队素材平台已完成”，因为生产 Web 客户端、团队账户权限、审批流、多人同步服务、缩略图服务和外部素材库实时同步仍属于后续阶段。

当前 v0.4.1 允许补充声明“历史结果库 graphIds 迁移修复通过验收”。不得把它表述为“通用迁移框架已完成”，因为后续 schema 级升级、迁移版本表和跨存储迁移仍需要单独设计。

当前 v0.5.0 允许补充声明“preview change-set 审阅确认闭环通过验收”。不得把它表述为“完整 proposal/batch 审批系统已完成”，因为多节点/多边命名 proposal、tree diff、Web 审批和团队权限仍属于后续阶段。

当前 v0.6.0 允许补充声明“图谱建模和图谱编辑场景 skill 通过验收”。不得把它表述为“自动完成所有领域图谱设计”，因为 skill 仍需要用户确认关键设计事实，且 generation guidance、phenotype library governance、proposal/batch UI 仍属于后续增强。

当前可补充声明“图谱建模、图谱编辑和表型生成 MVP 场景 skill 已有公开测试覆盖，Web 是只读本地工作台基线，交换格式已有版本化 manifest”。不得把它表述为“所有 DNA skill 已完整”“真实一方 provider package 已完成”或“生产级 Web 客户端已完成”，因为表型库治理 skill、第一方真实模型 provider、Web 审批和团队同步仍属于后续增强。
