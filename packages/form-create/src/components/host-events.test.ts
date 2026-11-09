// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, shallowRef } from "vue";
import FormDesigner from "./FormDesigner.vue";
import {
  createComponentTestFixture,
  type ComponentTestWrapper,
  type FixtureCaseKey,
} from "./__tests__/component-test-fixture.js";

let wrapper: ComponentTestWrapper | undefined;
let originalElementString: PropertyDescriptor | undefined;
const fixture = createComponentTestFixture({
  getWrapper: () => wrapper,
  setWrapper: (value) => {
    wrapper = value;
  },
  getOriginalElementString: () => originalElementString,
  setOriginalElementString: (value) => {
    originalElementString = value;
  },
});
let currentCase: FixtureCaseKey | undefined;
let originalUnload: Window["onbeforeunload"];
let originalDrop: HTMLElement["ondrop"];
beforeEach(() => {
  originalUnload = window.onbeforeunload;
  originalDrop = document.body.ondrop;
  currentCase = fixture.beforeEachCase();
});
afterEach(() => {
  const ending = currentCase;
  currentCase = undefined;
  try {
    if (ending !== undefined) fixture.afterEachCase(ending);
  } finally {
    window.onbeforeunload = originalUnload;
    document.body.ondrop = originalDrop;
  }
});

describe("FormDesigner 宿主事件隔离", () => {
  it.each(["legacy", "retained"] as const)("%s 挂载和卸载都保留宿主处理器", async (mode) => {
    const owner = fixture.beginManagerOwner();
    fixture.isolateManagerDesignerStyle(owner);
    const hostUnload = vi.fn();
    const hostDrop = vi.fn();
    window.onbeforeunload = hostUnload;
    document.body.ondrop = hostDrop;
    const target = owner.mount(() =>
      mount(FormDesigner, {
        props: { name: "宿主事件", rules: "[]", options: "{}", editingMode: mode },
        attachTo: document.body,
      }),
    );
    await owner.step(flushPromises);
    expect(window.onbeforeunload).toBe(hostUnload);
    expect(document.body.ondrop).toBe(hostDrop);
    owner.close();
    expect(window.onbeforeunload).toBe(hostUnload);
    expect(document.body.ondrop).toBe(hostDrop);
    expect(target.element.isConnected).toBe(false);
  });

  it("供应商 drop 只阻断本编辑器，宿主其他区域仍可处理", async () => {
    const owner = fixture.beginManagerOwner();
    fixture.isolateManagerDesignerStyle(owner);
    const hostDrop = vi.fn();
    document.body.ondrop = hostDrop;
    const target = owner.mount(() =>
      mount(FormDesigner, {
        props: { name: "拖放边界", rules: "[]", options: "{}" },
        attachTo: document.body,
      }),
    );
    await owner.step(flushPromises);
    const outside = new Event("drop", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
    expect(hostDrop).toHaveBeenCalledTimes(1);
    const inside = new Event("drop", { bubbles: true, cancelable: true });
    target.element.dispatchEvent(inside);
    expect(inside.defaultPrevented).toBe(true);
    expect(hostDrop).toHaveBeenCalledTimes(1);
  });

  it("同 app 双实例卸载及宿主后续改写不还原旧处理器", async () => {
    const owner = fixture.beginManagerOwner();
    fixture.isolateManagerDesignerStyle(owner);
    const initialUnload = vi.fn();
    const initialDrop = vi.fn();
    window.onbeforeunload = initialUnload;
    document.body.ondrop = initialDrop;
    const Harness = defineComponent({
      setup() {
        const firstVisible = shallowRef(true);
        return () =>
          h("div", [
            h(
              "button",
              {
                onClick: () => {
                  firstVisible.value = false;
                },
              },
              "卸载第一实例",
            ),
            firstVisible.value ? h(FormDesigner, { name: "一", rules: "[]", options: "{}" }) : null,
            h(FormDesigner, { name: "二", rules: "[]", options: "{}", editingMode: "retained" }),
          ]);
      },
    });
    const target = owner.mount(() => mount(Harness, { attachTo: document.body }));
    await owner.step(flushPromises);
    expect(window.onbeforeunload).toBe(initialUnload);
    expect(document.body.ondrop).toBe(initialDrop);
    const nextUnload = vi.fn();
    const nextDrop = vi.fn();
    window.onbeforeunload = nextUnload;
    document.body.ondrop = nextDrop;
    await owner.step(() => target.get("button").trigger("click"));
    await owner.step(flushPromises);
    expect(target.findAll('[data-test="form-designer"]')).toHaveLength(1);
    expect(window.onbeforeunload).toBe(nextUnload);
    expect(document.body.ondrop).toBe(nextDrop);
    const inside = new Event("drop", { bubbles: true, cancelable: true });
    target.get('[data-test="form-designer"]').element.dispatchEvent(inside);
    expect(inside.defaultPrevented).toBe(true);
    owner.close();
    expect(window.onbeforeunload).toBe(nextUnload);
    expect(document.body.ondrop).toBe(nextDrop);
  });

  it("独立 app 在无宿主处理器时可分别挂载和清理", async () => {
    const owner = fixture.beginManagerOwner();
    fixture.isolateManagerDesignerStyle(owner);
    window.onbeforeunload = null;
    document.body.ondrop = null;
    const first = fixture.beginManagerOwner();
    first.mount(() =>
      mount(FormDesigner, {
        props: { name: "一", rules: "[]", options: "{}" },
        attachTo: document.body,
      }),
    );
    const second = owner.mount(() =>
      mount(FormDesigner, {
        props: { name: "二", rules: "[]", options: "{}", editingMode: "retained" },
        attachTo: document.body,
      }),
    );
    await owner.step(flushPromises);
    first.close();
    expect(window.onbeforeunload).toBeNull();
    expect(document.body.ondrop).toBeNull();
    const inside = new Event("drop", { bubbles: true, cancelable: true });
    second.element.dispatchEvent(inside);
    expect(inside.defaultPrevented).toBe(true);
    owner.close();
    expect(window.onbeforeunload).toBeNull();
    expect(document.body.ondrop).toBeNull();
  });

  it("脏数据离页回调保持且卸载后移除，不重复执行宿主回调", async () => {
    const owner = fixture.beginManagerOwner();
    fixture.isolateManagerDesignerStyle(owner);
    const hostUnload = vi.fn();
    window.onbeforeunload = hostUnload;
    const target = owner.mount(() =>
      mount(FormDesigner, {
        props: { name: "离页保护", rules: "[]", options: "{}" },
        attachTo: document.body,
      }),
    );
    await owner.step(flushPromises);
    function signalUnload(): unknown {
      const event = new Event("beforeunload", { cancelable: true });
      // Happy DOM 没有真实离页 UI；独立记录供应商对事件协议的写入。
      Object.defineProperty(event, "returnValue", {
        configurable: true,
        writable: true,
        value: "",
      });
      window.dispatchEvent(event);
      return Reflect.get(event, "returnValue");
    }
    expect(signalUnload()).toBe("");
    expect(hostUnload).toHaveBeenCalledTimes(1);
    await owner.step(() => target.get("._fc-l-item").trigger("click"));
    await owner.step(() => target.get("._fc-l-item").trigger("click"));
    await owner.step(flushPromises);
    expect(signalUnload()).not.toBe("");
    const calls = hostUnload.mock.calls.length;
    owner.close();
    expect(signalUnload()).toBe("");
    expect(hostUnload).toHaveBeenCalledTimes(calls + 1);
  });
});
