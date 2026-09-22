import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { deriveBlockTree } from "@flowduet/core";
import {
  addBranchToBlock,
  removeApprovalNode,
  removeBlock,
  removeBranch,
  setDefaultBranch,
} from "./operations.js";

/**
 * 分支块交互（#24）：块内加支路 / 删支路 / 删整块 / 默认分支切换。
 * 契约基于 deriveBlockTree 的块树读视图（与渲染共用），编辑后块树必须
 * 反映正确——导出由既有链保证。
 */

/** 最小条件分支：开始 → fork{ 条件A→审批A；条件B→审批B } → join → 结束 */
function buildBranching(): BpmnModel {
  return BpmnModel.create({ processId: "branch_ops", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "before", name: "前置" })
    .addExclusiveGateway({ id: "fork1", name: "判断" })
    .addUserTask({ id: "a_node", name: "审批A" })
    .addUserTask({ id: "b_node", name: "审批B" })
    .addExclusiveGateway({ id: "join1", name: "汇聚" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "before" })
    .addSequenceFlow({ id: "f1", sourceRef: "before", targetRef: "fork1" })
    .addSequenceFlow({ id: "fa", sourceRef: "fork1", targetRef: "a_node" })
    .addSequenceFlow({ id: "fb", sourceRef: "fork1", targetRef: "b_node" })
    .addSequenceFlow({ id: "fa_j", sourceRef: "a_node", targetRef: "join1" })
    .addSequenceFlow({ id: "fb_j", sourceRef: "b_node", targetRef: "join1" })
    .addSequenceFlow({ id: "fj", sourceRef: "join1", targetRef: "end" });
}

function blockOf(
  model: BpmnModel,
): Extract<ReturnType<typeof deriveBlockTree>[number], { kind: "block" }> {
  const tree = deriveBlockTree(model);
  const block = tree.find((n) => n.kind === "block");
  if (block?.kind !== "block") throw new Error("场景缺少分支块");
  return block;
}

describe("addBranchToBlock", () => {
  it("条件块加支路：新支路带空白审批节点，块树分支数 +1", () => {
    const model = buildBranching();
    const before = blockOf(model).branches.length;
    const nodeId = addBranchToBlock(model, "fork1");
    const block = blockOf(model);
    expect(block.branches).toHaveLength(before + 1);
    // 新支路节点存在且接在 fork 与 join 之间
    expect(model.elementOf(nodeId).$type).toBe("bpmn:UserTask");
  });

  it("并行块同样支持加支路", () => {
    const model = BpmnModel.create({ processId: "par_ops", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addParallelGateway({ id: "pfork" })
      .addUserTask({ id: "p1" })
      .addUserTask({ id: "p2" })
      .addParallelGateway({ id: "pjoin" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "pfork" })
      .addSequenceFlow({ id: "fa", sourceRef: "pfork", targetRef: "p1" })
      .addSequenceFlow({ id: "fb", sourceRef: "pfork", targetRef: "p2" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "p1", targetRef: "pjoin" })
      .addSequenceFlow({ id: "fb_j", sourceRef: "p2", targetRef: "pjoin" })
      .addSequenceFlow({ id: "fj", sourceRef: "pjoin", targetRef: "end" });
    const nodeId = addBranchToBlock(model, "pfork");
    expect(deriveBlockTree(model).find((n) => n.kind === "block")).toMatchObject({
      kind: "block",
    });
    expect(model.elementOf(nodeId).$type).toBe("bpmn:UserTask");
  });

  it("fork id 不存在或不是多出边网关即抛错", () => {
    const model = buildBranching();
    expect(() => addBranchToBlock(model, "nope")).toThrow(/不存在|网关/);
    expect(() => addBranchToBlock(model, "before")).toThrow(/网关/);
  });
});

describe("removeBranch", () => {
  it("按支路索引删支路：级联节点与连线，块树分支数 -1", () => {
    const model = buildBranching();
    addBranchToBlock(model, "fork1"); // 3 支路
    removeBranch(model, "fork1", 1);
    const block = blockOf(model);
    expect(block.branches).toHaveLength(2);
    expect(() => model.elementOf("b_node")).toThrow();
    expect(() => model.elementOf("a_node")).not.toThrow();
  });

  it("两支路块拒绝删支（块至少两支）", () => {
    const model = buildBranching();
    expect(() => removeBranch(model, "fork1", 0)).toThrow(/至少需要两条支路/);
  });

  it("支路索引越界即抛错", () => {
    const model = buildBranching();
    expect(() => removeBranch(model, "fork1", 5)).toThrow(/支路 6 不存在/);
  });
});

describe("removeBlock", () => {
  it("删整块：fork/join 与全部支路级联，前后重链成直线", () => {
    const model = buildBranching();
    removeBlock(model, "fork1");
    expect(() => model.elementOf("fork1")).toThrow();
    expect(() => model.elementOf("join1")).toThrow();
    expect(() => model.elementOf("a_node")).toThrow();
    expect(() => model.elementOf("b_node")).toThrow();
    // before → end 直连重链
    const outgoing =
      (model.elementOf("before").get("outgoing") as { get(k: string): unknown }[]) ?? [];
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]!.get("targetRef")).toBeDefined();
  });

  it("fork id 不存在即抛错", () => {
    expect(() => removeBlock(buildBranching(), "nope")).toThrow(/不存在/);
  });
});

