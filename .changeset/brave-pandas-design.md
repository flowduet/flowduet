---
"@flowduet/designer": minor
---

新增公开导出 `collectDraftIssues(model)` 与 `isCcServiceTask(element)`：草稿待修复项收集器与抄送形态判定谓词，与 `exportXml` 共用同一扫描口径。设计文档保存与打开侧（`@flowduet/form-create`）据此实现「保存成功 + 报告待修复项」与子集校验，不再需要宿主复制判断逻辑。`exportXml` 行为不变。

---

"@flowduet/form-create": minor
---

占位包转为可用的最小实现（迭代三 #71，本票不发布 npm）：

- 流程设计文档协议与编解码：`format=flowduet.design` / `version=1` / `engine=flowable`，携带单流程 XML 与 `forms` 数组；当前版本仅支持空表单目录，非空表单在保存与打开两侧明确拒绝。
- `saveDesignDocument(model, forms?)`：生成带竖排 DI 的可恢复文档，业务草稿（审批人 / 条件未配齐）允许保存并返回 `pendingIssues`；产物重新解析自证可恢复。
- `openDesignDocument(text)`：坏 JSON / XML、未知格式 / 版本 / 引擎、多流程、超出编辑子集的元素与不良构图形（循环、多开始、不可达）明确拒绝；纯标准 BPMN 草稿（无 Flowable 命名空间）可恢复。
- `FlowDesignSession`：组合编辑会话，持有「模型 + 表单目录」整体状态，提供新建（最小流程）、保存与原子恢复打开；迟到的打开结果不覆盖更新的操作。
- core 与 designer 保持零 FormCreate 依赖。
