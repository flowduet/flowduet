# PR #84 最终审阅（2026-09-30）

审阅范围为整个 PR 相对 `develop` 的差异，包含此前 F01/F04 的修复与产品验收。审阅时 `develop` 为 `cf530a3`，原 PR head 为 `571daf7`；三点比较的共同祖先为 `d45041a`。AGENTS.md 的内联规则已在 develop 的 #86 存在，最终内容相同，不构成本 PR 额外变更。

## Standards

对源码、说明、changeset 与最终验收记录检查，未发现未解决的硬违规或实际风险。旧 A13 讨论涉及的非法子级、普通字段子规则和联动路径已修复。提供者编辑标记不会进入设计文档，没有引入第二份可写 schema。对下述追加修复再次审查，无新增问题。

## Spec

整个 PR 的最终审阅发现 1 项遗漏：`assertNoControl` 只检查 `control`，而 FormCreate 的 `loadRule/parseRule` 支持 `_control` 编辑别名。合法文档加上非空 `_control` 后，公开保存与打开原本均接受；提供者会将其还原为联动，违反 #74/A13 的范围要求。

已追加修复：保存/打开共用守卫现在同时检查 `control` 与 `_control`，覆盖字段、栅格行和列，非空或非法结构明确拒绝，空数组仍可往返。新增两项测试先实际失败（公开保存意外成功、规则守卫不拒绝），修复后通过。

Chrome 通过最新生产构建实际导入[联动别名复现文档](./74-browser-fixtures/control-alias.flowduet.json)，页面显示“规则「输入框（Fd2dmum0bpd0abc）」不支持组件联动（_control）”，无打开成功状态，先前有效设计的默认表单仍为 `form_1`。

追加修复经需求复核后无剩余阻断。八类字段、基础布局、默认值往返、试填隔离和文本最小链路沿用[最终修复复验记录](./74-final-fix-verification.md)的产品证据。

## 合并出口

本次本地 `pnpm lint`、`pnpm build` 通过，全量 `pnpm test` 为 core 90、designer 124、form-create 99、playground 17，共 **330 项通过**。最终 Standards 0 项、Spec 0 项未解决发现。合并前还须核对追加提交对应的 Node 22/24 CI，并锁定 PR head 后按仓库规则 squash 合入 develop；实际合并结果留在 PR 与 Issue 的关闭评论中。父规格部署、包消费与发布仍按对应实施票验收。
