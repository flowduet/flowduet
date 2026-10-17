import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "../App.vue";
import { assertActiveTarget, createBrowserTestCase } from "./browser-test-scope";

// 真实App使用VueFlow；与既有集成测试相同的DOM缺失API兼容。
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

const originalSetItem = localStorage.setItem;
const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
type TestCase = ReturnType<typeof createBrowserTestCase>;
let registeredCases: TestCase[] = [];
let currentCase: TestCase;
function registerCase(): TestCase {
  const owner = createBrowserTestCase();
  registeredCases.push(owner);
  return owner;
}
function cleanupGlobals(): void {
  try {
    document.body.innerHTML = "";
    localStorage.clear();
  } finally {
    vi.restoreAllMocks();
  }
}
function closeCases(cases: TestCase[]): void {
  const errors: unknown[] = [];
  for (const owner of [...cases].reverse()) {
    try {
      owner.close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "测试夹具清理失败");
}
beforeEach(() => {
  currentCase = registerCase();
});
afterEach(() => {
  const cases = registeredCases;
  registeredCases = [];
  try {
    closeCases(cases);
  } finally {
    try {
      cleanupGlobals();
    } finally {
      try {
        Object.defineProperty(localStorage, "setItem", {
          configurable: true,
          writable: true,
          value: originalSetItem,
        });
      } finally {
        if (originalDescriptor)
          Object.defineProperty(Element.prototype, "toString", originalDescriptor);
        else Reflect.deleteProperty(Element.prototype, "toString");
      }
    }
  }
});

describe("浏览器测试作用域", () => {
  it("兼容仅影响Element字符串，完整恢复安装时描述符且重复关闭无副作用", () => {
    const prior = {
      configurable: true,
      enumerable: true,
      writable: false,
      value: () => "原字符串",
    };
    Object.defineProperty(Element.prototype, "toString", prior);
    const objectString = Object.prototype.toString;
    const windowString = window.toString;
    const windowResult = window.toString();
    const owner = currentCase;
    const scope = owner.openScope(
      () => {},
      () => {},
    );
    const element = document.createElement("div");
    element.innerHTML = "<b>保留显式序列化</b>";
    expect(element.toString()).toBe(Object.prototype.toString.call(element));
    expect(element.outerHTML).toBe("<div><b>保留显式序列化</b></div>");
    expect(Object.prototype.toString).toBe(objectString);
    expect(window.toString).toBe(windowString);
    expect(window.toString()).toBe(windowResult);
    scope.close(
      () => {},
      () => {},
    );
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(prior);
    scope.close(
      () => {
        throw new Error("不得重复卸载");
      },
      () => {},
    );
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(prior);
  });
  it("原型只有继承字符串方法时，关闭删除覆盖而非制造自有属性", () => {
    Reflect.deleteProperty(Element.prototype, "toString");
    const inherited = document.createElement("div").toString;
    const owner = currentCase;
    const scope = owner.openScope(
      () => {},
      () => {},
    );
    expect(Object.hasOwn(Element.prototype, "toString")).toBe(true);
    scope.close(
      () => {},
      () => {},
    );
    expect(Object.hasOwn(Element.prototype, "toString")).toBe(false);
    expect(document.createElement("div").toString).toBe(inherited);
  });

  it.each(["正常", "测试体抛错", "卸载后抛错"])(
    "%s仍恢复真实组件、DOM、存储、spy和描述符",
    async (failure) => {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
      const url = URL.createObjectURL;
      const setItem = localStorage.setItem;
      const click = HTMLAnchorElement.prototype.click;
      const owner = currentCase;
      let cleanupTarget: ReturnType<typeof mount> | undefined;
      const scope = owner.openScope(() => cleanupTarget?.unmount(), cleanupGlobals);
      const target = (cleanupTarget = scope.own(mount(App, { attachTo: document.body })));
      let caught: unknown;
      try {
        await flushPromises();
        owner.assertActive();
        assertActiveTarget(target);
        localStorage.setItem("scope-fixture", "需清理");
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        });
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:scope");
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        if (failure === "测试体抛错") throw new Error("协议注入：测试体失败");
      } catch (error) {
        caught = error;
      } finally {
        try {
          scope.close(
            () => {
              expect(() => assertActiveTarget(target)).toThrow("测试实例已失效");
              target.unmount();
              if (failure === "卸载后抛错") throw new Error("协议注入：真实卸载后失败");
            },
            () => {
              document.body.innerHTML = "";
              localStorage.clear();
              vi.restoreAllMocks();
            },
          );
        } catch (error) {
          caught = error;
        }
      }
      if (failure === "正常") expect(caught).toBeUndefined();
      else
        expect(caught).toEqual(
          new Error(failure === "测试体抛错" ? "协议注入：测试体失败" : "协议注入：真实卸载后失败"),
        );
      expect(target.element.isConnected).toBe(false);
      expect(document.body.innerHTML).toBe("");
      expect(localStorage.length).toBe(0);
      expect(localStorage.setItem).toBe(setItem);
      localStorage.setItem("after-scope", "恢复后可写");
      expect(localStorage.getItem("after-scope")).toBe("恢复后可写");
      localStorage.clear();
      expect(URL.createObjectURL).toBe(url);
      expect(HTMLAnchorElement.prototype.click).toBe(click);
      expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
      expect(() => assertActiveTarget(target)).toThrow("测试实例已失效");
    },
  );

  it("同例协议：A清理后释放迟到动作，不点击B抽屉、不改变B模型或spy", async () => {
    const owner = currentCase;
    let cleanupA: ReturnType<typeof mount> | undefined;
    const scopeA = owner.openScope(() => cleanupA?.unmount(), cleanupGlobals);
    const a = (cleanupA = scopeA.own(mount(App, { attachTo: document.body })));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // 模拟已经启动、但直到A结束后才继续的测试动作；不在CI中制造真实超时。
    const lateAction = (async () => {
      await gate;
      owner.assertActive();
      assertActiveTarget(a);
      document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    })().catch((error: unknown) => error);
    let b: ReturnType<typeof mount> | undefined;
    let scopeB: ReturnType<TestCase["openScope"]> | undefined;
    try {
      await flushPromises();
      owner.assertActive();
      scopeA.close(
        () => a.unmount(),
        () => {
          document.body.innerHTML = "";
          localStorage.clear();
          vi.restoreAllMocks();
        },
      );
      scopeB = owner.openScope(() => b?.unmount(), cleanupGlobals);
      b = scopeB.own(mount(App, { attachTo: document.body }));
      await b.find('[data-test="new-design-btn"]').trigger("click");
      owner.assertActive();
      await b.findAll('[data-test="node-card"]')[1]!.trigger("click");
      owner.assertActive();
      await flushPromises();
      owner.assertActive();
      const drawer = b.find('[data-test="node-drawer"]');
      const input = b.get<HTMLInputElement>('[data-test="drawer-assignee"]');
      expect(input.element.value).toBe("");
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:B");
      release();
      expect(await lateAction).toEqual(new Error("测试实例已失效，拒绝迟到动作"));
      owner.assertActive();
      await flushPromises();
      owner.assertActive();
      expect(drawer.isVisible()).toBe(true);
      expect(input.element.value).toBe("");
      expect(clickSpy).not.toHaveBeenCalled();
      expect(urlSpy).not.toHaveBeenCalled();
      expect(URL.createObjectURL).toBe(urlSpy);
      expect(HTMLAnchorElement.prototype.click).toBe(clickSpy);
      await input.setValue("${boss}");
      owner.assertActive();
      await b.get('[data-test="drawer-save"]').trigger("click");
      owner.assertActive();
      await b.get('[data-test="save-local-btn"]').trigger("click");
      owner.assertActive();
      await flushPromises();
      owner.assertActive();
      expect(b.get('[data-test="doc-status"]').text()).toContain("无待修复项");
      const saved = JSON.parse(localStorage.getItem("flowduet.playground.design")!);
      expect(saved.xml).toContain('flowable:assignee="${boss}"');
    } finally {
      release();
      await lateAction;
      scopeA.close(
        () => a.unmount(),
        () => {},
      );
      scopeB?.close(
        () => b?.unmount(),
        () => {
          document.body.innerHTML = "";
          localStorage.clear();
          vi.restoreAllMocks();
        },
      );
    }
  });
  it("用例结束后旧finally与新scope请求均不能污染后例", async () => {
    const owner = currentCase;
    const aCase = registerCase();
    const bCase = registerCase();
    let cleanupA: ReturnType<typeof mount> | undefined;
    let b: ReturnType<typeof mount> | undefined;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const scopeA = aCase.openScope(
      () => cleanupA?.unmount(),
      () => {
        document.body.innerHTML = "";
        localStorage.clear();
        vi.restoreAllMocks();
      },
    );
    const a = (cleanupA = scopeA.own(mount(App, { attachTo: document.body })));
    // 与runner超时同一结束入口；门只控制旧续体时机，不提升或等待真实deadline。
    const late = (async () => {
      try {
        await gate;
        aCase.assertActive();
        document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
      } finally {
        scopeA.close(
          () => a?.unmount(),
          () => {
            document.body.innerHTML = "";
            localStorage.clear();
            vi.restoreAllMocks();
          },
        );
      }
    })().catch((error: unknown) => error);
    try {
      await flushPromises();
      owner.assertActive();
      closeCases([aCase]);
      const scopeB = bCase.openScope(
        () => b?.unmount(),
        () => {
          document.body.innerHTML = "";
          localStorage.clear();
          vi.restoreAllMocks();
        },
      );
      b = scopeB.own(mount(App, { attachTo: document.body }));
      await b.get('[data-test="new-design-btn"]').trigger("click");
      owner.assertActive();
      await b.findAll('[data-test="node-card"]')[1]!.trigger("click");
      owner.assertActive();
      await flushPromises();
      owner.assertActive();
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
      const setItem = localStorage.setItem;
      const spy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:B");
      localStorage.setItem("B-lifetime", "保留B");
      release();
      expect(await late).toEqual(new Error("测试用例已结束，拒绝迟到续体"));
      owner.assertActive();
      await flushPromises();
      owner.assertActive();
      expect(b.element.isConnected).toBe(true);
      expect(b.get('[data-test="node-drawer"]').isVisible()).toBe(true);
      expect(b.get<HTMLInputElement>('[data-test="drawer-assignee"]').element.value).toBe("");
      expect(URL.createObjectURL).toBe(spy);
      expect(spy).not.toHaveBeenCalled();
      expect(localStorage.getItem("B-lifetime")).toBe("保留B");
      expect(localStorage.setItem).toBe(setItem);
      expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
      // 仅检查旧target不够：旧续体也不能在后例中创建新的全局兼容作用域。
      expect(() =>
        aCase.openScope(
          () => {},
          () => {},
        ),
      ).toThrow("测试用例已结束");
      expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
      await b.get<HTMLInputElement>('[data-test="drawer-assignee"]').setValue("${boss}");
      owner.assertActive();
      await b.get('[data-test="drawer-save"]').trigger("click");
      owner.assertActive();
      await b.get('[data-test="save-local-btn"]').trigger("click");
      owner.assertActive();
      await flushPromises();
      owner.assertActive();
      expect(b.get('[data-test="doc-status"]').text()).toContain("无待修复项");
      expect(JSON.parse(localStorage.getItem("flowduet.playground.design")!).xml).toContain(
        'flowable:assignee="${boss}"',
      );
    } finally {
      release();
      await late;
      closeCases([aCase]);
      bCase.close();
    }
  });
  it.each([false, true])("用例关闭逆序处理全部scope且保留卸载异常：%s", async (failUnmount) => {
    const owner = currentCase;
    const lifecycle = registerCase();
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
    const closed: string[] = [];
    let cleanupA: ReturnType<typeof mount> | undefined;
    let cleanupB: ReturnType<typeof mount> | undefined;
    const scopeA = lifecycle.openScope(() => {
      cleanupA?.unmount();
      closed.push("A");
    }, cleanupGlobals);
    const a = (cleanupA = scopeA.own(mount(App, { attachTo: document.body })));
    const scopeB = lifecycle.openScope(() => {
      cleanupB?.unmount();
      closed.push("B");
      if (failUnmount) throw new Error("协议注入：B真实卸载后失败");
    }, cleanupGlobals);
    const b = (cleanupB = scopeB.own(mount(App, { attachTo: document.body })));
    try {
      await flushPromises();
      owner.assertActive();
      if (failUnmount) expect(() => closeCases([lifecycle])).toThrow("协议注入：B真实卸载后失败");
      else closeCases([lifecycle]);
      expect(closed).toEqual(["B", "A"]);
      expect(() => lifecycle.assertActive()).toThrow("测试用例已结束");
      expect(a.element.isConnected).toBe(false);
      expect(b.element.isConnected).toBe(false);
      expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
      lifecycle.close();
      expect(closed).toEqual(["B", "A"]);
    } finally {
      // 反证实现即使中途抛错也不能让本回归夹具残留真实组件。
      scopeB.close(() => b?.unmount(), cleanupGlobals);
      scopeA.close(() => a?.unmount(), cleanupGlobals);
    }
  });
});
