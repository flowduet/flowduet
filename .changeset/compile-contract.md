---
"@flowduet/core": minor
---

新增 ROADMAP Step 1 接缝的最小实现：模型树包装（BpmnModel）、编译器（compile）、
恒等 DI 布局（IdentityDiLayout）与 Flowable 适配器（扩展属性描述符）。
编译合同测试以手写基准文件锁定最小流程（开始 → 用户任务 → 排他网关 → 两分支 → 结束）
的 Flowable 6.8 方言输出：命名空间声明、flowable:assignee、bpmndi 一个不能少。
