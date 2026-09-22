// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { compile, verticalDiLayout } from "@flowduet/core";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  insertApprovalAfter,
  insertCcAfter,
} from "./operations.js";

/** 单链场景：开始 → 前置 → 结束（无坐标，竖排推导导出） */
function buildChain(): BpmnModel {
  return BpmnModel.create({ processId: "multi_cc", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addUserTask({ id: "before" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "before" })
    .addSequenceFlow({ id: "f2", sourceRef: "before", targetRef: "end" });
}

describe("insertCcAfter", () => {
  it("链上插入抄送节点：ServiceTask + ccTo + 占位 delegate，导出可推导", () => {
    const model = buildChain();
    insertCcAfter(model, "before", { recipients: "张三,李四" });
    const el = model.elementOf("cc_1");
    expect(el.$type).toBe("bpmn:ServiceTask");
    expect(el.get("ccTo")).toBe("张三,李四");
    expect(el.get("delegateExpression")).toBe("${flowduetCcTask}");
  });
});

describe("convertApprovalToMulti", () => {
  it("单人转多人：同 id、多实例形态落模型，name/formKey 保留", async () => {
    const model = buildChain();
    insertApprovalAfter(model, "before", { name: "会签审批", assignee: "${a}" });
    model.elementOf("approval_1").set("formKey", "form_v1");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });

    const el = model.elementOf("approval_1");
    expect(el.get("name")).toBe("会签审批");
    expect(el.get("formKey")).toBe("form_v1");
    const loop = el.get("loopCharacteristics") as { get(k: string): unknown };
    expect(loop.get("collection")).toBe("approvers");

    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain('flowable:collection="approvers"');
    expect(xml).toContain("nrOfCompletedInstances == nrOfInstances");
  });

  it("多实例节点重复转换即抛错；非审批节点拒绝", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "any" });
    expect(() =>
      convertApprovalToMulti(model, "approval_1", { collection: "x", mode: "all" }),
    ).toThrow(/已是多人审批/);
    expect(() => convertApprovalToMulti(model, "start", { collection: "x", mode: "all" })).toThrow(
      /不是审批任务/,
    );
  });
});

describe("convertMultiToSingle", () => {
  it("多人转单人：多实例移除，审批人留空待补填", async () => {
    const model = buildChain();
    insertApprovalAfter(model, "before", { name: "会签审批" });
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "sequential" });
    convertMultiToSingle(model, "approval_1");

    const el = model.elementOf("approval_1");
    expect(el.get("loopCharacteristics")).toBeUndefined();
    expect(el.get("assignee")).toBeUndefined();
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).not.toContain("multiInstanceLoopCharacteristics");
  });

  it("非多实例节点拒绝", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    expect(() => convertMultiToSingle(model, "approval_1")).toThrow(/不是多人审批/);
  });
});
