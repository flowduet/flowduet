import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture } from "./fixtures";
import { createContractController } from "./controller";
afterEach(() => vi.restoreAllMocks());
describe("候选控制器应用", () => {
  it("live_write_failure_retains_input_and_publishes_no_success", async () => {
    const f = fixture(),
      c = createContractController(f),
      t = f.target("approval_1"),
      node = f.model.elementOf(t.ref.id);
    const draft = f.read(t);
    if (!("name" in draft)) throw new Error("夹具类型不符");
    f.drafts.stage(t, { ...draft, name: "我的新名称" });
    const notifications: unknown[] = [];
    c.subscribe((e) => notifications.push(e));
    const original = node.set.bind(node);
    vi.spyOn(node, "set").mockImplementation((key, value) => {
      original(key, value);
      if (key === "name") throw new Error("真实写入中断");
    });
    expect(await c.apply(t)).toMatchObject({ ok: false, code: "commit-failed" });
    expect(node.get("name")).toBe("同名审批");
    expect(f.store.resolve(t.ref)).toBe(node);
    expect(f.drafts.input(t)).toMatchObject({ name: "我的新名称" });
    expect(notifications).toHaveLength(0);
  });
  it("invalid_form_keeps_current_session_and_input", async () => {
    const f = fixture(),
      form = f.session.createForm("一");
    f.sync();
    const c = createContractController(f),
      t = f.target(form.id, "form"),
      forms = f.session.current!.forms;
    f.drafts.stage(t, { kind: "form-content", rules: "[]", options: "坏JSON" });
    expect(await c.prepare("draft-save")).toMatchObject({ ok: false, code: "invalid-input" });
    expect(f.session.current!.forms).toBe(forms);
    expect(f.drafts.input(t)).toMatchObject({ options: "坏JSON" });
    expect(f.drafts.status(t)).toBe("invalid");
  });
  it("delete_notification_observes_cleaned_conflicts", async () => {
    const f = fixture(),
      form = f.session.createForm("一");
    f.sync();
    const c = createContractController(f),
      t = f.target(form.id, "form");
    f.drafts.stage(t, f.read(t));
    const observed: number[] = [];
    c.subscribe(() => observed.push(f.drafts.conflicts().length));
    expect(await c.deleteForm(t, () => Promise.resolve(true))).toMatchObject({ ok: true });
    expect(observed).toEqual([0]);
  });
});
