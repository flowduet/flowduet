// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { defineComponent, h, onBeforeMount, reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import FcDesigner from "@form-create/designer";
import TextDefaultEditor from "./TextDefaultEditor.vue";
import { createEditorInputState } from "./editor-input-state.js";
import { retainedDesignerConfig, FIELD_MENU } from "./designer-config.js";
import { prepareTextDefaults } from "./text-defaults.js";
import { ensureFormCreateInstalled } from "../form-create-setup.js";

type MountedRoot = { element: Node; unmount(): void };
type InputState = ReturnType<typeof createEditorInputState>;
type LifetimeOptions = { isolateMainStyle?: boolean };
function snapshotEnvironment() {
  const element = Element.prototype;
  const settings = (
    window as unknown as { happyDOM: { settings: { disableComputedStyleRendering: boolean } } }
  ).happyDOM.settings;
  return {
    element,
    descriptor: Object.getOwnPropertyDescriptor(element, "toString"),
    settings,
    computedStyle: settings.disableComputedStyleRendering,
  };
}
function restoreEnvironment(snapshot: ReturnType<typeof snapshotEnvironment>) {
  // 两项恢复独立执行，后一步故障不能覆盖前一步的原始异常。
  cleanupAll([
    () => {
      if (snapshot.descriptor)
        Object.defineProperty(snapshot.element, "toString", snapshot.descriptor);
      else Reflect.deleteProperty(snapshot.element, "toString");
    },
    () => {
      snapshot.settings.disableComputedStyleRendering = snapshot.computedStyle;
    },
  ]);
}
function cleanupAll(steps: (() => void)[]) {
  let failed = false;
  let failure: unknown;
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
}
/** 本文件仅文字生命期例不验主CSS；恢复先登记，真实卸载后再接回原节点。 */
function isolateLifetimeDesignerStyle(registerRestore: (restore: () => void) => void) {
  const matches = Array.from(document.head.querySelectorAll("style")).filter(
    (style) =>
      style.textContent?.startsWith(".CodeMirror{") && style.textContent.includes("._fc-designer"),
  );
  if (matches.length !== 1) throw new Error("未找到唯一的设计器主样式表");
  const style = matches[0]!;
  const parent = style.parentNode!;
  const next = style.nextSibling;
  registerRestore(() => {
    if (style.parentNode === parent && style.nextSibling === next) return;
    if (style.parentNode !== null || (next !== null && next.parentNode !== parent))
      throw new Error("设计器主样式表恢复位置冲突");
    parent.insertBefore(style, next);
  });
  style.remove();
}
function createLifetimeScope(options: LifetimeOptions = {}) {
  const environment = snapshotEnvironment();
  const ownerDocument = document;
  const isolateMainStyle = options.isolateMainStyle === true;
  let active = true;
  let closed = false;
  let root: MountedRoot | undefined;
  let afterUnmount: (() => void) | undefined;
  let inputState: InputState | undefined;
  let restoreDesignerStyle: (() => void) | undefined;
  const releases: (() => void)[] = [];
  function assertActive() {
    if (!active) throw new Error("文字生命期用例已结束");
  }
  return {
    install() {
      assertActive();
      // 本例只验字段生命期，CSS级联由真实浏览器矩阵承担；不替换真实控件。
      environment.settings.disableComputedStyleRendering = true;
      Object.defineProperty(environment.element, "toString", {
        configurable: true,
        writable: true,
        value: Object.prototype.toString,
      });
      if (isolateMainStyle)
        isolateLifetimeDesignerStyle((restore) => {
          restoreDesignerStyle = restore;
        });
    },
    invalidate() {
      active = false;
    },
    mayContinue() {
      if (!active) return false;
      // 活动用例意外断开必须失败，不能借取消保护跳过业务断言。
      if (root && !root.element.isConnected) throw new Error("活动用例的真实组件已断开");
      return true;
    },
    mount<T extends MountedRoot>(create: () => T, after?: () => void): T {
      assertActive();
      const mounted = create();
      root = mounted;
      afterUnmount = after;
      return mounted;
    },
    ownState(state: InputState) {
      assertActive();
      inputState = state;
    },
    ownRelease(release: () => void) {
      assertActive();
      releases.push(release);
    },
    close() {
      if (closed) return;
      // 先失效；卸载或恢复抛错后，迟到finally也不能再次清理后例。
      active = false;
      closed = true;
      cleanupAll([
        ...releases.splice(0),
        () => {
          root?.unmount();
          afterUnmount?.();
        },
        () => inputState?.clear(),
        () => {
          ownerDocument.body.innerHTML = "";
        },
        () => restoreDesignerStyle?.(),
        () => restoreEnvironment(environment),
      ]);
    },
  };
}
type LifetimeScope = ReturnType<typeof createLifetimeScope>;
const scopes: LifetimeScope[] = [];
let ambient: ReturnType<typeof snapshotEnvironment>;
function beginScope(options: LifetimeOptions = {}) {
  const scope = createLifetimeScope(options);
  scopes.push(scope);
  // 先登记再安装，部分安装失败也由afterEach关闭。
  scope.install();
  return scope;
}
function finishCases() {
  const ending = scopes.splice(0).reverse();
  ending.forEach((scope) => scope.invalidate());
  cleanupAll(ending.map((scope) => () => scope.close()));
}
beforeEach(() => {
  ambient = snapshotEnvironment();
});
afterEach(() => {
  cleanupAll([
    finishCases,
    () => {
      document.body.innerHTML = "";
    },
    () => restoreEnvironment(ambient),
  ]);
});

