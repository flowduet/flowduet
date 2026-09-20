import type { BpmnModel, ModdleElement, UserTaskSpec } from "@flowduet/core";

/**
 * 视图侧编辑操作：组合内核建模/编辑 API 成钉钉式交互语义
 * （加节点=当前节点之后、删中段节点=前后重链）。模型方法面见 core。
 */

function outgoingOf(model: BpmnModel, nodeId: string): ModdleElement[] {
  return (model.elementOf(nodeId).get("outgoing") as ModdleElement[] | undefined) ?? [];
}

function incomingOf(model: BpmnModel, nodeId: string): ModdleElement[] {
  return (model.elementOf(nodeId).get("incoming") as ModdleElement[] | undefined) ?? [];
}

/** 生成不与现有元素冲突的审批节点 id（确定性序列，便于测试与调试） */
export function nextNodeId(model: BpmnModel): string {
  for (let i = 1; ; i++) {
    const id = `approval_${i}`;
    try {
      model.elementOf(id);
    } catch {
      return id;
    }
  }
}

/**
 * 在链元素之后插入审批节点：摘掉 prev→next，接成 prev→新→next。
 * 仅支持单出边的链元素（事件/任务）；网关等多出边元素的分支内插入属 #24。
 */
export function insertApprovalAfter(
  model: BpmnModel,
  afterNodeId: string,
  spec: { name?: string; assignee?: string } = {},
): string {
  const outgoing = outgoingOf(model, afterNodeId);
  if (outgoing.length !== 1) {
    throw new Error(`节点 ${afterNodeId} 的出边数是 ${outgoing.length}，链上插入要求恰好 1 条`);
  }
  const nextFlow = outgoing[0];
  if (nextFlow === undefined) {
    throw new Error(`节点 ${afterNodeId} 没有后继连线`);
  }
  const nextId = (nextFlow.get("targetRef") as ModdleElement).get("id") as string;
  const id = nextNodeId(model);
  model.removeSequenceFlow(nextFlow.get("id") as string);
  const taskSpec: UserTaskSpec = { id, name: spec.name ?? "审批节点" };
  if (spec.assignee !== undefined) {
    taskSpec.assignee = spec.assignee;
  }
  model.addUserTask(taskSpec);
  model.addSequenceFlow({ id: `flow_${id}_in`, sourceRef: afterNodeId, targetRef: id });
  model.addSequenceFlow({ id: `flow_${id}_out`, sourceRef: id, targetRef: nextId });
  return id;
}

/**
 * 删除链中段节点并前后重链（prev→next 直连）；
 * 端点或多出边形态退化为级联删除（由调用方语境保证合法性）。
 * 开始/结束事件不允许删除——那是流程骨架。
 */
export function removeApprovalNode(model: BpmnModel, nodeId: string): void {
  const type = model.elementOf(nodeId).$type;
  if (type === "bpmn:StartEvent" || type === "bpmn:EndEvent") {
    throw new Error(`节点 ${nodeId} 是开始/结束事件，不允许删除`);
  }
  const incoming = incomingOf(model, nodeId);
  const outgoing = outgoingOf(model, nodeId);
  if (incoming.length === 1 && outgoing.length === 1) {
    const prevId = (incoming[0]!.get("sourceRef") as ModdleElement).get("id") as string;
    const nextId = (outgoing[0]!.get("targetRef") as ModdleElement).get("id") as string;
    model.removeNode(nodeId);
    model.addSequenceFlow({ id: `flow_${nodeId}_relay`, sourceRef: prevId, targetRef: nextId });
    return;
  }
  model.removeNode(nodeId);
}
