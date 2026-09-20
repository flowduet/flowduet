---
"@flowduet/core": minor
---

抄送任务（知会不阻塞）：`TaskKind` 新增 `cc`，经引擎中立映射 `addTask("cc", { recipients })` 落成 `ServiceTask` + 扩展属性 `flowable:ccTo`（字面量逗号分隔或运行时表达式）+ 占位 delegate 引用 `${flowduetCcTask}`（宿主绑定 bean 实现知会行为，部署合法不要求 bean 在场）；适配器描述符扩展 ServiceTask 的 `delegateExpression`/`ccTo` 属性；编译合同基准与部署冒烟扩展——扩展属性注入点的首个真实消费者。

BREAKING（0.x 口径）：`TaskKind` 从 4 个成员扩到 5 个，自定义 `EngineAdapter` 实现需补 `taskTypeMapping.cc` 映射，否则 TS 编译报缺少 `cc` 键；`TaskSpec` 类型从 `UserTaskSpec` 扩为 `UserTaskSpec | CcTaskSpec`，消费方若用 `TaskSpec` 标注 `addTask` 参数，升级后自动获得 cc 场景的类型覆盖。