it("删除后同名字段新生命期不继承旧存在性与组合阻断", async () => {
  const scope = beginScope({ isolateMainStyle: true });
  const state = createEditorInputState(() => {});
  scope.ownState(state);
  const config = {
    ...retainedDesignerConfig((source) => state.bind(source), "text-lifetime"),
    fieldReadonly: false,
  };
  const root = scope.mount(() =>
    mount(
      defineComponent({
        setup() {
          onBeforeMount(() => {
            expect(
              Array.from(document.head.querySelectorAll("style")).some(
                (style) =>
                  style.textContent?.startsWith(".CodeMirror{") &&
                  style.textContent.includes("._fc-designer"),
              ),
            ).toBe(false);
            ensureFormCreateInstalled();
            FcDesigner.component("flowduetTextDefault", TextDefaultEditor);
          });
          return () =>
            h(FcDesigner, {
              config,
              menu: FIELD_MENU,
              onDelete: state.release,
              onVnodeUnmounted: () => state.clear(),
            });
        },
      }),
      { attachTo: document.body },
    ),
  );

  await flushPromises();
  if (!scope.mayContinue()) return;
  const target = root.findComponent(FcDesigner);
  const rules = [{ type: "input", field: "text", title: "旧字段", value: "旧值" }];
  prepareTextDefaults(rules);
  target.vm.setRule(rules);
  let mask: Element | null | undefined;
  await vi.waitFor(() => {
    if (!scope.mayContinue()) return;
    expect(root.element.isConnected).toBe(true);
    const label = root.findAll(".el-form-item__label").find((node) => node.text() === "旧字段");
    mask = label?.element.closest("._fd-drag-item")?.querySelector("._fd-drag-mask");
    expect(mask).toBeTruthy();
  });
  if (!scope.mayContinue()) return;
  mask!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushPromises();
  if (!scope.mayContinue()) return;
  await vi.waitFor(() => {
    if (!scope.mayContinue()) return;
    expect(target.find('[data-retained-input="text"][data-field="text"]').exists()).toBe(true);
  });
  if (!scope.mayContinue()) return;
  const oldInput = target.get<HTMLInputElement>('[data-retained-input="text"]');
  expect(oldInput.element.value).toBe("旧值");
  await oldInput.trigger("compositionstart");
  if (!scope.mayContinue()) return;
  expect(state.blockers().map((b) => b.code)).toContain("composing");
  await target.get("._fc-m-drag .icon-delete").trigger("click");
  if (!scope.mayContinue()) return;
  await flushPromises();
  if (!scope.mayContinue()) return;
  expect(state.blockers()).toEqual([]);
  await target
    .findAll("._fc-l-item")
    .find((item) => item.text() === "输入框")!
    .trigger("click");
  if (!scope.mayContinue()) return;
  await vi.waitFor(() => {
    if (!scope.mayContinue()) return;
    expect(target.find('[data-retained-input="text-toggle"]').exists()).toBe(true);
  });
  if (!scope.mayContinue()) return;
  const field = target
    .findAll("._fc-r-config .el-form-item")
    .find((item) => item.text().includes("字段 ID"))!;
  await field.get("input").setValue("text");
  if (!scope.mayContinue()) return;
  await field.get("input").trigger("blur");
  if (!scope.mayContinue()) return;
  await flushPromises();
  if (!scope.mayContinue()) return;
  expect(target.vm.getRule()[0]!.field).toBe("text");
  expect(
    target.find('[data-retained-input="text"]').exists()
      ? target.get<HTMLInputElement>('[data-retained-input="text"]').element.value
      : "",
  ).toBe("");
  expect(state.blockers()).toEqual([]);
  state.clear();
});

