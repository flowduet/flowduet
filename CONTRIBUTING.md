# 贡献指南

## 分支与提交

- 集成分支为 `develop`；feature 分支命名 `feat/<issue 号>-<短横线摘要>`，经 PR（squash）合入。
- 提交信息遵循 [约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0/)，中文描述（详见 AGENTS.md）。
- CI 在 PR 上跑 Node 22 / 24 双矩阵：`pnpm lint` + `pnpm test` + `pnpm build`，绿了才可合并。
- 影响公开包 `@flowduet/core` 或 `@flowduet/designer` 的 PR 应附 changeset：运行 `pnpm changeset`，选择实际受影响的包和版本类型。纯文档或仅改私有 Playground 的 PR 不需要发包 changeset。

## 发版（Changesets，人工流程）

当前公开包为 `@flowduet/core` 与 `@flowduet/designer`；`@flowduet/playground` 是私有验收宿主。发包仍由维护者手动执行，CI 不会自动发布。发布期间避免继续向 `develop` 合并其他变更，使版本 PR、npm 产物与 Git tag 指向同一提交。

### 1. 确定发布范围

从最新、干净的 `develop` 开始，确认本轮功能 PR 和 changeset 已合入。运行 `pnpm changeset status`，逐包核对待发布版本及 changeset 内容；再用 npm 官方 registry 核对已发布版本，防止重复发布。历史版本（包括 designer 0.0.2）保留原记录，不撤包、不复用版本号。

```sh
pnpm changeset status
npm view @flowduet/core version dist-tags --json --registry=https://registry.npmjs.org/
npm view @flowduet/designer version dist-tags --json --registry=https://registry.npmjs.org/
```

### 2. 准备并评审版本 PR

从 `develop` 新建分支，运行 `pnpm version-packages`：它调用 Changesets 消费已累积的 changeset，并更新包版本与 CHANGELOG。检查两个公开包的版本、内部依赖、CHANGELOG 和锁文件；如锁文件需要更新，一并纳入 PR。版本 PR 以 `develop` 为目标，评审通过且 Node 22/24 CI 全绿后再合并。不要在未经评审的本地版本状态直接发布。

### 3. 验收版本化产物

对版本 PR 的实际提交运行以下门槛，并保存结果；其中 `pnpm smoke` 需要可用的 Docker。PR CI 自动执行 lint、test、build；Flowable 6.8 冒烟仅本地或手动触发的 Smoke 工作流执行，并非 PR CI 的一部分。

```sh
pnpm lint
pnpm test
pnpm build
pnpm smoke
pnpm --filter @flowduet/core pack --dry-run --json
pnpm --filter @flowduet/designer pack --dry-run --json
```

`pack --dry-run` 只检查拟装包内容。还需将两个公开包实际打成 tarball，在临时空项目同时安装并验证公开入口、CSS 与依赖解析。`realpath` 保证 macOS 上 npm 记录的本地 tarball 路径与真实路径一致：

```sh
FLOWDUET_PACK_DIR="$(realpath "$(mktemp -d)")"
pnpm --filter @flowduet/core pack --pack-destination "$FLOWDUET_PACK_DIR"
pnpm --filter @flowduet/designer pack --pack-destination "$FLOWDUET_PACK_DIR"

FLOWDUET_CONSUMER_DIR="$(realpath "$(mktemp -d)")"
printf '%s\n' '{"name":"flowduet-release-check","private":true,"type":"module"}' > "$FLOWDUET_CONSUMER_DIR/package.json"
npm install --prefix "$FLOWDUET_CONSUMER_DIR" --registry=https://registry.npmmirror.com \
  "$FLOWDUET_PACK_DIR"/flowduet-core-*.tgz \
  "$FLOWDUET_PACK_DIR"/flowduet-designer-*.tgz 'vue@^3.5.0'
(
  cd "$FLOWDUET_CONSUMER_DIR"
  npm ls --depth=0
  node --input-type=module - <<'NODE'
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BpmnModel } from '@flowduet/core';
import { exportXml } from '@flowduet/designer';
if (typeof BpmnModel !== 'function' || typeof exportXml !== 'function') throw new Error('公开导出缺失');
if (!existsSync(fileURLToPath(import.meta.resolve('@flowduet/designer/style.css')))) throw new Error('样式入口缺失');
NODE
)
```

对于本轮新增的设计器导出场景，另将 Playground 生成的有效 XML 在 Flowable 6.8 部署验证；现有 `pnpm smoke` 主要覆盖仓库基准文件，不能代替该场景验收。任何门槛未通过时停止发布并记录原因。

### 4. 发布与读回

版本 PR 合并后，重新拉取 `develop` 并确认工作树干净、提交与已验收的版本一致；确认具备 `@flowduet` 的 npm 发布权限，然后在仓库根目录执行 `pnpm build && pnpm release`。`release` 调用 `changeset publish`，检查各包的当前版本是否已在 npm 发布，仅发布尚未存在的版本，并在本地自动生成 `<包名>@<版本>` tag（如 `@flowduet/designer@0.0.5`）。不要逐包执行 `npm publish`，也不要手工创建裸 `v` tag。

发布后从 npm 官方 registry 读回每个实际发布包的版本与 dist-tag，核对本地生成的 tag，再用 `git push origin develop --follow-tags` 推送这些 tag，并读回远端 tag。若发布部分成功或网络中断，先核对 npm 与 Git 的实际状态，再决定如何恢复，不重复发布已存在的版本。

```sh
npm view @flowduet/core version dist-tags --json --registry=https://registry.npmjs.org/
npm view @flowduet/designer version dist-tags --json --registry=https://registry.npmjs.org/
git tag --points-at HEAD
git push origin develop --follow-tags
git ls-remote --tags origin
```

参见 [Changesets 命令说明](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md)及[手动版本 PR 流程](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md)。

## 部署冒烟

`pnpm smoke`——本地 Docker 启动 Flowable 6.8，把编译合同基准 XML 真实部署并断言
流程定义注册（详见 `scripts/smoke-deploy.sh` 头注释；CI 侧为 `workflow_dispatch` 手动触发）。
