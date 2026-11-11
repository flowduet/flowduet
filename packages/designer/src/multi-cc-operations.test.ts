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

  it("链首插入（afterId=start）：前后重链到开始事件（评审 S-2 抄送插入位置边界）", () => {
    const model = buildChain();
    insertCcAfter(model, "start", { recipients: "张三" });
    const el = model.elementOf("cc_1");
    // start → cc_1 → before → end：cc_1 入边来自 start，出边指向 before
    const incoming = el.get("incoming") as { get(k: string): unknown }[];
    const outgoing = el.get("outgoing") as { get(k: string): unknown }[];
    expect(incoming).toHaveLength(1);
    expect(outgoing).toHaveLength(1);
    expect((incoming[0]!.get("sourceRef") as { get(k: string): unknown }).get("id")).toBe("start");
    expect((outgoing[0]!.get("targetRef") as { get(k: string): unknown }).get("id")).toBe("before");
  });

  it("链尾插入（afterId=最后一个任务，before end）：任务 → cc → end 链路连通（评审 S-2）", async () => {
    const model = buildChain();
    insertCcAfter(model, "before", { recipients: "张三" });
    const el = model.elementOf("cc_1");
    const outgoing = el.get("outgoing") as { get(k: string): unknown }[];
    expect(outgoing).toHaveLength(1);
    expect((outgoing[0]!.get("targetRef") as { get(k: string): unknown }).get("id")).toBe("end");
    // 全链仍可竖排推导，不抛错
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain('id="cc_1"');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
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

  it("formKey 单↔多两形态清空口径对称（评审 S-2）：多人→单人后清空不留残值", async () => {
    const model = buildChain();
    insertApprovalAfter(model, "before", { name: "审批" });
    model.elementOf("approval_1").set("formKey", "form_v1");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    // 多人形态下清空 formKey
    model.elementOf("approval_1").set("formKey", undefined);
    let xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).not.toContain("formKey");
    // 转回单人：formKey 仍不存在（口径对称）
    convertMultiToSingle(model, "approval_1");
    xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).not.toContain("formKey");
    expect(model.elementOf("approval_1").get("formKey")).toBeUndefined();
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
    // 模拟绕过内核守卫直接写入的非法 formKey（内核 normalizeFormKey 正常路径到不了）
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

  it("档间切换全矩阵（评审 S-2）：会→或→依次→会 loop 形态逐步正确", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    const loop = model.elementOf("approval_1").get("loopCharacteristics") as {
      get(k: string): unknown;
    };

    // all → any
    setApprovalMode(model, "approval_1", { collection: "approvers", mode: "any" });
    expect(loop.get("isSequential")).toBe(false);
    expect(readApprovalMulti(model, "approval_1")?.mode).toBe("any");

    // any → sequential（固化完成条件必须被清空，isSequential=true）
    setApprovalMode(model, "approval_1", { collection: "approvers", mode: "sequential" });
    expect(loop.get("isSequential")).toBe(true);
    expect(loop.get("completionCondition")).toBeUndefined();
    expect(readApprovalMulti(model, "approval_1")?.mode).toBe("sequential");

    // sequential → all（回固化完成条件，isSequential=false）
    setApprovalMode(model, "approval_1", { collection: "approvers", mode: "all" });
    expect(loop.get("isSequential")).toBe(false);
    expect(readApprovalMulti(model, "approval_1")?.mode).toBe("all");
  });

  it("elementVariable 透传：未提供时回落 DEFAULT_ELEMENT_VARIABLE，提供时保留（评审 W-1）", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", {
      collection: "approvers",
      mode: "all",
      elementVariable: "user",
    });
    // 透传 elementVariable：保持 user 不被重置
    setApprovalMode(model, "approval_1", {
      collection: "approvers",
      mode: "any",
      elementVariable: "user",
    });
    const loop = model.elementOf("approval_1").get("loopCharacteristics") as {
      get(k: string): unknown;
    };
    expect(loop.get("elementVariable")).toBe("user");
    expect(model.elementOf("approval_1").get("assignee")).toBe("${user}");
    // 不透传：回落默认 assignee
    setApprovalMode(model, "approval_1", { collection: "approvers", mode: "all" });
    expect(loop.get("elementVariable")).toBe("assignee");
    expect(model.elementOf("approval_1").get("assignee")).toBe("${assignee}");
  });

  it("非法 mode 抛错（评审 W-2），不落出空 body 的 completionCondition", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    expect(() =>
      setApprovalMode(model, "approval_1", {
        collection: "approvers",
        mode: "nope" as never,
      }),
    ).toThrow(/mode 必须是/);
    // 模型零变更：仍是会签
    expect(readApprovalMulti(model, "approval_1")?.mode).toBe("all");
  });

  it("非字符串 collection 抛错（评审 W-2），不报 TypeError", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "all" });
    expect(() =>
      setApprovalMode(model, "approval_1", {
        collection: undefined as unknown as string,
        mode: "all",
      }),
    ).toThrow(/collection 不能为空白/);
    // 模型零变更
    expect(readApprovalMulti(model, "approval_1")?.collection).toBe("approvers");
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

  it("依次档携外部 completionCondition 抛错（评审 C-1），不静默抹除", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "sequential" });
    // 模拟外部编辑后导入的形态：串行多实例 + 早停完成条件（Flowable 合法写法）
    const loop = model.elementOf("approval_1").get("loopCharacteristics") as {
      get(k: string): unknown;
      set(k: string, v: unknown): void;
    };
    loop.set(
      "completionCondition",
      model.moddle.create("bpmn:FormalExpression", {
        body: "${nrOfCompletedInstances >= 2}",
      }),
    );
    // 关键守卫：读取时就要报错，不能 early-return“sequential”后让
    // setApprovalMode 把用户原始条件静默抹除
    expect(() => readApprovalMulti(model, "approval_1")).toThrow(
      /依次审批却携 completionCondition/,
    );
    // 模型零变更：条件仍在
    const condAfter = loop.get("completionCondition") as { get(k: string): unknown };
    expect(String(condAfter.get("body"))).toBe("${nrOfCompletedInstances >= 2}");
  });

  it("依次档无 completionCondition（内核固化形态）正常返回 sequential", () => {
    const model = buildChain();
    insertApprovalAfter(model, "before");
    convertApprovalToMulti(model, "approval_1", { collection: "approvers", mode: "sequential" });
    const multi = readApprovalMulti(model, "approval_1");
    expect(multi).not.toBeNull();
    expect(multi!.mode).toBe("sequential");
    expect(multi!.collection).toBe("approvers");
  });
});
