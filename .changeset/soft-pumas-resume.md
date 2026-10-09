---
"@flowduet/core": minor
"@flowduet/designer": minor
"@flowduet/form-create": minor
---

未完成设计的保存续编公开边界（迭代三 #76）：

- `DingtalkDesigner` 新增 `commitPendingChanges()` 组件方法与 `draft-change` 事件：宿主在保存设计文档前调用即可把抽屉里已输入未确认的变更经与「确定」同一套守卫写入模型；守卫拦截（如多人集合变量格式非法）返回 `false` 且抽屉保持打开，不绕过守卫落半写模型。抽屉字段被编辑时上抛 `draft-change`，未提交输入也计入宿主的未保存判定。
- `FormManager` 新增 `commitPendingEdit()` 与 `hasOpenEditor()` 组件方法，`FormDesigner` 新增 `exportContent()`：保存前可收集表单编辑器里尚未保存的 rules/options，序列化与守卫路径和「保存表单内容」按钮完全一致。
- 节点抽屉改为非模态展示：切换编辑目标前提交当前缓冲，格式非法时保留原节点与输入。

- `BpmnModel.addApprovalTask(spec, options)` 与 `DingtalkDesigner#commitPendingChanges(options)` 支持显式 `{ allowIncomplete: true }` 草稿路径：集合变量与收件人尚未配置时可保存恢复，非空非法格式仍拦截；默认确认和部署导出保持严格。内核只容许集合业务缺失，不放开 mode、元素变量或字段类型守卫。
- 表单收集序列化异常可见反馈并保留编辑器；Playground 用保存请求序号与设计替换序号阻止迟到结果覆盖较新草稿或反馈。

- 保存前收集表单当前焦点控件的未提交值；表单 `draft-change` 事件贯穿编辑器、管理面板与宿主编辑世代，保存期间的新输入不被误标为已保存。Playground 切换视图前收集抽屉缓冲，格式非法时保持原视图和选中态。
