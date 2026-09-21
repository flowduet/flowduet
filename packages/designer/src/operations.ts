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

/**
 * 探测第一个未被占用的元素 id（确定性序列，便于测试与调试）。
 * elementOf 对不存在的 id 抛错——此处正是借「抛错」判定 id 空闲（非误用异常）；
 * 内核若后续提供 hasElement(id) 非抛出式探测，应同步切换。
 */
function nextFreeId(model: BpmnModel, prefix: string): string {
  for (let i = 1; ; i++) {
    const id = `${prefix}${i}`;
    try {
      model.elementOf(id);
    } catch {
      return id;
    }
  }
}

/** 生成不与现有元素冲突的审批节点 id */
export function nextNodeId(model: BpmnModel): string {
  return nextFreeId(model, "approval_");
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
    // 分支块内唯一节点（前驱是多出边 fork、后继是多入边 join）：relay 会把 fork
    // 直连到配对 join，产出空分支，deriveBlockTree 渲染期显式抛错、视图崩溃。
    // 此处拒绝删除并保持模型不被改动；分支块的删除语义（块级删除等）属 #24。
    const prevIsFork = outgoingOf(model, prevId).length > 1;
    const nextIsJoin = incomingOf(model, nextId).length > 1;
    if (prevIsFork && nextIsJoin) {
      throw new Error(
        `节点 ${nodeId} 是分支块内唯一节点，删除会产生空分支（fork 直连 join），竖排推导不支持；分支块删除语义属 #24`,
      );
    }
    model.removeNode(nodeId);
    // 重链连线 id 走统一探测：节点 id 会被 nextNodeId 回收，若沿用
    // flow_${nodeId}_relay 定名，「删→他处插→再删」会撞已登记的旧重链连线
    model.addSequenceFlow({
      id: nextFreeId(model, "flow_relay_"),
      sourceRef: prevId,
      targetRef: nextId,
    });
    return;
  }
  model.removeNode(nodeId);
}
