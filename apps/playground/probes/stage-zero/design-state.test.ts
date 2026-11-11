import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import { FlowDesignSession } from "@flowduet/form-create";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  insertApprovalAfter,
  removeApprovalNode,
  removeBlock,
  removeBranch,
  addBranchToBlock,
} from "../../../../packages/designer/src/operations";
import { ProbeDesignState } from "./design-state";

function branch(nested = false) {
  const m = BpmnModel.create({ processId: "life_recheck", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addExclusiveGateway({ id: "fork" })
    .addUserTask({ id: "approval_1", name: "采购审批", assignee: "alice" })
    .addUserTask({ id: "tail", assignee: "bob" })
    .addUserTask({ id: "b" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sf", sourceRef: "s", targetRef: "fork" })
    .addSequenceFlow({
      id: "fa",
      sourceRef: "fork",
      targetRef: "approval_1",
      condition: "${amount > 100}",
    })
    .addSequenceFlow({ id: "at", sourceRef: "approval_1", targetRef: "tail" })
    .addSequenceFlow({ id: "tj", sourceRef: "tail", targetRef: "join" })
    .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b", default: true })
    .addSequenceFlow({ id: "bj", sourceRef: "b", targetRef: "join" })
    .addSequenceFlow({ id: "je", sourceRef: "join", targetRef: "e" });
  if (nested) {
    m.addParallelGateway({ id: "inner" })
      .addParallelGateway({ id: "ij" })
      .addUserTask({ id: "i1" })
      .addUserTask({ id: "i2" });
    m.retargetSequenceFlow("fa", "inner");
    m.removeNode("approval_1");
    for (const [id, sourceRef, targetRef] of [
      ["ii1", "inner", "i1"],
      ["ii2", "inner", "i2"],
      ["i1j", "i1", "ij"],
      ["i2j", "i2", "ij"],
      ["jt", "ij", "tail"],
    ] as const)
      m.addSequenceFlow({ id, sourceRef, targetRef });
  }
  return m;
}
function setup(nested = false) {
  return new ProbeDesignState(new FlowDesignSession(branch(nested)));
}
function forms() {
  const p = setup();
  p.createForm("一");
  p.createForm("二");
  return p;
}
const content = (text: string) => ({
  rules: JSON.stringify([{ type: "input", field: "f", title: "事项", value: text }]),
  options: "{}",
});

describe("真实模型操作与候选生命期/缓冲", () => {
  it("单↔多保留头边生命期与分支输入，节点不相容输入保留为冲突", () => {
    const p = setup(),
      m = p.session.current!.model;
    const node = p.registry.ref("node", "approval_1"),
      flow = p.registry.ref("flow", "fa");
    p.stage(node, { assignee: "未应用单签输入" });
    p.stage(flow, { condition: "${amount > 200}" });
    p.mutateModel(() =>
      convertApprovalToMulti(m, "approval_1", { collection: "people", mode: "all" }),
    );
    expect(p.registry.ref("node", "approval_1")).toEqual(node);
    expect(p.registry.ref("flow", "fa")).toEqual(flow);
    expect(p.buffer(flow)?.conflict).toBe(false);
    expect(p.buffer(node)?.conflict).toBe(true);
    expect(p.buffer(node)?.input).toEqual({ assignee: "未应用单签输入" });
    p.mutateModel(() => convertMultiToSingle(m, "approval_1"));
    expect(p.registry.ref("node", "approval_1")).toEqual(node);
  });
  it("首节点删除保留支路输入和定位目标，删除节点缓冲即时作废", () => {
    const p = setup(),
      m = p.session.current!.model;
    const node = p.registry.ref("node", "approval_1"),
      flow = p.registry.ref("flow", "fa");
    p.stage(node, { name: "旧节点输入" });
    p.stage(flow, { condition: "${amount > 200}" });
    p.mutateModel(() => removeApprovalNode(m, "approval_1"));
    expect(p.registry.resolve(node)).toBeUndefined();
    expect(p.buffer(node)).toBeUndefined();
    expect(p.registry.ref("flow", "fa")).toEqual(flow);
    expect(p.buffer(flow)?.conflict).toBe(false);
    expect((p.registry.resolve(flow) as ModdleElement).get("targetRef")).toBe(m.elementOf("tail"));
    expect(
      (m.elementOf("fork").get("outgoing") as ModdleElement[]).map((f) => f.get("id")),
    ).toEqual(["fa", "fb"]);
    expect(m.elementOf("fork").get("default")).toBe(m.elementOf("fb"));
  });
  it("嵌套块删除清理全部后代，保留外层支路身份及未应用条件", () => {
    const p = setup(true),
      m = p.session.current!.model,
      outer = p.registry.ref("flow", "fa");
    const gone = [
      ...["inner", "ij", "i1", "i2"].map((id) => p.registry.ref("node", id)),
      ...["ii1", "ii2", "i1j", "i2j", "jt"].map((id) => p.registry.ref("flow", id)),
    ];
    gone.forEach((ref) => p.stage(ref, "后代输入"));
    p.stage(outer, { condition: "未应用条件" });
    p.mutateModel(() => removeBlock(m, "inner"));
    gone.forEach((ref) => {
      expect(p.registry.resolve(ref)).toBeUndefined();
      expect(p.buffer(ref)).toBeUndefined();
    });
    expect(p.registry.ref("flow", "fa")).toEqual(outer);
    expect(p.buffer(outer)?.input).toEqual({ condition: "未应用条件" });
  });
  it("删完整嵌套支路清理后代，兄弟缓冲保留", () => {
    const p = setup(true),
      m = p.session.current!.model;
    p.mutateModel(() => addBranchToBlock(m, "fork"));
    const descendant = p.registry.ref("node", "i1"),
      head = p.registry.ref("flow", "fa"),
      sibling = p.registry.ref("flow", "fb");
    [descendant, head, sibling].forEach((ref) => p.stage(ref, "输入"));
    p.mutateModel(() => removeBranch(m, "fork", 0));
    expect(p.buffer(descendant)).toBeUndefined();
    expect(p.buffer(head)).toBeUndefined();
    expect(p.buffer(sibling)?.input).toBe("输入");
  });
  it("同一同步命令删后再插复用ID，旧输入不串到新节点", () => {
    const p = setup(),
      m = p.session.current!.model,
      old = p.registry.ref("node", "approval_1");
    p.stage(old, "旧输入");
    p.mutateModel(() => {
      removeApprovalNode(m, "approval_1");
      expect(insertApprovalAfter(m, "tail")).toBe("approval_1");
    });
    expect(p.buffer(old)).toBeUndefined();
    expect(p.registry.ref("node", "approval_1").lifetime).not.toBe(old.lifetime);
  });
  it("失败删除不作废仍存节点和缓冲", () => {
    const p = setup(),
      m = p.session.current!.model;
    p.mutateModel(() => removeApprovalNode(m, "tail"));
    const ref = p.registry.ref("node", "approval_1");
    p.stage(ref, "保留");
    expect(() => p.mutateModel(() => removeApprovalNode(m, "approval_1"))).toThrow(/唯一节点/);
    expect(p.buffer(ref)?.input).toBe("保留");
  });
  it("外部原位属性变更保持身份，但候选基线冲突不能误判兼容", () => {
    const p = setup(),
      ref = p.registry.ref("node", "approval_1");
    p.stage(ref, { name: "候选" });
    p.session.current!.model.elementOf("approval_1").set("name", "宿主改名");
    p.reconcile();
    expect(p.registry.ref("node", "approval_1")).toEqual(ref);
    expect(p.buffer(ref)?.conflict).toBe(true);
  });
});

describe("真实session表单目录与收集", () => {
  it("受控改名产生副本但保留生命期和规则输入", () => {
    const p = forms(),
      ref = p.registry.ref("form", "form_1"),
      editor = { exportContent: () => content("未保存") };
    p.registerEditor(ref, editor);
    p.capture(ref);
    p.renameForm("form_1", "改名");
    expect(p.registry.ref("form", "form_1")).toEqual(ref);
    expect(p.buffer(ref)?.conflict).toBe(false);
    expect(p.capture(ref)).toEqual(content("未保存"));
  });
  it("删除最后一张并创建同ID表单，旧编辑器/快照失效", () => {
    const p = forms(),
      ref = p.registry.ref("form", "form_2");
    p.registerEditor(ref, { exportContent: () => content("旧内容") });
    p.capture(ref);
    p.deleteForm("form_2");
    expect(p.createForm("重建").id).toBe("form_2");
    expect(p.buffer(ref)).toBeUndefined();
    expect(p.editorCount).toBe(0);
    expect(() => p.capture(ref)).toThrow(/失效/);
    expect(p.session.current!.forms.find((f) => f.id === "form_2")!.rules).toBe("[]");
  });
  it("受引用表单删除失败，编辑器与输入保留", () => {
    const p = forms(),
      ref = p.registry.ref("form", "form_1");
    p.session.current!.model.setDefaultFormKey("form_1");
    p.registerEditor(ref, { exportContent: () => content("保留") });
    p.capture(ref);
    expect(() => p.deleteForm("form_1")).toThrow(/仍被/);
    expect(p.editorCount).toBe(1);
    expect(p.buffer(ref)?.input).toEqual(content("保留"));
  });
  it("两份未应用表单收集不写session；整体应用续期后才写入", () => {
    const p = forms(),
      refs = [p.registry.ref("form", "form_1"), p.registry.ref("form", "form_2")];
    refs.forEach((ref, i) => p.registerEditor(ref, { exportContent: () => content(`输入${i}`) }));
    expect(p.collectAll().map((f) => f.rules)).toEqual([
      content("输入0").rules,
      content("输入1").rules,
    ]);
    expect(p.session.current!.forms.map((f) => f.rules)).toEqual(["[]", "[]"]);
    p.applyAll();
    expect(p.session.current!.forms.map((f) => f.rules)).toEqual([
      content("输入0").rules,
      content("输入1").rules,
    ]);
    refs.forEach((ref) => {
      expect(p.registry.ref("form", ref.id)).toEqual(ref);
      expect(p.buffer(ref)).toBeUndefined();
    });
  });
  for (const failure of ["throw", "null", "invalid-json"] as const) {
    it(`第二张表单${failure}失败，全部session零写入且实例仍存`, () => {
      const p = forms(),
        first = p.registry.ref("form", "form_1"),
        second = p.registry.ref("form", "form_2");
      p.registerEditor(first, { exportContent: () => content("第一份") });
      p.registerEditor(second, {
        exportContent: () => {
          if (failure === "throw") throw new Error("收集失败");
          return failure === "null" ? null : { rules: "非法JSON", options: "{}" };
        },
      });
      expect(() => p.applyAll()).toThrow();
      expect(p.session.current!.forms.map((f) => f.rules)).toEqual(["[]", "[]"]);
      expect(p.editorCount).toBe(2);
      expect(p.buffer(first)?.input).toEqual(content("第一份"));
    });
  }
  it("外部表单内容替换作废旧生命期；受控原样应用不会误续旧缓冲", () => {
    const p = forms(),
      ref = p.registry.ref("form", "form_1");
    p.stage(ref, content("旧候选"));
    p.session.updateFormContent("form_1", content("宿主").rules, "{}");
    p.reconcile();
    expect(p.registry.resolve(ref)).toBeUndefined();
    expect(p.buffer(ref)).toBeUndefined();
  });
  it("替换为同名文档拒绝迟到捕获，日志世代递增", () => {
    const p = forms(),
      ref = p.registry.ref("form", "form_1");
    p.registerEditor(ref, { exportContent: () => content("旧") });
    p.session.newDesign({ processId: "life_recheck" });
    p.reconcile();
    p.createForm("新");
    expect(p.registry.ref("form", "form_1").documentEpoch).toBeGreaterThan(ref.documentEpoch);
    expect(() => p.capture(ref)).toThrow(/失效/);
    expect(p.editorCount).toBe(0);
  });
});
