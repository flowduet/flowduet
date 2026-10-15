import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture, deferred } from "./fixtures";
import type { DraftValue } from "./types";
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
  it("受控表单改名续期且保留输入", () => {
    const f = fixture(),
      c = createContractController(f),
      t = c.createForm("一");
    if (!t.ok) throw new Error("创建失败");
    f.drafts.stage(t.value, { kind: "form-content", rules: "[]", options: '{"formName":"本地"}' });
    expect(c.renameForm(t.value, "新目录名")).toMatchObject({ ok: true });
    expect(f.store.resolve(t.value.ref)).toBeDefined();
    expect(f.drafts.input(t.value)).toMatchObject({ options: '{"formName":"本地"}' });
    expect(f.drafts.status(t.value)).toBe("dirty");
  });
  it("陈旧渲染请求不作用于未知替换的新对象", async () => {
    const f = fixture(),
      c = createContractController(f),
      request = {
        model: f.model,
        renderRevision: c.revision,
        operation: { type: "remove-node" as const, nodeId: "approval_1" },
      };
    f.model.removeNode("approval_1");
    f.model.addUserTask({ id: "approval_1", name: "新对象" });
    expect(await c.executeOperation(request, () => Promise.resolve(true))).toMatchObject({
      ok: false,
      code: "version-changed",
    });
    expect(f.model.elementOf("approval_1").get("name")).toBe("新对象");
  });

  it("候选入口按规格返回目标及不支持错误，不透传异常", () => {
    const f = fixture(),
      c = createContractController(f);
    expect(c.target("node", "approval_1", "properties")).toMatchObject({
      ok: true,
      value: { ref: { id: "approval_1" } },
    });
    expect(c.target("node", "e", "properties")).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("删除确认期间内容相同的对象替换也拒绝旧引用", async () => {
    const f = fixture(),
      form = f.session.createForm("一");
    f.sync();
    const c = createContractController(f),
      target = f.target(form.id, "form"),
      gate = deferred<boolean>();
    f.drafts.stage(target, { kind: "form-content", rules: "[]", options: "{}" });
    const pending = c.deleteForm(target, () => gate.promise);
    f.session.updateFormContent(form.id, "[]", "{}");
    gate.resolve(true);
    expect(await pending).toMatchObject({ ok: false, code: "version-changed" });
    expect(f.session.current!.forms).toHaveLength(1);
    expect(f.store.resolve(target.ref)).toBeUndefined();
    expect(f.drafts.conflicts()[0]?.status).toBe("detached");
  });
  it("外部替换成相同基础字段后还原也不能清掉旧输入", () => {
    const f = fixture(),
      c = createContractController(f),
      target = f.target("approval_1"),
      draft = f.read(target);
    if (!("name" in draft)) throw new Error("夹具不符");
    f.drafts.stage(target, { ...draft, name: "不能丢" });
    const model = f.session.newDesign({ processId: "contract" });
    model.elementOf("approval_1").set("name", "同名审批");
    model.elementOf("approval_1").set("assignee", "alice");
    expect(c.restore(target)).toMatchObject({ ok: false, code: "stale-target" });
    expect(f.drafts.input(target)).toMatchObject({ name: "不能丢" });
    expect(f.drafts.status(target)).toBe("detached");
  });
  it("冲突呈现后文档又替换时不能继续重启旧对象", () => {
    const f = fixture(),
      c = createContractController(f),
      target = f.target("approval_1"),
      draft = f.read(target);
    if (!("name" in draft)) throw new Error("夹具不符");
    f.drafts.stage(target, { ...draft, name: "本地" });
    f.model.elementOf(target.ref.id).set("name", "外部");
    const conflict = f.drafts.conflicts()[0]!;
    f.session.newDesign({ processId: "contract" });
    expect(c.resolveConflict(conflict.id, "restart-on-current")).toMatchObject({
      ok: false,
      code: "stale-target",
    });
    expect(f.drafts.input(target)).toMatchObject({ name: "本地" });
  });

  it("已释放控制器不能继续创建或应用", async () => {
    const f = fixture(),
      c = createContractController(f),
      target = f.target("approval_1");
    c.dispose();
    expect(c.createForm("禁止创建")).toMatchObject({ ok: false, code: "cancelled" });
    expect(await c.apply(target)).toMatchObject({ ok: false, code: "stale-target" });
    expect(f.session.current!.forms).toHaveLength(0);
  });

  it("内容相同的未知表单替换也推进渲染版本", () => {
    const f = fixture(),
      form = f.session.createForm("一");
    f.sync();
    const c = createContractController(f),
      before = c.revision;
    f.session.updateFormContent(form.id, "[]", "{}");
    c.sync();
    expect(c.revision).toBeGreaterThan(before);
  });
  it("不能删除被未应用节点绑定引用的表单", async () => {
    const f = fixture(),
      c = createContractController(f),
      form = c.createForm("一");
    if (!form.ok) throw new Error("创建失败");
    const target = f.target("approval_1"),
      input = f.read(target);
    if (input.kind !== "approval") throw new Error("夹具不符");
    f.drafts.stage(target, { ...input, formKey: form.value.ref.id });
    expect(await c.deleteForm(form.value, () => Promise.resolve(true))).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
    expect(f.session.current!.forms).toHaveLength(1);
    expect(f.drafts.input(target)).toMatchObject({ formKey: "form_1" });
  });
  it("已选择的表单被同ID替换后节点绑定缓冲不能自动指向新表单", async () => {
    const f = fixture(),
      c = createContractController(f),
      form = c.createForm("一");
    if (!form.ok) throw new Error("创建失败");
    const target = f.target("approval_1"),
      input = f.read(target);
    if (input.kind !== "approval") throw new Error("夹具不符");
    f.drafts.stage(target, { ...input, name: "保留节点输入", formKey: form.value.ref.id });
    f.session.updateFormContent(form.value.ref.id, "[]", '{"formName":"新对象"}');
    c.sync();
    expect(await c.apply(target)).toMatchObject({ ok: false, code: "conflict" });
    expect(f.model.elementOf(target.ref.id).get("formKey")).toBeUndefined();
    expect(f.drafts.input(target)).toMatchObject({ name: "保留节点输入", formKey: "form_1" });
  });
  it.each([
    null,
    { kind: "unknown" },
    { kind: "approval", name: "名称", approvalKind: "single", assignee: "alice", formKey: 42 },
  ])("运行时不支持的输入返回错误且不污染缓冲：%j", (bad) => {
    const f = fixture(),
      c = createContractController(f),
      target = f.target("approval_1");
    expect(c.stage(target, bad as unknown as DraftValue)).toMatchObject({
      ok: false,
      code: "unsupported",
    });
    expect(f.drafts.input(target)).toBeUndefined();
    expect(f.model.elementOf(target.ref.id).get("name")).toBe("同名审批");
  });
});
