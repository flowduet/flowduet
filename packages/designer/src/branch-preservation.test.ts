import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  removeApprovalNode,
  removeBlock,
  addBranchToBlock,
  removeBranch,
} from "./operations.js";

// 这些是应当成立但当前失败的生产回归合同，不能用绿色探针摘要冒充修复。
function build(mode: "condition" | "default", multi = false) {
  const m = BpmnModel.create({ processId: "branch_contract", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addExclusiveGateway({ id: "fork" });
  if (multi) m.addApprovalTask({ id: "a", collection: "approvers", mode: "all" });
  else m.addUserTask({ id: "a", assignee: "alice" });
  m.addUserTask({ id: "tail" })
    .addUserTask({ id: "b" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sf", sourceRef: "s", targetRef: "fork" })
    .addSequenceFlow({
      id: "fa",
      name: "采购条件",
      sourceRef: "fork",
      targetRef: "a",
      ...(mode === "condition" ? { condition: "${amount > 100}" } : { default: true }),
    })
    .addSequenceFlow({ id: "at", sourceRef: "a", targetRef: "tail", name: "保留出边" })
    .addSequenceFlow({ id: "tj", sourceRef: "tail", targetRef: "join" })
    .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b" })
    .addSequenceFlow({ id: "bj", sourceRef: "b", targetRef: "join" })
    .addSequenceFlow({ id: "je", sourceRef: "join", targetRef: "e" });
  return m;
}
function assertHead(m: BpmnModel, target: string, mode: "condition" | "default") {
  const fork = m.elementOf("fork");
  const outs = fork.get("outgoing") as ModdleElement[];
  const head = outs.find((f) => (f.get("targetRef") as ModdleElement).get("id") === target)!;
  expect.soft(head.get("id")).toBe("fa");
  expect.soft(head.get("name")).toBe("采购条件");
  expect.soft(outs.map((f) => f.get("id"))).toEqual(["fa", "fb"]);
  if (mode === "condition")
    expect
      .soft((head.get("conditionExpression") as ModdleElement | undefined)?.get("body"))
      .toBe("${amount > 100}");
  else expect.soft(fork.get("default")).toBe(head);
}
describe("支路身份保真回归", () => {
  for (const mode of ["condition", "default"] as const) {
    it(`preserves_branch_head_on_conversion single-to-multi ${mode}`, () => {
      const m = build(mode);
      convertApprovalToMulti(m, "a", { collection: "approvers", mode: "all" });
      assertHead(m, "a", mode);
      const out = (m.elementOf("a").get("outgoing") as ModdleElement[])[0]!;
      expect.soft(out.get("id")).toBe("at");
      expect.soft(out.get("name")).toBe("保留出边");
    });
    it(`preserves_branch_head_on_conversion multi-to-single ${mode}`, () => {
      const m = build(mode, true);
      convertMultiToSingle(m, "a");
      assertHead(m, "a", mode);
    });
    it(`preserves_branch_head_when_removing_first ${mode}`, () => {
      const m = build(mode);
      removeApprovalNode(m, "a");
      assertHead(m, "tail", mode);
    });
  }
  it("preserves_branch_head_when_removing_nested_block", () => {
    const m = build("condition");
    m.removeSequenceFlow("at");
    m.removeSequenceFlow("fa");
    m.removeNode("a");
    m.addExclusiveGateway({ id: "inner" })
      .addExclusiveGateway({ id: "ij" })
      .addUserTask({ id: "i1" })
      .addUserTask({ id: "i2" });
    m.addSequenceFlow({
      id: "fa",
      name: "采购条件",
      sourceRef: "fork",
      targetRef: "inner",
      condition: "${amount > 100}",
    });
    // 构造固定的人工支路顺序，随后被测操作必须保持它。
    const outs = m.elementOf("fork").get("outgoing") as ModdleElement[];
    outs.reverse();
    for (const [id, sourceRef, targetRef] of [
      ["i1f", "inner", "i1"],
      ["i2f", "inner", "i2"],
      ["i1j", "i1", "ij"],
      ["i2j", "i2", "ij"],
      ["ijt", "ij", "tail"],
    ] as const)
      m.addSequenceFlow({ id, sourceRef, targetRef });
    removeBlock(m, "inner");
    assertHead(m, "tail", "condition");
  });
  it("refuses_empty_branch_without_mutation", () => {
    const m = build("condition");
    removeApprovalNode(m, "tail");
    const original = m.elementOf("a");
    expect(() => removeApprovalNode(m, "a")).toThrow(/唯一节点/);
    expect(m.elementOf("a")).toBe(original);
    assertHead(m, "a", "condition");
  });
});

describe("结构删除补充边界", () => {
  for (const mode of ["condition", "default"] as const) {
    it(`删除前保留完整入边对象及表达式 ${mode}`, () => {
      const m = build(mode);
      const edge = m.elementOf("fa");
      const expression = edge.get("conditionExpression");
      const elements = [...(m.process.get("flowElements") as ModdleElement[])];
      const removed = [m.elementOf("a"), m.elementOf("at")];
      removeApprovalNode(m, "a");
      expect(m.elementOf("fa")).toBe(edge);
      expect(edge.get("conditionExpression")).toBe(expression);
      expect(m.process.get("flowElements")).toEqual(elements.filter((e) => !removed.includes(e)));
      expect(m.elementOf("tail").get("incoming") as ModdleElement[]).toEqual([edge]);
    });
  }
  for (const corrupt of ["missing-incoming", "extra-incoming", "foreign-edge"]) {
    it(`删除拒绝 ${corrupt}，已有状态不变`, async () => {
      const m = build("condition");
      if (corrupt === "missing-incoming") m.elementOf("tail").set("incoming", []);
      if (corrupt === "extra-incoming")
        (m.elementOf("a").get("incoming") as ModdleElement[]).push(m.elementOf("fb"));
      if (corrupt === "foreign-edge")
        m.elementOf("a").set("outgoing", [build("condition").elementOf("at")]);
      const before = await m.toXML();
      expect(() => removeApprovalNode(m, "a")).toThrow();
      expect(await m.toXML()).toEqual(before);
    });
  }
});

function nested(mode: "condition" | "default", parallel = false) {
  const m = build(mode);
  m.removeSequenceFlow("at");
  m.removeNode("a");
  if (parallel) m.addParallelGateway({ id: "inner" }).addParallelGateway({ id: "ij" });
  else m.addExclusiveGateway({ id: "inner" }).addExclusiveGateway({ id: "ij" });
  m.addUserTask({ id: "i1" }).addUserTask({ id: "i2" });
  m.addSequenceFlow({
    id: "fa",
    name: "采购条件",
    sourceRef: "fork",
    targetRef: "inner",
    ...(mode === "condition" ? { condition: "${amount > 100}" } : { default: true }),
  });
  // 与真实创建数据一致：XML 元素顺序和 source.outgoing 同时维护。
  const elements = m.process.get("flowElements") as ModdleElement[];
  const fa = m.elementOf("fa");
  elements.splice(elements.indexOf(fa), 1);
  elements.splice(elements.indexOf(m.elementOf("fb")), 0, fa);
  (m.elementOf("fork").get("outgoing") as ModdleElement[]).reverse();
  for (const [id, sourceRef, targetRef] of [
    ["i1f", "inner", "i1"],
    ["i2f", "inner", "i2"],
    ["i1j", "i1", "ij"],
    ["i2j", "i2", "ij"],
    ["ijt", "ij", "tail"],
  ] as const)
    m.addSequenceFlow({ id, sourceRef, targetRef });
  return m;
}

for (const mode of ["condition", "default"] as const) {
  for (const parallel of [true, false]) {
    it(`删除嵌套 ${parallel ? "并行" : "条件"} 块保留外层 ${mode} 支路`, () => {
      const m = nested(mode, parallel);
      const head = m.elementOf("fa");
      removeBlock(m, "inner");
      assertHead(m, "tail", mode);
      expect(m.elementOf("fa")).toBe(head);
      for (const id of ["inner", "ij", "i1", "i2", "i1f", "i2f", "i1j", "i2j", "ijt"]) {
        expect(() => m.elementOf(id)).toThrow();
      }
    });
  }
}

it("嵌套块跨边界连接拒绝且不改模型或 DI", async () => {
  const m = nested("default");
  m.addSequenceFlow({ id: "cross", sourceRef: "i1", targetRef: "b" });
  const before = await m.toXML();
  expect(() => removeBlock(m, "inner")).toThrow();
  expect(await m.toXML()).toEqual(before);
});

it("整个默认支路删除清除 default，保留其余顺序", () => {
  const m = build("default");
  addBranchToBlock(m, "fork");
  const before = (m.elementOf("fork").get("outgoing") as ModdleElement[]).slice(1);
  removeBranch(m, "fork", 0);
  expect(m.elementOf("fork").get("default")).toBeUndefined();
  expect(m.elementOf("fork").get("outgoing")).toEqual(before);
  expect(() => m.elementOf("fa")).toThrow();
});
