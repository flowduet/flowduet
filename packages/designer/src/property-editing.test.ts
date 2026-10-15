import { describe, it, expect } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { readPropertyDraft, applyPropertyDraft, switchApprovalKind } from "./property-editing";
function model() {
  return BpmnModel.create({ processId: "shared", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addUserTask({ id: "a", name: "原名称", assignee: "${manager}" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sa", sourceRef: "s", targetRef: "a" })
    .addSequenceFlow({ id: "ae", sourceRef: "a", targetRef: "e" });
}
describe("共享属性编辑规则", () => {
  it("草稿允许业务缺项但严格确定仍拒绝，拒绝前不改名称", () => {
    const m = model(),
      draft = readPropertyDraft(m, "a");
    if (draft?.kind !== "approval") throw new Error("夹具不是审批");
    const multi = { ...draft, name: "新名称", approvalKind: "all" as const, assignee: "" };
    expect(() => applyPropertyDraft(m, "a", multi)).toThrow(/集合/);
    expect(m.elementOf("a").get("name")).toBe("原名称");
    applyPropertyDraft(m, "a", multi, { allowIncomplete: true });
    expect(readPropertyDraft(m, "a")).toMatchObject({
      name: "新名称",
      approvalKind: "all",
      assignee: "",
    });
  });
  it("非法集合格式在草稿路径仍拒绝", () => {
    const m = model(),
      draft = readPropertyDraft(m, "a");
    if (draft?.kind !== "approval") throw new Error("夹具不是审批");
    expect(() =>
      applyPropertyDraft(
        m,
        "a",
        { ...draft, approvalKind: "all", assignee: "${people}", name: "不能留下" },
        { allowIncomplete: true },
      ),
    ).toThrow(/变量名/);
    expect(m.elementOf("a").get("name")).toBe("原名称");
  });
  it("单多切换在输入内保存两侧值，不写模型", () => {
    const m = model(),
      draft = readPropertyDraft(m, "a");
    if (draft?.kind !== "approval") throw new Error("夹具不是审批");
    const multi = switchApprovalKind(draft, "all");
    expect(multi.assignee).toBe("");
    const single = switchApprovalKind({ ...multi, assignee: "approvers" }, "single");
    expect(single.assignee).toBe("${manager}");
    expect(switchApprovalKind(single, "any").assignee).toBe("approvers");
    expect(m.elementOf("a").get("loopCharacteristics")).toBeUndefined();
  });
  it("未传元素变量时保持既有自定义变量", () => {
    const m = BpmnModel.create({ processId: "variable", adapter: flowableAdapter }).addApprovalTask(
      { id: "a", name: "原", collection: "approvers", mode: "all", elementVariable: "reviewer" },
    );
    const draft = readPropertyDraft(m, "a");
    if (draft?.kind !== "approval") throw new Error("夹具不符");
    const input = { ...draft, name: "新名称" };
    delete input.elementVariable;
    applyPropertyDraft(m, "a", input);
    expect(readPropertyDraft(m, "a")).toMatchObject({
      elementVariable: "reviewer",
      name: "新名称",
    });
    expect(m.elementOf("a").get("assignee")).toBe("${reviewer}");
  });
});
