# 迭代二 · 钉钉式视图 MVP —— Spec 总纲

- 状态：已收敛（2026-09-20 grilling 会话，九项决策无遗留分歧）
- 时间盒：2026-10-08 → 10-22（两周）
- 里程碑：GitHub `iteration-2`
- 上游依据：ROADMAP「迭代二」章节、ADR-0003（双视图架构）、ADR-0004（钉钉式边界）、CONTEXT.md「审批节点」节

## 目标

把 ADR-0003「双视图共享同一棵模型树」的立项主张第一次落成代码证据：钉钉式视图五类节点可编辑、BPMN 画布只读投影、导出 XML 经 Flowable 6.8 真实部署成功。

## 范围

- **内核三扩展**（`packages/core`）：多实例用户任务（会签/或签/依次三档）、并行网关 + 排他网关默认分支、抄送节点（服务任务 + 适配器扩展属性）。
- **视图层**（`packages/designer`）：钉钉式五类节点递归组件 + 抽屉配置（Element Plus）。
- **只读投影**：Vue-Flow 只读画布，与钉钉式读写同一棵模型树。
- **验收宿主**（`apps/playground`）：最小页面挂载 designer，含 XML 导出预览。
- **冒烟扩展**：新元素基准文件全谱过 Flowable 6.8 部署冒烟。

## Spec 索引（拆票前逐份成稿）

| Spec | 内容 | 状态 |
| --- | --- | --- |
| [multi-instance-user-task.md](./multi-instance-user-task.md) | 内核：多实例用户任务三档（会签/或签/依次） | 骨架 |
| [parallel-gateway.md](./parallel-gateway.md) | 内核：并行网关 + 排他网关默认分支 | 骨架 |
| [cc-task.md](./cc-task.md) | 内核：抄送 = 服务任务 + 适配器扩展属性 | 骨架 |
| [dingtalk-view-mvp.md](./dingtalk-view-mvp.md) | 钉钉式视图：递归组件 + 抽屉 + playground 宿主 | 骨架 |
| [bpmn-readonly-projection.md](./bpmn-readonly-projection.md) | Vue-Flow 只读投影 | 骨架 |

流程纪律（v1 起）：spec 成稿 → 拆自包含票（挂里程碑 `iteration-2`）→ 每票新会话 `/implement` → feature 分支 → PR → develop。

## 出口标准

1. playground 五类节点编辑 → 导出 XML → Flowable 6.8 REST **真实部署成功**（冒烟扩到新元素全谱）；
2. 只读投影与钉钉式读写**同一棵模型树**，互切零转换；
3. 三条测试链（编译合同 / 往返保真 / 适配器合同）覆盖五类节点全谱；
4. `pnpm test` 全绿 + CI 绿；
5. `@flowduet/core` 0.2.0 + `@flowduet/designer` 0.0.x alpha 发布完成。

## 砍序

超期时按序砍：**只读投影 → 依次审批 → 抄送**。前两项砍任一项，出口标准第 2/3 条相应收缩并在里程碑收尾时明示。

## 显式不做

节点拒绝语义（运行时话题）、依次审批之外的完成策略细化、监听器 / 扩展属性高级面板、表单绑定协议（本迭代仅 formKey 占位字段）、BPMN 可编辑画布、7.2 / 8.0 部署冒烟。

## 九项决策

1. 主线 = 钉钉式视图 MVP + 内核最小配套；
2. 节点边界 = 五类（审批、条件分支、会签、抄送、并行分支）；
3. BPMN 视图 = Vue-Flow 只读投影进本迭代，可编辑画布留后；
4. 多实例形态 = 会签 / 或签 / 依次三档全上；
5. 抄送方言 = `bpmn:ServiceTask` + 适配器扩展属性（收件人）；
6. UI 组件库 = Element Plus；
7. 抽屉字段面 = 最小集 + 默认分支 + formKey 占位；
8. 时间盒 = 10-08 → 10-22 两周，砍序如上；
9. 发布 = core 0.2.0 + designer 公开 alpha，CI 自动发包不上。