// 清理交错使用真实文字控件；不把它计为第三方设计器或自然故障证据。
function mountText(scope: LifetimeScope, value: string, afterUnmount?: () => void) {
  const source = reactive<{ type: string; field: string; value: unknown }>({
    type: "input",
    field: "same",
    value,
  });
  const state = createEditorInputState(() => {});
  scope.ownState(state);
  const binding = state.bind(source);
  const root = scope.mount(
    () =>
      mount(
        defineComponent({
          setup: () => () =>
            h(TextDefaultEditor, {
              binding,
              modelValue: source.value,
              "onUpdate:modelValue": (value: unknown) => {
                source.value = value;
              },
            }),
        }),
        { attachTo: document.body },
      ),
    afterUnmount,
  );
  return { root, source, state };
}

it.each([
  { css: false, own: true },
  { css: true, own: false },
])("文字生命期测试作用域：正常关闭恢复设置与完整描述符 $css/$own", ({ css, own }) => {
  const settings = ambient.settings;
  settings.disableComputedStyleRendering = css;
  if (own)
    Object.defineProperty(Element.prototype, "toString", {
      configurable: true,
      enumerable: true,
      writable: false,
      value: function () {
        return "原自有语义";
      },
    });
  else Reflect.deleteProperty(Element.prototype, "toString");
  const before = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const scope = beginScope();
  const { root } = mountText(scope, "原值");
  expect(settings.disableComputedStyleRendering).toBe(true);
  expect(Element.prototype.toString).toBe(Object.prototype.toString);
  expect(root.element.isConnected).toBe(true);
  scope.close();
  expect(root.element.isConnected).toBe(false);
  expect(settings.disableComputedStyleRendering).toBe(css);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(before);
  expect(() => scope.close()).not.toThrow();
  expect(settings.disableComputedStyleRendering).toBe(css);
});

it("文字生命期测试作用域：测试体异常后仍卸载并恢复设置", () => {
  const before = snapshotEnvironment();
  const failure = new Error("测试体中断");
  let element: Node | undefined;
  expect(() => {
    const scope = beginScope();
    try {
      const { root } = mountText(scope, "未完成");
      element = root.element;
      expect(before.settings.disableComputedStyleRendering).toBe(true);
      throw failure;
    } finally {
      finishCases();
    }
  }).toThrow(failure);
  expect(element?.isConnected).toBe(false);
  expect(before.settings.disableComputedStyleRendering).toBe(before.computedStyle);
  expect(Object.getOwnPropertyDescriptor(before.element, "toString")).toEqual(before.descriptor);
});

