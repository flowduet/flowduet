import { describe, expect, it } from "vitest";
import { FlowDesignSession } from "@flowduet/form-create";
import { createEntityStore, observeSession } from "./entity-store";

function fixture(owner = "A") {
  const session = new FlowDesignSession();
  session.newDesign({ processId: "contract" });
  const store = createEntityStore(owner);
  store.reconcile(observeSession(session));
  return { session, store };
}
function target(store: ReturnType<typeof createEntityStore>, id = "approval_1") {
  const result = store.target("node", id, "properties");
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe("控制器归属与租约", () => {
  it("foreign_ref_rejected", () => {
    const a = fixture(),
      b = fixture("B");
    const ref = target(a.store).ref;
    expect(a.store.resolve(ref)).toBe(a.session.current!.model.elementOf("approval_1"));
    expect(b.store.resolve(ref)).toBeUndefined();
    expect(a.store.resolve({ ...ref })).toBeUndefined();
  });
  it("facet_kind_rejected", () => {
    const { store } = fixture();
    expect(store.target("node", "approval_1", "default-form")).toMatchObject({
      ok: false,
      code: "unsupported",
    });
    expect(store.target("process", "contract", "default-form")).toMatchObject({ ok: true });
  });
  it("same_command_reuse_new_lifetime", () => {
    const { session, store } = fixture();
    const old = target(store),
      model = session.current!.model;
    model.removeNode("approval_1");
    model.addUserTask({ id: "approval_1", name: "新对象" });
    store.reconcile(observeSession(session));
    expect(store.resolve(old.ref)).toBeUndefined();
    expect(target(store).ref.lifetime).not.toBe(old.ref.lifetime);
  });
  it("late_release_keeps_new_editor", () => {
    const { store } = fixture(),
      t = target(store);
    const editor = { flush() {}, capture: () => null };
    const old = store.registerEditor(t, editor),
      latest = store.registerEditor(t, editor);
    store.releaseEditor(old);
    expect(store.editor(t)?.lease).toBe(latest);
    store.releaseEditor(latest);
    expect(store.editor(t)).toBeUndefined();
  });
  it("process_ref_expires_on_replace", async () => {
    const { store, session } = fixture();
    const result = store.target("process", "contract", "default-form");
    if (!result.ok) throw new Error(result.message);
    session.newDesign({ processId: "contract" });
    store.reconcile(observeSession(session));
    expect(store.resolve(result.value.ref)).toBeUndefined();
    const json = (await session.save()).json;
    expect(json).not.toMatch(/controllerId|documentEpoch|lifetime|EditorLease/);
  });
});
