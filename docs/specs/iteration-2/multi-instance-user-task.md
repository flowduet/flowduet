# Spec：多实例用户任务（会签 / 或签 / 依次审批）

- 状态：**骨架**——拆票前成稿
- 所属包：`packages/core`（模型 / 编译 / 解析 / 适配器）
- 域术语：见 CONTEXT.md「会签」「或签」「依次审批」

## 目标

内核支持多实例用户任务，承载钉钉式视图的多人审批节点三档形态；导出 XML 经 Flowable 6.8 部署冒烟验证。

## 已定决策

- 三档全上：会签（全员同意）、或签（任一人同意）、依次审批（按序逐人）；
- BPMN 形态 = `bpmn:UserTask` + `bpmn:MultiInstanceLoopCharacteristics`；会签与或签为非串行（`isSequential=false`）、差异仅在 `completionCondition`；依次审批为 `isSequential=true`；
- 节点拒绝语义（有人拒绝时节点如何失败）不在本 spec 范围（运行时话题，显式不做）。

## 待细化（成稿时逐项钉死）

1. 模型 API：`addMultiInstanceUserTask(spec)` 的入参形态——审批人集合（表达式 collection vs 人数 cardinality）、`elementVariable` 命名、完成方式枚举；
2. 完成条件表达式由内核按三档固化，还是允许调用方自定义覆盖（覆盖面与往返保真的边界）；
3. 适配器合同扩展：`TaskKind` 是否新增多实例任务类，方言属性面（`flowable:assignee` 与多实例的组合形态）在 Flowable 6.8 上的落法；
4. 基准文件：三档各一份最小合法 XML（含 `bpmndi`），部署冒烟兜底合法性；
5. 钉钉式映射链：多人审批节点（视图层 spec）→ 本模型的字段对齐表。

## 验收要点

- 编译合同：三档基准文件逐字一致；
- 往返保真：三档 XML `parse → model → compile` 语义等价；
- 适配器合同：扩展后的任务映射三要点全覆盖；
- Flowable 6.8 部署冒烟通过（本地 Docker + CI workflow_dispatch）。
