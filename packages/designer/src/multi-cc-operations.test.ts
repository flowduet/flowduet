// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { compile, verticalDiLayout } from "@flowduet/core";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  insertApprovalAfter,
  insertCcAfter,
  readApprovalMulti,
  setApprovalMode,
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

describe("fail-fast 前置校验（#25 评审 W3）", () => {
  it("convertApprovalToMulti 空 collection 抛错，且不破坏模型（节点/连线完好）", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before", { name: "审批" });
    expect(() =>
      convertApprovalToMulti(model, "approval_1", { collection: "   ", mode: "all" }),
    ).toThrow(/collection 不能为空白/);
    // 抛错在 removeNode 之前：节点仍是单实例 UserTask，两侧连线未被删
    const el = model.elementOf("approval_1");
    expect(el.$type).toBe("bpmn:UserTask");
    expect(el.get("loopCharacteristics")).toBeUndefined();
    expect((el.get("incoming") as unknown[]).length).toBe(1);
    expect((el.get("outgoing") as unknown[]).length).toBe(1);
  });

  it("convertApprovalToMulti 非法 mode 抛错", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    expect(() =>
      convertApprovalToMulti(model, "approval_1", {
        collection: "approvers",
        mode: "nope" as never,
      }),
    ).toThrow(/mode 必须是/);
  });

  it("insertCcAfter 空 recipients 抛错，且不断链", () => {
    const model = buildChain();
    expect(() => insertCcAfter(model, "before", { recipients: "  " })).toThrow(
      /recipients 不能为空白/,
    );
    // before 的唯一出边未被摘除
    expect((model.elementOf("before").get("outgoing") as unknown[]).length).toBe(1);
  });

  it("convertApprovalToMulti 携带纯空白 formKey 抛错，且不破坏模型", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before", { name: "审批" });
    // 模拟绕过内核守卫直接写入的非法 formKey（内核 #setFormKey 正常路径到不了）
    model.elementOf("approval_1").set("formKey", "   ");
    expect(() =>
      convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" }),
    ).toThrow(/formKey 不能为空白/);
    const el = model.elementOf("approval_1");
    expect(el.get("loopCharacteristics")).toBeUndefined();
    expect((el.get("incoming") as unknown[]).length).toBe(1);
  });

  it("convertMultiToSingle 携带纯空白 formKey 抛错，且不破坏模型", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    model.elementOf("approval_1").set("formKey", "   ");
    expect(() => convertMultiToSingle(model, "approval_1")).toThrow(/formKey 不能为空白/);
    // 节点仍是多实例，未被 removeNode
    expect(model.elementOf("approval_1").get("loopCharacteristics")).not.toBeUndefined();
  });
});

describe("setApprovalMode（#25 评审 W1/W5）", () => {
  it("档间直改复用内核固化完成条件（会签→或签）", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    setApprovalMode(model, "approval_1", { collection: "approvers", mode: "any" });
    expect(readApprovalMulti(model, "approval_1")?.mode).toBe("any");
    // 直改写入的是内核固化值（单一出处）；在模型层断言避开 XML 实体转义（>= → &gt;=）
    const loop = model.elementOf("approval_1").get("loopCharacteristics") as {
      get(k: string): { get(k: string): unknown } | undefined;
    };
    expect(String(loop.get("completionCondition")!.get("body"))).toBe(
      "${nrOfCompletedInstances >= 1}",
    );
  });

  it("elementVariable 空白抛错（与内核 addApprovalTask 口径对称）", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    expect(() =>
      setApprovalMode(model, "approval_1", {
        collection: "approvers",
        mode: "all",
        elementVariable: "   ",
      }),
    ).toThrow(/elementVariable 不能为空白/);
  });
});

describe("readApprovalMulti（#25 评审 W2）", () => {
  it("非内核固化的 completionCondition 诚实报错，不静默 fallback", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    // 模拟外部编辑后导入的完成条件：含 ">= 1" 子串但非固化值，旧 includes 反推会误判为 any
    const loop = model.elementOf("approval_1").get("loopCharacteristics") as {
      get(k: string): { set(k: string, v: unknown): void } | undefined;
    };
    loop.get("completionCondition")!.set("body", "${nrOfCompletedInstances >= 10}");
    expect(() => readApprovalMulti(model, "approval_1")).toThrow(/不是内核固化形态/);
  });
});
