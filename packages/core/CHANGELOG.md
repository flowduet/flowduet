# @flowduet/core

## 0.2.1

### Patch Changes

- 竖排布局分支线改 Z 形贴边折线（#49）：fork 出线即折、join 入线即折，横段按支路序错开防重叠，引入/引出段拉长至 ~60px——分支线两端明确接进卡片顶/引出卡片底（原中位折线末端仅 10–19px 视觉断线）。DI 层形态变化、语义不变；场景基准随产物同步。

## 0.2.0

### Minor Changes

- 67aaae8: BPMN 视图只读投影（#26）：designer 新增 `BpmnCanvas`（Vue-Flow 只读画布）——几何经 `resolveCanvasGeometry` 直读 DI 登记表、任一元素缺坐标时全图走竖排推导（与 XML 导出同源，互切零转换）；自定义节点词汇按 BPMN 元素类型渲染（事件圆/任务矩形含多实例并行三竖条与串行三横条标记/网关菱形区分/抄送虚线珊瑚橙声部），折线连线含终点箭头；只读配置清单（禁拖拽/连线/编辑/选中/删除，保留缩放平移）。内核补导出 `deriveVerticalGeometry`（画布只读投影与 XML 导出共用同一竖排推导链与可达性守卫）及 `LayoutResult`。评审加固：不可达图形在画布与导出两侧一致显式拒绝（不再静默丢图）、`BpmnCanvas` 对推导异常渲染可读错误态而非白屏、折线纯函数返回副本、修正末段退化时的不可见箭头、只读配置补 `selectionKeyCode: null` 关闭框选。二轮复核加固：库构建外置 `@vue-flow/core`（消除与宿主的双实例/体积浪费，消费者经 dependencies 传递安装并自引样式）、`BpmnCanvas` 新增 `version` prop 原地刷新接缝（#27 三区布局边编辑边看预览）。BREAKING（0.x 口径）：无。
- 74a0df9: 抄送任务（知会不阻塞）：`TaskKind` 新增 `cc`，经引擎中立映射 `addTask("cc", { recipients })` 落成 `ServiceTask` + 扩展属性 `flowable:ccTo`（字面量逗号分隔或运行时表达式）+ 占位 delegate 引用 `${flowduetCcTask}`（宿主绑定 bean 实现知会行为，部署合法不要求 bean 在场）；适配器描述符扩展 ServiceTask 的 `delegateExpression`/`ccTo` 属性；编译合同基准与部署冒烟扩展——扩展属性注入点的首个真实消费者。

  BREAKING（0.x 口径）：`TaskKind` 从 4 个成员扩到 5 个，自定义 `EngineAdapter` 实现需补 `taskTypeMapping.cc` 映射，否则 TS 编译报缺少 `cc` 键；`TaskSpec` 类型从 `UserTaskSpec` 扩为 `UserTaskSpec | CcTaskSpec`，消费方若用 `TaskSpec` 标注 `addTask` 参数，升级后自动获得 cc 场景的类型覆盖。

- 150bf51: designer 包从占位变实体（#23 审批节点最小闭环）：`DingtalkDesigner` 顶层组件（挂 `BpmnModel` 实例即得钉钉式可编辑视图：纵向卡片链 + 卡间「+」插入审批节点 + 抽屉配置节点名/审批人 + 删除中段节点前后重链）与 `exportXml` 导出入口（固定竖排布局，零坐标建模导出合法 bpmndi）；绑定方式 = 直接读写模型树 + `deriveBlockTree` 重推导（视图无独立状态）。内核配套编辑 API：`removeSequenceFlow`（含网关 default 引用清理）/ `removeNode`（级联删连线）/ `elementOf`（抽屉字段读写访问器），并公开再导出 `ModdleElement` 类型。工程面：Vue 3 SFC + Element Plus + vite 库构建 + vue-tsc 严格类型检查 + happy-dom 组件冒烟；ESLint 增 Vue SFC 支持（essential 规则 + TS 子解析）；playground 拉起编辑区验收页面。BREAKING（0.x 口径）：无——新增 API 均为增量。
- 97d923b: 多人审批与抄送抽屉（#25）：内核 `UserTaskSpec`/`ApprovalTaskSpec` 增 `formKey` 占位字段（`flowable:formKey` 序列化）；designer「+」插入升级为类型菜单（审批节点/抄送节点），抽屉新增完成方式四选项卡（单签/会签/或签/依次——三档落多实例集合变量与固化完成条件，单人↔多人同 id 转换且保持前后连通）、抄送收件人编辑（必填守卫）、formKey 占位字段；operations 新增 `insertCcAfter`/`convertApprovalToMulti`/`convertMultiToSingle`/`setApprovalMode`/`readApprovalMulti`。BREAKING（0.x 口径）：无——新增 API 均为增量。

  评审加固（#25 复核）：内核新增导出 `DEFAULT_ELEMENT_VARIABLE`（元素变量默认名单一出处）；designer `setApprovalMode` 复用内核 `COMPLETION_CONDITIONS`/`DEFAULT_ELEMENT_VARIABLE` 并补 `elementVariable` 空白守卫，`readApprovalMulti` 改全等比对固化完成条件、非固化形态显式报错（不再子串反推），`insertCcAfter`/`convertApprovalToMulti`/`convertMultiToSingle` 增破坏性操作前的 fail-fast 校验（含携带 formKey 空白拦截）；抽屉保存改为「先校验后写」消除半写模型、单↔多切换清空审批人缓冲（避免集合名被当字面 assignee 落盘）、多人集合变量裸标识符校验、抄送收件人拒绝插入占位串（新增导出 `CC_RECIPIENTS_PLACEHOLDER`）。均为增量/修复，无破坏性变更。

