# @flowduet/designer

FlowDuet 钉钉式设计器：纵向列表加节点、抽屉里配置，一切编辑直接读写 [BpmnModel](https://www.npmjs.com/package/@flowduet/core) 模型树——视图无独立状态，与 BPMN 只读画布共享同一棵模型树。

> **特性边界（ADR-0004）**：钉钉式视图严格限定为 BPMN 可表达子集的语法糖——它画不出 BPMN 表达不了的流程，这是保真特性而非缺陷。加签、任意回退等国内审批流特色能力，通过引擎适配器的扩展属性落地，不在模型层发明私有节点类型。

## 安装

```sh
pnpm add @flowduet/designer @flowduet/core element-plus vue
```

样式（vite 库模式不自动注入，宿主须显式引入）：

```ts
import "@flowduet/designer/style.css";
import "element-plus/dist/index.css";
```

若使用 `BpmnCanvas`，宿主还需显式安装 Vue Flow 的样式提供包，并引入其基础样式；`@flowduet/designer/style.css` 提供本包样式，不代替 Vue Flow 基础样式。只使用 `DingtalkDesigner` 时不需要这一步。

```sh
pnpm add @vue-flow/core@^1.48.2
```

```ts
import "@vue-flow/core/dist/style.css";
```

TypeScript 接入以 Vue/Vite 的 `moduleResolution: "Bundler"` 为验证口径；Vue SFC 声明并不保证在纯 `NodeNext` 配置中可直接解析。`@flowduet/core` 可独立用于 Node 环境。

## 使用

```vue
<script setup lang="ts">
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { BpmnCanvas, DingtalkDesigner, exportXml } from "@flowduet/designer";

const model = BpmnModel.create({ processId: "demo", adapter: flowableAdapter })
  .addStartEvent({ id: "start", name: "开始" })
  .addUserTask({ id: "t1", name: "经理审批", assignee: "${manager}" })
  .addEndEvent({ id: "end", name: "结束" })
  .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
  .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });

async function doExport(): Promise<string> {
  // 钉钉式零坐标建模：导出固定走竖排布局，产出合法 bpmndi
  return exportXml(model);
}
</script>

<template>
  <!-- 编辑视图：挂模型实例即得；change 在每次编辑成功后触发 -->
  <DingtalkDesigner :model="model" @change="..." />
  <!-- 只读画布：与编辑视图共享同一模型实例，互切零转换 -->
  <BpmnCanvas :model="model" />
</template>
```

## 能力面（iteration-2）

- 节点：审批（单签 / 会签 / 或签 / 依次多实例三档）、抄送、条件分支（条件表达式 + 默认分支）、并行分支；
- 抽屉字段：节点名、审批人（单人为字面量/表达式，多人为集合变量名）、完成方式、条件表达式、抄送收件人、formKey 占位；
- 导出：`exportXml(model)` 产出 Flowable 方言 XML（合法可执行承诺，部署冒烟兜底）。审批人、抄送收件人或非默认条件支路尚未配置时，草稿仍可编辑，但导出会抛出包含节点或支路 ID 的错误。
- 草稿扫描：`collectDraftIssues(model)` 返回上述待修复项列表而不抛错，供「保存草稿 + 报告待修复项」的链路（如 `@flowduet/form-create` 的设计文档保存）复用同一口径。
- 表单集成接缝（#72）：`DingtalkDesigner` 接收中立的 `formOptions`（`{ id, name }[]`，不依赖任何表单实现）——传入即展示「流程默认表单」选择条与审批节点的有效表单摘要（继承默认 / 节点指定 / 引用失效），不传则纯流程形态完全不变；`isCcServiceTask(element)` 公开抄送形态判定。默认引用经 `BpmnModel.setDefaultFormKey()` 读写（`flowduet:defaultFormKey`，由 core 统一注册）。
- 未提交内容收集（#76）：抽屉里的字段缓冲点「确定」才写模型。宿主在保存设计前可调用组件方法 `DingtalkDesigner#commitPendingChanges(options?)`——抽屉打开时执行与「确定」同一套守卫并把当前输入写入模型（成功后关闭抽屉、触发 `change`），守卫拦截（如多人集合变量格式非法）返回 `false` 且抽屉保持打开，宿主应中止保存而不是绕过守卫；抽屉未打开时为无操作。抽屉字段被编辑时组件上抛 `draft-change` 事件，未提交输入同样计入宿主的「未保存修改」判定（如替换当前设计前的确认提示）。宿主保存业务草稿时可显式传入 `{ allowIncomplete: true }`，允许空集合变量、空抄送收件人及插入占位收件人落盘，由草稿诊断报告待修复项；非空非法集合格式仍拒绝。默认调用与普通「确定」保持严格。抽屉为非模态展示：切换目标前提交当前缓冲，格式校验失败则停留原节点；提供 `formOptions` 的集成宿主按草稿路径收集，纯流程宿主保持严格校验。

## 节点属性抽屉的实例外观（#103）

省略 `appearance` 时保持原有抽屉外观和行为。传入合法对象才显式启用新适配：

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DingtalkDesigner, type ComponentAppearance } from "@flowduet/designer";
import "@flowduet/designer/style.css";
import "element-plus/dist/index.css";

