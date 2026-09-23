---
"@flowduet/core": minor
"@flowduet/designer": patch
---

多人审批与抄送抽屉（#25）：内核 `UserTaskSpec`/`ApprovalTaskSpec` 增 `formKey` 占位字段（`flowable:formKey` 序列化）；designer「+」插入升级为类型菜单（审批节点/抄送节点），抽屉新增完成方式四选项卡（单签/会签/或签/依次——三档落多实例集合变量与固化完成条件，单人↔多人同 id 转换且保持前后连通）、抄送收件人编辑（必填守卫）、formKey 占位字段；operations 新增 `insertCcAfter`/`convertApprovalToMulti`/`convertMultiToSingle`/`setApprovalMode`/`readApprovalMulti`。BREAKING（0.x 口径）：无——新增 API 均为增量。

评审加固（#25 复核）：内核新增导出 `DEFAULT_ELEMENT_VARIABLE`（元素变量默认名单一出处）；designer `setApprovalMode` 复用内核 `COMPLETION_CONDITIONS`/`DEFAULT_ELEMENT_VARIABLE` 并补 `elementVariable` 空白守卫，`readApprovalMulti` 改全等比对固化完成条件、非固化形态显式报错（不再子串反推），`insertCcAfter`/`convertApprovalToMulti`/`convertMultiToSingle` 增破坏性操作前的 fail-fast 校验（含携带 formKey 空白拦截）；抽屉保存改为「先校验后写」消除半写模型、单↔多切换清空审批人缓冲（避免集合名被当字面 assignee 落盘）、多人集合变量裸标识符校验、抄送收件人拒绝插入占位串（新增导出 `CC_RECIPIENTS_PLACEHOLDER`）。均为增量/修复，无破坏性变更。
