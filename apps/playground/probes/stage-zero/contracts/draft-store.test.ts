import { describe, it, expect } from "vitest";
import type { DraftValue } from "./types";
import { fixture, deferred } from "./fixtures";
import { removeBranch, removeBlock } from "../../../../../packages/designer/src/operations";

function named(draft: DraftValue, name: string): DraftValue {
  if (!("name" in draft)) throw new Error("夹具不是名称编辑");
  return { ...draft, name };
}

describe("冲突保留与显式恢复", () => {
  it("unknown_form_replace_keeps_live_editor_on_capture_throw", () => {
    const f = fixture();
    const form = f.session.createForm("表一");
    f.sync();
    const t = f.target(form.id, "form"),
      adapter = {
        flush() {},
        capture(): never {
          throw new Error("内部输入尚未序列化");
        },
      };
    const lease = f.store.registerEditor(t, adapter);
    f.drafts.touch(t);
    f.session.updateFormContent(form.id, "[]", '{"formName":"外部值"}');
    f.sync();
    expect(f.drafts.conflicts()[0]).toMatchObject({
      status: "detached",
      retained: { lease, adapter },
    });
    expect(f.store.resolve(t.ref)).toBeUndefined();
    expect(
      f.drafts.resolveConflict(f.drafts.conflicts()[0]!.id, "restart-on-current"),
    ).toMatchObject({ ok: false, code: "stale-target" });
  });
  it("in_place_change_keeps_original_basis", () => {
    const f = fixture(),
      t = f.target("approval_1");
    f.drafts.stage(t, named(f.read(t), "我的输入"));
    f.model.elementOf("approval_1").set("name", "外部名称");
    f.drafts.stage(t, named(f.read(t), "后续输入"));
    expect(f.drafts.status(t)).toBe("conflicted");
    expect(f.drafts.conflicts()[0]?.input).toMatchObject({ name: "后续输入" });
  });
  it("discard_affects_one_record", () => {
    const f = fixture(),
      a = f.target("approval_1"),
      b = f.target("tail");
    for (const t of [a, b]) f.drafts.stage(t, named(f.read(t), "本地"));
    f.model.elementOf("approval_1").set("name", "外部");
    const c = f.drafts.conflicts()[0]!;
    f.drafts.resolveConflict(c.id, "discard-local");
    expect(f.drafts.status(a)).toBe("clean");
    expect(f.drafts.input(b)).toMatchObject({ name: "本地" });
  });
  it("restart_uses_current_without_copying_local", () => {
    const f = fixture(),
      t = f.target("approval_1");
    f.drafts.stage(t, named(f.read(t), "本地"));
    f.model.elementOf(t.ref.id).set("name", "外部");
    const c = f.drafts.conflicts()[0]!;
    expect(f.drafts.resolveConflict(c.id, "restart-on-current")).toMatchObject({ ok: true });
    expect(f.drafts.input(t)).toMatchObject({ name: "外部" });
    expect(f.drafts.comparisons()[0]?.input).toMatchObject({ name: "本地" });
    expect(f.model.elementOf(t.ref.id).get("name")).toBe("外部");
  });
  it("deleted_target_cannot_restart", () => {
    const f = fixture(),
      t = f.target("approval_1");
    f.drafts.stage(t, f.read(t));
    f.model.removeNode(t.ref.id);
    f.model.addUserTask({ id: t.ref.id, name: "新对象" });
    f.sync();
    expect(
      f.drafts.resolveConflict(f.drafts.conflicts()[0]!.id, "restart-on-current"),
    ).toMatchObject({ ok: false, code: "stale-target" });
    expect(f.drafts.status(f.target(t.ref.id))).toBe("clean");
  });
  it("delete_confirmation_expires_after_edit", async () => {
    const f = fixture(),
      t = f.target("approval_1"),
      gate = deferred<boolean>();
    f.drafts.stage(t, f.read(t));
    const result = f.drafts.confirmRemoval(
      [t.ref],
      () => gate.promise,
      () => f.drafts.revision,
      () => f.model.removeNode(t.ref.id),
    );
    f.drafts.stage(t, named(f.read(t), "确认期间新输入"));
    gate.resolve(true);
    expect(await result).toMatchObject({ ok: false, code: "version-changed" });
    expect(f.store.resolve(t.ref)).toBeDefined();
    expect(f.drafts.input(t)).toMatchObject({ name: "确认期间新输入" });
  });
  it("failed_cascade_keeps_buffers", async () => {
    const f = fixture(),
      t = f.target("approval_1");
    f.drafts.stage(t, named(f.read(t), "本地"));
    await f.drafts.confirmRemoval(
      [t.ref],
      () => Promise.resolve(true),
      () => f.drafts.revision,
      () => removeBranch(f.model, "fork", 99),
    );
    expect(f.drafts.input(t)).toMatchObject({ name: "本地" });
    expect(f.store.resolve(t.ref)).toBeDefined();
  });
  it("successful_cascade_clears_only_deleted", async () => {
    const f = fixture(),
      a = f.target("approval_1"),
      b = f.target("tail"),
      flow = f.target("fa", "flow"),
      outside = f.target("e");
    for (const t of [a, b, flow]) f.drafts.stage(t, f.read(t));
    // 整块删除只清实际被删对象，外部流程默认配置保留。
    const process = f.target("contract", "process", "default-form");
    f.drafts.stage(process, f.read(process));
    const before = f.store.all();
    const result = await f.drafts.confirmRemoval(
      before.filter(
        (r) =>
          r !== outside.ref && r !== process.ref && r.id !== "s" && r.id !== "sf" && r.id !== "je",
      ),
      () => Promise.resolve(true),
      () => f.drafts.revision,
      () => {
        removeBlock(f.model, "fork");
        f.sync();
      },
    );
    expect(result).toMatchObject({ ok: true });
    expect(f.drafts.conflicts()).toHaveLength(0);
    expect(f.drafts.input(process)).toEqual({ kind: "default-form", formKey: undefined });
    expect(f.store.resolve(outside.ref)).toBeDefined();
  });
});
