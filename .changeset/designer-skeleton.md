---
"@flowduet/core": minor
"@flowduet/designer": minor
---

designer 包从占位变实体（#23 审批节点最小闭环）：`DingtalkDesigner` 顶层组件（挂 `BpmnModel` 实例即得钉钉式可编辑视图：纵向卡片链 + 卡间「+」插入审批节点 + 抽屉配置节点名/审批人 + 删除中段节点前后重链）与 `exportXml` 导出入口（固定竖排布局，零坐标建模导出合法 bpmndi）；绑定方式 = 直接读写模型树 + `deriveBlockTree` 重推导（视图无独立状态）。内核配套编辑 API：`removeSequenceFlow`（含网关 default 引用清理）/ `removeNode`（级联删连线）/ `elementOf`（抽屉字段读写访问器），并公开再导出 `ModdleElement` 类型。工程面：Vue 3 SFC + Element Plus + vite 库构建 + vue-tsc 严格类型检查 + happy-dom 组件冒烟；ESLint 增 Vue SFC 支持（essential 规则 + TS 子解析）；playground 拉起编辑区验收页面。BREAKING（0.x 口径）：无——新增 API 均为增量。
