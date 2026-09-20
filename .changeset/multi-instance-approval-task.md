---
"@flowduet/core": minor
---

多实例用户任务三档（会签/或签/依次审批）：新增 `addApprovalTask` 语义建模 API（集合表达式 + 完成方式封闭枚举，完成条件内核固化）、`ApprovalMode`/`ApprovalTaskSpec`/`APPROVAL_MODES` 公开导出、flowable 描述符扩展 `MultiInstanceLoopCharacteristics` 的 `collection`/`elementVariable` 方言属性；三份编译合同基准与部署冒烟运行时断言（会签逐人展开、或签任一完成即终止、依次串行仅队首）。