it("文字生命期测试作用域：真实卸载后异常仍恢复且不重复清理", () => {
  const before = snapshotEnvironment();
  const failure = new Error("真实卸载后故障");
  const scope = beginScope();
  let calls = 0;
  const { root, state } = mountText(scope, "旧值", () => {
    calls++;
    throw failure;
  });
  expect(before.settings.disableComputedStyleRendering).toBe(true);
  expect(() => scope.close()).toThrow(failure);
  expect(root.element.isConnected).toBe(false);
  expect(state.blockers()).toEqual([]);
  expect(document.body.childNodes).toHaveLength(0);
  expect(before.settings.disableComputedStyleRendering).toBe(before.computedStyle);
  expect(Object.getOwnPropertyDescriptor(before.element, "toString")).toEqual(before.descriptor);
  expect(() => scope.close()).not.toThrow();
  expect(calls).toBe(1);
});

it("文字生命期测试作用域：结束A后迟到续体与旧close不影响B", async () => {
  const a = beginScope();
  const first = mountText(a, "A");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  a.ownRelease(release);
  let lateActions = 0;
  const late = (async () => {
    await gate;
    if (!a.mayContinue()) return;
    lateActions++;
    await first.root.get("input[data-retained-input=text]").setValue("迟到输入");
  })().finally(() => a.close());
  // 与afterEach共用结束入口，模拟runner已结束A而旧异步体未返回。
  finishCases();
  const b = beginScope();
  const second = mountText(b, "B");
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const settings = snapshotEnvironment().settings;
  try {
    release();
    await late;
    if (!b.mayContinue()) return;
    expect(lateActions).toBe(0);
    let created = false;
    expect(() =>
      a.mount(() => {
        created = true;
        return mount(defineComponent(() => () => h("div")));
      }),
    ).toThrow();
    expect(created).toBe(false);
    expect(second.root.element.isConnected).toBe(true);
    expect(second.source.value).toBe("B");
    expect(settings.disableComputedStyleRendering).toBe(true);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
    if (!b.mayContinue()) return;
    await second.root.get("input[data-retained-input=text]").setValue("B的新输入");
    if (!b.mayContinue()) return;
    await flushPromises();
    if (!b.mayContinue()) return;
    expect(second.source.value).toBe("B的新输入");
    expect(second.state.blockers()).toEqual([]);
  } finally {
    release();
    await late;
    b.close();
  }
});

it("文字生命期测试作用域：活动组件意外断开必须失败", () => {
  const scope = beginScope();
  const { root } = mountText(scope, "真实输入");
  root.element.parentNode!.removeChild(root.element);
  expect(() => scope.mayContinue()).toThrow("活动用例的真实组件已断开");
});

it("文字生命期测试作用域：异常时仍逆序关闭全部登记对象", () => {
  const before = snapshotEnvironment();
  const calls: string[] = [];
  const a = beginScope();
  const first = mountText(a, "A", () => {
    calls.push("A");
  });
  const b = beginScope();
  const failure = new Error("B卸载后故障");
  const second = mountText(b, "B", () => {
    calls.push("B");
    throw failure;
  });
  expect(before.settings.disableComputedStyleRendering).toBe(true);
  expect(() => finishCases()).toThrow(failure);
  expect(calls).toEqual(["B", "A"]);
  expect(first.root.element.isConnected).toBe(false);
  expect(second.root.element.isConnected).toBe(false);
  expect(a.mayContinue()).toBe(false);
  expect(b.mayContinue()).toBe(false);
  expect(before.settings.disableComputedStyleRendering).toBe(before.computedStyle);
  expect(Object.getOwnPropertyDescriptor(before.element, "toString")).toEqual(before.descriptor);
});

