---
"@flowduet/core": patch
"@flowduet/designer": patch
---

PR #34 评审加固（#25 复核遗留）：修复两处静默型数据损坏缺口 + 一批文档/UX/测试补齐。

**内核（core）**：

- `#setFormKey` 补元素类型守卫（评审 C-2）：`addTask(kind, { formKey })` 在 kind 映射到非 `bpmn:UserTask` 的方言形态（cc/mail/service/script）时抛错，避免产出无 flowable 前缀的非法 XML；与相邻 `assignee` 守卫对称。
- `normalizeFormKey` 抽为纯函数，`addTask`/`addApprovalTask` 前置校验（评审 S-1）：formKey 纯空白抛错时不留半写节点，且 trim 后落盘（与 `assignee`/`ccTo` 口径对齐）。
- 补 `form-key.test.ts` 合同测试 8 例：cc/mail/service/script 各拒 formKey、user 对照通过、trim/空白守卫、多实例 formKey 空白。

**设计器（designer）**：

- `readApprovalMulti` 完成条件读取上移到 `isSequential` 判定之前（评审 C-1）：依次档携外部 completionCondition（串行多实例 + 早停完成条件是 Flowable 合法写法）同样显式报错，避免 `setApprovalMode` 的 `completionCondition=undefined` 静默抹除用户原始条件。
- `setApprovalMode` 补 mode 合法性与 collection 类型守卫（评审 W-2）：与 `convertApprovalToMulti` / 内核 `addApprovalTask` 口径对称，非法 mode 不再落出空 body 的 completionCondition，非字符串 collection 不再报 TypeError。
- `NodeDrawer` 补 `elementVariable` 缓冲（评审 W-1）：回填 + 保存透传给 `convertApprovalToMulti`/`setApprovalMode`，避免多人节点保存后元素变量名被静默重置为 `DEFAULT_ELEMENT_VARIABLE`、`assignee` 表达式被改写导致流程内引用旧变量名的表单/监听器全部失效。
- `NodeDrawer` 单↔多切换审批人缓冲暂存/恢复（评审 S-3）：同会话内误点后切回不丢字段（`lastSingleAssignee` / `lastCollection` 两个 ref）；抽屉关闭重开后作废，避免跨会话污染。
- `NodeDrawer` 集合变量校验错误文案改为明确 ASCII-only（评审 S-4）：`审批人集合变量名仅支持英文字母/数字/下划线（如 approvers 或 dept.approvers），不接受 ${...} 表达式或逗号名单`。
- `NodeCard` TYPE_VOCAB 补 `bpmn:ServiceTask` + `ccTo` 判定（评审 W-5、PR #37 复核 3.1）：抄送节点专属「抄」字形 + 中性灰蓝底色（`#6b7a99`），与审批任务的「审」 + 靛蓝拉开声部。#26 spec 只定义珊瑚橙 `#F76547` 强调色、无抄送色系；若 #26 落地时为抄送节点引入配色，建议对齐此灰蓝以维持双视图同一语义的颜色回忆（待 #26 落地核验）。
- `operations.ts` DI 丢失已知限制注释改写为诚实描述（评审 W-6、PR #37 复核 3.1）：明确 `IdentityDiLayout.attach` 调 `shapeOf` 缺 shape 直接抛错（诚实失败）；#26 只读画布按 spec「几何零计算：`shapeOf`/`waypointsOf` 直映射」，缺坐标同样沿 `shapeOf` 抛错，并非此前注释里写的「全图降级竖排」（该函数在代码与 #26 spec 中均不存在）。登记 #27/#35 追踪需求。
- `exportXml` 前置草稿扫描（评审 S-5）：拒绝抄送占位收件人（`CC_RECIPIENTS_PLACEHOLDER`）与多实例空集合变量导出，避免部署合法但运行时静默失效的脏数据；全模型系统性校验另立 #35。
- `index.ts` 导出 `CC_RECIPIENTS_PLACEHOLDER`（评审 S-5）：宿主可经此常量识别 `exportXml` 抛错中的占位串（做 i18n / 用户引导），或自建导出前校验时对齐 designer 内置扫描口径。
- 测试补 25 例回归（core +8 / designer +17）：core 侧 8 例 formKey 合同测试（cc/mail/service/script 拒 formKey、user 对照、trim、空白守卫）；designer 侧 17 例——C-1（依次档携条件抽屉级 + operations 级）、W-1（elementVariable 透传）、W-2（非法 mode / 非字符串 collection）、W-5（抄送卡片字形）、S-2（formKey 单↔多清空对称、档间切换全矩阵、抄送链首/链尾插入位置）、S-3（单↔多缓冲暂存/恢复）、S-4（错误文案）、S-5（exportXml 拒绝占位串 + 空 collection）。

**文档**：

- `CONTEXT.md` 补「单签」词条（评审 W-3）：与会签/或签/依次审批并列作为抽屉完成方式四张卡之一，单签卡承载单↔多开关（#25 有意偏离视觉定稿的"三卡多人时出现"）。
- `docs/specs/iteration-2/dingtalk-view-mvp.md` 补三条 Implementation Decisions（评审 W-3/W-5/S-5）：完成方式四卡常显的偏离记录、抄送节点专属字形、`exportXml` 草稿扫描作为 #35 落地前的过渡闸。
- `apps/playground/src/App.vue` 演示场景补多人会签 + 抄送知会节点（评审 W-4）：以便手验 #25 多人审批与抄送的导出部署链路。

均为修复/增强，无破坏性变更；`exportXml` 前置草稿扫描对绕过抽屉直接导出的脏数据行为属"由静默失效改为诚实抛错"，符合产品硬承诺"合法可执行"。
