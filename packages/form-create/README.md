# @flowduet/form-create

FlowDuet 表单集成包：承载**流程设计文档**的编解码与组合编辑装配，并封装真实的 [FormCreate](https://github.com/xaboy/form-create-designer) 开源设计器与 Element Plus 渲染器。当前版本交付：八类常用字段与基础栅格布局的表单设计、多表单目录管理（新建 / 改名 / 删除守卫）、流程默认绑定与审批节点显式覆盖、文档往返、真实渲染器试填与组合部署导出、打开侧的引擎扩展兼容检查与原子恢复。

> **边界（ADR-0006 / ADR-0009）**：`@flowduet/core` 与 `@flowduet/designer` 保持零 FormCreate 依赖；表单领域的内容（设计器、渲染、文档内表单定义）全部收敛在本包。宿主负责存储（文件、浏览器或后端），本包负责成套编解码与原子恢复。不使用 FormCreate Pro 与 AI 助理（设计器 AI 模块已关闭）。

## 安装

```sh
pnpm add @flowduet/form-create @flowduet/core @flowduet/designer element-plus vue
```

样式（宿主显式引入；本包 style.css 已内联 FormCreate 设计器样式）：

```ts
import "@flowduet/form-create/style.css";
import "element-plus/dist/index.css";
```

锁定的外部依赖：`@form-create/designer@3.5.0` + `@form-create/element-ui@3.3.4`（Vue 3 / Element Plus 线，peer `vue ^3.5`）。注意 npm 上 `latest` 标签是 Vue 2 线、`next` 标签会漂移——请勿混装其他版本。

> **浏览器环境边界**：本包（含上游 FormCreate 设计器）在模块加载期访问 `document`，纯 Node 下 `import "@flowduet/form-create"` 会抛 `document is not defined`——属浏览器组件库的预期行为。SSR 宿主（Nuxt 等）需将本包的导入与组件挂载收敛到客户端（client-only / onMounted 动态导入）；`@flowduet/core` 与 `@flowduet/designer` 无此限制（core 同构可用，designer 仅依赖 Vue 运行时）。

TypeScript 消费本包的 Vue SFC 声明时，采用 Vue/Vite 的 `moduleResolution: "Bundler"`；纯 `NodeNext` 模式不是本包已验证的声明解析口径。

## 流程设计文档

外层 JSON 协议（首版，未知格式 / 版本 / 引擎明确拒绝，不自动迁移）：

| 字段      | 约定                                                                     |
| --------- | ------------------------------------------------------------------------ |
| `format`  | 固定 `flowduet.design`                                                   |
| `version` | 整数 `1`（文档协议版本）                                                 |
| `engine`  | 目标引擎适配器，当前仅 `flowable`                                        |
| `xml`     | 单流程 BPMN XML（含绑定引用，保存时生成可恢复 DI）                       |
| `forms`   | 文档内全部表单定义（含尚未绑定）；字段范围为下表八类组件与栅格布局        |

每个表单定义：稳定唯一 `id`（改名不换 ID）、非空 `name`、提供者 `form-create/element-plus`、成对序列化的 `rules` / `options` JSON 字符串。字段 `field` 标识必须非空且在单张表单内唯一（含栅格列内的字段）；缺失、重复或超出开放范围的规则在保存与打开两侧明确拒绝，不静默删减。流程结构与表单绑定以 XML 为事实源，外层不另存第二份可写关系。

## 支持的表单组件

| 类别     | 组件                                   | 说明                                                                  |
| -------- | -------------------------------------- | --------------------------------------------------------------------- |
| 字段     | 文本 / 多行文本（input）               | 多行文本是 `props.type=textarea` 形态；其余原生输入类型不在开放范围     |
| 字段     | 数字（inputNumber）                    | 默认值支持数字 `0`（与空值语义区分，往返不丢失）                       |
| 字段     | 单选（radio）、多选（checkbox）        | 静态选项配置（label / value），默认值按各组件值类型保留                |
| 字段     | 下拉单选（select）                     | 仅单选形态；`multiple` 多选超出范围，导入侧明确拒绝                    |
| 字段     | 日期单值（datePicker）                 | 仅单值形态（date / datetime / week / month / year 等）；范围形态拒绝  |
| 字段     | 开关（switch）                         | 默认值支持 `false`（与未设置语义区分，往返不丢失）                     |
| 布局     | 栅格布局（fcRow + col）                | 基础行列布局；栅格只能位于顶层、列内放字段，嵌套栅格明确拒绝           |
| 字段配置 | 默认值、必填、选项、字段顺序           | 验证面板只保留必填；选项仅静态编辑                                    |

多选字段通过“设置默认值”区分未设置与显式默认值：关闭时规则不带 `value`，开启且未选中选项时保存 `value: []`。清空选项仍保留空数组；关闭该设置才移除默认值。恢复、重复保存和栅格列内字段沿用同一口径。下拉单选只接受静态选项，可以本地搜索，不能启用 `allowCreate` 创建选项。

范围外能力（上传、远程数据源、事件脚本、组件联动、自定义组件、子表单 / 重复明细、复杂嵌套布局）在设计器中无 UI 入口，导入侧同步明确拒绝。设计器与预览使用同一组锁定的 FormCreate 版本，`rules` / `options` 经其序列化接口成对保存恢复。

## 使用

```ts
import { FlowDesignSession } from "@flowduet/form-create";

// 组合编辑会话：持有「模型 + 表单目录」整体状态
const session = new FlowDesignSession(existingModel);

// 表单目录管理（#72/#73）：创建 / 改名（ID 不变）/ 写入设计器产物 / 删除守卫
const form = session.createForm("申请单");
session.renameForm(form.id, "报销单");
session.updateFormContent(form.id, rulesJson, optionsJson);
// 删除：被流程默认或任意审批节点引用时抛错并列出全部引用位置（A06）
session.deleteForm(form.id);

// designer 的中立表单接缝（formOptions prop）直接可用
const options = session.formOptions();

// 保存：业务草稿与引用失效都允许保存，随结果报告
const { json, pendingIssues, referenceIssues } = await session.save();

// 打开：格式、XML、表单定义与可编辑结构全部校验通过后才整体替换
const state = await session.open(json);

// 组合部署导出：流程校验 + 表单引用完整性（默认与节点 key 必须在目录内）
const xml = await exportDeployXml(session.current!.model, session.current!.forms);
```

组件层：`FormManager`（目录管理面板，内嵌 `FormDesigner` 真实设计器——菜单收口为八类常用字段与栅格布局，远程数据源 / 事件脚本 / 联动等范围外配置无 UI 入口）、`FormPreview`（真实渲染器试填、必填校验、查看值；试填值与设计定义隔离，切换目标即重置）。

宿主只做文件 I/O 与展示（下载 Blob、读 File、把模型接进 `DingtalkDesigner` / `BpmnCanvas`），文档算法不复制到宿主。纯函数形式同样可用：`saveDesignDocument(model, forms?)` / `openDesignDocument(text)` / `exportDeployXml(model, forms)` / `collectReferenceIssues(model, forms)`。

文件宿主应将文本读取 Promise 直接传给 `session.open`，例如 `session.open(Promise.resolve().then(() => file.text()))`，让会话在读取开始前记录打开顺序；先等待文件读完再调用无法防止慢文件覆盖较新文件。已有 `session.open(json)` 调用继续有效。会话会拒绝迟到结果，宿主的状态与错误提示也应按文件选择顺序过滤旧请求；新建设计应使旧请求的反馈失效。

## 默认表单绑定与节点覆盖

- 流程默认表单落在 `bpmn:Process` 的 `flowduet:defaultFormKey`（命名空间 `urn:flowduet:bpmn`），由 core 在创建与解析路径统一注册，未使用时编译输出不含该命名空间（既有基准逐字一致）。
- 只有审批节点（单签与三种多人形态）参与继承；网关与抄送不解析也不展示。节点显式 `flowable:formKey` 优先，且不被默认值覆盖、不因目录缺失被清除；继承结果不逐节点固化。修改默认只影响继承节点，审批形态（单签 / 会签 / 或签 / 依次）切换保留节点 ID 与覆盖 key。
- 表单集成模式下（designer 传入 `formOptions`），审批节点抽屉提供覆盖选择：继承默认 / 从目录显式覆盖 / 目录外 key 只读项保留并改选修复；同名表单选项附 ID 区分。不传 `formOptions` 的纯流程宿主保持手写 formKey 的自由文本合同。
- 引用失效（key 不在目录中或带首尾空格）：保存与打开允许（保留 XML 原值的草稿），组合部署导出阻断，相关预览显示错误。
- 删除被默认或任意审批节点引用的表单会被 `deleteForm` 拒绝并列出引用位置（流程默认 / 各审批节点），解除或调整全部引用后才可删除；未被引用的表单（含尚未绑定的草稿表单）随时可删。
- 默认继承是 FlowDuet 的设计协议——Flowable 引擎不会自动加载或渲染表单，宿主需用公开解析能力（core 的 `resolveEffectiveForm`）自行接入运行时。

## 保存与部署导出的区别

| 入口                            | 业务配置未配齐（审批人 / 条件 / 收件人） | 表单引用失效           | 产出                                |
| ------------------------------- | ---------------------------------------- | ---------------------- | ----------------------------------- |
| `session.save()`                | 允许保存，`pendingIssues` 报告           | 允许保存，随结果报告   | 带版本协议的设计文档 JSON           |
| `exportDeployXml(model, forms)` | 拦截并抛错                               | 拦截并抛错（含 A18：默认 key 失效即使节点全有覆盖也阻断） | 裸 Flowable 方言 BPMN XML（部署用） |

两个入口在 Playground 中是两个独立按钮；单独导出的 XML 只含流程与引用，完整恢复需要设计文档。

## 保存前收集未提交内容（宿主责任）

流程抽屉与表单编辑器里的输入要等「确定 / 保存」才落模型与目录——宿主在调用 `session.save()` 前，应先经组件提交边界收集这些未提交变更，避免只保存旧模型而遗漏当前输入：

- `DingtalkDesigner#commitPendingChanges({ allowIncomplete: true })`：宿主保存业务草稿时显式允许空集合变量与空收件人，仍拦截非空非法集合格式；未传选项时与「确定」保持严格。抽屉未打开为无操作。业务缺失由保存结果报告，部署导出仍拒绝。
- `FormManager#commitPendingEdit()`：编辑对话框打开时经真实设计器序列化 rules/options 并走「保存表单内容」同一守卫上抛 `updateContent`；对话框未打开为无操作。`FormManager#hasOpenEditor()` 可查询编辑器是否开着，替换当前设计前应据此一并向用户确认。`FormDesigner` 与 `FormManager` 的 `draft-change` 事件上抛原生输入、变更和设计器结构编辑；第三方仅发 Vue 事件的控件，通过编辑区点击/编辑按键保守标记潜在编辑（仅查看配置也可能提示未保存），宿主应接入编辑世代以识别保存期间尚未提交的新表单输入。
- 保存入口的可达性由宿主自行安排：抽屉与对话框（Element Plus 的 Dialog 即使关闭遮罩，全屏容器仍拦截点击）开着时工具栏按钮不可点，Playground 以 Cmd/Ctrl+S 快捷键作为编辑中途保存的稳定入口。

`FormDesigner#exportContent()` 同步导出前会使本编辑器内的活动控件失焦，收集 FormCreate 在失焦时才提交的字段值；不会改变编辑器外部控件的焦点。

任一返回 `false` 时宿主应中止保存——守卫错误已在对应组件内呈现，绕过守卫会制造半写模型或无法恢复的文档。抽屉字段被编辑时 designer 上抛 `draft-change` 事件，供宿主把未提交输入计入「未保存修改」判定（打开文件 / 新建设计前的替换确认）。

宿主自行负责存储（文件、浏览器或后端）与异步竞态：`saveDesignDocument` 是异步序列化，期间发生的新编辑不属于本次快照，宿主应以编辑世代比对避免把新状态标记为已保存，并用请求序号阻止迟到旧保存覆盖较新草稿或新建/打开后的反馈（Playground 的实现可参考 `apps/playground`）；文件读取与存储失败须如实反馈，不显示保存成功。

## 打开的拒绝口径

坏 JSON、未知 `format` / `version` / `engine`、多流程、超出钉钉式编辑子集的元素、竖排推导不可行的图形（循环、多开始事件、不可达元素）、结构坏的表单定义（重复 id / 空名 / 未知提供者 / 坏 JSON / 超出开放范围的字段或布局，含下拉多选、日期范围、远程数据源、事件脚本与提供者函数编码、嵌套栅格）一律明确拒绝并保留当前状态。纯标准 BPMN 草稿（无 Flowable 命名空间）可以打开——缺少业务配置按草稿处理；存在表单 key 但目录缺失的定义属于业务草稿，打开后保留 key 供修复（相关预览与部署导出受阻）。

文档保存自证与打开均启用 `parse` 的 `rejectWarnings` 选项；重复 ID、未知元素等解析警告会阻止恢复，避免接受已经丢失内容的模型。`core.parse` 默认仍保持原有宽松行为。恢复时根据顺序流端点重建节点的 `incoming/outgoing` 引用，省略这些可选标记不会影响继续编辑或缺失条件校验。

### 引擎扩展兼容判定

打开与保存自证对 XML 实际使用的引擎扩展做**引擎扩展兼容判定**——按命名空间 URI 与实际使用内容判定，不看前缀名称、不看是否声明：

- 同一 URI 换任意前缀（如 `fa:assignee` 绑定 `http://flowable.org/bpmn`）照常识别与恢复；项目扩展 `urn:flowduet:bpmn` 同样保留。
- xmlns 声明中的 XML 字符引用先解码再比较 URI；URI 大小写与百分号编码不归一化。`xml` 可以省略声明或显式声明其固定 URI，非法重绑定及其他保留命名空间声明会拒绝，即使该声明未被使用。
- 仅声明未使用的其他引擎命名空间（如只写 `xmlns:camunda=...` 而无引用）不构成冲突。
- 实际使用了未注册命名空间的元素或属性——包括假借 `flowable` 前缀但绑定其他 URI、真实使用 `camunda:` 扩展——明确拒绝，错误点名前缀、URI、限定名与行号。动机：moddle 对这类内容不产生解析警告而是静默收进 `$attrs`，语义丢失对调用者不可见。
- 判定经 `parse` 的 `rejectUnregisteredNamespaces` 选项开启（本包的保存自证与打开路径均已启用）；已注册集合以适配器与项目协议的扩展包为准，新增合法组件或适配器不需要维护第二份名单。

## 打开期间的新编辑保护

宿主可调用 `session.open(textOrPromise, { canReplace })`，同步判定函数在文档临时校验完成后、模型与表单目录原子替换之前执行。返回 `false` 或抛错时取消打开并保留当前会话；未传选项沿用原行为。宿主应在读取前记录编辑世代，并在判定中检查等待期间是否产生新编辑。Playground 对文件打开和本地草稿恢复都接入该保护；发现新编辑后明确提示取消本次打开，用户处理修改后可重试。

## License

Apache-2.0（见 [LICENSE](./LICENSE)）

### 显式保留数值/日期输入（retained）

`FormDesigner`、`FormManager` 可传 `editingMode="retained"`；缺省和显式 `legacy` 保持原有导出、保存、取消与 Dialog 行为。模式在挂载时固定，活动期间修改会报告 `unsupported-mode`；更换模式或文档前须由宿主确认放弃/替换，再创建新实例。相同字符串内容的文档替换也须由宿主管理生命期，组件不能仅凭两个 JSON 字符串识别文档身份。

retained 使用自有文本入口保留数值 `-`、`1.`、`1e` 与日期 `2026-` 等中间原文；合法有限数值写入规则为 number，普通日期仅接受有效 `YYYY-MM-DD`，日历仍可明确确认日期。空输入表示未设置，`0` 是有效默认值。六类既有单值日期和自定义 `valueFormat` 未编辑时原样往返；非普通 date/自定义格式的手工编辑会保留原文并报告 `unsupported-input`。这些原文仅存于当前挂载的编辑器，不能序列化到设计文档。

新增三种根导出 DTO：`FormDesignerBlocker`、`FormDesignerEditingState`、`FormDesignerCaptureResult`。`FormDesigner#readEditingState()` 只读返回本实例模式、编辑版本、`canSuspend`、`canCapture` 与原因；`captureContent()` 同步返回 `captured`（成对 rules/options）、`blocked` 或 `failed`。合法输入须经过公开 prop 回显与原规则确认；组合、拖动、弹层、未确认的第三方输入或捕获期间版本变化都会阻断。宿主 UI 可等待一次 `nextTick` 再重读，不能把同步适配器改为异步，也不能在失败时保存旧值。legacy 的新捕获接口返回 `unsupported-mode`，原 `exportContent()` 不变。

retained 的 `exportContent()`、工具栏保存和 `FormManager#commitPendingEdit()` 共用新捕获边界，不主动 blur；blocked 返回 null/false 并保持编辑器，序列化异常仍保留既有错误边界。`editing-state-change` 转发只读状态，与实际设计变更的 `draft-change` 分开，二者都不确认宿主持久化。

`canSuspend=true` 只允许宿主将 **同一 FormDesigner 保持挂载隐藏（K）**；不授权 Dialog 关闭或卸载。FormManager 不提供 K 隐藏/目录缓存。retained 的 X、遮罩和取消均要求明确选择“放弃并关闭”，取消/异常或确认期间实例、版本变化都会保持原编辑器；成功提交才走原内容守卫并关闭。Escape 保留 IME/内部弹层语义，空闲时也不关闭表单；拖动取消尚未交付，Escape 不代表已取消拖动。关闭保护只处理自有实例的手势，不能拦截父级强制卸载。

`FormManager#readEditingState()` 查询/`editing-state-change` 转发当前子状态；活动未就绪或关闭收尾时为不可捕获的 `not-ready` 快照，完全没有编辑器才为 null。未知的同 ID 表单定义替换会保留当前输入并阻断提交，由宿主确认处理后重开。每次打开使用独立会话 key，旧状态、保存、取消、确认和关闭动画回调不能影响同 ID 重开的实例。查询不改编辑版本、不发 `draft-change`。

此能力仅覆盖本轮数值/日期及对应关闭保护。文字显式空串、非重建拖拽取消、OS 输入法与其他未验证项仍需后续验收，B03 整体尚未通过；默认 legacy 不获得 retained 保真承诺。