it.each([true, false])("首异常恢复：双故障保留描述符首异常 own=%s", (own) => {
  const snapshot = snapshotEnvironment();
  const first = new Error("描述符恢复故障");
  const second = new Error("设置恢复故障");
  const calls: string[] = [];
  const failDescriptor = () => {
    calls.push("descriptor");
    throw first;
  };
  const faultSnapshot = {
    ...snapshot,
    descriptor: own
      ? { configurable: true, writable: true, value: Object.prototype.toString }
      : undefined,
    element: new Proxy(snapshot.element, {
      defineProperty: failDescriptor,
      deleteProperty: failDescriptor,
    }),
    settings: new Proxy(snapshot.settings, {
      set() {
        calls.push("settings");
        throw second;
      },
    }),
  };
  let caught: unknown;
  try {
    restoreEnvironment(faultSnapshot);
  } catch (error) {
    caught = error;
  }
  expect(calls).toEqual(["descriptor", "settings"]);
  expect(caught).toBe(first);
});

it.each([
  { own: true, descriptorFails: true },
  { own: false, descriptorFails: true },
  { own: true, descriptorFails: false },
  { own: false, descriptorFails: false },
])("首异常恢复：单故障不跳过另一恢复 $own/$descriptorFails", ({ own, descriptorFails }) => {
  const snapshot = snapshotEnvironment();
  const failure = new Error("单步恢复故障");
  const calls: string[] = [];
  const descriptorStep = () => {
    calls.push("descriptor");
    if (descriptorFails) throw failure;
    // 成功路径同样只观察局部代理，不能修改真实原型。
    return true;
  };
  const faultSnapshot = {
    ...snapshot,
    descriptor: own
      ? { configurable: true, writable: true, value: Object.prototype.toString }
      : undefined,
    element: new Proxy(snapshot.element, {
      defineProperty: descriptorStep,
      deleteProperty: descriptorStep,
    }),
    settings: new Proxy(snapshot.settings, {
      set(_target, key, value) {
        expect(key).toBe("disableComputedStyleRendering");
        expect(value).toBe(snapshot.computedStyle);
        calls.push("settings");
        if (!descriptorFails) throw failure;
        return true;
      },
    }),
  };
  let caught: unknown;
  try {
    restoreEnvironment(faultSnapshot);
  } catch (error) {
    caught = error;
  }
  expect(calls).toEqual(["descriptor", "settings"]);
  expect(caught).toBe(failure);
});

it("首异常恢复：关闭故障后A的迟到续体与旧finally不污染B", async () => {
  const a = beginScope();
  const failure = new Error("A真实卸载后故障");
  let unmounts = 0;
  const first = mountText(a, "A", () => {
    unmounts++;
    throw failure;
  });
  let release!: () => void;
  let releases = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  a.ownRelease(() => {
    releases++;
    release();
  });
  let lateActions = 0;
  let finalizers = 0;
  const late = (async () => {
    await gate;
    if (!a.mayContinue()) return;
    lateActions++;
    await first.root.get("input[data-retained-input=text]").setValue("迟到输入");
  })().finally(() => {
    finalizers++;
    a.close();
  });
  // 同步结束A后先挂载B，再让已释放的微任务继续，复现runner换例交错。
  expect(() => finishCases()).toThrow(failure);
  const b = beginScope();
  const second = mountText(b, "B");
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const settings = snapshotEnvironment().settings;
  try {
    await late;
    if (!b.mayContinue()) return;
    expect(lateActions).toBe(0);
    expect(finalizers).toBe(1);
    expect(releases).toBe(1);
    expect(unmounts).toBe(1);
    expect(() => a.ownRelease(() => {})).toThrow("文字生命期用例已结束");
    expect(() => a.mount(() => second.root)).toThrow("文字生命期用例已结束");
    expect(second.root.element.isConnected).toBe(true);
    expect(second.source.value).toBe("B");
    expect(settings.disableComputedStyleRendering).toBe(true);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
    await second.root.get("input[data-retained-input=text]").setValue("B的新输入");
    if (!b.mayContinue()) return;
    await flushPromises();
    if (!b.mayContinue()) return;
    expect(second.source.value).toBe("B的新输入");
    expect(second.state.blockers()).toEqual([]);
    expect(() => a.close()).not.toThrow();
    expect(unmounts).toBe(1);
    expect(releases).toBe(1);
  } finally {
    release();
    await late;
    b.close();
  }
});

