import { describe, it, expect } from "vitest";
import { compile, verticalDiLayout, type ModdleElement } from "@flowduet/core";
import { fixture } from "./fixtures";
import { commitAtomicProperties } from "./transaction";
describe("属性提交原子性", () => {
  it("commit_middle_failure_rolls_back_identity_arrays_di_events", async () => {
    const f = fixture();
    f.session.createForm("一");
    await compile(f.model, { diLayout: verticalDiLayout() });
    const state = f.session.current!,
      forms = state.forms,
      node = f.model.elementOf("approval_1"),
      fork = f.model.elementOf("fork"),
      outgoing = fork.get("outgoing"),
      diagrams = f.model.definitions.get("diagrams"),
      xml = (await f.model.toXML()).xml;
    const result = commitAtomicProperties(state, () => {
      node.set("name", "不该留下");
      fork.set("default", undefined);
      (outgoing as ModdleElement[]).reverse();
      state.forms = [];
      f.model.definitions.set("diagrams", []);
      throw new Error("中段失败");
    });
    expect(result).toMatchObject({ ok: false, code: "commit-failed" });
    expect(f.session.current).toBe(state);
    expect(state.forms).toBe(forms);
    expect(f.model.elementOf("approval_1")).toBe(node);
    expect(fork.get("outgoing")).toBe(outgoing);
    expect(f.model.definitions.get("diagrams")).toBe(diagrams);
    expect((await f.model.toXML()).xml).toBe(xml);
  });
  it("失败撤销不能把继承属性名当作原有字段", () => {
    const f = fixture(),
      state = f.session.current!;
    const root = f.model.definitions;
    const result = commitAtomicProperties(state, () => {
      Object.defineProperty(root, "toString", { value: "temporary", configurable: true });
      throw new Error("中断");
    });
    expect(result.ok).toBe(false);
    expect(Object.hasOwn(root, "toString")).toBe(false);
  });
});
