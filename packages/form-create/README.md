# @flowduet/form-create

FlowDuet 表单集成包（迭代三构建中）：承载**流程设计文档**的编解码与组合编辑装配。当前版本（#71）交付无表单流程的文档闭环——保存、恢复、继续编辑；表单设计与 FormCreate 装配在后续版本补齐，本包是它的落点。

> **边界（ADR-0006 / ADR-0009）**：`@flowduet/core` 与 `@flowduet/designer` 保持零 FormCreate 依赖；表单领域的内容（设计器、渲染、文档内表单定义）全部收敛在本包。宿主负责存储（文件、浏览器或后端），本包负责成套编解码与原子恢复。

## 安装

> 当前尚未发布到 npm（迭代三构建中，首个公开 alpha 随迭代三发版交付）；仓库内以 pnpm workspace 引用。

```sh
pnpm add @flowduet/form-create @flowduet/core @flowduet/designer
```

## 流程设计文档

外层 JSON 协议（首版，未知格式 / 版本 / 引擎明确拒绝，不自动迁移）：

| 字段      | 约定                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| `format`  | 固定 `flowduet.design`                                                         |
| `version` | 整数 `1`（文档协议版本）                                                       |
| `engine`  | 目标引擎适配器，当前仅 `flowable`                                              |
| `xml`     | 单流程 BPMN XML（含绑定引用，保存时生成可恢复 DI）                             |
| `forms`   | 文档内全部表单定义；**当前版本恒为空数组**，非空表单在保存与打开两侧都明确拒绝 |

流程结构与表单绑定以 XML 为事实源，外层不另存第二份可写关系。

## 使用

```ts
import { FlowDesignSession } from "@flowduet/form-create";

// 组合编辑会话：持有「模型 + 表单目录」整体状态；构造参数可选（裸会话先 newDesign）
const session = new FlowDesignSession(existingModel);

// 新建最小流程（开始 → 审批 → 结束，审批人未配 = 业务草稿）
const model = session.newDesign();

// 保存：业务草稿允许保存，待修复项随结果报告（部署导出仍会拦截）
const { json, pendingIssues } = await session.save();

// 打开：格式、XML 与可编辑结构全部校验通过后才整体替换，失败保留当前状态
const state = await session.open(json);
```

宿主只做文件 I/O 与展示（下载 Blob、读 File、把返回的模型接进 `DingtalkDesigner` / `BpmnCanvas`），文档算法不复制到宿主。

也可以绕开会话直接用纯函数：`saveDesignDocument(model, forms?)` / `openDesignDocument(text)`。

## 保存与部署导出的区别

| 入口                           | 业务配置未配齐（审批人 / 条件 / 收件人） | 产出                                |
| ------------------------------ | ---------------------------------------- | ----------------------------------- |
| `session.save()`               | 允许保存，`pendingIssues` 报告待修复项   | 带版本协议的设计文档 JSON           |
| `exportXml(model)`（designer） | 拦截并抛错                               | 裸 Flowable 方言 BPMN XML（部署用） |

两个入口在 Playground 中是两个独立按钮；单独导出的 XML 不含表单定义，完整恢复需要设计文档。

## 打开的拒绝口径

坏 JSON、未知 `format` / `version` / `engine`、多流程、超出钉钉式编辑子集的元素、竖排推导不可行的图形（循环、多开始事件、不可达元素）一律明确拒绝并保留当前状态。纯标准 BPMN 草稿（无 Flowable 命名空间）可以打开——缺少业务配置按草稿处理。

文档保存自证与打开均启用 `parse` 的 `rejectWarnings` 选项；重复 ID、未知元素等解析警告会阻止恢复，避免接受已经丢失内容的模型。`core.parse` 默认仍保持原有宽松行为。恢复时根据顺序流端点重建节点的 `incoming/outgoing` 引用，省略这些可选标记不会影响继续编辑或缺失条件校验。

## License

Apache-2.0
