# @flowduet/form-create

FlowDuet 表单集成包（迭代三构建中）：承载**流程设计文档**的编解码与组合编辑装配，并封装真实的 [FormCreate](https://github.com/xaboy/form-create-designer) 开源设计器与 Element Plus 渲染器。当前版本（#72–#74）交付：八类常用字段与基础栅格布局的表单设计、多表单目录管理（新建 / 改名 / 删除守卫）、流程默认绑定与审批节点显式覆盖、文档往返、真实渲染器试填与组合部署导出。

> **边界（ADR-0006 / ADR-0009）**：`@flowduet/core` 与 `@flowduet/designer` 保持零 FormCreate 依赖；表单领域的内容（设计器、渲染、文档内表单定义）全部收敛在本包。宿主负责存储（文件、浏览器或后端），本包负责成套编解码与原子恢复。不使用 FormCreate Pro 与 AI 助理（设计器 AI 模块已关闭）。

## 安装

> 当前尚未发布到 npm（迭代三构建中，首个公开 alpha 随迭代三发版交付）；仓库内以 pnpm workspace 引用。

```sh
pnpm add @flowduet/form-create @flowduet/core @flowduet/designer element-plus vue
```

样式（宿主显式引入；本包 style.css 已内联 FormCreate 设计器样式）：

```ts
import "@flowduet/form-create/style.css";
import "element-plus/dist/index.css";
```

锁定的外部依赖：`@form-create/designer@3.5.0` + `@form-create/element-ui@3.3.4`（Vue 3 / Element Plus 线，peer `vue ^3.5`）。注意 npm 上 `latest` 标签是 Vue 2 线、`next` 标签会漂移——请勿混装其他版本。

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
| 字段     | 文本 / 多行文本（input）               | 多行文本是 `props.type=textarea` 形态，组件类型同为 input              |
| 字段     | 数字（inputNumber）                    | 默认值支持数字 `0`（与空值语义区分，往返不丢失）                       |
| 字段     | 单选（radio）、多选（checkbox）        | 静态选项配置（label / value），默认值按各组件值类型保留                |
| 字段     | 下拉单选（select）                     | 仅单选形态；`multiple` 多选超出范围，导入侧明确拒绝                    |
| 字段     | 日期单值（datePicker）                 | 仅单值形态（date / datetime / week / month / year 等）；范围形态拒绝  |
| 字段     | 开关（switch）                         | 默认值支持 `false`（与未设置语义区分，往返不丢失）                     |
| 布局     | 栅格布局（fcRow + col）                | 基础行列布局；栅格只能位于顶层、列内放字段，嵌套栅格明确拒绝           |
| 字段配置 | 默认值、必填、选项、字段顺序           | 验证面板只保留必填；选项仅静态编辑                                    |

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

## 打开的拒绝口径

坏 JSON、未知 `format` / `version` / `engine`、多流程、超出钉钉式编辑子集的元素、竖排推导不可行的图形（循环、多开始事件、不可达元素）、结构坏的表单定义（重复 id / 空名 / 未知提供者 / 坏 JSON / 超出开放范围的字段或布局，含下拉多选、日期范围、远程数据源、嵌套栅格）一律明确拒绝并保留当前状态。纯标准 BPMN 草稿（无 Flowable 命名空间）可以打开——缺少业务配置按草稿处理。

文档保存自证与打开均启用 `parse` 的 `rejectWarnings` 选项；重复 ID、未知元素等解析警告会阻止恢复，避免接受已经丢失内容的模型。`core.parse` 默认仍保持原有宽松行为。恢复时根据顺序流端点重建节点的 `incoming/outgoing` 引用，省略这些可选标记不会影响继续编辑或缺失条件校验。

## License

Apache-2.0
