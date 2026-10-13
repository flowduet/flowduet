# @flowduet/form-create

## 0.1.0

### Minor Changes

- 33591e1: 内核 `parse` 新增可选 `rejectWarnings`：默认保持宽松解析，文档恢复入口主动启用警告拒绝，防止重复 ID 或未知元素在打开后静默丢失。

  新增公开导出 `collectDraftIssues(model)` 与 `isCcServiceTask(element)`：草稿待修复项收集器与抄送形态判定谓词，与 `exportXml` 共用同一扫描口径。设计文档保存与打开侧（`@flowduet/form-create`）据此实现「保存成功 + 报告待修复项」与子集校验，不再需要宿主复制判断逻辑。`exportXml` 行为不变。

  流程设计文档编解码与组合会话（迭代三 #71）：

  - 流程设计文档协议与编解码：`format=flowduet.design` / `version=1` / `engine=flowable`，携带单流程 XML 与 `forms` 数组；支持同文档多表单目录，真实表单定义与范围校验由本次发布的集成能力提供。
  - `saveDesignDocument(model, forms?)`：生成带竖排 DI 的可恢复文档，业务草稿（审批人 / 条件未配齐）允许保存并返回 `pendingIssues`；产物重新解析自证可恢复。
  - `openDesignDocument(text)`：坏 JSON / XML、未知格式 / 版本 / 引擎、多流程、超出编辑子集的元素与不良构图形（循环、多开始、不可达）明确拒绝；纯标准 BPMN 草稿（无 Flowable 命名空间）可恢复。
  - 恢复后按顺序流端点重建节点连线登记，省略 incoming/outgoing 标记的文档仍可继续编辑，缺失条件不会绕过部署导出校验。
  - `FlowDesignSession`：组合编辑会话，持有「模型 + 表单目录」整体状态，提供新建（最小流程）、保存与原子恢复打开；迟到的打开结果不覆盖更新的操作。
  - core 与 designer 保持零 FormCreate 依赖。

- 5ab2b61: 设计文档打开的引擎扩展兼容检查与原子恢复（迭代三 #75）：

  - `parse` 新增 opt-in 选项 `rejectUnregisteredNamespaces`：XML 实际使用的命名空间按 URI 与真实使用内容判定（带前缀元素/属性经作用域内声明解析），未注册的扩展内容抛 `UnregisteredNamespaceError` 并点名前缀、URI、限定名与行号。默认关闭，既有调用者的宽松行为不变；已注册集合以 moddle registry 为准（标准四包 + 适配器方言 + 项目协议），新增适配器扩展包自动进入放行范围。
  - 动机：bpmn-moddle 对「未注册 URI 的带前缀属性」不产生解析警告而是静默收进 `$attrs`（键名还可能被改写成 `ns0:` 前缀）——假借 `flowable` 前缀但绑定其他 URI、实际使用 camunda 扩展等内容会混过 `rejectWarnings` 检查且语义丢失不可见。同 URI 不同前缀照常识别；仅声明未使用的命名空间不构成冲突；`xml` / `xsi` 基建前缀放行；扫描器跳过注释、CDATA、PI 与 DOCTYPE，按引号切分属性值（条件表达式中的尖括号不误判）。
  - 审计在 moddle 解析成功之后执行：结构坏 XML 仍由解析层报「无法解析」，审计只针对「能解析但语义静默丢失」的内容。
  - 表单包的文档保存自证与打开路径启用该审计，并在错误包装上区分两类失败：「文档 XML 使用了当前引擎适配器不支持的扩展」与「文档 XML 无法解析」，诊断不静默丢弃。
  - xmlns 字符引用按 XML 属性语义解码，合法 URI 可恢复；非法保留命名空间声明明确拒绝，防止打开后保存丢失扩展。多行属性诊断定位至属性名起始行，兼容 LF、CRLF 与 CR 换行。
  - `FlowDesignSession.open` 兼容接收文本读取 Promise，读取与解析使用同一打开序号；Playground 按文件选择顺序过滤迟到的成功和错误提示，新建设计同样使旧请求失效。

