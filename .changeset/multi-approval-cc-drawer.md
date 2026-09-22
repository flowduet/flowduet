---
"@flowduet/core": minor
"@flowduet/designer": minor
---

多人审批与抄送抽屉（#25）：内核 `UserTaskSpec`/`ApprovalTaskSpec` 增 `formKey` 占位字段（`flowable:formKey` 序列化）；designer「+」插入升级为类型菜单（审批节点/抄送节点），抽屉新增完成方式四选项卡（单签/会签/或签/依次——三档落多实例集合变量与固化完成条件，单人↔多人同 id 转换且保持前后连通）、抄送收件人编辑（必填守卫）、formKey 占位字段；operations 新增 `insertCcAfter`/`convertApprovalToMulti`/`convertMultiToSingle`/`setApprovalMode`/`readApprovalMulti`。BREAKING（0.x 口径）：无——新增 API 均为增量。