// 跟随宿主时必须声明宿主当前的 EP 主题；本组件不会切换宿主 html/body 深色类。
const appearance = ref<ComponentAppearance | undefined>({ mode: "light" });

function useCompactBrand(): void {
  appearance.value = { colorSource: "brand", mode: "dark", density: "compact" };
}

function useLegacyAppearance(): void {
  appearance.value = undefined;
}
</script>

<template>
  <DingtalkDesigner :model="model" :appearance="appearance" />
</template>
```

| 配置项        | 取值                         | 默认值        | 说明                                                                 |
| ------------- | ---------------------------- | ------------- | -------------------------------------------------------------------- |
| `colorSource` | `host` / `brand`             | `host`        | 跟随宿主或 FlowDuet 品牌预设；首批不开放任意种子或 token 覆盖 API    |
| `mode`        | `light` / `dark`             | 必填          | `host` 时须与宿主当前 EP 主题一致；`brand` 可按实例独立于宿主主题    |
| `density`     | `comfortable` / `compact`    | `comfortable` | 分别对应 EP `default` / `small`，实测控件高度为 32px / 24px          |

跟随宿主只读取宿主当前 EP 主色、中性色、字体与圆角，为抽屉自有卡片和原生选择器派生 `--fd-*` 角色，**不写入任何 `--el-*` 变量（含实例范围）**。品牌预设只在所选抽屉内写入局部 EP 变量，不影响画布、节点卡片、流程默认表单条、其他实例或无关宿主控件。抽屉的非模态、覆盖层、节点切换与提交行为保持既有合同。

运行中修改配色、主题、密度以及启用／停用都保留未提交输入、焦点和输入法组合，不自动确定／取消，也不修改模型或 BPMN XML。更新时请替换整个 `appearance` 对象引用，不依赖对原对象字段的深度变更侦测。JavaScript 传入非法对象或枚举时会整份拒绝：已有合法配置则保持上次有效呈现，首次非法则保持旧路径，并通过 `console.warn` 报告具体字段和原因。合法停用与非法回退是两条不同路径。

`@flowduet/designer` 包根同时导出 `ComponentAppearance`、`ResolvedComponentAppearance` 及其枚举类型，以及供其他 FlowDuet 组件复用的 `resolveComponentAppearance(value, previous?)`。后者补全合法配置；`previous` 传入当前有效结果时用于非法回退，合法省略返回 `undefined`，调用方应在合法停用后清空自己的 `previous`，避免后续非法输入复活旧主题。

当前仅 **DingtalkDesigner 的节点属性抽屉**完成本适配；`FormPreview` 由后续切片交付。`propertyEditing="external"` 不渲染抽屉，合法 `appearance` 没有可见效果，也不影响宿主自有属性面板。原生 `select` 的系统选项弹层外观受浏览器和操作系统限制，不为像素一致替换成 `ElSelect`。

首批验证环境为单份 Element Plus 2.14.6 与桌面 Chromium；其他 EP 版本、Firefox、Safari／WebKit、移动端、真实操作系统中文输入法及完整可访问性认证尚未验证。

## License

Apache-2.0（见 [LICENSE](./LICENSE)）
