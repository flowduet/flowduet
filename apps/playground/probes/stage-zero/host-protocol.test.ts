import { describe, it, expect } from "vitest";
import { ProbeHostController } from "./host-protocol";
import { FlowDesignSession } from "../../../../packages/form-create/src/session";
import { ValidationTracker } from "./identity-policy";
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
async function document(id: string) {
  const s = new FlowDesignSession();
  s.newDesign({ processId: id });
  return (await s.save()).json;
}
describe("真实 session 与候选宿主控制层", () => {
  it("host_conflict_or_cancel_keeps_current_document_and_dirty", () => {
    const c = new ProbeHostController();
    c.edit();
    const original = c.session.current!.model;
    expect(
      c.replaceIfAllowed(
        "taken",
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(c.session.current!.model).toBe(original);
    expect(
      c.replaceIfAllowed(
        "available",
        () => false,
        () => true,
      ),
    ).toBe(false);
    expect(c.session.current!.model).toBe(original);
    expect(c.dirty).toBe(true);
  });
  it("approved_available_identity_replaces_once", () => {
    const c = new ProbeHostController();
    c.edit();
    expect(
      c.replaceIfAllowed(
        "new_identity",
        () => true,
        () => true,
      ),
    ).toBe(true);
    expect(c.session.current!.model.process.get("id")).toBe("new_identity");
    expect(c.dirty).toBe(false);
  });
  it("save_during_new_edit_remains_dirty", async () => {
    const c = new ProbeHostController();
    c.edit();
    const gate = deferred<void>(),
      entered = deferred<void>();
    const p = c.save(async () => {
      entered.resolve();
      await gate.promise;
    });
    await Promise.race([entered.promise, p]);
    c.edit();
    gate.resolve();
    expect(await p).toBe("saved");
    expect(c.dirty).toBe(true);
  });
  it("save_before_new_document_is_stale", async () => {
    const c = new ProbeHostController();
    c.edit();
    const gate = deferred<void>(),
      entered = deferred<void>();
    const p = c.save(async () => {
      entered.resolve();
      await gate.promise;
    });
    await Promise.race([entered.promise, p]);
    c.newDesign("new_doc");
    c.edit();
    gate.resolve();
    expect(await p).toBe("stale");
    expect(c.dirty).toBe(true);
    expect(c.session.current!.model.process.get("id")).toBe("new_doc");
  });
  it("load_out_of_order_keeps_latest", async () => {
    const c = new ProbeHostController(),
      a = deferred<string>(),
      b = deferred<string>();
    const first = c.load(a.promise),
      last = c.load(b.promise);
    b.resolve(await document("second"));
    expect(await last).toBe("loaded");
    a.resolve(await document("first"));
    expect(await first).toBe("stale");
    expect(c.session.current!.model.process.get("id")).toBe("second");
  });
  it("input_during_load_prevents_replace", async () => {
    const c = new ProbeHostController(),
      read = deferred<string>();
    const loading = c.load(read.promise);
    c.edit();
    read.resolve(await document("incoming"));
    expect(await loading).toBe("failed");
    expect(c.session.current!.model.process.get("id")).toBe("host_probe");
    expect(c.dirty).toBe(true);
  });
  it("failed_save_never_marks_clean", async () => {
    const c = new ProbeHostController();
    c.edit();
    expect(
      await c.save(async () => {
        throw new Error("拒绝");
      }),
    ).toBe("failed");
    expect(c.dirty).toBe(true);
  });
  it("exact_candidate_apply_keeps_validation_but_not_saved", async () => {
    const c = new ProbeHostController(),
      v = new ValidationTracker();
    c.edit();
    v.update("名称=新名称", "doc1");
    v.validate();
    c.session.current!.model.process.set("name", "新名称");
    v.update("名称=新名称", "doc1");
    expect(v.current()).toBe(true);
    expect(c.dirty).toBe(true);
    await c.save(async () => {});
    expect(c.dirty).toBe(false);
    expect(v.current()).toBe(true);
  });
  it("normalization_changes_candidate_and_requires_revalidation", () => {
    const v = new ValidationTracker();
    v.update("name= A ", "doc1");
    v.validate();
    v.update("name=A", "doc1");
    expect(v.current()).toBe(false);
  });
});