it("首异常恢复：提前异常仍释放登记gate并拒绝迟到动作", async () => {
  const before = snapshotEnvironment();
  const scope = beginScope();
  const { root } = mountText(scope, "原输入");
  const failure = new Error("新回归测试体提前中断");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let releases = 0;
  scope.ownRelease(() => {
    releases++;
    release();
  });
  let lateActions = 0;
  const late = gate.then(() => {
    if (!scope.mayContinue()) return;
    lateActions++;
  });
  expect(() => {
    try {
      throw failure;
    } finally {
      finishCases();
    }
  }).toThrow(failure);
  // 故障scope已结束，剩余异步断言另行登记；真实afterEach后不能读取后例环境。
  const observer = createLifetimeScope();
  scopes.push(observer);
  await late;
  if (!observer.mayContinue()) return;
  expect(releases).toBe(1);
  expect(lateActions).toBe(0);
  expect(root.element.isConnected).toBe(false);
  expect(before.settings.disableComputedStyleRendering).toBe(before.computedStyle);
  expect(Object.getOwnPropertyDescriptor(before.element, "toString")).toEqual(before.descriptor);
  expect(() => scope.close()).not.toThrow();
  expect(releases).toBe(1);
});

it("首异常恢复：gate释放故障不跳过剩余释放与真实清理", () => {
  const before = snapshotEnvironment();
  const scope = beginScope();
  const { root, state } = mountText(scope, "待清理输入");
  const failure = new Error("首个gate释放故障");
  const calls: string[] = [];
  scope.ownRelease(() => {
    calls.push("first");
    throw failure;
  });
  scope.ownRelease(() => calls.push("second"));
  expect(() => finishCases()).toThrow(failure);
  expect(calls).toEqual(["first", "second"]);
  expect(root.element.isConnected).toBe(false);
  expect(state.blockers()).toEqual([]);
  expect(document.body.childNodes).toHaveLength(0);
  expect(before.settings.disableComputedStyleRendering).toBe(before.computedStyle);
  expect(Object.getOwnPropertyDescriptor(before.element, "toString")).toEqual(before.descriptor);
  expect(() => scope.close()).not.toThrow();
  expect(calls).toEqual(["first", "second"]);
});

function lifetimeStyleSnapshot() {
  const matches = Array.from(document.head.querySelectorAll("style")).filter(
    (style) =>
      style.textContent?.startsWith(".CodeMirror{") && style.textContent.includes("._fc-designer"),
  );
  expect(matches).toHaveLength(1);
  const style = matches[0]!;
  return {
    style,
    parent: style.parentNode!,
    next: style.nextSibling,
    text: style.textContent,
    attrs: Array.from(style.attributes).map((attr) => [attr.name, attr.value]),
    children: Array.from(style.childNodes),
  };
}

function expectLifetimeStyleRestored(before: ReturnType<typeof lifetimeStyleSnapshot>) {
  expect(before.style.parentNode).toBe(before.parent);
  expect(before.style.nextSibling).toBe(before.next);
  expect(before.style.textContent).toBe(before.text);
  expect(Array.from(before.style.attributes).map((attr) => [attr.name, attr.value])).toEqual(
    before.attrs,
  );
  expect(Array.from(before.style.childNodes)).toEqual(before.children);
  Array.from(before.style.childNodes).forEach((child, index) => {
    expect(child).toBe(before.children[index]);
  });
}