- c31d3ba: 默认表单绑定协议与真实 FormCreate 集成（迭代三 #72）：

  - core：新增项目绑定扩展描述符——`bpmn:Process` 上的 `flowduet:defaultFormKey`（命名空间 `urn:flowduet:bpmn`），由创建与解析路径统一注册并与适配器扩展包合并，占用 `flowduet` 前缀的适配器明确拒绝；`BpmnModel.defaultFormKey / setDefaultFormKey()` 读写收口；`resolveEffectiveForm()` 有效表单解析（显式覆盖优先、默认继承、网关与抄送不参与）。未使用绑定的既有编译输出逐字不变（新增基准 `default-form.flowable68.baseline.xml`）。
  - designer：`DingtalkDesigner` 新增中立表单接缝 `formOptions`（id/name 摘要，不依赖表单实现）——传入即展示流程默认表单选择条与审批节点有效表单摘要（继承默认 / 节点指定 / 引用失效，失效保留原 key），不传时纯流程形态完全不变；公开 `isCcServiceTask()` 谓词。
  - form-create：接入真实开源设计器与渲染器（锁定 `@form-create/designer@3.5.0` + `@form-create/element-ui@3.3.4`，Vue3/Element Plus 线，AI 模块关闭）；`FlowDesignSession` 扩展表单目录管理（创建 / 改名不改 ID / 内容写入校验）；设计文档 forms 携带真实定义（provider=form-create/element-plus、成对序列化 rules/options、字段范围守卫覆盖八类常用字段与基础栅格）；`FormManager` / `FormDesigner`（菜单收口八类常用字段与基础栅格）/ `FormPreview`（真实渲染器试填、必填校验、查看值，试填与设计隔离、切换目标重置）；`exportDeployXml()` 组合部署导出（流程校验 + 默认与节点引用完整性，A18：默认失效即使节点全有覆盖也阻断）；`collectReferenceIssues()` 引用诊断。

- a0b7365: 常用字段与基础布局的设计往返（迭代三 #74）：

  - 字段范围从文本扩展为八类常用组件：文本、多行文本（input + textarea 形态）、数字（inputNumber）、单选（radio）、多选（checkbox）、下拉单选（select）、日期单值（datePicker）、开关（switch），可配置选项、默认值、必填与字段顺序；新增基础栅格布局（fcRow + col 行列结构，栅格仅限顶层、列内放字段）。
  - `FormDesigner` 菜单与配置入口同步收口：上传、子表单等超范围组件无拖拽入口；远程数据源（选项类型选择器隐藏，仅静态选项编辑）、下拉多选、日期范围形态、事件脚本（组件事件面板与表单级事件配置）、组件联动、数据录入、自定义组件均无 UI 入口；栅格布局经 `checkDrag` 拒绝拖入任何容器，杜绝嵌套。
  - `form-schema` 守卫升级为规则树递归校验（保存与打开两侧共用同一口径）：类型超出开放集合、普通输入框的非文本形态、下拉 multiple、日期范围形态、effect.fetch 远程数据源、嵌套栅格、单独 col、栅格内非列子级、字段标识缺失或跨树重复逐一明确拒绝，不静默删减；导入规则携带范围外的子级、联动或脚本配置及提供者函数编码时同样拒绝。
  - 值语义按组件语义处理：数字 `0`、开关 `false`、空多选数组与空值的默认值往返与试填互不污染；`rules` / `options` 继续经锁定版本的 FormCreate 序列化接口成对保存恢复，不引入第二份 schema 转换模型。
  - 多选默认值通过“设置默认值”区分未设置与显式 `[]`；针对提供者删除空数组的行为，在编辑态保留设置意图、序列化后恢复空默认值并移除编辑标记。下拉单选隐藏创建新条目入口，保存与打开同时拒绝 `allowCreate`。
  - 联动的公开键 `control` 与提供者编辑别名 `_control` 在字段及栅格行列中使用同一拒绝口径，防止导入隐藏的范围外规则。

