# @flowduet/core

FlowDuet 内核：一棵 BPMN 2.0 模型树（moddle）+ Parser/Compiler + 引擎适配器 + DI 布局。XML 是唯一事实源——所有编辑最终落在模型树上，`compile()` 产出目标引擎方言的合法可执行 BPMN。

> **零表单依赖（ADR-0006 / ADR-0009）**：core 只定义「节点 ↔ 表单」引用协议（formKey / 默认表单），不依赖任何表单库；表单设计、渲染与文档编解码在 `@flowduet/form-create`，不用表单的宿主可不装。

## 安装

```sh
pnpm add @flowduet/core
```

无 peer 依赖，Node 与浏览器均可运行（唯一运行时依赖是 bpmn-moddle）。

## 建模与编译

```ts
import { BpmnModel, flowableAdapter, compile } from "@flowduet/core";

const model = BpmnModel.create({ processId: "leave_approval", adapter: flowableAdapter })
  .addStartEvent({ id: "start", name: "开始" })
  .addUserTask({ id: "t1", name: "经理审批", assignee: "${manager}" }) // 单签：普通用户任务
  .addApprovalTask({
    id: "t2",
    name: "会签",
    mode: "all", // 多实例三档：all 会签 / any 或签 / sequential 依次审批
    collection: "approvers", // 审批人集合：裸变量名，运行时由流程变量注入名单
  })
  .addEndEvent({ id: "end", name: "结束" })
  .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
  .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "t2" })
  .addSequenceFlow({ id: "f3", sourceRef: "t2", targetRef: "end" });

// 编译为 Flowable 6.8 方言 XML（assignee / collection / elementVariable 等扩展属性落盘）。
// 零坐标建模导出须传竖排布局推导 DI（parse 出的模型自带 DI，用默认 IdentityDiLayout 即可）
const xml = await compile(model, { diLayout: verticalDiLayout() });
```

- **审批节点**：单签是 `addUserTask`（普通用户任务，`assignee` 表达式或字面量）；多人形态走 `addApprovalTask`——`mode` 三档（`all` 会签 / `any` 或签 / `sequential` 依次审批）映射多实例用户任务，`collection` 是审批人集合的裸变量名；
- **其他元素**：`addUserTask` / 抄送服务任务（`addTask("cc", ...)`）、`addExclusiveGateway`（条件分支）/ `addParallelGateway`（并行分支）、`addStartEvent` / `addEndEvent`、`addSequenceFlow`；
- **DI 布局**：零坐标建模时经 `verticalDiLayout` 推导竖排布局（`exportXml` 见 `@flowduet/designer`，固定走竖排）；
- **可执行承诺**：编译产物经真实 Flowable 6.8 REST 部署冒烟验证（含实例启动与任务 assignee 运行时断言），不是「合法 XML」而是「合法可执行」。

## 解析与往返

```ts
import { parse, compile, flowableAdapter } from "@flowduet/core";

const model = await parse(xml, { adapter: flowableAdapter }); // 引擎方言 XML → 模型树
await compile(model); // 往返保真：parse → compile 语义等价（parse 出的模型自带 DI）
```

`parse` 默认宽松（未注册命名空间的属性收进 `$attrs` 不报错）；两个 opt-in 选项供严格场景使用：

- `rejectWarnings`：重复 ID、未知元素等解析警告转为异常——设计文档恢复等「不接受静默丢失」的路径使用；
- `rejectUnregisteredNamespaces`：按命名空间 URI 与**实际使用内容**审计引擎扩展——真实使用了当前适配器不支持的扩展（如 camunda）时抛 `UnregisteredNamespaceError` 并点名前缀、URI、限定名与行号；仅声明未使用不构成冲突，同 URI 换前缀照常识别。

## 引擎适配器

```ts
import { flowableAdapter, assertAdapterContract } from "@flowduet/core";
```

适配器收敛三点：命名空间前缀、扩展属性 schema、任务类型映射。`flowableAdapter` 是首发实现（命名空间 `http://flowable.org/bpmn`）；`assertAdapterContract` 是适配器合同测试入口，新引擎适配器必须通过。

## 表单绑定协议（仅引用，不含表单实现）

```ts
import { resolveEffectiveForm } from "@flowduet/core";

model.setDefaultFormKey("form_apply_v1"); // 流程默认：bpmn:Process 上的 flowduet:defaultFormKey
// 节点显式覆盖：建模时 spec.formKey → flowable:formKey
resolveEffectiveForm(model, "t1");
// → 覆盖优先、否则默认、均未指定为无表单；网关与抄送不参与解析
```

默认继承是 FlowDuet 的设计协议——Flowable 引擎**不会**自动加载或渲染表单，宿主需用 `resolveEffectiveForm` 自行接入运行时。

## 版本

`CORE_VERSION` 导出当前内核版本，供集成方做健康检查（与 package.json 版本一致，防漂移测试钉住）。

## License

Apache-2.0（见 [LICENSE](./LICENSE)）
