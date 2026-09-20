---
"@flowduet/core": minor
---

适配器接口正式化（ADR-0005 三收敛点）：命名空间前缀、扩展属性 schema、任务类型映射。
合同以 `assertAdapterContract` 随包发布（纯断言、不依赖测试框架），任何适配器实现可直接复用；
`BpmnModel.addTask(kind)` 消费任务类型映射，邮件任务按 Flowable 习惯落成
ServiceTask + flowable:type="mail"。
