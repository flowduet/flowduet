import { describe, expect, it } from "vitest";
import { createRetentionPolicy } from "./retention-policy";
import { formStateFixture } from "./fixtures";
import { deferred } from "../contracts/fixtures";
import { targetKey, type EditorLease, type EditTarget } from "../contracts/types";
import type { FormContent, LiveState, MountedEditor, RetentionHost } from "./types";
function live(): LiveState {
  return {
    selectedField: null,
    configPage: null,
    pendingControls: [],
    openLayers: [],
    composing: false,
    dragging: false,
    ownerKnown: true,
  };
}
/** 这里只验证调度/租约协议；真实FormCreate状态另由浏览器及组件回归验收。 */
export function policyFixture() {
  const f = formStateFixture("policy", { field: "F01" }),
    c = f.controller;
  type Entry = {
    editor: MountedEditor;
    content: FormContent;
    lease?: EditorLease;
    state: LiveState;
    unmounted: boolean;
  };
  const entries: Entry[] = [];
  let current: MountedEditor | undefined,
    serial = 0,
    captures = 0;
  const entry = (editor: MountedEditor) => entries.find((e) => e.editor === editor)!;
  const make = (target: EditTarget, content: FormContent) => {
    const e: Entry = {
      editor: {
        target,
        instanceId: `vm-${++serial}`,
        adapter: {
          flush() {},
          capture() {
            captures++;
            return { kind: "form-content", ...e.content };
          },
        },
      },
      content: { ...content },
      state: live(),
      unmounted: false,
    };
    entries.push(e);
    return e;
  };
  const host: RetentionHost = {
    current: () => current,
    observe: (editor) => entry(editor).state,
    async mountActive(target) {
      const old = entries.find(
        (e) =>
          !e.unmounted &&
          e.lease &&
          targetKey(e.editor.target) === targetKey(target) &&
          c.store.editor(target)?.lease === e.lease,
      );
      if (old) return old.editor;
      const opened = c.openEditor(target);
      if (!opened.ok || opened.value.kind !== "form-content") throw new Error("无法打开");
      const e = make(target, opened.value);
      e.lease = c.store.registerEditor(target, e.editor.adapter);
      return e.editor;
    },
    async mountProvisional(target, content) {
      return make(target, content).editor;
    },
    async restoreContext(editor, before) {
      entry(editor).state = structuredClone(before);
      return true;
    },
    adopt(editor, lease) {
      entry(editor).lease = lease;
    },
    show(editor) {
      current = editor;
    },
    unmount(editor) {
      const e = entry(editor);
      e.unmounted = true;
      if (e.lease) c.store.releaseEditor(e.lease);
    },
  };
  const policy = createRetentionPolicy(c, host);
  return {
    ...f,
    c,
    host,
    policy,
    entry,
    entries,
    captures: () => captures,
    current: () => current,
  };
}
describe("C2 保持挂载导航", () => {
  it("two_forms_switch_without_session_write：忙碌和未捕获输入也不触发导出", async () => {
    const f = policyFixture(),
      [a, b] = f.forms;
    try {
      await f.policy.select(a!, "keep-mounted");
      const source = f.current()!,
        lease = f.c.store.editor(a!)!.lease;
      f.entry(source).content.rules = '[{"type":"input","field":"a_subject","value":"未失焦"}]';
      f.entry(source).state.composing = true;
      f.c.drafts.touch(a!);
      const before = JSON.stringify(f.c.session.current!.forms);
      expect(await f.policy.select(b!, "keep-mounted")).toMatchObject({
        ok: true,
        value: { actual: "kept" },
      });
      await f.policy.select(a!, "keep-mounted");
      expect(f.current()).toBe(source);
      expect(f.c.store.editor(a!)!.lease).toBe(lease);
      expect(f.entry(source).content.rules).toContain("未失焦");
      expect(f.captures()).toBe(0);
      expect(JSON.stringify(f.c.session.current!.forms)).toBe(before);
      expect(f.c.dirty).toBe(true);
    } finally {
      f.policy.dispose();
      f.c.dispose();
    }
  });
  it("外来/错误facet在触碰宿主前拒绝", async () => {
    const f = policyFixture(),
      other = formStateFixture("foreign");
    try {
      expect(await f.policy.select(other.forms[0]!, "keep-mounted")).toMatchObject({
        ok: false,
        code: "stale-target",
      });
      expect(
        await f.policy.select(f.context.target("c_probe", "process"), "keep-mounted"),
      ).toMatchObject({ ok: false, code: "unsupported" });
      expect(f.entries).toHaveLength(0);
    } finally {
      f.policy.dispose();
      f.c.dispose();
      other.controller.dispose();
    }
  });
  it("后一次导航获胜，迟到挂载不能显示或卸载当前实例", async () => {
    const f = policyFixture(),
      gate = deferred<void>(),
      mount = f.host.mountActive;
    try {
      await f.policy.select(f.forms[0]!, "keep-mounted");
      const first = f.current();
      f.host.mountActive = async (target) => {
        if (target.ref === f.forms[1]!.ref) await gate.promise;
        return mount(target);
      };
      const old = f.policy.select(f.forms[1]!, "keep-mounted");
      await f.policy.select(f.forms[0]!, "keep-mounted");
      gate.resolve();
      expect(await old).toMatchObject({ ok: false, code: "cancelled" });
      expect(f.current()).toBe(first);
      expect(f.entry(first!).unmounted).toBe(false);
    } finally {
      f.policy.dispose();
      f.c.dispose();
    }
  });
  it("目标删除或dispose期间完成的挂载不再导航", async () => {
    const f = policyFixture(),
      gate = deferred<void>(),
      mount = f.host.mountActive;
    try {
      await f.policy.select(f.forms[0]!, "keep-mounted");
      const first = f.current();
      f.host.mountActive = async (target) => {
        await gate.promise;
        return mount(target);
      };
      const pending = f.policy.select(f.forms[1]!, "keep-mounted");
      f.policy.dispose();
      gate.resolve();
      expect(await pending).toMatchObject({ ok: false, code: "cancelled" });
      expect(f.current()).toBe(first);
    } finally {
      f.policy.dispose();
      f.c.dispose();
    }
  });
});
