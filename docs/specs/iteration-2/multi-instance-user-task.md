# Spec：多实例用户任务（会签 / 或签 / 依次审批）

- 状态：**成稿**（2026-09-20；prototype 结论 + grilling R1/R5 折入，拆票依据）
- 原型依据：分支 `prototype/iter2-vertical-layout-mi`（primary source，含反例全集与运行时探针）
- 域术语：CONTEXT.md「审批节点」「会签」「或签」「依次审批」

## Problem Statement

审批流配置者需要多人审批节点：部门会签要所有人同意、或签任一人同意即可、依次审批按顺序逐个过。当前内核只有单人用户任务（`assignee` 单值），多人审批建不出来——导出的 XML 没有多实例形态，Flowable 里跑不出逐人待办。

## Solution

内核提供语义化建模 API `addApprovalTask`：传入审批人集合表达式与完成方式三档枚举，内核固化三档的多实例形态（非串行 × 完成条件差异、串行形态），导出即为合法可执行的多实例用户任务 XML。

## User Stories

1. 作为审批流配置者，我想给审批节点配置多名审批人，这样协作场景能按人逐一产生待办。
2. 作为审批流配置者，我想选择「会签」，这样所有审批人同意后节点才通过。
3. 作为审批流配置者，我想选择「或签」，这样任一审批人同意后节点立即通过。
4. 作为审批流配置者，我想选择「依次审批」，这样审批人按顺序逐个处理。
5. 作为审批流配置者，我想给节点命名，这样待办列表里认得出这个节点。
6. 作为宿主开发者，我想用集合变量注入审批人名单，这样名单在运行时才确定（如发起时选人）。
7. 作为宿主开发者，我想三档复用同一集合变量，这样不为串行另造数据形态。
8. 作为 Flowable 运维，我想部署含多实例的流程定义一次通过，这样引擎校验不报 multi-instance 缺参。
9. 作为 Flowable 运维，我想启动实例后看到逐人任务与正确 assignee，这样确认扩展属性真实生效。
10. 作为内核嵌入开发者，我想建模 API 挂在模型树方法面，这样连线端点校验与登记表天然生效。
11. 作为内核嵌入开发者，我想完成方式是封闭枚举，这样没人能传自定义完成条件绕过三档语义。
12. 作为内核嵌入开发者，我想导入的多实例 XML 能再次导出等价形态，这样往返保真不变量不破。

## Implementation Decisions

- **API 形态**（原型验证的语义形态）：

```ts
addApprovalTask({
  id: "counter_sign",
  name?: "部门会签",
  collection: "approvers",            // 审批人集合，裸变量名（运行时注入）
  mode: "all" | "any" | "sequential", // 会签 / 或签 / 依次
  elementVariable?: "assignee",       // 逐实例变量名
})
```

- **三档固化**：会签 = 非串行 + 完成条件 `${nrOfCompletedInstances == nrOfInstances}`；或签 = 非串行 + `${nrOfCompletedInstances >= 1}`；依次 = `isSequential="true"` 且不写完成条件。完成条件**不开放覆盖**；向 sequential 档传完成相关覆盖直接抛错（守卫已原型验证）。
- `isSequential=false` 是 XSD 缺省，序列化时省略属性（bpmn.io 同款行为，原型验证合法）。
- 审批人集合用**裸变量名**的集合表达式；`loopCardinality` 落法否决（Expression 元素序列化崩 + 拿不到逐人审批人，原型反例表）。
- **API 必须进模型树方法面**：外挂函数拿不到私有登记表，连连线端点校验都无法复用（原型反例）。
- **不经任务类型映射**：多实例是 BPMN 标准语义而非方言差异，专用方法直建用户任务；TaskKind 映射合同本 spec 不动。
- **描述符扩展**（随正式适配器落）：`MultiInstanceLoopCharacteristics` 扩 `collection`、`elementVariable` 两属性（`assignee` 已有）。
- **方言 XML 形态**（原型实测：6.8 部署 + 启动 + assignee 逐人验证全过）：

```xml
<bpmn:userTask id="counter_sign" name="部门会签" flowable:assignee="${assignee}">
  <bpmn:multiInstanceLoopCharacteristics isSequential="false"
      flowable:collection="approvers" flowable:elementVariable="assignee">
    <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">${nrOfCompletedInstances == nrOfInstances}</bpmn:completionCondition>
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:userTask>
```

- **前提已结案**：flowable 命名空间 URI 缺陷已修（`http://flowable.org/bpmn`，core 0.1.2 已发、冒烟已带运行时断言）——多实例扩展属性依赖此修复。

## Testing Decisions

- 只断言外部行为，不断内部结构。三条既有链扩展：
  - **编译合同**：三档基准文件（含 bpmndi）逐字一致；
  - **往返保真**：三档 `parse → compile` 语义等价，重点 `loopCharacteristics` 子元素与扩展属性的往返；
  - **适配器合同**：描述符扩展后命名空间前缀、属性注入点、任务映射三要点仍全绿。
- 基准文件三份（all / any / sequential），沿用「手写最小合法 XML + 部署兜底」口径。
- **冒烟升级**：6.8 部署 + 启动实例 + assignee 逐人断言（原型探针脚本可直接搬进 scripts/）——迭代一「只断言部署注册」的教训已由命名空间缺陷实锤。
- 先例：迭代一三条测试链与 `minimal-flow` 基准；原型 `mi-approval.play.test.ts` 的断言形态。

## Out of Scope

节点拒绝语义（有人拒绝时节点/流程走向——运行时话题）、完成条件自定义覆盖、比例通过（如 2/3 多数）、多实例的服务/脚本任务（仅用户任务）、异步实例、加签/减签（ADR-0004 边界外）。

## Further Notes

反例全集（`loopDataInputRef` 破坏往返、外挂建模进不了登记表、哑坐标绕行等）见原型 README；「文档 URI 静默失联」的定位过程见原型 `ns-probe.sh` 双变量对照。