- 5beacbd: 多表单管理与审批节点显式覆盖（迭代三 #73）：

  - designer：`NodeDrawer` 新增中立表单接缝 `formOptions`（由 `DingtalkDesigner` 自动下传）——表单集成模式下审批节点的自由文本 formKey 占位升级为目录选择：继承默认（选项内呈现当前默认表单名）/ 显式覆盖 / 目录外 key 只读项保留可改选修复；同名表单选项附 ID 区分（A05）；不传 `formOptions` 的纯流程宿主保持自由文本合同（A17）。网关与抄送不出现覆盖入口（A19）。
  - form-create：`FlowDesignSession.deleteForm(id)` 表单删除守卫（A06）——被流程默认或任意审批节点引用时拒绝并列出全部引用位置，解除或调整全部引用后才可删除；新增 `collectFormUsage(model, id)` 引用位置收集器。`FormManager` 面板补删除入口（两段确认），未绑定表单随时可删（A08 反向面）。
  - 基准：core 新增 `form-override` 编译与往返基准（流程默认 + 单签/或签继承 + 会签/依次覆盖复用同一 key + 网关与抄送在场），Flowable 6.8 部署冒烟扩展运行时断言——显式覆盖 formKey 经引擎任务查询可读、继承节点不固化（task.formKey=null）、多节点复用同一覆盖 key 逐节点可读。

- 34b6a6b: 未完成设计的保存续编公开边界（迭代三 #76）：

  - `DingtalkDesigner` 新增 `commitPendingChanges()` 组件方法与 `draft-change` 事件：宿主在保存设计文档前调用即可把抽屉里已输入未确认的变更经与「确定」同一套守卫写入模型；守卫拦截（如多人集合变量格式非法）返回 `false` 且抽屉保持打开，不绕过守卫落半写模型。抽屉字段被编辑时上抛 `draft-change`，未提交输入也计入宿主的未保存判定。
  - `FormManager` 新增 `commitPendingEdit()` 与 `hasOpenEditor()` 组件方法，`FormDesigner` 新增 `exportContent()`：保存前可收集表单编辑器里尚未保存的 rules/options，序列化与守卫路径和「保存表单内容」按钮完全一致。
  - 节点抽屉改为非模态展示：切换编辑目标前提交当前缓冲，格式非法时保留原节点与输入。

  - `BpmnModel.addApprovalTask(spec, options)` 与 `DingtalkDesigner#commitPendingChanges(options)` 支持显式 `{ allowIncomplete: true }` 草稿路径：集合变量与收件人尚未配置时可保存恢复，非空非法格式仍拦截；默认确认和部署导出保持严格。内核只容许集合业务缺失，不放开 mode、元素变量或字段类型守卫。
  - 表单收集序列化异常可见反馈并保留编辑器；Playground 用保存请求序号与设计替换序号阻止迟到结果覆盖较新草稿或反馈。

  - 保存前收集表单当前焦点控件的未提交值；表单 `draft-change` 事件贯穿编辑器、管理面板与宿主编辑世代，保存期间的新输入不被误标为已保存。Playground 切换视图前收集抽屉缓冲，格式非法时保持原视图和选中态。

  - `FlowDesignSession.open` 增加可选同步 `canReplace` 判定，在临时校验完成、实际替换之前取消已产生新编辑的打开请求；Playground 文件读取和刷新恢复期间的新输入不会被迟到结果静默覆盖，默认打开合同保持兼容。

### Patch Changes

- a046d93: 修复 #72 默认表单评审发现：有效表单解析保留 XML 引用字面值；带首尾空格的引用在设计视图中标为失效，组合部署导出明确拒绝；表单定义拒绝缺失或重复的字段标识，避免试填值混用。Playground 的预览与引用提示随模型编辑更新，表单管理面板就地反馈空白名称错误。
- dc5cbbc: 修复普通 npm 消费者的类型声明链：core 构建时复制 bpmn-moddle ambient 声明并在公开入口引用，避免消费侧 TS7016；form-create 构建时剥离声明产物中的 CSS 副作用 import，避免 TS2882。core 接入示例补齐竖排布局函数导入。

  修复同 ID、相同定义重新打开后预览当前值为空的问题：定义对象换代时重建渲染器并清除旧 API、试填及校验状态，默认值和当前值保持一致，试填仍不进入设计文档。

- Updated dependencies [33591e1]
- Updated dependencies [5ab2b61]
- Updated dependencies [c31d3ba]
- Updated dependencies [a046d93]
- Updated dependencies [dc5cbbc]
- Updated dependencies [5beacbd]
- Updated dependencies [34b6a6b]
  - @flowduet/core@0.3.0
  - @flowduet/designer@0.1.0
