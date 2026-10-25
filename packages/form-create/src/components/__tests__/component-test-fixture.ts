import { expect, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import FcDesigner from "@form-create/designer";
import type { FormDesignerEditingState, FormDesignerCaptureResult } from "../../editor-state.js";
import FormManager from "../FormManager.vue";
import FormDesigner from "../FormDesigner.vue";
import type { FormDefinition } from "../../document.js";
export type RetainedVm = {
  readEditingState(): FormDesignerEditingState;
  captureContent(): FormDesignerCaptureResult;
  exportContent(): { rules: string; options: string } | null;
};
export type ManagerVm = {
  readEditingState(): FormDesignerEditingState | null;
  commitPendingEdit(): boolean;
  hasOpenEditor(): boolean;
};

export type ComponentTestWrapper = ReturnType<typeof mount>;
export type FixtureBindings = {
  getWrapper(): ComponentTestWrapper | undefined;
  setWrapper(value: ComponentTestWrapper | undefined): void;
  getOriginalElementString(): PropertyDescriptor | undefined;
  setOriginalElementString(value: PropertyDescriptor | undefined): void;
};

const fixtureCaseKeyBrand: unique symbol = Symbol("component-test-fixture-case");
export type FixtureCaseKey = Readonly<{ [fixtureCaseKeyBrand]: true }>;
export type FixtureFailure = Readonly<{ error: unknown }>;
export interface FixtureCaseApi {
  beforeEachCase(): FixtureCaseKey;
  afterEachCase(key: FixtureCaseKey, primary?: FixtureFailure): void;
}

/** 每文件独立调用；只闭包保存owner，文件局部状态经明确get/set接线。 */
export function createComponentTestFixture(bindings: FixtureBindings) {
  const slots = {
    get wrapper(): ComponentTestWrapper | undefined {
      return bindings.getWrapper();
    },
    set wrapper(value: ComponentTestWrapper | undefined) {
      bindings.setWrapper(value);
    },
    get originalElementString(): PropertyDescriptor | undefined {
      return bindings.getOriginalElementString();
    },
    set originalElementString(value: PropertyDescriptor | undefined) {
      bindings.setOriginalElementString(value);
    },
  };
  type ManagerRoot = { readonly element: Node; unmount(): void };

  interface ManagerOwner {
    assertActive(): void;
    invalidate(): void;
    mount<T extends ManagerRoot>(create: () => T): T;
    spy<T extends { mockRestore(): unknown }>(create: () => T): { value: T; restore: () => void };
    defer(cleanup: () => void): () => void;
    step<T>(action: () => T | Promise<T>): Promise<T>;
    waitFor(check: () => void): Promise<void>;
    close(): void;
  }

  const managerOwners: ManagerOwner[] = [];
  const signedKeys = new WeakSet<FixtureCaseKey>();
  const closedKeys = new WeakSet<FixtureCaseKey>();
  let activeKey: FixtureCaseKey | undefined;
  let closing = false;

  function finishManagerSteps(steps: (() => void)[], primary?: FixtureFailure) {
    const errors: unknown[] = primary === undefined ? [] : [primary.error];
    for (const step of steps) {
      try {
        step();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Manager用例清理失败");
  }

  function beginManagerOwner(): ManagerOwner {
    let active = true;
    let closed = false;
    const roots: ManagerRoot[] = [];
    const cleanups: (() => void)[] = [];
    function assertActive() {
      if (!active) throw new Error("Manager用例已结束，拒绝迟到续体");
      if (roots.some((root) => !root.element.isConnected))
        throw new Error("活动Manager用例的真实组件已断开");
    }
    function defer(cleanup: () => void) {
      assertActive();
      let pending = true;
      const release = () => {
        if (!pending) return;
        pending = false;
        cleanup();
      };
      cleanups.push(release);
      return release;
    }
    const owner = {
      assertActive,
      invalidate() {
        active = false;
      },
      mount<T extends ManagerRoot>(create: () => T): T {
        assertActive();
        const target = create();
        defer(() => {
          try {
            target.unmount();
          } finally {
            if (Object.is(slots.wrapper, target)) slots.wrapper = undefined;
          }
        });
        roots.push(target);
        return target;
      },
      spy<T extends { mockRestore(): unknown }>(create: () => T) {
        assertActive();
        const value = create();
        return {
          value,
          restore: defer(() => {
            value.mockRestore();
          }),
        };
      },
      defer,
      async step<T>(action: () => T | Promise<T>): Promise<T> {
        assertActive();
        const result = await action();
        assertActive();
        return result;
      },
      async waitFor(check: () => void) {
        assertActive();
        await vi.waitFor(() => {
          assertActive();
          check();
        });
        assertActive();
      },
      close() {
        active = false;
        if (closed) return;
        // 清理开始即消费所有权，卸载/恢复失败也不能让旧finally再次清理后例。
        closed = true;
        finishManagerSteps(cleanups.splice(0).reverse());
      },
    };
    managerOwners.push(owner);
    return owner;
  }

  function isolateManagerDesignerStyle(owner: ManagerOwner) {
    owner.assertActive();
    const matches = Array.from(document.head.querySelectorAll("style")).filter(
      (node) =>
        node.textContent?.startsWith(".CodeMirror{") && node.textContent.includes("._fc-designer"),
    );
    if (matches.length !== 1) throw new Error("未找到唯一的设计器主样式表");
    const style = matches[0]!;
    const parent = style.parentNode!;
    const next = style.nextSibling;
    const restore = owner.defer(() => {
      if (style.parentNode === parent && style.nextSibling === next) return;
      if (style.parentNode !== null || (next !== null && next.parentNode !== parent))
        throw new Error("设计器主样式表恢复位置冲突");
      parent.insertBefore(style, next);
    });
    style.remove();
    return { restore };
  }

  type DesignerFixtureOptions = { owner?: ManagerOwner; isolateMainStyle?: boolean };

  function beginDesignerOwner(options: DesignerFixtureOptions = {}) {
    const owner = options.owner ?? beginManagerOwner();
    if (options.isolateMainStyle === true) isolateManagerDesignerStyle(owner);
    return owner;
  }

  function finishManagerOwners() {
    const ending = managerOwners.splice(0).reverse();
    ending.forEach((owner) => owner.invalidate());
    finishManagerSteps(ending.map((owner) => () => owner.close()));
  }

  const APPLY_FORM: FormDefinition = {
    id: "form_apply",
    name: "申请单",
    provider: "form-create/element-plus",
    rules: JSON.stringify([
      {
        type: "input",
        field: "reason",
        title: "申请事由",
        value: "默认事由",
        $required: true,
      },
    ]),
    options: "{}",
  };

  const MATRIX_RULES_JSON = JSON.stringify([
    {
      type: "input",
      field: "reason",
      title: "申请事由",
      value: "默认事由",
      $required: true,
      _fc_drag_tag: "input",
    },
    { type: "input", field: "detail", title: "详细说明", props: { type: "textarea" } },
    { type: "inputNumber", field: "amount", title: "金额", value: 0 },
    {
      type: "radio",
      field: "urgent",
      title: "是否加急",
      options: [
        { label: "是", value: "1" },
        { label: "否", value: "0" },
      ],
      value: "0",
      effect: { fetch: "" },
    },
    {
      type: "checkbox",
      field: "tags",
      title: "标签",
      options: [
        { label: "甲", value: "a" },
        { label: "乙", value: "b" },
      ],
    },
    { type: "select", field: "level", title: "级别", options: [{ label: "普通", value: "1" }] },
    { type: "datePicker", field: "applyDate", title: "申请日期" },
    {
      type: "switch",
      field: "notify",
      title: "通知",
      value: false,
      props: { activeValue: true, inactiveValue: false },
    },
    {
      type: "fcRow",
      children: [
        {
          type: "col",
          props: { span: 12 },
          children: [{ type: "input", field: "leftCol", title: "列甲" }],
        },
        {
          type: "col",
          props: { span: 12 },
          children: [{ type: "datePicker", field: "rightCol", title: "列乙" }],
        },
      ],
    },
  ]);

  const MATRIX_FORM: FormDefinition = {
    id: "form_matrix",
    name: "矩阵表单",
    provider: "form-create/element-plus",
    rules: MATRIX_RULES_JSON,
    options: "{}",
  };

  type RetainedVm = {
    readEditingState(): FormDesignerEditingState;
    captureContent(): FormDesignerCaptureResult;
    exportContent(): { rules: string; options: string } | null;
  };

  const numericDateRules = JSON.stringify([
    { type: "inputNumber", field: "amount", title: "金额", value: 0 },
    {
      type: "datePicker",
      field: "date",
      title: "日期",
      value: "2024-02-29",
      props: { type: "date", valueFormat: "YYYY-MM-DD" },
    },
  ]);

  type DesignerFixture = { owner: ManagerOwner; target: ReturnType<typeof mount> };

  async function retainedEditor(rules = numericDateRules, options: DesignerFixtureOptions = {}) {
    const owner = beginDesignerOwner(options);
    const target = owner.mount(() =>
      mount(FormDesigner, {
        props: { name: "原文", rules, options: "{}", editingMode: "retained" },
        attachTo: document.body,
      }),
    );
    slots.wrapper = target;
    await owner.step(flushPromises);
    return { owner, target, vm: target.vm as unknown as RetainedVm };
  }

  async function selectRetained({ owner, target }: DesignerFixture, field: string) {
    owner.assertActive();
    const designer = target.findComponent(FcDesigner);
    const previous = designer.emitted("active")?.length ?? 0;
    // 激活和属性区就绪分开：观察输入时不再重复重建已选字段的配置。
    await owner.waitFor(() => {
      if ((designer.emitted("active")?.length ?? 0) === previous) designer.vm.triggerActive(field);
      expect(designer.emitted("active")?.length ?? 0).toBeGreaterThan(previous);
    });
    await owner.step(flushPromises);
    await owner.waitFor(() => {
      expect(target.find(`[data-retained-input][data-field="${field}"]`).exists()).toBe(true);
    });
    return target.get<HTMLInputElement>(`[data-retained-input][data-field="${field}"]`);
  }

  type ManagerVm = {
    readEditingState(): FormDesignerEditingState | null;
    commitPendingEdit(): boolean;
    hasOpenEditor(): boolean;
  };

  async function retainedManager(options: { isolateMainStyle?: boolean } = {}) {
    const owner = beginManagerOwner();
    if (options.isolateMainStyle === true) isolateManagerDesignerStyle(owner);
    const target = owner.mount(() =>
      mount(FormManager, {
        props: { forms: [{ ...APPLY_FORM, rules: numericDateRules }], editingMode: "retained" },
        attachTo: document.body,
      }),
    );
    slots.wrapper = target;
    const vm = target.vm as unknown as ManagerVm;
    expect(typeof vm.readEditingState).toBe("function");
    expect(vm.readEditingState()).toBeNull();
    target
      .get('[data-test="form-edit-btn-form_apply"]')
      .element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(vm.readEditingState()?.blockers[0]?.code).toBe("not-ready");
    await owner.step(flushPromises);
    return { owner, target, vm };
  }

  async function retainedProtocolManager() {
    return retainedManager({ isolateMainStyle: true });
  }

  type ManagerFixture = Awaited<ReturnType<typeof retainedManager>>;

  async function managerRaw({ owner, target }: ManagerFixture, raw = "-") {
    owner.assertActive();
    const designer = target.findComponent(FcDesigner);
    const previous = designer.emitted("active")?.length ?? 0;
    // 选择确认与属性刷新分开，观察输入时不再反复发起激活。
    await owner.waitFor(() => {
      if ((designer.emitted("active")?.length ?? 0) === previous)
        designer.vm.triggerActive("amount");
      expect(designer.emitted("active")?.length ?? 0).toBeGreaterThan(previous);
    });
    await owner.step(flushPromises);
    await owner.waitFor(() => {
      expect(target.find('[data-retained-input="number"]').exists()).toBe(true);
    });
    const input = target.get<HTMLInputElement>('[data-retained-input="number"]');
    await owner.step(() => input.setValue(raw));
    return input;
  }

  async function retainedTitle(fixture: DesignerFixture) {
    await selectRetained(fixture, "amount");
    fixture.owner.assertActive();
    const item = fixture.target
      .findComponent(FcDesigner)
      .findAll("._fc-r-config .el-form-item")
      .find((row) => row.text().includes("字段名称"));
    expect(item).toBeDefined();
    return item!.get<HTMLInputElement>("input");
  }

  function typeNative(input: HTMLInputElement, text: string) {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function mountText(
    rules: unknown[],
    mode: "retained" | "legacy" = "retained",
    owner = beginManagerOwner(),
  ) {
    const create = () =>
      mount(FormDesigner, {
        props: { name: "文字", rules: JSON.stringify(rules), options: "{}", editingMode: mode },
        attachTo: document.body,
      });
    const target = owner.mount(create);
    slots.wrapper = target;
    return { owner, target, vm: target.vm as unknown as RetainedVm };
  }

  async function activateText(
    target: ReturnType<typeof mount>,
    field = "text",
    owner?: ManagerOwner,
  ) {
    owner?.assertActive();
    // 真实卡片已出现不代表提供者的triggerActive索引已就绪；从公开遮罩入口单次选中。
    const title = ({ text: "文字", unset: "未设置", reason: "申请事由" } as Record<string, string>)[
      field
    ];
    let mask: Element | null | undefined;
    await vi.waitFor(() => {
      owner?.assertActive();
      expect(target.element.isConnected).toBe(true);
      const label = target.findAll(".el-form-item__label").find((node) => node.text() === title);
      mask = label?.element.closest("._fd-drag-item")?.querySelector("._fd-drag-mask");
      expect(mask).toBeTruthy();
    });
    owner?.assertActive();
    mask!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    owner?.assertActive();
    await vi.waitFor(() => {
      owner?.assertActive();
      expect(target.element.isConnected).toBe(true);
      expect(
        target.find(`[data-retained-input="text-toggle"][data-field="${field}"]`).exists(),
      ).toBe(true);
    });
    owner?.assertActive();
  }

  function textRules(type: string, grid: boolean) {
    const children = [
      { type: "input", field: "text", title: "文字", value: "原值", props: { type } },
      { type: "input", field: "unset", title: "未设置" },
      { type: "input", field: "empty", title: "显式空串", value: "" },
    ];
    return grid
      ? [{ type: "fcRow", children: [{ type: "col", props: { span: 24 }, children }] }]
      : children;
  }

  function capturedFields(vm: RetainedVm) {
    const result = vm.captureContent();
    expect(result.status, JSON.stringify(result)).toBe("captured");
    if (result.status !== "captured") throw new Error(JSON.stringify(result));
    expect(result.content.rules).not.toContain("__flowduet");
    const rules = JSON.parse(result.content.rules);
    return {
      content: result.content,
      fields: rules[0]?.type === "fcRow" ? rules[0].children[0].children : rules,
    };
  }

  function managerStyleSnapshot() {
    const matches = Array.from(document.head.querySelectorAll("style")).filter(
      (node) =>
        node.textContent?.startsWith(".CodeMirror{") && node.textContent.includes("._fc-designer"),
    );
    expect(matches).toHaveLength(1);
    const style = matches[0]!;
    return {
      style,
      parent: style.parentNode!,
      next: style.nextSibling,
      text: style.textContent,
      children: Array.from(style.childNodes),
      attributes: Array.from(style.attributes).map(({ name, value }) => [name, value]),
      order: Array.from(document.head.childNodes),
    };
  }

  function expectManagerStyleRestored(before: ReturnType<typeof managerStyleSnapshot>) {
    expect(before.style.parentNode).toBe(before.parent);
    expect(before.style.nextSibling).toBe(before.next);
    expect(before.style.textContent).toBe(before.text);
    expect(Array.from(before.style.childNodes)).toEqual(before.children);
    expect(Array.from(before.style.attributes).map(({ name, value }) => [name, value])).toEqual(
      before.attributes,
    );
    expect(Array.from(document.head.childNodes)).toEqual(before.order);
  }
  function beforeEachCase(): FixtureCaseKey {
    if (activeKey !== undefined || closing) throw new Error("当前fixture用例尚未结束");
    const key: FixtureCaseKey = Object.freeze({ [fixtureCaseKeyBrand]: true });
    signedKeys.add(key);
    activeKey = key;
    let original: PropertyDescriptor | undefined;
    let captured = false;
    let slotAttempted = false;
    let compatibilityAttempted = false;
    try {
      original = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
      captured = true;
      slotAttempted = true;
      slots.originalElementString = original;
      compatibilityAttempted = true;
      Object.defineProperty(Element.prototype, "toString", {
        configurable: true,
        writable: true,
        value: Object.prototype.toString,
      });
      return key;
    } catch (error) {
      activeKey = undefined;
      closedKeys.add(key);
      closing = true;
      try {
        // 外部setter/defineProperty可能先写入后抛错；只回滚已经尝试的步骤。
        finishManagerSteps(
          [
            () => {
              if (slotAttempted) slots.originalElementString = undefined;
            },
            () => {
              if (!captured || !compatibilityAttempted) return;
              if (original) Object.defineProperty(Element.prototype, "toString", original);
              else Reflect.deleteProperty(Element.prototype, "toString");
            },
          ],
          { error },
        );
      } finally {
        closing = false;
      }
      throw error;
    }
  }
  function afterEachCase(key: FixtureCaseKey, primary?: FixtureFailure) {
    if (!signedKeys.has(key)) throw new Error("拒绝不属于当前factory的用例身份");
    if (closedKeys.has(key)) return;
    if (activeKey !== key) throw new Error("用例身份不是当前活动用例");
    // 身份先消费；失败不回滚所有权，旧finally不能再次清理后例。
    closedKeys.add(key);
    activeKey = undefined;
    closing = true;
    try {
      finishManagerSteps(
        [
          finishManagerOwners,
          () => {
            const target = slots.wrapper;
            slots.wrapper = undefined;
            target?.unmount();
          },
          () => {
            document.body.innerHTML = "";
          },
          () => {
            const original = slots.originalElementString;
            slots.originalElementString = undefined;
            if (original) Object.defineProperty(Element.prototype, "toString", original);
            else Reflect.deleteProperty(Element.prototype, "toString");
          },
        ],
        primary,
      );
    } finally {
      closing = false;
    }
  }
  return {
    managerOwners,
    finishManagerSteps,
    beginManagerOwner,
    isolateManagerDesignerStyle,
    beginDesignerOwner,
    finishManagerOwners,
    APPLY_FORM,
    MATRIX_RULES_JSON,
    MATRIX_FORM,
    numericDateRules,
    retainedEditor,
    selectRetained,
    retainedManager,
    retainedProtocolManager,
    managerRaw,
    retainedTitle,
    typeNative,
    mountText,
    activateText,
    textRules,
    capturedFields,
    managerStyleSnapshot,
    expectManagerStyleRestored,
    beforeEachCase,
    afterEachCase,
  };
}

export type ComponentTestFixture = ReturnType<typeof createComponentTestFixture>;
