import "../form-repair/input-capture.cases";
import "../form-state.cases";
import "../form-repair/dialog-close.cases";
import { describe, expect, it } from "vitest";
import { compile, verticalDiLayout, type ModdleElement } from "@flowduet/core";
import { fixture } from "./fixtures";
import { graphValue } from "./candidate";
import { createContractController } from "./controller";
import { createSeamRecorder } from "../form-repair/seam-proof";

describe("P0公开接缝观察器（不是产品身份实现）", () => {
  it("same_field_string_does_not_make_clone_a_source_token", () => {
    const recorder = createSeamRecorder("A");
    const source = { field: "same" };
    expect(recorder.token(source)).toBe(recorder.token(source));
    expect(recorder.token({ ...source })).not.toBe(recorder.token(source));
  });
  it("owners_and_recreated_sources_have_distinct_observation_tokens", () => {
    const a = createSeamRecorder("A"),
      b = createSeamRecorder("B");
    const source = { field: "same" };
    expect(a.token(source)).not.toBe(b.token(source));
    expect(a.token({ field: "same" })).not.toBe(a.token(source));
  });
});

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
  it("flush更换租约后拒绝捕获旧实例", async () => {
    const f = withForms(),
      target = f.target("form_1", "form");
    const latest = {
      flush() {},
      capture: () => ({
        kind: "form-content" as const,
        rules: "[]",
        options: '{"formName":"新实例"}',
      }),
    };
    f.store.registerEditor(target, {
      flush() {
        f.store.registerEditor(target, latest);
      },
      capture: () => ({ kind: "form-content", rules: "[]", options: '{"formName":"旧实例"}' }),
    });
    expect(await f.c.prepare("draft-save")).toMatchObject({ ok: false, code: "version-changed" });
    expect(f.drafts.input(target)).not.toMatchObject({ options: '{"formName":"旧实例"}' });
  });
  it("候选等待期间更换同对象编辑器租约也拒绝", async () => {
    const f = withForms(),
      target = f.target("form_1", "form");
    f.store.registerEditor(target, {
      flush() {},
      capture: () => ({ kind: "form-content", rules: "[]", options: "{}" }),
    });
    const pending = f.c.prepare("draft-save");
    f.store.registerEditor(target, {
      flush() {},
      capture: () => ({ kind: "form-content", rules: "[]", options: '{"formName":"新实例"}' }),
    });
    expect(await pending).toMatchObject({ ok: false, code: "version-changed" });
  });
  it("特殊自有属性名也必须进入版本投影", () => {
    const value = Object.create(null) as Record<string, string>;
    value["__proto__"] = "changed";
    expect(graphValue(value)).toContain('"__proto__":"changed"');
  });
  it("capture期间内容相同的未知替换也拒绝旧实例输入", async () => {
    const f = withForms(),
      target = f.target("form_1", "form");
    f.c.openEditor(target);
    let captures = 0;
    f.store.registerEditor(target, {
      flush() {},
      capture() {
        if (++captures === 1) f.session.updateFormContent("form_1", "[]", "{}");
        return { kind: "form-content", rules: "[]", options: '{"formName":"旧实例输入"}' };
      },
    });
    const result = await f.c.prepare("draft-save");
    expect(result).toMatchObject({ ok: false });
    expect(f.session.current!.forms[0]?.options).toBe("{}");
    expect(f.store.resolve(target.ref)).toBeUndefined();
    expect(f.drafts.conflicts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target,
          status: "detached",
          input: expect.objectContaining({ options: '{"formName":"旧实例输入"}' }),
        }),
      ]),
    );
  });
});

describe("C4只读候选移交闸门", () => {
  it("candidate_gate_rejects_foreign_stale_or_disposed", async () => {
    const a = withForms(),
      b = withForms();
    try {
      const prepared = await a.c.prepare("draft-save");
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;
      expect(a.c.checkPreparedCandidate(prepared.value)).toEqual({ ok: true, value: undefined });
      expect(b.c.checkPreparedCandidate(prepared.value)).toMatchObject({
        ok: false,
        code: "version-changed",
      });
      expect(a.c.checkPreparedCandidate({ ...prepared.value })).toMatchObject({
        ok: false,
        code: "version-changed",
      });
      a.c.drafts.touch(a.target("form_1", "form"));
      expect(a.c.checkPreparedCandidate(prepared.value)).toMatchObject({
        ok: false,
        code: "version-changed",
      });
      const newer = await a.c.prepare("draft-save");
      expect(newer.ok).toBe(true);
      if (!newer.ok) return;
      a.store.registerEditor(a.target("form_1", "form"), {
        flush() {},
        capture: () => ({ kind: "form-content", rules: "[]", options: "{}" }),
      });
      expect(a.c.checkPreparedCandidate(newer.value)).toMatchObject({
        ok: false,
        code: "version-changed",
      });
      a.c.dispose();
      expect(a.c.checkPreparedCandidate(prepared.value)).toMatchObject({
        ok: false,
        code: "cancelled",
      });
    } finally {
      a.c.dispose();
      b.c.dispose();
    }
  });
  it("candidate_gate_does_not_recapture_or_write：旧候选不清新成功", async () => {
    const f = withForms();
    let calls = 0;
    try {
      f.store.registerEditor(f.target("form_1", "form"), {
        flush() {
          calls++;
        },
        capture() {
          calls++;
          return { kind: "form-content", rules: "[]", options: "{}" };
        },
      });
      const old = await f.c.prepare("draft-save");
      expect(old.ok).toBe(true);
      if (!old.ok) return;
      f.drafts.touch(f.target("form_1", "form"));
      const latest = await f.c.prepare("draft-save");
      expect(latest.ok).toBe(true);
      if (!latest.ok) return;
      const before = calls,
        session = f.session.current,
        xml = (await f.model.toXML()).xml,
        revision = f.drafts.revision;
      expect(f.c.checkPreparedCandidate(old.value)).toMatchObject({
        ok: false,
        code: "version-changed",
      });
      expect(f.c.checkPreparedCandidate(latest.value).ok).toBe(true);
      expect(f.c.checkPreparedCandidate(latest.value).ok).toBe(true);
      expect(calls).toBe(before);
      expect(f.session.current).toBe(session);
      expect((await f.model.toXML()).xml).toBe(xml);
      expect(f.drafts.revision).toBe(revision);
      f.model.elementOf("approval_1").set("extraFlag", 1n);
      expect(f.c.checkPreparedCandidate(latest.value)).toMatchObject({
        ok: false,
        code: "capture-failed",
      });
    } finally {
      f.c.dispose();
    }
  });
});