describe("setDefaultBranch", () => {
  it("设默认：落网关 default 引用；切到另一支自动转移", () => {
    const model = buildBranching();
    setDefaultBranch(model, "fork1", 0);
    const fork = model.elementOf("fork1");
    expect((fork.get("default") as { get(k: string): unknown }).get("id")).toBe("fa");
    // 切换：另一支成为默认
    setDefaultBranch(model, "fork1", 1);
    expect((fork.get("default") as { get(k: string): unknown }).get("id")).toBe("fb");
  });

  it("传 null 清除默认", () => {
    const model = buildBranching();
    setDefaultBranch(model, "fork1", 0);
    setDefaultBranch(model, "fork1", null);
    expect(model.elementOf("fork1").get("default")).toBeUndefined();
  });

  it("并行块拒绝默认分支", () => {
    const model = BpmnModel.create({ processId: "par_default", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addParallelGateway({ id: "pfork" })
      .addUserTask({ id: "p1" })
      .addUserTask({ id: "p2" })
      .addParallelGateway({ id: "pjoin" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "pfork" })
      .addSequenceFlow({ id: "fa", sourceRef: "pfork", targetRef: "p1" })
      .addSequenceFlow({ id: "fb", sourceRef: "pfork", targetRef: "p2" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "p1", targetRef: "pjoin" })
      .addSequenceFlow({ id: "fb_j", sourceRef: "p2", targetRef: "pjoin" })
      .addSequenceFlow({ id: "fj", sourceRef: "pjoin", targetRef: "end" });
    expect(() => setDefaultBranch(model, "pfork", 0)).toThrow(/并行分支.*没有默认分支/);
  });
});

describe("块内删除守卫（#23 的临时拒绝语义保持）", () => {
  it("分支块内唯一节点删除仍被拒绝（空分支防护）", () => {
    const model = buildBranching();
    expect(() => removeApprovalNode(model, "a_node")).toThrow(/空分支/);
    expect(() => model.elementOf("a_node")).not.toThrow();
  });
});

describe("嵌套块删除（评审修复：递归级联）", () => {
  /** 条件块嵌条件块：外层支2 内含 {整改, 归档} 两支的内层块 */
  function buildNested(): BpmnModel {
    return BpmnModel.create({ processId: "nested_ops", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addExclusiveGateway({ id: "outer_fork" })
      .addUserTask({ id: "x_node" })
      .addUserTask({ id: "y_node" })
      .addExclusiveGateway({ id: "inner_fork" })
      .addUserTask({ id: "r_node" })
      .addUserTask({ id: "arch_node" })
      .addExclusiveGateway({ id: "inner_join" })
      .addExclusiveGateway({ id: "outer_join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "outer_fork" })
      .addSequenceFlow({ id: "fx", sourceRef: "outer_fork", targetRef: "x_node" })
      .addSequenceFlow({ id: "fy", sourceRef: "outer_fork", targetRef: "y_node" })
      .addSequenceFlow({ id: "fy_i", sourceRef: "y_node", targetRef: "inner_fork" })
      .addSequenceFlow({ id: "fi_r", sourceRef: "inner_fork", targetRef: "r_node" })
      .addSequenceFlow({ id: "fi_a", sourceRef: "inner_fork", targetRef: "arch_node" })
      .addSequenceFlow({ id: "fr_j", sourceRef: "r_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "arch_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fij_oj", sourceRef: "inner_join", targetRef: "outer_join" })
      .addSequenceFlow({ id: "fx_oj", sourceRef: "x_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "foj_e", sourceRef: "outer_join", targetRef: "end" });
  }

  it("删内层支路：仅收缩内层块，外层结构完好", () => {
    const model = buildNested();
    addBranchToBlock(model, "inner_fork"); // 内层 3 支
    removeBranch(model, "inner_fork", 0);
    expect(() => model.elementOf("r_node")).toThrow();
    expect(() => model.elementOf("arch_node")).not.toThrow();
    expect(() => model.elementOf("x_node")).not.toThrow();
  });

  it("删内层整块：内层 fork/join 与两支级联，外层支路只剩 y_node", () => {
    const model = buildNested();
    removeBlock(model, "inner_fork");
    expect(() => model.elementOf("inner_fork")).toThrow();
    expect(() => model.elementOf("inner_join")).toThrow();
    expect(() => model.elementOf("r_node")).toThrow();
    expect(() => model.elementOf("arch_node")).toThrow();
    expect(() => model.elementOf("y_node")).not.toThrow();
    expect(() => model.elementOf("x_node")).not.toThrow();
  });

  it("删外层整块：嵌套内容全部级联，主链直连", () => {
    const model = buildNested();
    removeBlock(model, "outer_fork");
    for (const id of [
      "outer_fork",
      "outer_join",
      "x_node",
      "y_node",
      "inner_fork",
      "inner_join",
      "r_node",
      "arch_node",
    ]) {
      expect(() => model.elementOf(id)).toThrow();
    }
  });
});
