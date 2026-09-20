---
"@flowduet/core": minor
---

并行网关与排他网关默认流转：新增 `addParallelGateway` 建模方法与 `SequenceFlowSpec.default` 分支侧默认标记（内核落网关 `default` 引用属性，三重守卫：与条件互斥、源限定排他网关、同网关唯一）；两份编译合同基准（并行分裂-汇合、带默认分支排他网关）与部署冒烟扩展。
