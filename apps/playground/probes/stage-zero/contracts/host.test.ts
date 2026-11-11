import { describe, it, expect } from "vitest";
import { fixture, deferred } from "./fixtures";
import { createContractController } from "./controller";
function ready() {
  const f = fixture(),
    c = createContractController(f),
    target = f.target("approval_1"),
    draft = f.read(target);
  if (draft.kind !== "approval") throw new Error("夹具不符");
  f.drafts.stage(target, { ...draft, name: "待保存" });
  return { ...f, c, target, draft };
}
describe("宿主快照确认", () => {
  it("save_during_edit_keeps_dirty", async () => {
    const f = ready(),
      gate = deferred<void>(),
      started = deferred<void>();
    const pending = f.c.save(async () => {
      started.resolve();
      await gate.promise;
    });
    await started.promise;
    f.drafts.stage(f.target, { ...f.draft, name: "保存期间新编辑" });
    gate.resolve();
    expect(await pending).toMatchObject({ status: "saved" });
    expect(f.c.dirty).toBe(true);
    expect(f.c.savedGeneration).toBeLessThan(f.c.generation);
  });
  it("stale_epoch_save_does_not_confirm", async () => {
    const f = ready(),
      gate = deferred<void>(),
      started = deferred<void>();
    const pending = f.c.save(async () => {
      started.resolve();
      await gate.promise;
    });
    await started.promise;
    f.session.newDesign({ processId: "contract" });
    f.c.sync();
    gate.resolve();
    expect(await pending).toMatchObject({ status: "stale" });
    expect(f.c.hasPersisted).toBe(false);
  });
  it("宿主失败保留输入及未保存状态", async () => {
    const f = ready();
    expect(
      await f.c.save(async () => {
        throw new Error("存储不可用");
      }),
    ).toMatchObject({ status: "failed" });
    expect(f.drafts.input(f.target)).toMatchObject({ name: "待保存" });
    expect(f.c.dirty).toBe(true);
    expect(f.c.hasPersisted).toBe(false);
  });
  it("saved_candidate_apply_stays_clean", async () => {
    const f = ready();
    expect(await f.c.save(async () => {})).toMatchObject({ status: "saved" });
    expect(f.c.dirty).toBe(false);
    expect(await f.c.apply(f.target)).toMatchObject({ ok: true });
    expect(f.c.dirty).toBe(false);
    expect(f.c.hasPersisted).toBe(true);
  });
  it("只读访问惰性空数组不标记设计已修改", () => {
    const f = fixture(),
      c = createContractController(f);
    expect(c.dirty).toBe(false);
    f.model.elementOf("e").get("outgoing");
    expect(c.dirty).toBe(false);
  });
  it("控制器销毁后迟到保存不得确认且引用立即失效", async () => {
    const f = ready(),
      gate = deferred<void>(),
      started = deferred<void>();
    const pending = f.c.save(async () => {
      started.resolve();
      await gate.promise;
    });
    await started.promise;
    f.c.dispose();
    gate.resolve();
    expect(await pending).toMatchObject({ status: "stale" });
    expect(f.store.resolve(f.target.ref)).toBeUndefined();
    expect(f.c.hasPersisted).toBe(false);
  });
});