it("文字生命期style：显式隔离在真实挂载前生效且关闭后恢复", () => {
  const before = lifetimeStyleSnapshot();
  const scope = beginScope({ isolateMainStyle: true });
  expect(before.style.isConnected).toBe(false);
  const { root } = mountText(scope, "真实输入");
  expect(root.element.isConnected).toBe(true);
  scope.close();
  expect(root.element.isConnected).toBe(false);
  expectLifetimeStyleRestored(before);
  expect(() => scope.close()).not.toThrow();
  expectLifetimeStyleRestored(before);
});

it.each([undefined, false])("文字生命期style：默认与显式false保持主CSS在场 %s", (option) => {
  const before = lifetimeStyleSnapshot();
  const scope = option === undefined ? beginScope() : beginScope({ isolateMainStyle: option });
  const { root } = mountText(scope, "默认输入");
  expect(root.element.isConnected).toBe(true);
  expectLifetimeStyleRestored(before);
  scope.close();
  expectLifetimeStyleRestored(before);
});

it.each(["missing", "duplicate"])("文字生命期style：拒绝%s且恢复部分安装", (kind) => {
  const environment = snapshotEnvironment();
  const before = lifetimeStyleSnapshot();
  const guard = beginScope();
  const duplicate = before.style.cloneNode(true);
  guard.ownRelease(() => {
    duplicate.parentNode?.removeChild(duplicate);
    if (before.style.parentNode === null) before.parent.insertBefore(before.style, before.next);
  });
  if (kind === "missing") before.style.remove();
  else before.parent.appendChild(duplicate);
  expect(() => beginScope({ isolateMainStyle: true })).toThrow("未找到唯一的设计器主样式表");
  finishCases();
  expectLifetimeStyleRestored(before);
  expect(environment.settings.disableComputedStyleRendering).toBe(environment.computedStyle);
  expect(Object.getOwnPropertyDescriptor(environment.element, "toString")).toEqual(
    environment.descriptor,
  );
});

it.each(["body", "unmount"])("文字生命期style：%s异常仍恢复且不重复清理", (kind) => {
  const environment = snapshotEnvironment();
  const before = lifetimeStyleSnapshot();
  const scope = beginScope({ isolateMainStyle: true });
  const failure = new Error(`文字style${kind}故障`);
  let unmounts = 0;
  const { root, state } = mountText(scope, "原输入", () => {
    unmounts++;
    expect(before.style.isConnected).toBe(false);
    if (kind === "unmount") throw failure;
  });
  expect(() => {
    try {
      if (kind === "body") throw failure;
    } finally {
      scope.close();
    }
  }).toThrow(failure);
  expect(root.element.isConnected).toBe(false);
  expect(state.blockers()).toEqual([]);
  expectLifetimeStyleRestored(before);
  expect(environment.settings.disableComputedStyleRendering).toBe(environment.computedStyle);
  expect(Object.getOwnPropertyDescriptor(environment.element, "toString")).toEqual(
    environment.descriptor,
  );
  expect(() => scope.close()).not.toThrow();
  expect(unmounts).toBe(1);
  expectLifetimeStyleRestored(before);
});

it("文字生命期style：移离后故障已有登记恢复且不泄漏局部替换", () => {
  const before = lifetimeStyleSnapshot();
  const guard = beginScope();
  const descriptor = Object.getOwnPropertyDescriptor(before.style, "remove");
  const remove = before.style.remove.bind(before.style);
  const failure = new Error("主CSS移离后故障");
  guard.ownRelease(() => {
    if (descriptor) Object.defineProperty(before.style, "remove", descriptor);
    else Reflect.deleteProperty(before.style, "remove");
  });
  Object.defineProperty(before.style, "remove", {
    configurable: true,
    value() {
      remove();
      throw failure;
    },
  });
  expect(() => beginScope({ isolateMainStyle: true })).toThrow(failure);
  expect(before.style.isConnected).toBe(false);
  finishCases();
  expectLifetimeStyleRestored(before);
  expect(Object.getOwnPropertyDescriptor(before.style, "remove")).toEqual(descriptor);
});

