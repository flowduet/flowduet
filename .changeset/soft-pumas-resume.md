---
"@flowduet/designer": minor
"@flowduet/form-create": minor
---

未完成设计的保存续编公开边界（迭代三 #76）：

- `DingtalkDesigner` 新增 `commitPendingChanges()` 组件方法与 `draft-change` 事件：宿主在保存设计文档前调用即可把抽屉里已输入未确认的变更经与「确定」同一套守卫写入模型；守卫拦截（如多人集合变量格式非法）返回 `false` 且抽屉保持打开，不绕过守卫落半写模型。抽屉字段被编辑时上抛 `draft-change`，未提交输入也计入宿主的未保存判定。
- `FormManager` 新增 `commitPendingEdit()` 与 `hasOpenEditor()` 组件方法，`FormDesigner` 新增 `exportContent()`：保存前可收集表单编辑器里尚未保存的 rules/options，序列化与守卫路径和「保存表单内容」按钮完全一致。
- 节点抽屉改为非模态展示：点击画布可切换编辑目标而不丢失抽屉缓冲，避免误点遮罩关闭抽屉导致未提交输入被放弃。
