---
"@flowduet/core": minor
---

竖排布局器与可选几何（钉钉式导出地基）：`NodeSpec.shape`/`SequenceFlowSpec.waypoints` 可选化（缺省时恒等布局在 compile 处诚实抛错）；新增 `verticalDiLayout()`（`DiLayout` 第二实现，`compile(model, { diLayout })` 调用面）与 `deriveBlockTree` 公开导出（图 → 块结构树，钉钉式递归组件与坐标推导共用的读视图，含分支不收敛/交错收敛的良构抛错）；五类节点全谱嵌套场景零坐标建模实测无重叠并经 6.8 部署。BREAKING（0.x 口径）：`shape`/`waypoints` 改为可选，读取这两个字段的消费方需处理 `undefined`（写入方不受影响）。
