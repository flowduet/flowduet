---
"@flowduet/core": minor
"@flowduet/designer": minor
---

BPMN 视图只读投影（#26）：designer 新增 `BpmnCanvas`（Vue-Flow 只读画布）——几何经 `resolveCanvasGeometry` 直读 DI 登记表、任一元素缺坐标时全图走竖排推导（与 XML 导出同源，互切零转换）；自定义节点词汇按 BPMN 元素类型渲染（事件圆/任务矩形含多实例并行三竖条与串行三横条标记/网关菱形区分/抄送虚线珊瑚橙声部），折线连线含终点箭头；只读配置清单（禁拖拽/连线/编辑/选中/删除，保留缩放平移）。内核补导出 `deriveVerticalGeometry`（画布只读投影与 XML 导出共用同一竖排推导链与可达性守卫）及 `layoutVertical`/`FlowTable`/`LayoutResult`。评审加固：不可达图形在画布与导出两侧一致显式拒绝（不再静默丢图）、`BpmnCanvas` 对推导异常渲染可读错误态而非白屏、折线纯函数返回副本、修正末段退化时的不可见箭头、只读配置补 `selectionKeyCode: null` 关闭框选。BREAKING（0.x 口径）：无。