- 209ea9c: 多实例用户任务三档（会签/或签/依次审批）：新增 `addApprovalTask` 语义建模 API（集合表达式 + 完成方式封闭枚举，完成条件内核固化）、`ApprovalMode`/`ApprovalTaskSpec`/`APPROVAL_MODES` 公开导出、flowable 描述符扩展 `MultiInstanceLoopCharacteristics` 的 `collection`/`elementVariable` 方言属性；三份编译合同基准与部署冒烟运行时断言（会签逐人展开、或签任一完成即终止、依次串行仅队首）。
- 391c113: 并行网关与排他网关默认流转：新增 `addParallelGateway` 建模方法与 `SequenceFlowSpec.default` 分支侧默认标记（内核落网关 `default` 引用属性，三重守卫：与条件互斥、源限定排他网关、同网关唯一）；两份编译合同基准（并行分裂-汇合、带默认分支排他网关）与部署冒烟扩展。
- dee6bf4: 竖排布局器与可选几何（钉钉式导出地基）：`NodeSpec.shape`/`SequenceFlowSpec.waypoints` 可选化（缺省时恒等布局在 compile 处诚实抛错）；新增 `verticalDiLayout()`（`DiLayout` 第二实现，`compile(model, { diLayout })` 调用面）与 `deriveBlockTree` 公开导出（图 → 块结构树，钉钉式递归组件与坐标推导共用的读视图，含分支不收敛/交错收敛的良构抛错）；五类节点全谱嵌套场景零坐标建模实测无重叠并经 6.8 部署。BREAKING（0.x 口径）：`shape`/`waypoints` 改为可选，读取这两个字段的消费方需处理 `undefined`（写入方不受影响）。

### Patch Changes

- 48c5763: PR #34 评审加固（#25 复核遗留）：修复两处静默型数据损坏缺口 + 一批文档/UX/测试补齐。

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

## 0.1.2

### Patch Changes

- f38cbaa: 修复 flowable 方言命名空间:引擎读 flowable: 属性用 http://flowable.org/bpmn(6.8 引擎常量),此前官方文档风格的 http://flowable.org/bpm 会让 assignee 等扩展属性被引擎静默忽略(部署注册照常通过,缺陷隐蔽)。部署冒烟同步升级:启动实例并断言 assignee 真实生效。

## 0.1.1

### Patch Changes

- 修复发布产物的 ESM 兼容性：源码相对导入补全 `.js` 扩展名。此前 dist 在
  Node 原生 ESM 下无法导入（tsc 不改写导入路径，extensionless 仅在打包器
  解析下可用），由发布后的真实安装验证发现；CI 新增产物导入检查防回归。

## 0.1.0

### Minor Changes

- 49b692c: 适配器接口正式化（ADR-0005 三收敛点）：命名空间前缀、扩展属性 schema、任务类型映射。
  合同以 `assertAdapterContract` 随包发布（纯断言、不依赖测试框架），任何适配器实现可直接复用；
  `BpmnModel.addTask(kind)` 消费任务类型映射，邮件任务按 Flowable 习惯落成
  ServiceTask + flowable:type="mail"。
- 56cc000: 新增 ROADMAP Step 1 接缝的最小实现：模型树包装（BpmnModel）、编译器（compile）、
  恒等 DI 布局（IdentityDiLayout）与 Flowable 适配器（扩展属性描述符）。
  编译合同测试以手写基准文件锁定最小流程（开始 → 用户任务 → 排他网关 → 两分支 → 结束）
  的 Flowable 6.8 方言输出：命名空间声明、flowable:assignee、bpmndi 一个不能少。
- e075358: 部署冒烟链路：`pnpm smoke` 一键完成「启动 Flowable 6.8 容器 → REST 部署基准
  XML → 断言流程定义注册」，CI 侧以 workflow_dispatch 手动触发的同名 job 承载。
- f126d96: 新增解析接缝 `parse(xml, { adapter })`：方言 XML → 模型树（语义元素 + bpmndi 几何恢复）。
  编译器幂等化：重复编译不再叠加 DI 段。往返保真不变量（parse → model → compile 语义等价）
  以最小流程与三个变体（分支交换 / 线性流程 / 审批链加签）逐字一致锁定。
