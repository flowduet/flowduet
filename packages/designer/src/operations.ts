import type { BpmnModel, ModdleElement, UserTaskSpec } from "@flowduet/core";
import { deriveBlockTree } from "@flowduet/core";
import type { BlockTreeNode } from "@flowduet/core";

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
 * 端点多出边形态退化为级联删除（由调用方语境保证合法性）。
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
      // 面向用户的可读提示（#24 评审 S7）：不暴露内部 API 名，指向 UI 上的操作入口
      const rawName = model.elementOf(nodeId).get("name");
      const label =
        rawName === undefined || String(rawName).trim() === "" ? nodeId : String(rawName);
      throw new Error(
        `「${label}」是分支内唯一节点，删除会留下空分支（fork 直连 join）；请改用「删除分支」或「删块」`,
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

// ---------- 分支块操作（#24）：加支路 / 删支路 / 删整块 / 默认分支 ----------

/** 在块树中递归查找 forkId 对应的块节点（渲染与块操作共用同一读视图） */
function findBlock(
  items: BlockTreeNode[],
  forkId: string,
): Extract<BlockTreeNode, { kind: "block" }> | undefined {
  for (const item of items) {
    if (item.kind === "block") {
      if (item.forkId === forkId) return item;
      for (const branch of item.branches) {
        const found = findBlock(branch, forkId);
        if (found !== undefined) return found;
      }
    }
  }
  return undefined;
}

/**
 * 校验 fork id 并返回配对 join id——配对关系取自 deriveBlockTree 块树
 * （渲染与块操作共用同一读视图），不做图遍历的第二套判定。
 */
function resolveFork(
  model: BpmnModel,
  forkId: string,
): {
  fork: ModdleElement;
  joinId: string;
  branchCount: number;
  /** 全量 fork→join 配对（良构图上一次建表，供级联删除查表；#24 评审 S6：不再重复推导） */
  joinMap: Map<string, string>;
} {
  let fork: ModdleElement;
  try {
    fork = model.elementOf(forkId);
  } catch {
    throw new Error(`分支块 ${forkId} 不存在`);
  }
  if (fork.$type !== "bpmn:ExclusiveGateway" && fork.$type !== "bpmn:ParallelGateway") {
    throw new Error(`节点 ${forkId} 不是网关，分支块操作只对 fork 网关生效`);
  }
  // 块树只推导一次：既定位 fork 的配对 join，又建全量 fork→join 表供级联删除复用
  const tree = deriveBlockTree(model);
  const block = findBlock(tree, forkId);
  if (block === undefined) {
    throw new Error(`网关 ${forkId} 不是分支块（单出边网关）或图不良构`);
  }
  const joinMap = new Map<string, string>();
  collectJoinMap(tree, joinMap);
  return { fork, joinId: block.joinId, branchCount: block.branches.length, joinMap };
}

/**
 * 向分支块追加一条空白支路（单审批节点）：fork→新节点→join。
 * 钉钉式心智的「添加分支」，块树分支数随 +1。
 * 两次 resolveFork 之间图处于中间态（新支路只接了一侧），良构检查会炸——
 * 因此只 resolve 一次，joinId 全程沿用。
 */
export function addBranchToBlock(model: BpmnModel, forkId: string): string {
  const { joinId } = resolveFork(model, forkId);
  const id = nextFreeId(model, "branch_node_");
  model.addUserTask({ id, name: "审批节点" });
  model.addSequenceFlow({
    id: nextFreeId(model, "flow_branch_in_"),
    sourceRef: forkId,
    targetRef: id,
  });
  model.addSequenceFlow({
    id: nextFreeId(model, "flow_branch_out_"),
    sourceRef: id,
    targetRef: joinId,
  });
  return id;
}

/** 收集块树中全部 fork→join 配对（良构图上一次性建表） */
function collectJoinMap(items: BlockTreeNode[], map: Map<string, string>): void {
  for (const item of items) {
    if (item.kind === "block") {
      map.set(item.forkId, item.joinId);
      for (const branch of item.branches) {
        collectJoinMap(branch, map);
      }
    }
  }
}

/**
 * 级联删除支路上 fork→join 之间的全部内容（#24 评审修复）：
 * 遇嵌套块（多出边网关）时先递归清其全部子支路再删网关本身——
 * 否则子支路节点泄漏成孤岛、或误入已删元素的出边表。
 * 嵌套配对查 joinMap（入口良构时一次建表）：删除进行中的图是中间态，
 * deriveBlockTree 的良构检查对它不再成立（addBranchToBlock 同款教训）。
 */
function removeBranchChain(
  model: BpmnModel,
  firstNodeId: string,
  joinId: string,
  joinMap: Map<string, string>,
): void {
  let curId: string | undefined = firstNodeId;
  while (curId !== undefined && curId !== joinId) {
    const outs = outgoingOf(model, curId);
    // 嵌套 fork：先递归清其全部子支路（join 由块级删除兜住），再删 fork 自身
    if (outs.length > 1) {
      const nestedJoinId = joinMap.get(curId);
      if (nestedJoinId === undefined) {
        throw new Error(`嵌套分支块 ${curId} 缺少配对 join（良构检查应在入口完成）`);
      }
      for (const flow of [...outs]) {
        const childFirst = (flow.get("targetRef") as ModdleElement).get("id") as string;
        if (childFirst !== nestedJoinId) {
          removeBranchChain(model, childFirst, nestedJoinId, joinMap);
        }
      }
      // 嵌套 join 出边唯一（钉钉式保证）。#24 评审 C2：outgoingOf 返回的是 moddle 上的
      // 活数组引用，removeNode 会 splice 清空它——必须在删之前把「首元素的 targetRef id」
      // 取成值，否则删完再读 joinOuts[0] 恒为 undefined，嵌套块之后的节点会静默漏删。
      const joinOutFlow = outgoingOf(model, nestedJoinId)[0];
      const afterNestedId =
        joinOutFlow === undefined
          ? undefined
          : ((joinOutFlow.get("targetRef") as ModdleElement).get("id") as string);
      model.removeNode(curId);
      model.removeNode(nestedJoinId);
      curId = afterNestedId;
      continue;
    }
    const next = outs[0];
    model.removeNode(curId);
    curId =
      next === undefined
        ? undefined
        : ((next.get("targetRef") as ModdleElement).get("id") as string);
  }
}

/**
 * 按支路索引删除一条支路（fork→首元素 上的出边定位）：
 * 级联删除该支路全部节点与连线；块至少保留两条支路。
 */
export function removeBranch(model: BpmnModel, forkId: string, branchIndex: number): void {
  const { joinId, branchCount, joinMap } = resolveFork(model, forkId);
  const branchFlows = outgoingOf(model, forkId);
  const flow = branchFlows[branchIndex];
  if (flow === undefined) {
    throw new Error(`分支块 ${forkId} 的支路 ${branchIndex + 1} 不存在`);
  }
  if (branchCount <= 2) {
    throw new Error(`分支块 ${forkId} 至少需要两条支路`);
  }
  const firstNodeId = (flow.get("targetRef") as ModdleElement).get("id") as string;
  // #24 评审 C1：删「含嵌套块的支路」必须走与 removeBlock 同一套递归级联，
  // 否则只沿 outs[0] 下行会漏删嵌套 fork 的其余子支路、泄漏孤儿节点、导出永久失败。
  // 校验（越界 / 至少两支）已全部前置，动刀前模型仍良构。
  removeBranchChain(model, firstNodeId, joinId, joinMap);
}

/**
 * 删除整块：fork、join 与全部支路级联，前后元素重链成直线。
 * fork 必须恰有一条入边（主链中间的块）；入边不唯一时拒绝。
 */
export function removeBlock(model: BpmnModel, forkId: string): void {
  const { joinId, joinMap } = resolveFork(model, forkId);
  const incoming = incomingOf(model, forkId);
  if (incoming.length !== 1) {
    throw new Error(`分支块 ${forkId} 的入边数是 ${incoming.length}，块级删除要求恰在主链中间`);
  }
  const prevId = (incoming[0]!.get("sourceRef") as ModdleElement).get("id") as string;
  const joinOuts = outgoingOf(model, joinId);
  const joinOut = joinOuts[0];
  if (joinOuts.length !== 1 || joinOut === undefined) {
    throw new Error(`join ${joinId} 出边必须唯一（钉钉式生成保证）`);
  }
  const nextId = (joinOut.get("targetRef") as ModdleElement).get("id") as string;
  // #24 评审 C3：本块若正是外层某支路的全部内容（前驱是外层 fork、后继是外层 join），
  // 重链 prev→next 会产出「外层 fork 直连外层 join」的空分支——deriveBlockTree 渲染期抛错、
  // 模型不可逆损坏。与 removeApprovalNode 的空分支防护同口径，在任何 removeNode 之前拒绝。
  const prevIsFork = outgoingOf(model, prevId).length > 1;
  const nextIsJoin = incomingOf(model, nextId).length > 1;
  if (prevIsFork && nextIsJoin) {
    throw new Error(
      `分支块 ${forkId} 是外层支路的全部内容，删块会留下空分支（fork 直连 join）；请改删外层支路，或先在支路内保留一个节点`,
    );
  }
  // 先删全部支路（引用 fork/join 的连线随之清理），再删 fork/join，最后重链
  const branchFlows = [...outgoingOf(model, forkId)];
  for (const flow of branchFlows) {
    const firstNodeId = (flow.get("targetRef") as ModdleElement).get("id") as string;
    removeBranchChain(model, firstNodeId, joinId, joinMap);
  }
  model.removeNode(forkId);
  model.removeNode(joinId);
  model.addSequenceFlow({
    id: nextFreeId(model, "flow_block_relay_"),
    sourceRef: prevId,
    targetRef: nextId,
  });
}

/**
 * 默认分支：设/切/清（传 null 清除）。
 * 内核三重守卫负责互斥与唯一性；此处额外按钉钉语义拒绝并行块。
 * index 是 fork 出边序（与支路渲染顺序一致）。
 */
export function setDefaultBranch(
  model: BpmnModel,
  forkId: string,
  branchIndex: number | null,
): void {
  const { fork } = resolveFork(model, forkId);
  if (fork.$type === "bpmn:ParallelGateway") {
    throw new Error("并行分支所有支路同时执行，没有默认分支");
  }
  if (branchIndex === null) {
    fork.set("default", undefined);
    return;
  }
  const flow = outgoingOf(model, forkId)[branchIndex];
  if (flow === undefined) {
    throw new Error(`分支块 ${forkId} 的支路 ${branchIndex + 1} 不存在`);
  }
  // 切换语义：直接覆盖引用（同块唯一由「覆盖」天然保证）；
  // 真正的守卫面是「默认流转不得带条件」——给已配条件的支路点默认即抛错
  const condition = flow.get("conditionExpression");
  if (condition !== undefined) {
    throw new Error(`支路 ${branchIndex + 1} 携带条件表达式，不能设为默认流转`);
  }
  fork.set("default", flow);
}

/**
 * 分支条件表达式（#24）：设（非空）或清（空串）排他网关出线的条件。
 * FormalExpression 在调用方模型树上的组装与内核 addSequenceFlow 同构；
 * 默认流转不得带条件——与网关 default 的互斥在这里显式校验
 * （清条件允许随时进行，不受默认标记影响）。
 */
export function setBranchCondition(model: BpmnModel, flowId: string, condition: string): void {
  let flow: ModdleElement;
  try {
    flow = model.elementOf(flowId);
  } catch {
    throw new Error(`连线 ${flowId} 不存在`);
  }
  if (flow.$type !== "bpmn:SequenceFlow") {
    throw new Error(`元素 ${flowId} 不是连线`);
  }
  const source = flow.get("sourceRef") as ModdleElement;
  if (source.$type !== "bpmn:ExclusiveGateway") {
    throw new Error(`连线 ${flowId} 的源不是排他网关，无条件可配`);
  }
  const trimmed = condition.trim();
  if (trimmed === "") {
    flow.set("conditionExpression", undefined);
    return;
  }
  if (source.get("default") === flow) {
    throw new Error(`支路 ${flowId} 是默认流转，不能携带条件表达式`);
  }
  // 与内核同构：FormalExpression 体，序列化时 moddle 自动补 xsi:type
  // （moddle 是 BpmnModel 公开 getter，DiLayout 同样经它复用建模实例）
  flow.set("conditionExpression", model.moddle.create("bpmn:FormalExpression", { body: trimmed }));
}

/**
 * 支路头连线 id（#24）：fork → 指定支路首元素的出线。
 * 与 removeBranch 同一定位语义（出边序 = 支路渲染序）。
 */
export function branchHeadFlowId(
  model: BpmnModel,
  forkId: string,
  branchIndex: number,
): string | undefined {
  // #24 评审 S8：读函数改为非抛出式——调用点（模板事件/渲染）拿到 undefined 即安全降级，
  // 不让半损态模型的异常冒进渲染期或事件处理器。
  let flow: ModdleElement | undefined;
  try {
    flow = outgoingOf(model, forkId)[branchIndex];
  } catch {
    return undefined;
  }
  return flow === undefined ? undefined : (flow.get("id") as string);
}

/** 判定支路是否为默认分支（渲染「· 默认」标记用；非排他网关或查不到恒 false） */
export function isDefaultBranch(model: BpmnModel, forkId: string, branchIndex: number): boolean {
  // 非抛出式（#24 评审 S8）：渲染期直接调用，查不到元素即返回 false，不带异常进渲染
  let gateway: ModdleElement;
  try {
    gateway = model.elementOf(forkId);
  } catch {
    return false;
  }
  if (gateway.$type !== "bpmn:ExclusiveGateway") return false;
  const flow = outgoingOf(model, forkId)[branchIndex];
  return flow !== undefined && gateway.get("default") === flow;
}
