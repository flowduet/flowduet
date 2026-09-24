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

## License

Apache-2.0
