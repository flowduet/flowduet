import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "./App.vue";
import { createBrowserTestScope } from "./test-utils/browser-test-scope";

let wrapper: ReturnType<typeof mount> | undefined;
let scope: ReturnType<typeof createBrowserTestScope>;
const originallyDark = document.documentElement.classList.contains("dark");

// VueFlow 初始化需要 ResizeObserver；本例只核对公开场景装配，不推断画布布局。
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

beforeEach(() => {
  scope = createBrowserTestScope();
  // 与正式 index.html 一致：显式 appendTo 样例要求目标先于 Vue 挂载存在。
  const popperTarget = document.createElement("div");
  popperTarget.id = "form-appearance-explicit-popper-target";
  document.body.append(popperTarget);
});

afterEach(() => {
  const target = wrapper;
  wrapper = undefined;
  scope.close(
    () => target?.unmount(),
    () => {
      document.body.innerHTML = "";
      document.documentElement.classList.toggle("dark", originallyDark);
      localStorage.clear();
      vi.restoreAllMocks();
    },
  );
});

describe("Playground 双入口公开消费示例", () => {
  it("两个入口同时挂载，并共享宿主主动声明的浅色／深色主题", { timeout: 15000 }, async () => {
    const target = (wrapper = scope.own(mount(App, { attachTo: document.body })));

    await target.find('[data-test="appearance-scene-btn"]').trigger("click");
    await flushPromises();

    expect(target.find('[data-test="appearance-consumption-scene"]').exists()).toBe(true);
    expect(target.find('[data-test="appearance-scene"]').exists()).toBe(true);
    expect(target.find('[data-test="form-appearance-scene"]').exists()).toBe(true);

    await target.find('[data-test="form-appearance-host-dark"]').setValue(true);
    await flushPromises();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      target.find<HTMLSelectElement>('[data-test="appearance-first-mode"]').element.value,
    ).toBe("dark");
    expect(
      target.find<HTMLSelectElement>('[data-test="form-appearance-first-mode"]').element.value,
    ).toBe("dark");
    // 品牌实例自己的异主题选择不被宿主切换改写。
    expect(
      target.find<HTMLSelectElement>('[data-test="form-appearance-second-mode"]').element.value,
    ).toBe("dark");

    await target.find('[data-test="appearance-host-dark"]').setValue(false);
    await target.find('[data-test="appearance-declarative-dark"]').setValue(true);
    await flushPromises();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(
      target.find<HTMLSelectElement>('[data-test="appearance-first-mode"]').element.value,
    ).toBe("dark");
    expect(
      target.find<HTMLSelectElement>('[data-test="form-appearance-first-mode"]').element.value,
    ).toBe("dark");
  });
});
