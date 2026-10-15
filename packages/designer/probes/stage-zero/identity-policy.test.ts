import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import {
  EntityRegistry,
  ValidationTracker,
} from "../../../../apps/playground/probes/stage-zero/identity-policy";
import { insertApprovalAfter, removeApprovalNode } from "../../src/operations";
function model() {
  return BpmnModel.create({ processId: "identity", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addUserTask({ id: "approval_1" })
    .addUserTask({ id: "tail" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "s1", sourceRef: "s", targetRef: "approval_1" })
    .addSequenceFlow({ id: "1t", sourceRef: "approval_1", targetRef: "tail" })
    .addSequenceFlow({ id: "te", sourceRef: "tail", targetRef: "e" });
}
const live = (m: BpmnModel) =>
  (m.process.get("flowElements") as ModdleElement[]).map((object) => ({
    kind: object.$type === "bpmn:SequenceFlow" ? ("flow" as const) : ("node" as const),
    id: String(object.get("id")),
    object,
  }));
describe("对象生命期策略（非生产工作台）", () => {
  it("reused_id_is_not_old_entity", () => {
    const m = model(),
      r = new EntityRegistry();
    r.sync(live(m));
    const old = r.ref("node", "approval_1");
    r.put(old, "旧输入");
    removeApprovalNode(m, "approval_1");
    expect(insertApprovalAfter(m, "tail")).toBe("approval_1");
    r.sync(live(m));
    expect(r.get(old)).toBeUndefined();
    expect(r.resolve(old)).toBeUndefined();
    expect(r.ref("node", "approval_1").lifetime).not.toBe(old.lifetime);
  });
  it("cascade_invalidates_all_descendants", () => {
    const r = new EntityRegistry();
    const a = {},
      b = {},
      f = {},
      keep = {};
    r.sync([
      { kind: "node", id: "a", object: a },
      { kind: "node", id: "b", object: b },
      { kind: "flow", id: "f", object: f },
      { kind: "node", id: "keep", object: keep },
    ]);
    const refs = [r.ref("node", "a"), r.ref("node", "b"), r.ref("flow", "f")];
    refs.forEach((x) => r.put(x, "未应用"));
    r.remove(refs);
    r.sync([
      { kind: "node", id: "a", object: {} },
      { kind: "node", id: "keep", object: keep },
    ]);
    refs.forEach((x) => expect(r.resolve(x)).toBeUndefined());
    expect(r.resolve(r.ref("node", "keep"))).toBe(keep);
  });
  it("atomic_replace_requires_continuity_notice", () => {
    const r = new EntityRegistry();
    r.sync([{ kind: "node", id: "a", object: {} }]);
    const a = r.ref("node", "a");
    r.put(a, "兼容缓冲");
    r.sync([{ kind: "node", id: "a", object: {} }], new Set(["node:a"]));
    expect(r.get(a)).toBe("兼容缓冲");
    r.sync([{ kind: "node", id: "a", object: {} }]);
    expect(r.get(a)).toBeUndefined();
  });
  it("form_reuse_and_document_replace_do_not_reuse_buffers", () => {
    const r = new EntityRegistry();
    r.sync([{ kind: "form", id: "form_1", object: {} }]);
    const a = r.ref("form", "form_1");
    r.put(a, "旧表单");
    r.sync([]);
    r.sync([{ kind: "form", id: "form_1", object: {} }]);
    expect(r.get(a)).toBeUndefined();
    const b = r.ref("form", "form_1");
    r.put(b, "新表单");
    r.replaceDocument();
    r.sync([{ kind: "form", id: "form_1", object: {} }]);
    expect(r.get(b)).toBeUndefined();
  });
  it("failed_delete_keeps_buffers_and_late_delete_does_not_remove_new_object", () => {
    const r = new EntityRegistry(),
      object = {};
    r.sync([{ kind: "node", id: "a", object }]);
    const a = r.ref("node", "a");
    r.put(a, "保留");
    r.sync([{ kind: "node", id: "a", object }]);
    expect(r.get(a)).toBe("保留");
    r.sync([{ kind: "node", id: "a", object: {} }]);
    const b = r.ref("node", "a");
    r.put(b, "新输入");
    r.remove([a]);
    expect(r.get(b)).toBe("新输入");
    expect(() => r.put(a, "迟到写入")).toThrow();
  });
});
describe("有效候选状态", () => {
  it("exact_apply_preserves_validation", () => {
    const v = new ValidationTracker();
    v.update("name=A", "node:a:1");
    v.validate();
    v.update("name=A", "node:a:1");
    expect(v.current()).toBe(true);
  });
  it.each([
    ["new-input", "name=B", "node:a:1"],
    ["restore", "name=old", "node:a:1"],
    ["normalization", "name=A;default=new", "node:a:1"],
    ["replacement", "name=A", "node:a:2"],
  ])("changed_candidate_invalidates_validation %s", (_case, effective, ids) => {
    const v = new ValidationTracker();
    v.update("name=A", "node:a:1");
    v.validate();
    v.update(effective, ids);
    expect(v.current()).toBe(false);
  });
  it("rule_or_document_change_invalidates_even_identical_content", () => {
    const v = new ValidationTracker();
    v.update("A", "a");
    v.validate();
    v.changeRules();
    expect(v.current()).toBe(false);
    v.validate();
    v.replaceDocument();
    expect(v.current()).toBe(false);
  });
});
