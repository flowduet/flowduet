import { describe, it, expect, vi } from "vitest";
import { fixture, deferred } from "./fixtures";
import { createContractController } from "./controller";
function ready() {
  const f = fixture();
  f.model.elementOf("b").set("assignee", "carol");
  const c = createContractController(f),
    t = f.target("approval_1"),
    draft = f.read(t);
  if (draft.kind !== "approval") throw new Error("夹具不符");
  return { ...f, c, t, draft };
}
describe("完整候选校验章", () => {
  it("equivalent_apply_keeps_validation_not_saved", async () => {
    const f = ready();
    f.drafts.stage(f.t, { ...f.draft, name: "新名称" });
    expect(await f.c.validate()).toMatchObject({ ok: true });
    expect(f.c.validationCurrent).toBe(true);
    expect(f.c.dirty).toBe(true);
    expect(await f.c.apply(f.t)).toMatchObject({ ok: true });
    expect(f.c.validationCurrent).toBe(true);
    expect(f.c.dirty).toBe(true);
    expect(f.c.hasPersisted).toBe(false);
  });
  it("normalization_invalidates_validation", async () => {
    const f = ready();
    f.drafts.stage(f.t, { ...f.draft, name: " 经理 " });
    expect(await f.c.validate()).toMatchObject({ ok: true });
    expect(await f.c.apply(f.t)).toMatchObject({ ok: true });
    expect(f.c.validationCurrent).toBe(false);
    expect(f.model.elementOf(f.t.ref.id).get("name")).toBe("经理");
  });
  it("unknown_change_requires_revalidation", async () => {
    const f = ready();
    expect(await f.c.validate()).toMatchObject({ ok: true });
    f.model.elementOf("tail").set("name", "外部修改");
    expect(f.c.validationCurrent).toBe(false);
  });
  it("校验不能用旧模型掩盖非法缓冲", async () => {
    const f = ready();
    f.drafts.stage(f.t, { ...f.draft, approvalKind: "all", assignee: "${bad}" });
    expect(await f.c.validate()).toMatchObject({ ok: false, code: "invalid-input" });
    expect(f.drafts.input(f.t)).toMatchObject({ assignee: "${bad}" });
    expect(f.c.validationCurrent).toBe(false);
  });
  it("原样应用后不因等价复核重新制造当前缓冲", async () => {
    const f = ready(),
      input = { ...f.draft, name: "新名称" };
    f.store.registerEditor(f.t, { flush() {}, capture: () => input });
    expect(await f.c.validate()).toMatchObject({ ok: true });
    expect(await f.c.apply(f.t)).toMatchObject({ ok: true });
    expect(f.drafts.status(f.t)).toBe("clean");
    expect(f.c.validationCurrent).toBe(true);
  });
  it("规则版本变化使通过结论失效", async () => {
    const f = ready();
    expect(await f.c.validate()).toMatchObject({ ok: true });
    f.c.changeRules();
    expect(f.c.validationCurrent).toBe(false);
  });
  it("收集失败即使未收到新输入事件也不能保留当前通过", async () => {
    const f = ready(),
      form = f.session.createForm("一");
    f.c.sync();
    const target = f.target(form.id, "form");
    let fail = false;
    f.store.registerEditor(target, {
      flush() {},
      capture() {
        if (fail) throw new Error("无法确认当前输入");
        return { kind: "form-content", rules: "[]", options: "{}" };
      },
    });
    expect(await f.c.save(async () => {})).toMatchObject({ status: "saved" });
    expect(f.c.dirty).toBe(false);
    expect(await f.c.validate()).toMatchObject({ ok: true });
    expect(f.c.validationCurrent).toBe(true);
    fail = true;
    expect(await f.c.prepare("draft-save")).toMatchObject({ ok: false, code: "capture-failed" });
    expect(f.c.dirty).toBe(true);
    expect(f.c.validationCurrent).toBe(false);
  });

  it("迟到的候选失败不能清除更新校验的通过状态", async () => {
    const f = ready(),
      gate = deferred<{ xml: string }>();
    const spy = vi.spyOn(f.model, "toXML").mockImplementationOnce(() => gate.promise);
    const old = f.c.validate(),
      latest = f.c.validate();
    expect(await latest).toMatchObject({ ok: true });
    gate.reject(new Error("旧请求失败"));
    expect(await old).toMatchObject({ ok: false, code: "cancelled" });
    expect(f.c.validationCurrent).toBe(true);
    spy.mockRestore();
  });
  it("单签的隐藏切换缓存不改变有效设计状态", async () => {
    const f = ready();
    expect(await f.c.validate()).toMatchObject({ ok: true });
    f.drafts.stage(f.t, {
      ...f.draft,
      elementVariable: "cachedReviewer",
      lastCollection: "oldApprovers",
    });
    expect(f.c.validationCurrent).toBe(true);
    expect(f.c.dirty).toBe(false);
  });
});
