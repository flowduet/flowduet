---
"@flowduet/core": minor
---

新增解析接缝 `parse(xml, { adapter })`：方言 XML → 模型树（语义元素 + bpmndi 几何恢复）。
编译器幂等化：重复编译不再叠加 DI 段。往返保真不变量（parse → model → compile 语义等价）
以最小流程与三个变体（分支交换 / 线性流程 / 审批链加签）逐字一致锁定。
