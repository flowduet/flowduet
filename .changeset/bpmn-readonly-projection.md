---
"@flowduet/core": minor
"@flowduet/designer": minor
---

BPMN 视图只读投影（#26）：designer 新增 `BpmnCanvas`（Vue-Flow 只读画布）——几何经 `resolveCanvasGeometry` 直读 DI 登记表、任一元素缺坐标时全图走竖排推导（与 XML 导出同源，互切零转换）；自定义节点词汇按 BPMN 元素类型渲染（事件圆/任务矩形含多实例并行三竖条与串行三横条标记/网关菱形区分/抄送虚线珊瑚橙声部），折线连线含终点箭头；只读配置清单（禁拖拽/连线/编辑/选中/删除，保留缩放平移）。内核补导出 `layoutVertical`/`FlowTable`/`LayoutResult`。BREAKING（0.x 口径）：无。
