import { createRetentionPolicy } from "./retention-policy";
import { formStateFixture } from "./fixtures";
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