it("文字生命期style：真实afterEach先卸载再恢复完整环境", () => {
  const environment = snapshotEnvironment();
  const before = lifetimeStyleSnapshot();
  const scope = beginScope({ isolateMainStyle: true });
  let unmounted = false;
  const { root } = mountText(scope, "真实输入", () => {
    expect(before.style.isConnected).toBe(false);
    unmounted = true;
  });
  onTestFinished(() => {
    expect(unmounted).toBe(true);
    expect(root.element.isConnected).toBe(false);
    expect(scope.mayContinue()).toBe(false);
    expectLifetimeStyleRestored(before);
    expect(environment.settings.disableComputedStyleRendering).toBe(environment.computedStyle);
    expect(Object.getOwnPropertyDescriptor(environment.element, "toString")).toEqual(
      environment.descriptor,
    );
  });
});

it("文字生命期style：恢复位置冲突不覆盖外来节点且继续恢复环境", () => {
  const environment = snapshotEnvironment();
  const before = lifetimeStyleSnapshot();
  const next = before.next!;
  expect(next).toBeTruthy();
  const afterNext = next.nextSibling;
  const guard = beginScope();
  guard.ownRelease(() => {
    if (next.parentNode === null) before.parent.insertBefore(next, afterNext);
    if (before.style.parentNode === null) before.parent.insertBefore(before.style, next);
  });
  const guardedEnvironment = snapshotEnvironment();
  const scope = beginScope({ isolateMainStyle: true });
  const { root } = mountText(scope, "冲突输入");
  next.parentNode!.removeChild(next);
  environment.settings.disableComputedStyleRendering = false;
  Object.defineProperty(environment.element, "toString", {
    configurable: true,
    value: () => "局部受控覆盖",
  });
  expect(() => scope.close()).toThrow("设计器主样式表恢复位置冲突");
  expect(root.element.isConnected).toBe(false);
  expect(before.style.parentNode).toBeNull();
  expect(next.parentNode).toBeNull();
  expect(environment.settings.disableComputedStyleRendering).toBe(guardedEnvironment.computedStyle);
  expect(Object.getOwnPropertyDescriptor(environment.element, "toString")).toEqual(
    guardedEnvironment.descriptor,
  );
  finishCases();
  expectLifetimeStyleRestored(before);
  expect(environment.settings.disableComputedStyleRendering).toBe(environment.computedStyle);
});

it("文字生命期style：A结束后迟到续体与旧finally不接回B的样式", async () => {
  const before = lifetimeStyleSnapshot();
  const a = beginScope({ isolateMainStyle: true });
  const first = mountText(a, "A");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  a.ownRelease(release);
  let lateActions = 0;
  const late = (async () => {
    await gate;
    if (!a.mayContinue()) return;
    lateActions++;
    await first.root.get("input[data-retained-input=text]").setValue("旧输入");
  })().finally(() => a.close());
  finishCases();
  expectLifetimeStyleRestored(before);
  const b = beginScope({ isolateMainStyle: true });
  const second = mountText(b, "B");
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  const settings = snapshotEnvironment().settings;
  try {
    await late;
    if (!b.mayContinue()) return;
    expect(lateActions).toBe(0);
    expect(second.root.element.isConnected).toBe(true);
    expect(second.source.value).toBe("B");
    expect(before.style.isConnected).toBe(false);
    expect(settings.disableComputedStyleRendering).toBe(true);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
    await second.root.get("input[data-retained-input=text]").setValue("B的新输入");
    if (!b.mayContinue()) return;
    await flushPromises();
    if (!b.mayContinue()) return;
    expect(second.source.value).toBe("B的新输入");
    expect(second.state.blockers()).toEqual([]);
    expect(before.style.isConnected).toBe(false);
  } finally {
    release();
    await late;
    b.close();
  }
});
