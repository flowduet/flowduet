// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { deriveBlockTree } from "@flowduet/core";
import {
  addBranchToBlock,
  removeApprovalNode,
  removeBlock,
  removeBranch,
  setBranchCondition,
  setDefaultBranch,
} from "./operations.js";
import { exportConfiguredXml } from "../test-support/export-configured-xml.js";

/**
 * 分支块交互（#24）：块内加支路 / 删支路 / 删整块 / 默认分支切换。
 * 契约基于 deriveBlockTree 的块树读视图（与渲染共用），编辑后块树必须反映正确；
 * 嵌套删除的导出一致性（#24 评审 C1/C2/C3 回归）在文件末尾直接断言 exportXml。
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

describe("嵌套删除回归（#24 评审 C1/C2/C3）", () => {
  /**
   * C1 场景：外层排他块三支，第 3 支内含一个嵌套排他块
   * （支路内容 = y_node → 内层块{r,arch}，非整支即块）。
   */
  function buildOuterWithNestedBranch(): BpmnModel {
    return BpmnModel.create({ processId: "nested_branch", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "before" })
      .addExclusiveGateway({ id: "outer_fork" })
      .addUserTask({ id: "p_node" })
      .addUserTask({ id: "q_node" })
      .addUserTask({ id: "y_node" })
      .addExclusiveGateway({ id: "inner_fork" })
      .addUserTask({ id: "r_node" })
      .addUserTask({ id: "arch_node" })
      .addExclusiveGateway({ id: "inner_join" })
      .addExclusiveGateway({ id: "outer_join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "before" })
      .addSequenceFlow({ id: "f1", sourceRef: "before", targetRef: "outer_fork" })
      .addSequenceFlow({ id: "fp", sourceRef: "outer_fork", targetRef: "p_node" })
      .addSequenceFlow({ id: "fq", sourceRef: "outer_fork", targetRef: "q_node" })
      .addSequenceFlow({ id: "fy", sourceRef: "outer_fork", targetRef: "y_node" })
      .addSequenceFlow({ id: "fp_j", sourceRef: "p_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "fq_j", sourceRef: "q_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "fy_i", sourceRef: "y_node", targetRef: "inner_fork" })
      .addSequenceFlow({ id: "fi_r", sourceRef: "inner_fork", targetRef: "r_node" })
      .addSequenceFlow({ id: "fi_a", sourceRef: "inner_fork", targetRef: "arch_node" })
      .addSequenceFlow({ id: "fr_j", sourceRef: "r_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "arch_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fij_oj", sourceRef: "inner_join", targetRef: "outer_join" })
      .addSequenceFlow({ id: "foj_e", sourceRef: "outer_join", targetRef: "end" });
  }

  /** C2 场景：支路 = y_node → 内层块{r,arch} → z_node（嵌套块之后还有节点） */
  function buildNestedThenNode(): BpmnModel {
    return BpmnModel.create({ processId: "nested_then_node", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "before" })
      .addExclusiveGateway({ id: "outer_fork" })
      .addUserTask({ id: "x_node" })
      .addUserTask({ id: "y_node" })
      .addExclusiveGateway({ id: "inner_fork" })
      .addUserTask({ id: "r_node" })
      .addUserTask({ id: "arch_node" })
      .addExclusiveGateway({ id: "inner_join" })
      .addUserTask({ id: "z_node" })
      .addExclusiveGateway({ id: "outer_join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "before" })
      .addSequenceFlow({ id: "f1", sourceRef: "before", targetRef: "outer_fork" })
      .addSequenceFlow({ id: "fx", sourceRef: "outer_fork", targetRef: "x_node" })
      .addSequenceFlow({ id: "fy", sourceRef: "outer_fork", targetRef: "y_node" })
      .addSequenceFlow({ id: "fx_j", sourceRef: "x_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "fy_i", sourceRef: "y_node", targetRef: "inner_fork" })
      .addSequenceFlow({ id: "fi_r", sourceRef: "inner_fork", targetRef: "r_node" })
      .addSequenceFlow({ id: "fi_a", sourceRef: "inner_fork", targetRef: "arch_node" })
      .addSequenceFlow({ id: "fr_j", sourceRef: "r_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "arch_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fij_z", sourceRef: "inner_join", targetRef: "z_node" })
      .addSequenceFlow({ id: "fz_j", sourceRef: "z_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "foj_e", sourceRef: "outer_join", targetRef: "end" });
  }

  /** C3 场景：外层排他块的第 2 支全部内容就是一个内层并行块（playground demo 同构） */
  function buildBlockAsWholeBranch(): BpmnModel {
    return BpmnModel.create({ processId: "block_as_branch", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "before" })
      .addExclusiveGateway({ id: "outer_fork" })
      .addUserTask({ id: "x_node" })
      .addParallelGateway({ id: "inner_fork" })
      .addUserTask({ id: "r_node" })
      .addUserTask({ id: "arch_node" })
      .addParallelGateway({ id: "inner_join" })
      .addExclusiveGateway({ id: "outer_join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "before" })
      .addSequenceFlow({ id: "f1", sourceRef: "before", targetRef: "outer_fork" })
      .addSequenceFlow({ id: "fx", sourceRef: "outer_fork", targetRef: "x_node" })
      .addSequenceFlow({ id: "fi", sourceRef: "outer_fork", targetRef: "inner_fork" })
      .addSequenceFlow({ id: "fx_j", sourceRef: "x_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "fi_r", sourceRef: "inner_fork", targetRef: "r_node" })
      .addSequenceFlow({ id: "fi_a", sourceRef: "inner_fork", targetRef: "arch_node" })
      .addSequenceFlow({ id: "fr_j", sourceRef: "r_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "arch_node", targetRef: "inner_join" })
      .addSequenceFlow({ id: "fij_oj", sourceRef: "inner_join", targetRef: "outer_join" })
      .addSequenceFlow({ id: "foj_e", sourceRef: "outer_join", targetRef: "end" });
  }

  it("C1：删「含嵌套块的支路」递归级联——无孤儿节点且导出可用", async () => {
    const model = buildOuterWithNestedBranch();
    removeBranch(model, "outer_fork", 2);
    // 支路内嵌套块全部内容级联删除（旧实现会漏删 arch_node 成孤儿）
    for (const id of ["y_node", "inner_fork", "r_node", "arch_node", "inner_join"]) {
      expect(() => model.elementOf(id)).toThrow();
    }
    for (const id of ["outer_fork", "outer_join", "p_node", "q_node"]) {
      expect(() => model.elementOf(id)).not.toThrow();
    }
    expect(blockOf(model).branches).toHaveLength(2);
    // AC#5 导出一致：不抛且不含被删节点
    const xml = await exportConfiguredXml(model);
    expect(xml).not.toContain('id="arch_node"');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
  });

  it("C2：删整块时嵌套块之后的节点不被漏删（活数组 splice 陷阱）", async () => {
    const model = buildNestedThenNode();
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
      "z_node",
    ]) {
      expect(() => model.elementOf(id)).toThrow();
    }
    const xml = await exportConfiguredXml(model);
    expect(xml).not.toContain('id="z_node"');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
  });

  it("C3：删「作为外层支路全部内容」的嵌套块被拒绝且模型不变", () => {
    const model = buildBlockAsWholeBranch();
    expect(() => removeBlock(model, "inner_fork")).toThrow(/空分支/);
    // validate-then-mutate：守卫在任何 removeNode 之前，模型完好
    for (const id of [
      "inner_fork",
      "inner_join",
      "r_node",
      "arch_node",
      "outer_fork",
      "outer_join",
      "x_node",
    ]) {
      expect(() => model.elementOf(id)).not.toThrow();
    }
    // 未被拒绝前导出仍可用
    expect(deriveBlockTree(model).find((n) => n.kind === "block")).toBeDefined();
  });

  /** 二轮评审边界：外层支路内串行两个嵌套块（块 → 块），验证 C3 守卫不误杀 */
  function buildSerialBlocks(): BpmnModel {
    return BpmnModel.create({ processId: "serial_blocks", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "before" })
      .addExclusiveGateway({ id: "outer_fork" })
      .addExclusiveGateway({ id: "fa" })
      .addUserTask({ id: "a1" })
      .addUserTask({ id: "a2" })
      .addExclusiveGateway({ id: "ja" })
      .addExclusiveGateway({ id: "fb" })
      .addUserTask({ id: "b1" })
      .addUserTask({ id: "b2" })
      .addExclusiveGateway({ id: "jb" })
      .addUserTask({ id: "x_node" })
      .addExclusiveGateway({ id: "outer_join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "before" })
      .addSequenceFlow({ id: "f1", sourceRef: "before", targetRef: "outer_fork" })
      .addSequenceFlow({ id: "fx", sourceRef: "outer_fork", targetRef: "x_node" })
      .addSequenceFlow({ id: "fia", sourceRef: "outer_fork", targetRef: "fa" })
      .addSequenceFlow({ id: "fa1", sourceRef: "fa", targetRef: "a1" })
      .addSequenceFlow({ id: "fa2", sourceRef: "fa", targetRef: "a2" })
      .addSequenceFlow({ id: "fa1j", sourceRef: "a1", targetRef: "ja" })
      .addSequenceFlow({ id: "fa2j", sourceRef: "a2", targetRef: "ja" })
      .addSequenceFlow({ id: "faj_b", sourceRef: "ja", targetRef: "fb" })
      .addSequenceFlow({ id: "fb1", sourceRef: "fb", targetRef: "b1" })
      .addSequenceFlow({ id: "fb2", sourceRef: "fb", targetRef: "b2" })
      .addSequenceFlow({ id: "fb1j", sourceRef: "b1", targetRef: "jb" })
      .addSequenceFlow({ id: "fb2j", sourceRef: "b2", targetRef: "jb" })
      .addSequenceFlow({ id: "fbj_oj", sourceRef: "jb", targetRef: "outer_join" })
      .addSequenceFlow({ id: "fx_oj", sourceRef: "x_node", targetRef: "outer_join" })
      .addSequenceFlow({ id: "foj_e", sourceRef: "outer_join", targetRef: "end" });
  }

  it("支路首节点即嵌套块：删该支路级联完整且导出可用（二轮评审边界）", async () => {
    const model = buildBlockAsWholeBranch();
    addBranchToBlock(model, "outer_fork"); // 外层 3 支后才允许删支
    removeBranch(model, "outer_fork", 1); // 删「整块即支路」的支 2
    for (const id of ["inner_fork", "inner_join", "r_node", "arch_node"]) {
      expect(() => model.elementOf(id)).toThrow();
    }
    expect(() => model.elementOf("x_node")).not.toThrow();
    const xml = await exportConfiguredXml(model);
    expect(xml).toContain("<bpmndi:BPMNDiagram");
  });

  it("串行双块：删后块仅收缩该块，前块与外层完好（C3 守卫不误杀）", async () => {
    const model = buildSerialBlocks();
    removeBlock(model, "fb"); // prev 是 ja（单出边 join），不应触发空分支守卫
    for (const id of ["fb", "jb", "b1", "b2"]) {
      expect(() => model.elementOf(id)).toThrow();
    }
    for (const id of ["fa", "ja", "a1", "a2", "x_node", "outer_fork", "outer_join"]) {
      expect(() => model.elementOf(id)).not.toThrow();
    }
    expect(await exportConfiguredXml(model)).toContain("<bpmndi:BPMNDiagram");
  });

  it("串行双块：删前块仅收缩该块，后块成为支路首且导出可用（C3 守卫不误杀）", async () => {
    const model = buildSerialBlocks();
    removeBlock(model, "fa"); // next 是 fb（单入边 fork），不应触发空分支守卫
    for (const id of ["fa", "ja", "a1", "a2"]) {
      expect(() => model.elementOf(id)).toThrow();
    }
    for (const id of ["fb", "jb", "b1", "b2", "x_node"]) {
      expect(() => model.elementOf(id)).not.toThrow();
    }
    expect(await exportConfiguredXml(model)).toContain("<bpmndi:BPMNDiagram");
  });
});

describe("分支条件守卫（#24 二轮评审 S1）", () => {
  it("汇聚网关出线拒绝配条件：只有分支 fork 的出线可配", () => {
    const model = buildBranching();
    expect(() => setBranchCondition(model, "fj", "${x > 1}")).toThrow(/汇聚/);
    // fork 出线不受影响
    expect(() => setBranchCondition(model, "fa", "${x > 1}")).not.toThrow();
  });
});
