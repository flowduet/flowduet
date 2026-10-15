import { describe, expect, it } from "vitest";
import { compile, verticalDiLayout, type ModdleElement } from "@flowduet/core";
import { fixture } from "./fixtures";
import { createContractController } from "./controller";

function withForms() {
  const f = fixture();
  f.session.createForm("一");
  f.session.createForm("二");
  f.sync();
  return { ...f, c: createContractController(f) };
}
describe("隔离候选与当前编辑版本", () => {
  it("focused_flush_included_in_first_candidate", async () => {
    const f = withForms(),
      t = f.target("form_1", "form");
    let options = "{}";
    f.store.registerEditor(t, {
      flush() {
        options = '{"formName":"焦点输入"}';
        f.drafts.touch(t);
      },
      capture() {
        return { kind: "form-content", rules: "[]", options };
      },
    });
    const r = await f.c.prepare("draft-save");
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.value.json).forms[0].options).toContain("焦点输入");
    expect(f.session.current!.forms[0]?.options).toBe("{}");
  });
  it("second_capture_failure_zero_live_writes", async () => {
    const f = withForms(),
      state = f.session.current!,
      forms = state.forms;
    f.store.registerEditor(f.target("form_1", "form"), {
      flush() {},
      capture: () => ({ kind: "form-content", rules: "[]", options: '{"formName":"未写入"}' }),
    });
    const second = {
      flush() {},
      capture(): never {
        throw new Error("第二份收集失败");
      },
    };
    f.store.registerEditor(f.target("form_2", "form"), second);
    const xml = (await f.model.toXML()).xml;
    expect(await f.c.prepare("draft-save")).toMatchObject({ ok: false, code: "capture-failed" });
    expect(f.session.current).toBe(state);
    expect(state.forms).toBe(forms);
    expect((await f.model.toXML()).xml).toBe(xml);
    expect(f.store.editor(f.target("form_2", "form"))?.adapter).toBe(second);
  });
  it("prepare_new_input_rejected", async () => {
    const f = withForms(),
      t = f.target("approval_1");
    const pending = f.c.prepare("draft-save");
    const d = f.read(t);
    if (!("name" in d)) throw new Error("夹具不匹配");
    f.drafts.stage(t, { ...d, name: "新输入" });
    expect(await pending).toMatchObject({ ok: false, code: "version-changed" });
    expect(f.drafts.input(t)).toMatchObject({ name: "新输入" });
  });
  it("snapshot_compile_keeps_original_di", async () => {
    const f = withForms();
    await compile(f.model, { diLayout: verticalDiLayout() });
    const diagrams = f.model.definitions.get("diagrams"),
      elements = f.model.process.get("flowElements"),
      xml = (await f.model.toXML()).xml;
    const result = await f.c.prepare("validate");
    expect(result.ok).toBe(true);
    expect(f.model.definitions.get("diagrams")).toBe(diagrams);
    expect(f.model.process.get("flowElements")).toBe(elements);
    expect((await f.model.toXML()).xml).toBe(xml);
  });
  it("unsupported_extension_preserved_or_rejected", async () => {
    const f = withForms(),
      el = f.model.elementOf("approval_1");
    el.set("extraFlag", "keep");
    const xml = (await f.model.toXML()).xml,
      r = await f.c.prepare("draft-save");
    if (r.ok) expect(JSON.parse(r.value.json).xml).toContain('extraFlag="keep"');
    else expect(["unsupported", "capture-failed", "invalid-input"]).toContain(r.code);
    expect((await f.model.toXML()).xml).toBe(xml);
  });
  it("fork_default_readset_detects_sibling_change", async () => {
    const f = withForms(),
      t = f.target("fa", "flow");
    f.drafts.stage(t, { kind: "branch", name: "金额", condition: "${amount > 200}" });
    const pending = f.c.apply(t);
    f.model.elementOf("fork").set("default", undefined);
    expect(await pending).toMatchObject({ ok: false, code: "version-changed" });
    expect((f.model.elementOf("fa").get("conditionExpression") as ModdleElement).get("body")).toBe(
      "${amount > 100}",
    );
  });
  it("new_form_reference_blocks_stale_delete", async () => {
    const f = withForms(),
      t = f.target("form_1", "form");
    const pending = f.c.deleteForm(t, () => Promise.resolve(true));
    f.model.setDefaultFormKey("form_1");
    expect(await pending).toMatchObject({ ok: false, code: "version-changed" });
    expect(f.session.current!.forms).toHaveLength(2);
  });
});
