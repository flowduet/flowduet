import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import DialogCloseSeamProbe from "./DialogCloseSeamProbe.vue";

const create = () =>
  mount(DialogCloseSeamProbe, { props: { label: "same" }, attachTo: document.body });
type View = ReturnType<typeof create>;
async function withPair(run: (a: View, b: View) => Promise<void>) {
  const views: View[] = [];
  try {
    const a = create();
    views.push(a);
    const b = create();
    views.push(b);
    await flushPromises();
    await run(a, b);
  } finally {
    for (const view of views.reverse()) if (view.exists()) view.unmount();
    await flushPromises();
  }
}
async function open(view: View) {
  await view.get('[data-test="dialog-open"]').trigger("click");
  await flushPromises();
  expect(view.attributes("data-dialog-open")).toBe("true");
}
function closeButton(view: View) {
  const key = view.attributes("data-owner-key");
  const button = document.querySelector<HTMLElement>(
    `[data-seam-close-owner="${key}"][data-test="dialog-x"]`,
  );
  if (!button) throw new Error("真实Dialog关闭按钮未就绪");
  return button;
}
function key(target: HTMLElement, value = "Enter") {
  const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
function pointer(target: HTMLElement) {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
function preflights(view: View) {
  return (view.emitted("observe") ?? []).filter((args) => args[0] === "dialog-preflight");
}

// 这些是真实ElDialog上的事件协议断言；原生焦点/默认激活另由浏览器矩阵验证。
describe("P0 Dialog关闭归属协议回归", () => {
  it("same_label_in_separate_apps_has_distinct_mount_owners", () =>
    withPair(async (a, b) => {
      expect(a.attributes("data-owner-key")).not.toBe(b.attributes("data-owner-key"));
    }));
  it("hidden_busy_instance_cannot_swallow_peer_enter", () =>
    withPair(async (a, b) => {
      await a.get('[data-test="dialog-busy"]').setValue(true);
      await open(b);
      const target = closeButton(b);
      expect(key(target).defaultPrevented).toBe(false);
      expect(preflights(a)).toHaveLength(0);
      target.click();
      await nextTick();
      expect(b.attributes("data-dialog-open")).toBe("false");
    }));
  it("two_open_dialogs_route_space_and_pointer_only_to_owner", () =>
    withPair(async (a, b) => {
      await open(a);
      await a.get('[data-test="dialog-busy"]').setValue(true);
      await open(b);
      expect(key(closeButton(b), " ").defaultPrevented).toBe(false);
      expect(pointer(closeButton(b)).defaultPrevented).toBe(false);
      expect(preflights(a)).toHaveLength(0);
      expect(key(closeButton(a), " ").defaultPrevented).toBe(true);
      expect(pointer(closeButton(a)).defaultPrevented).toBe(true);
    }));
  it("closed_instance_ignores_even_its_late_owned_marker", () =>
    withPair(async (a) => {
      await a.get('[data-test="dialog-busy"]').setValue(true);
      const stale = document.createElement("button");
      stale.dataset.seamCloseOwner = a.attributes("data-owner-key");
      document.body.append(stale);
      try {
        expect(key(stale).defaultPrevented).toBe(false);
        expect(preflights(a)).toHaveLength(0);
      } finally {
        stale.remove();
      }
    }));
  it("unmount_and_same_label_remount_do_not_reuse_close_ownership", () =>
    withPair(async (a) => {
      await open(a);
      await a.get('[data-test="dialog-busy"]').setValue(true);
      const oldKey = a.attributes("data-owner-key"),
        stale = closeButton(a).cloneNode(true) as HTMLElement;
      a.unmount();
      const replacement = create();
      try {
        await open(replacement);
        await replacement.get('[data-test="dialog-busy"]').setValue(true);
        expect(replacement.attributes("data-owner-key")).not.toBe(oldKey);
        document.body.append(stale);
        expect(key(stale).defaultPrevented).toBe(false);
        expect(key(closeButton(replacement)).defaultPrevented).toBe(true);
      } finally {
        stale.remove();
        replacement.unmount();
        await flushPromises();
      }
    }));
  it("refused_own_pointer_cannot_be_authorized_by_later_busy_clear", () =>
    withPair(async (a) => {
      await open(a);
      await a.get('[data-test="dialog-busy"]').setValue(true);
      const target = closeButton(a);
      expect(pointer(target).defaultPrevented).toBe(true);
      await a.get('[data-test="dialog-busy"]').setValue(false);
      target.click();
      await nextTick();
      expect(a.attributes("data-dialog-open")).toBe("true");
    }));
});
