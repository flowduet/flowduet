import { describe, expect, it } from "vitest";
import { BpmnModel, deriveBlockTree, flowableAdapter } from "@flowduet/core";
import { insertApprovalAfter, removeApprovalNode } from "./operations.js";

/**
 * operations 逻辑级测试：直接调视图操作函数验证模型树变更，不经组件渲染
 * （组件外部行为级冒烟见 designer.test.ts）。
 */

function chain(): BpmnModel {
  return BpmnModel.create({ processId: "ops_relay", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "approval_1", name: "经理审批", assignee: "${manager}" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
    .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "end" });
}

describe("removeApprovalNode 重链连线 id 唯一性", () => {
  it("节点 id 被回收后再删，重链连线不与残留重链连线撞 id", () => {
    const model = chain();
    // start → approval_1 → end
    insertApprovalAfter(model, "approval_1"); // 插入 approval_2：start→a1→a2→end
    removeApprovalNode(model, "approval_2"); // 删 a2，生成重链连线（a1→end），仍留在登记表
    // 改在 start 之后插入：nextNodeId 回收 approval_2，上一条重链连线未被摘除
    insertApprovalAfter(model, "start"); // 插入 approval_2：start→a2→a1→end
    // 再次删除 approval_2：需新建重链连线，旧连线仍占用命名空间——不得撞 id 抛错
    expect(() => removeApprovalNode(model, "approval_2")).not.toThrow();
  });
});

/** 分支块模型：fork→[分支1 仅 task_a]、[分支2 仅 task_b]→join */
function branchedChain(): BpmnModel {
  return BpmnModel.create({ processId: "ops_branch", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addParallelGateway({ id: "fork" })
    .addParallelGateway({ id: "join" })
    .addUserTask({ id: "task_a", name: "A", assignee: "${a}" })
    .addUserTask({ id: "task_b", name: "B", assignee: "${b}" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "fork" })
    .addSequenceFlow({ id: "f1", sourceRef: "fork", targetRef: "task_a" })
    .addSequenceFlow({ id: "f2", sourceRef: "task_a", targetRef: "join" })
    .addSequenceFlow({ id: "f3", sourceRef: "fork", targetRef: "task_b" })
    .addSequenceFlow({ id: "f4", sourceRef: "task_b", targetRef: "join" })
    .addSequenceFlow({ id: "f5", sourceRef: "join", targetRef: "end" });
}

/** 分支块模型（分支1 含两个任务）：fork→task_a1→task_a2→join */
function branchedChainMulti(): BpmnModel {
  return BpmnModel.create({ processId: "ops_branch_multi", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addParallelGateway({ id: "fork" })
    .addParallelGateway({ id: "join" })
    .addUserTask({ id: "task_a1", name: "A1", assignee: "${a}" })
    .addUserTask({ id: "task_a2", name: "A2", assignee: "${a}" })
    .addUserTask({ id: "task_b", name: "B", assignee: "${b}" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "fork" })
    .addSequenceFlow({ id: "f1", sourceRef: "fork", targetRef: "task_a1" })
    .addSequenceFlow({ id: "f2", sourceRef: "task_a1", targetRef: "task_a2" })
    .addSequenceFlow({ id: "f3", sourceRef: "task_a2", targetRef: "join" })
    .addSequenceFlow({ id: "f4", sourceRef: "fork", targetRef: "task_b" })
    .addSequenceFlow({ id: "f5", sourceRef: "task_b", targetRef: "join" })
    .addSequenceFlow({ id: "f6", sourceRef: "join", targetRef: "end" });
}

describe("removeApprovalNode 分支块删除守卫", () => {
  it("分支块内唯一节点：拒绝删除并明确报错，模型不被改动（#24 前守卫）", () => {
    const model = branchedChain();
    // 守卫前（旧行为）：relay 产出 fork→join 空分支，deriveBlockTree 渲染期崩溃
    expect(() => removeApprovalNode(model, "task_a")).toThrow(/空分支/);
    // 模型未被改动：块树仍可正常推导
    expect(() => deriveBlockTree(model)).not.toThrow();
  });

  it("分支内多任务时删首任务：不误伤，正常重链（守卫只拦空分支）", () => {
    const model = branchedChainMulti();
    // task_a1 是分支1 首节点但非唯一（prev=fork 多出边、next=task_a2 单入边）——合法删除
    expect(() => removeApprovalNode(model, "task_a1")).not.toThrow();
    expect(() => deriveBlockTree(model)).not.toThrow();
  });
});
