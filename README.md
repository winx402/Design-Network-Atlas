# DNA: Design Network Atlas

> English | [中文](#中文)

DNA is a local-first, open-source system for design genome graphs. It helps teams model reusable design dimensions, stable design species, evolution relationships, generated phenotypes, asset pointers, reviews, and downstream impact.

The first release focuses on game-art visual assets and UI/icon assets, while keeping the core graph model domain-neutral.

## What DNA Is

DNA provides a structured way to manage design inheritance and variation:

- **Gene layer**: reusable design dimensions, constraints, and templates.
- **Species layer**: stable design objects such as icons, characters, props, interface components, or art-style families.
- **Evolution layer**: directional relationships from parent species to child species, including deltas, value resolution, must-preserve rules, and must-avoid rules.
- **Phenotype layer**: concrete generated or curated outputs for a specific task, with versions, reviews, and asset pointers.

DNA does not store binary assets by default. It stores asset indexes such as local paths, Eagle links, Figma links, object-storage URLs, or generated-output references.

## Current Features

- TypeScript monorepo with reusable core, storage, SQLite, CLI, template-pack, server-adapter, and web packages.
- SQLite local storage with import/export.
- `dna` CLI for graph, template, node, edge, phenotype, asset, review, impact, import, export, and version-history workflows.
- Built-in starter template packs for game-art visual assets and UI/icon assets.
- Compile policies including `system-rule-first` and `snapshot-fixed`.
- Prompt/brief generation for phenotypes.
- Review and style-distance utilities.
- Impact analysis for upstream node or edge changes.
- Mock generation-provider adapter with sensitive-parameter scrubbing.
- Asset workbench UI for search, version switching, review details, status transitions, asset groups, and outdated signals.
- Local/server collaboration adapters with permission checks and sync-conflict change-sets.
- Git-friendly JSON directory export format.

## Maturity

The current repository is a **v0.1 local-first release**. It is suitable for pilot use inside a design project, local graph governance, prompt/brief generation, asset indexing, review records, impact analysis, and Git-friendly exchange.

It is not yet a hosted production platform. npm package publishing, real image-model provider adapters, a persistent HTTP API, a web client connected to SQLite/API, and team account/sync workflows are post-v1 work.

The monorepo uses `private: true` in `package.json` to prevent accidental npm publishing. This does not mean the GitHub repository is private; the source is open under the MIT license.

## Use Cases

- Build a reusable visual-identity graph for a game project.
- Manage UI icon families and their style variants.
- Track how a parent design change affects downstream species and generated assets.
- Generate image prompts, art briefs, and review checklists from graph constraints.
- Keep multiple versions of a phenotype and record which species version produced each result.
- Register multiple assets for one phenotype version, such as size variants, angle variants, source files, and previews.
- Use DNA as a local-first design asset governance layer before integrating a production asset system.

## Quick Start

Requirements:

- Node.js 20+
- pnpm 11+

```bash
git clone https://github.com/winx402/Design-Network-Atlas.git
cd Design-Network-Atlas
pnpm install
pnpm test
pnpm typecheck
pnpm dna --help
```

Create a minimal graph:

```bash
pnpm dna --db .dna/dna.sqlite template install-builtins --yes

pnpm dna --db .dna/dna.sqlite graph create \
  --id graph-demo \
  --name "Demo Graph" \
  --purpose "Local test" \
  --template ui-icon-asset \
  --yes

pnpm dna --db .dna/dna.sqlite node create \
  --graph graph-demo \
  --id node-root \
  --name "Root Icon" \
  --motif broken-ring \
  --constraint color=red \
  --yes

pnpm dna --db .dna/dna.sqlite phenotype generate \
  --graph graph-demo \
  --node node-root \
  --type image-prompt \
  --name "Warning Icon Prompt" \
  --brief "toolbar warning icon" \
  --tool manual \
  --yes
```

Use DNA from another project:

```bash
alias dna='pnpm --silent --dir /path/to/Design-Network-Atlas dna'

cd /path/to/your-project
mkdir -p .dna
dna --db .dna/dna.sqlite graph list
```

## CLI Examples

Create an evolution edge:

```bash
pnpm dna --db .dna/dna.sqlite edge create \
  --graph graph-demo \
  --id edge-root-warning \
  --from node-root \
  --to node-warning \
  --type specialize \
  --direction "warning specialization" \
  --operation override \
  --delta semantic=danger \
  --value-resolution color=override \
  --preserve broken-ring \
  --avoid photorealistic \
  --yes
```

Register an asset pointer:

```bash
pnpm dna --db .dna/dna.sqlite asset add \
  --id asset-warning-preview \
  --uri "eagle://asset-library/warning-preview" \
  --linked-type phenotype-version \
  --linked-id pv-example \
  --tag ui \
  --variant-role preview \
  --yes
```

Check impact after an upstream change:

```bash
pnpm dna --db .dna/dna.sqlite impact check \
  --graph graph-demo \
  --node node-root \
  --changed-version node-root@2.0.0 \
  --yes
```

Export a Git-friendly project directory:

```bash
pnpm dna --db .dna/dna.sqlite export --out .dna/export
```

## Exchange Format

`dna export --out <dir>` writes:

- `dna.project.json`
- `templates/`
- `graphs/<graph_id>/graph.json`
- `graphs/<graph_id>/nodes/`
- `graphs/<graph_id>/edges/`
- `graphs/<graph_id>/phenotypes/`
- `graphs/<graph_id>/assets/`
- `graphs/<graph_id>/reviews/`
- `graphs/<graph_id>/impacts/`

## Development

```bash
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
```

## Roadmap

- Package the CLI for npm installation.
- Add production provider adapters.
- Add a persistent web API for team collaboration.
- Expand template packs for more design domains.
- Improve graph visualization and template editing in the web workbench.

## License

MIT License. See [LICENSE](LICENSE).

---

# 中文

DNA 是一个本地优先的开源“设计基因图谱”系统，用来管理设计维度、稳定设计对象、演化关系、生成结果、素材索引、审查记录和下游影响。

首发版本优先服务游戏美术视觉资产和 UI/图标资产，但核心图谱模型不绑定具体行业。

## DNA 是什么

DNA 用一套结构化方式管理设计继承和变体：

- **基因层**：定义可复用的设计维度、约束和模板。
- **物种层**：定义稳定设计对象，例如图标、角色、道具、界面组件、视觉风格族。
- **进化层**：定义从父物种到子物种的方向性演化关系，包括 delta、value resolution、必须保留、必须避免等规则。
- **表型层**：定义某次具体任务中生成或整理出的结果实例，包含版本、审查和素材索引。

DNA 默认不保存二进制素材，只保存素材索引，例如本地路径、Eagle 链接、Figma 链接、对象存储 URL 或生成结果引用。

## 当前能力

- TypeScript monorepo，包含 core、storage、SQLite、CLI、template-pack、server adapter 和 web workbench。
- SQLite 本地存储，支持导入导出。
- `dna` CLI 支持 graph、template、node、edge、phenotype、asset、review、impact、import、export、version-history。
- 内置游戏美术视觉资产和 UI/图标资产模板包。
- 支持 `system-rule-first` 和 `snapshot-fixed` 编译策略。
- 可以从图谱约束生成 prompt / brief。
- 支持节点审查、表型审查、风格距离。
- 支持上游物种或进化边变化后的影响分析。
- Mock 生成模型 provider adapter，并清理敏感参数。
- 资产工作台 UI 支持搜索、版本切换、审查详情、状态流转、素材组和 outdated 提示。
- local/server 协作 adapter 支持权限检查和同步冲突 change-set。
- 支持 Git 友好的 JSON 目录交换格式。

## 成熟度

当前仓库是 **v0.1 本地优先版本**。它适合在设计项目里试点使用，覆盖本地图谱治理、prompt / brief 生成、素材索引、审查记录、影响分析和 Git 友好目录交换。

它还不是生产级托管平台。npm 包发布、真实图片生成模型 provider、持久化 HTTP API、接入 SQLite/API 的 Web 客户端、团队账户与同步流程属于 post-v1 工作。

`package.json` 里的 `private: true` 用来防止 monorepo 被误发到 npm，不表示 GitHub 仓库是私有的；源码按 MIT License 开源。

## 适用场景

- 为游戏项目建立可复用的视觉资产图谱。
- 管理 UI 图标家族及其风格变体。
- 追踪父级设计变化会影响哪些下游物种和已生成素材。
- 基于图谱约束生成图片提示词、美术 brief、审查 checklist。
- 为同一个表型保留多个版本，并记录每个版本来自哪个物种版本。
- 为同一个表型版本登记多个素材，例如尺寸变体、角度变体、源文件和预览图。
- 在接入正式资产管理系统前，把 DNA 作为本地优先的设计资产治理层。

## 快速开始

要求：

- Node.js 20+
- pnpm 11+

```bash
git clone https://github.com/winx402/Design-Network-Atlas.git
cd Design-Network-Atlas
pnpm install
pnpm test
pnpm typecheck
pnpm dna --help
```

创建一个最小图谱：

```bash
pnpm dna --db .dna/dna.sqlite template install-builtins --yes

pnpm dna --db .dna/dna.sqlite graph create \
  --id graph-demo \
  --name "Demo Graph" \
  --purpose "Local test" \
  --template ui-icon-asset \
  --yes

pnpm dna --db .dna/dna.sqlite node create \
  --graph graph-demo \
  --id node-root \
  --name "Root Icon" \
  --motif broken-ring \
  --constraint color=red \
  --yes

pnpm dna --db .dna/dna.sqlite phenotype generate \
  --graph graph-demo \
  --node node-root \
  --type image-prompt \
  --name "Warning Icon Prompt" \
  --brief "toolbar warning icon" \
  --tool manual \
  --yes
```

在其他项目里使用 DNA：

```bash
alias dna='pnpm --silent --dir /path/to/Design-Network-Atlas dna'

cd /path/to/your-project
mkdir -p .dna
dna --db .dna/dna.sqlite graph list
```

## CLI 示例

创建进化边：

```bash
pnpm dna --db .dna/dna.sqlite edge create \
  --graph graph-demo \
  --id edge-root-warning \
  --from node-root \
  --to node-warning \
  --type specialize \
  --direction "warning specialization" \
  --operation override \
  --delta semantic=danger \
  --value-resolution color=override \
  --preserve broken-ring \
  --avoid photorealistic \
  --yes
```

登记素材索引：

```bash
pnpm dna --db .dna/dna.sqlite asset add \
  --id asset-warning-preview \
  --uri "eagle://asset-library/warning-preview" \
  --linked-type phenotype-version \
  --linked-id pv-example \
  --tag ui \
  --variant-role preview \
  --yes
```

检查上游变化影响：

```bash
pnpm dna --db .dna/dna.sqlite impact check \
  --graph graph-demo \
  --node node-root \
  --changed-version node-root@2.0.0 \
  --yes
```

导出 Git 友好目录：

```bash
pnpm dna --db .dna/dna.sqlite export --out .dna/export
```

## 交换格式

`dna export --out <dir>` 会写出：

- `dna.project.json`
- `templates/`
- `graphs/<graph_id>/graph.json`
- `graphs/<graph_id>/nodes/`
- `graphs/<graph_id>/edges/`
- `graphs/<graph_id>/phenotypes/`
- `graphs/<graph_id>/assets/`
- `graphs/<graph_id>/reviews/`
- `graphs/<graph_id>/impacts/`

## 开发

```bash
pnpm test
pnpm typecheck
pnpm e2e
pnpm security:test
pnpm docs:check
```

## 路线图

- 发布 npm CLI 安装包。
- 增加生产级生成模型 provider adapter。
- 增加团队协作服务端 API。
- 扩展更多设计领域的模板包。
- 强化 Web 工作台里的图谱可视化和模板编辑。

## 许可证

MIT License。详见 [LICENSE](LICENSE)。
