# 贡献指南

## 分支与提交

- 集成分支为 `develop`；feature 分支命名 `feat/<issue 号>-<短横线摘要>`，经 PR（squash）合入。
- 提交信息遵循 [约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0/)，中文描述（详见 AGENTS.md）。
- CI 在 PR 上跑 Node 22 / 24 双矩阵：`pnpm lint` + `pnpm test` + `pnpm build`，绿了才可合并。
- 带 `@flowduet/core` API 变更的 PR 必须附 changeset：`pnpm changeset` 按提示写一份。

## 发版（changesets，人工首发流程）

1. **版本**：`pnpm changeset version`——消费已累积的 changeset，更新版本号与 CHANGELOG；
2. **评审**：版本变更走 PR（squash）合入 develop，CI 绿后合并；
3. **发布**：合并后 `pnpm build && cd packages/core && npm publish --access public`
   （`publishConfig.registry` 已钉死官方源；首发需本机 `npm login`，Granular Token 权限 Read and write）；
4. **打标**：`git tag v0.x.0 && git push origin v0.x.0`。
   CI 自动发包（NPM_TOKEN + changesets action）待 release 流程稳定后接入。

## 部署冒烟

`pnpm smoke`——本地 Docker 启动 Flowable 6.8，把编译合同基准 XML 真实部署并断言
流程定义注册（详见 `scripts/smoke-deploy.sh` 头注释；CI 侧为 `workflow_dispatch` 手动触发）。
