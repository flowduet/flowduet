---
"@flowduet/designer": minor
"@flowduet/form-create": minor
---

多表单管理与审批节点显式覆盖（迭代三 #73）：

- designer：`NodeDrawer` 新增中立表单接缝 `formOptions`（由 `DingtalkDesigner` 自动下传）——表单集成模式下审批节点的自由文本 formKey 占位升级为目录选择：继承默认（选项内呈现当前默认表单名）/ 显式覆盖 / 目录外 key 只读项保留可改选修复；同名表单选项附 ID 区分（A05）；不传 `formOptions` 的纯流程宿主保持自由文本合同（A17）。网关与抄送不出现覆盖入口（A19）。
- form-create：`FlowDesignSession.deleteForm(id)` 表单删除守卫（A06）——被流程默认或任意审批节点引用时拒绝并列出全部引用位置，解除或调整全部引用后才可删除；新增 `collectFormUsage(model, id)` 引用位置收集器。`FormManager` 面板补删除入口（两段确认），未绑定表单随时可删（A08 反向面）。
- 基准：core 新增 `form-override` 编译与往返基准（流程默认 + 单签/或签继承 + 会签/依次覆盖复用同一 key + 网关与抄送在场），Flowable 6.8 部署冒烟扩展运行时断言——显式覆盖 formKey 经引擎任务查询可读、继承节点不固化（task.formKey=null）、多节点复用同一覆盖 key 逐节点可读。
