import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture } from "./fixtures";
import { createContractController } from "./controller";

afterEach(() => vi.restoreAllMocks());
function setup() {
  const f = fixture();
  f.model.elementOf("b").set("assignee", "carol");
  const c = createContractController(f),
    t = f.target("approval_1"),
    input = f.read(t);
  return { ...f, c, t, input };
}
describe("不可读状态的接缝异常边界", () => {
  it.each(["prepare", "apply", "target", "stage", "restore", "openEditor"] as const)(
    "%s遇到不可序列化外部属性返回失败并保留缓冲",
    async (name) => {
      const f = setup();
      f.c.stage(f.t, f.input);
      f.model.elementOf(f.t.ref.id).set("extraFlag", 1n);
      const run = {
        prepare: () => f.c.prepare("draft-save"),
        apply: () => f.c.apply(f.t),
        target: () => f.c.target("node", f.t.ref.id, "properties"),
        stage: () => f.c.stage(f.t, f.input),
        restore: () => f.c.restore(f.t),
        openEditor: () => f.c.openEditor(f.t),
      };
      await expect(Promise.resolve().then(() => run[name]())).resolves.toMatchObject({
        ok: false,
        code: "capture-failed",
      });
      expect(f.drafts.input(f.t)).toEqual(f.input);
    },
  );
  it("校验与保存失败不穿透UI且不调用宿主持久化", async () => {
    const f = setup();
    f.c.stage(f.t, f.input);
    f.model.elementOf(f.t.ref.id).set("extraFlag", 1n);
    await expect(f.c.validate()).resolves.toMatchObject({ ok: false, code: "capture-failed" });
    let persisted = 0;
    await expect(
      f.c.save(async () => {
        persisted++;
      }),
    ).resolves.toMatchObject({ status: "failed" });
    expect(persisted).toBe(0);
    expect(f.drafts.input(f.t)).toEqual(f.input);
  });
  it("定位同步失败在导航前返回failed", async () => {
    const f = setup();
    let routed = 0;
    f.c.attachView({
      async route() {
        routed++;
      },
      async focus(t) {
        return { status: "focused", selectedId: t.ref.id };
      },
      selectedId() {
        return f.t.ref.id;
      },
    });
    f.model.elementOf(f.t.ref.id).set("extraFlag", 1n);
    await expect(f.c.locate(f.t)).resolves.toMatchObject({ status: "failed" });
    expect(routed).toBe(0);
  });
  it("异步快照后版本投影失败也返回捕获失败", async () => {
    const f = setup(),
      original = f.model.toXML.bind(f.model);
    f.c.stage(f.t, f.input);
    vi.spyOn(f.model, "toXML").mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      f.model.elementOf(f.t.ref.id).set("extraFlag", 1n);
      return result;
    });
    await expect(f.c.prepare("draft-save")).resolves.toMatchObject({
      ok: false,
      code: "capture-failed",
    });
    expect(f.drafts.input(f.t)).toEqual(f.input);
  });
  it("捕获失败后的状态读取安全并要求恢复后重新校验", async () => {
    const f = setup();
    expect(await f.c.save(async () => {})).toMatchObject({ status: "saved" });
    expect(await f.c.validate()).toMatchObject({ ok: true });
    const generation = f.c.generation;
    f.model.elementOf(f.t.ref.id).set("extraFlag", 1n);
    await expect(f.c.prepare("draft-save")).resolves.toMatchObject({ ok: false });
    expect(() => [
      f.c.generation,
      f.c.savedGeneration,
      f.c.hasPersisted,
      f.c.dirty,
      f.c.validationCurrent,
    ]).not.toThrow();
    expect(f.c.generation).toBeGreaterThanOrEqual(generation);
    expect(f.c.dirty).toBe(true);
    expect(f.c.validationCurrent).toBe(false);
    f.model.elementOf(f.t.ref.id).set("extraFlag", undefined);
    expect(await f.c.prepare("draft-save")).toMatchObject({ ok: true });
    expect(f.c.validationCurrent).toBe(false);
    expect(await f.c.validate()).toMatchObject({ ok: true });
  });
});

it("不可读状态下创建表单失败不留下半次创建", () => {
  const f = setup();
  f.model.elementOf(f.t.ref.id).set("extraFlag", 1n);
  expect(f.c.createForm("不应创建")).toMatchObject({ ok: false, code: "capture-failed" });
  expect(f.session.current!.forms).toHaveLength(0);
});
