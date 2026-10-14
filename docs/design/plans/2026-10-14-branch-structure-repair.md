# 支路结构修复实施清单

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 已获用户明确授权在当前会话开始实施，逐项执行，无需再次询问执行方式。

**Goal:** 修复阶段零七项结构失败及补充边界。
**Architecture:** designer 原位修改审批形态；core 提供目标重接并维护引用和 DI；删除前预计算集合；compiler 对 DI 容器做异常恢复。
**Tech Stack:** TypeScript、bpmn-moddle、Vue 3、Vitest；不新增依赖。
**Spec:** docs/design/2026-10-14-branch-structure-repair-proposal.md（用户于本轮确认，包括整图自动布局取舍）。

## Global Constraints

- 保留存续对象引用、ID、条件/default、顺序；不重建同名对象。
- 不放宽普通确认/部署校验；仅显式 allowIncomplete 允许业务缺项。
- 删除重接使旧路线失效，预览整图 derived；默认 Identity 编译不自动降级。
- 只改前置结构及回归，不引入工作台、主题或生命期缓冲实现。
- 基线 origin/develop a72dc9d；非票变更使用 refactor/branch-identity-preservation；不推送、开 PR、合并。

## Review Focus

- 自定义 loop 属性不能随多→单转换静默丢失：任务 1 测试未知属性、扩展、标准循环。
- 非法/损坏图必须写入前拒绝：任务 2 测试跨边界及不一致引用，比较拒绝前后 XML 和对象。
- 多图 DI 按对象清理：任务 2 测试非标准 DI ID、其他图元素保留。
- 编译序列化失败不得留下新 DI：任务 3 注入序列化拒绝，验证原容器恢复。
- 原位修改不能丢刷新：任务 3 真实 Playground 编辑、双视图、保存恢复。

### Task 1: 审批原位转换

**Files:** packages/designer/src/operations.ts；packages/designer/src/branch-preservation.test.ts；packages/designer/src/approval-preservation.test.ts。
**Interfaces:** 保留 convertApprovalToMulti/convertMultiToSingle 调用签名；新增私有 loop 支持形态检查。

- [ ] 迁入 8 个基线合同，修正相对 import；运行 `pnpm --filter @flowduet/designer test src/branch-preservation.test.ts`，Expected: 7 failed / 1 passed。
- [ ] 添加引用、DI、三种 mode、未知字段、非法 loop/输入拒绝无变更测试，先观察相关失败。
- [ ] 原位设置/删除 loop、更新/清空 assignee，保留其余任务及连接；所有守卫先执行。
- [ ] 运行转换相关测试及 designer 既有测试，Expected: 转换新增用例通过，仅保留未处理的 3 个删除失败。
- [ ] 提交 `fix(designer): 原位转换审批形态并保留连线身份`。

### Task 2: 安全重接与结构删除

**Files:** packages/core/src/model/bpmn-model.ts；packages/core/test/structure-editing.test.ts；packages/designer/src/operations.ts；结构回归测试。
**Interfaces:** 产出 BpmnModel.retargetSequenceFlow(flowId: string, targetId: string): this；designer 消费该接口。

- [ ] 添加重接引用/顺序/default/DI、同目标无操作、非法引用拒绝测试，Expected: 新方法不存在而失败；删除 DI 残留断言失败。
- [ ] core 实现窄重接接口及私有 DI 清理 helper；既有删除方法接入清理。
- [ ] designer 删除前预计算并校验完整集合，保留入边再删除；补嵌套条件/default、并行、尾节点、整个默认支路删除测试。
- [ ] 运行 core/designer 测试，Expected: 七项原始失败全部转绿，边界通过。
- [ ] 提交 `fix(core): 安全重接支路并清理失效几何`。

### Task 3: 编译恢复与集成验证

**Files:** packages/core/src/compile/compiler.ts；core compiler 回归；packages/form-create/src/document.test.ts；docs/design/reviews/2026-10-14-branch-structure-repair-results.md；.changeset/。
**Interfaces:** compile 签名和默认布局不变；消费任务 2 的坐标失效行为。

- [ ] 添加 Identity/序列化失败恢复原 DI 测试，Expected: 现有先清图行为导致失败。
- [ ] 实现限定 DI 容器恢复；补缺失/混合 DI、显式竖排导出、顺序/表单绑定保存恢复测试。
- [ ] 运行 `pnpm test`、`pnpm build`、`pnpm lint`，Expected: 全部通过；既有告警如实记录。
- [ ] 在真实 Playground 验证带 DI 导入、单↔多转换、删除、双视图切换、保存重开；记录实际证据及限制。
- [ ] 提交编译恢复、changeset 与验收证据；按 executing-plans 做一次全分支独立复核，处理重要问题后重跑相关及完整测试。
