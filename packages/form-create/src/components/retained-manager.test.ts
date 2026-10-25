// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { defineComponent, h } from "vue";
import { ElMessageBox, ElDialog } from "element-plus";
import { flushPromises, mount } from "@vue/test-utils";
import FcDesigner from "@form-create/designer";
import FormManager from "./FormManager.vue";
import FormDesigner from "./FormDesigner.vue";
import {
  createComponentTestFixture,
  type RetainedVm,
  type ManagerVm,
} from "./__tests__/component-test-fixture.js";
let wrapper: ReturnType<typeof mount> | undefined;
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
const {
  managerOwners,
  beginManagerOwner,
  isolateManagerDesignerStyle,
  beginDesignerOwner,
  finishManagerOwners,
  APPLY_FORM,
  numericDateRules,
  retainedEditor,
  selectRetained,
  retainedManager,
  retainedProtocolManager,
  managerRaw,
  mountText,
  activateText,
  textRules,
  managerStyleSnapshot,
  expectManagerStyleRestored,
} = fixture;
let currentFixtureCase: import("./__tests__/component-test-fixture.js").FixtureCaseKey | undefined;
beforeEach(() => {
  currentFixtureCase = fixture.beforeEachCase();
});
afterEach(() => {
  const ending = currentFixtureCase;
  currentFixtureCase = undefined;
  if (ending !== undefined) fixture.afterEachCase(ending);
});

describe("retained FormManager状态与关闭", () => {
  afterEach(() => vi.restoreAllMocks());
  it("manager_retained_query_and_forward", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    await managerRaw(manager);
    expect(vm.readEditingState()?.mode).toBe("retained");
    expect(vm.readEditingState()?.canSuspend).toBe(true);
    expect(vm.readEditingState()?.canCapture).toBe(false);
    expect(wrapper!.emitted("editingStateChange")?.length).toBeGreaterThan(0);
    expect(vm.commitPendingEdit()).toBe(false);
    expect(vm.hasOpenEditor()).toBe(true);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  });
  it("manager_suspend_is_not_discard，取消确认保留实例和raw", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    const input = await managerRaw(manager);
    manager.owner.spy(() => vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel"));
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-designer-cancel"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("-");
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  });
  it("manager_dismiss_requires_discard，明确放弃后重开不复活raw", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    await managerRaw(manager);
    manager.owner.spy(() => vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm"));
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-designer-cancel"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(false);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    expect((await managerRaw(manager, "2")).element.value).toBe("2");
  });
  it("manager_late_discard_rejected，确认期间新输入使旧肯定答复过期", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    const input = await managerRaw(manager);
    let resolve!: (v: "confirm") => void;
    manager.owner.spy(() =>
      vi.spyOn(ElMessageBox, "confirm").mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-designer-cancel"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    await manager.owner.step(() => input.setValue("1e"));
    resolve("confirm");
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("1e");
  });
  it("manager_ime_escape_keeps_editor，组合中的关闭手势不先blur", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    const input = await managerRaw(manager);
    input.element.focus();
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const confirm = manager.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
    const cancel = wrapper!.get('[data-test="form-designer-cancel"]');
    const pointer = new Event("pointerdown", { bubbles: true, cancelable: true });
    cancel.element.dispatchEvent(pointer);
    expect(pointer.defaultPrevented).toBe(true);
    input.element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await manager.owner.step(() => flushPromises());
    await manager.owner.step(() => cancel.trigger("click"));
    await manager.owner.step(() => flushPromises());
    expect(confirm.value).not.toHaveBeenCalled();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(document.activeElement).toBe(input.element);
  });
  it("manager_old_editor_state_dropped，保存/取消/旧状态不可影响重开", async () => {
    const manager = await retainedManager({ isolateMainStyle: true });
    const { vm, target: wrapper } = manager;
    const old = wrapper!.findComponent(FormDesigner);
    await managerRaw(manager, "7");
    expect(vm.commitPendingEdit()).toBe(true);
    await manager.owner.step(() => flushPromises());
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    const before = vm.readEditingState();
    old.vm.$emit("editingStateChange", {
      mode: "retained",
      revision: 999,
      canCapture: true,
      canSuspend: true,
      blockers: [],
    });
    old.vm.$emit("save", "[]", "{}");
    old.vm.$emit("cancel");
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(vm.readEditingState()).toEqual(before);
    expect(wrapper!.emitted("updateContent")?.length).toBe(1);
  });
});

describe("retained 关闭与旧回调补充边界", () => {
  afterEach(() => vi.restoreAllMocks());
  it.each(["x", "mask", "cancel"])("请求%s并不授权销毁，确认拒绝/异常都保持raw", async (method) => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    const input = await managerRaw(manager);
    manager.owner.spy(() =>
      vi.spyOn(ElMessageBox, "confirm").mockRejectedValue(new Error("确认失败")),
    );
    if (method === "x")
      await manager.owner.step(() =>
        wrapper!.get('[data-test="form-manager-close"]').trigger("click"),
      );
    else if (method === "cancel")
      await manager.owner.step(() =>
        wrapper!.get('[data-test="form-designer-cancel"]').trigger("click"),
      );
    else {
      const modal = document.querySelector<HTMLElement>(".el-overlay-dialog")!;
      modal.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      modal.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("-");
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
    expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1);
  });
  it("manager_old_close_request_cannot_target_reopened_editor，旧closed不发新null", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    await managerRaw(manager, "7");
    let resolve!: (v: "confirm") => void;
    manager.owner.spy(() =>
      vi.spyOn(ElMessageBox, "confirm").mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    const oldDialog = wrapper!.findComponent(ElDialog);
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-designer-cancel"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    expect(vm.commitPendingEdit()).toBe(true);
    await manager.owner.step(() => flushPromises());
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    await managerRaw(manager, "8");
    const before = vm.readEditingState();
    resolve("confirm");
    oldDialog.vm.$emit("closed");
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(vm.readEditingState()).toEqual(before);
    expect(wrapper!.emitted("editingStateChange")?.at(-1)?.[0]).not.toBeNull();
  });
  it("manager_busy_close_gesture_cannot_blur_then_close，正常输入不被拒绝手势吞掉", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    const input = await managerRaw(manager);
    input.element.focus();
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const x = wrapper!.get('[data-test="form-manager-close"]');
    const pointer = new Event("pointerdown", { bubbles: true, cancelable: true });
    x.element.dispatchEvent(pointer);
    expect(pointer.defaultPrevented).toBe(true);
    const ordinary = new MouseEvent("click", { bubbles: true, cancelable: true });
    input.element.dispatchEvent(ordinary);
    expect(ordinary.defaultPrevented).toBe(false);
    const late = new MouseEvent("click", { bubbles: true, cancelable: true });
    x.element.dispatchEvent(late);
    expect(late.defaultPrevented).toBe(true);
    expect(vm.hasOpenEditor()).toBe(true);
  });
  it("retained序列化异常不关闭，修正后成功提交一次", async () => {
    const manager = await retainedProtocolManager();
    const { vm, target: wrapper } = manager;
    await managerRaw(manager, "11");
    const fc = wrapper!.findComponent(FcDesigner);
    const fault = manager.owner.spy(() =>
      vi.spyOn(fc.vm, "getJson").mockImplementationOnce(() => {
        throw new Error("序列化失败");
      }),
    );
    expect(vm.commitPendingEdit()).toBe(false);
    expect(vm.hasOpenEditor()).toBe(true);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
    fault.restore();
    expect(vm.commitPendingEdit()).toBe(true);
    expect(JSON.parse(wrapper!.emitted("updateContent")![0]![1] as string)[0].value).toBe(11);
  });
  it.each([undefined, "legacy"] as const)(
    "legacy_dialog_dismiss_unchanged mode=%s",
    async (editingMode) => {
      const owner = beginManagerOwner();
      const confirm = owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
      const target = owner.mount(() =>
        mount(FormManager, {
          props: { forms: [APPLY_FORM], ...(editingMode ? { editingMode } : {}) },
          attachTo: document.body,
        }),
      );
      wrapper = target;
      await owner.step(() => target.get('[data-test="form-edit-btn-form_apply"]').trigger("click"));
      await owner.step(() => flushPromises());
      const vm = target.vm as unknown as ManagerVm;
      expect(vm.readEditingState()?.blockers[0]?.code).toBe("unsupported-mode");
      await owner.step(() => target.get('[data-test="form-designer-cancel"]').trigger("click"));
      await owner.step(() => flushPromises());
      expect(vm.hasOpenEditor()).toBe(false);
      expect(confirm.value).not.toHaveBeenCalled();
      expect(target.emitted("editingStateChange")).toBeUndefined();
    },
  );
});

describe("retained 多实例与捕获版本", () => {
  afterEach(() => vi.restoreAllMocks());
  it("同ID两个真实FormManager，busy保护不拦另一实例的Enter或输入", async () => {
    const owner = beginManagerOwner();
    isolateManagerDesignerStyle(owner);
    const target = owner.mount(() =>
      mount(
        defineComponent({
          render: () =>
            h("div", [
              h(FormManager, {
                forms: [{ ...APPLY_FORM, rules: numericDateRules }],
                editingMode: "retained",
              }),
              h(FormManager, {
                forms: [{ ...APPLY_FORM, rules: numericDateRules }],
                editingMode: "retained",
              }),
            ]),
        }),
        { attachTo: document.body },
      ),
    );
    wrapper = target;
    const managers = target.findAllComponents(FormManager);
    for (const manager of managers)
      await owner.step(() =>
        manager.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
      );
    await owner.step(flushPromises);
    const first = managers[0]!;
    const designer = first.findComponent(FcDesigner);
    const previous = designer.emitted("active")?.length ?? 0;
    // 选择确认与异步刷新分阶段；观察输入的waitFor不重复发起昂贵的选择/刷新。
    await owner.waitFor(() => {
      if ((designer.emitted("active")?.length ?? 0) === previous)
        designer.vm.triggerActive("amount");
      expect(designer.emitted("active")?.length ?? 0).toBeGreaterThan(previous);
    });
    await owner.step(flushPromises);
    await owner.waitFor(() => {
      expect(first.find('[data-retained-input="number"]').exists()).toBe(true);
    });
    const input = first.get('[data-retained-input="number"]');
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const peer = managers[1]!.get('[data-test="form-manager-close"]');
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    peer.element.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    const ownEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    first.get('[data-test="form-manager-close"]').element.dispatchEvent(ownEnter);
    expect(ownEnter.defaultPrevented).toBe(true);
    expect((managers[1]!.vm as unknown as ManagerVm).hasOpenEditor()).toBe(true);
  });
  it("捕获中同步新输入使候选失效，下一次仍可收集最新值", async () => {
    const { owner, target: wrapper, vm } = await retainedEditor();
    const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
    await owner.step(() => input.setValue("4"));
    await owner.step(() => flushPromises());
    const fc = wrapper!.findComponent(FcDesigner),
      original = fc.vm.getJson;
    const { restore: restoreSpy } = owner.spy(() =>
      vi.spyOn(fc.vm, "getJson").mockImplementationOnce(() => {
        const rules = original();
        input.element.value = "5";
        input.element.dispatchEvent(new Event("input", { bubbles: true }));
        return rules;
      }),
    );
    expect(vm.captureContent()).toMatchObject({
      status: "blocked",
      blockers: [{ code: "version-changed" }],
    });
    restoreSpy();
    await owner.step(() => flushPromises());
    const captured = vm.captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status === "captured") expect(JSON.parse(captured.content.rules)[0].value).toBe(5);
    expect(wrapper!.emitted("save")).toBeUndefined();
  });
});

it("确认期间宿主替换同ID同内容表单，旧肯定答复与保存均拒绝且保留输入", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  const input = await managerRaw(manager, "7");
  let resolve!: (v: "confirm") => void;
  const confirm = manager.owner.spy(() =>
    vi.spyOn(ElMessageBox, "confirm").mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  try {
    await manager.owner.step(() =>
      wrapper!.get('[data-test="form-designer-cancel"]').trigger("click"),
    );
    await manager.owner.step(() => flushPromises());
    await manager.owner.step(() =>
      wrapper!.setProps({ forms: [{ ...APPLY_FORM, rules: numericDateRules }] }),
    );
    resolve("confirm");
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("7");
    expect(vm.readEditingState()?.blockers[0]?.code).toBe("version-changed");
    expect(vm.commitPendingEdit()).toBe(false);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  } finally {
    confirm.restore();
  }
});

it("授权关闭的真实Dialog closed事件完成收尾并转发null", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  await managerRaw(manager, "9");
  const dialog = wrapper!.findComponent(ElDialog);
  expect(vm.commitPendingEdit()).toBe(true);
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("not-ready");
  dialog.vm.$emit("closed");
  await manager.owner.step(() => flushPromises());
  expect(vm.readEditingState()).toBeNull();
  expect(wrapper!.emitted("editingStateChange")?.at(-1)?.[0]).toBeNull();
});

it("同一表单对象被宿主原位改写也不覆盖当前输入", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  const input = await managerRaw(manager, "7");
  const form = wrapper!.props("forms")[0]!;
  form.rules = "[]";
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("version-changed");
  expect(vm.commitPendingEdit()).toBe(false);
  expect(input.element.value).toBe("7");
  expect(wrapper!.emitted("updateContent")).toBeUndefined();
});

it("旧Dialog迟到modelValue回调不能关闭同ID重开的编辑器", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  await managerRaw(manager, "7");
  const oldDialog = wrapper!.findComponent(ElDialog),
    oldEditor = wrapper!.findComponent(FormDesigner);
  expect(vm.commitPendingEdit()).toBe(true);
  // 在Vue重渲染前重开；旧组件此刻仍挂载，确保迟到回调真的进入旧监听器。
  wrapper!
    .get('[data-test="form-edit-btn-form_apply"]')
    .element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(oldEditor.element.isConnected).toBe(true);
  oldEditor.vm.$emit("editingStateChange", {
    mode: "retained",
    revision: 999,
    canCapture: true,
    canSuspend: true,
    blockers: [],
  });
  oldEditor.vm.$emit("save", "[]", "{}");
  oldEditor.vm.$emit("cancel");
  oldDialog.vm.$emit("update:modelValue", false);
  oldDialog.vm.$emit("closed");
  expect(oldEditor.emitted("save")).toHaveLength(1);
  expect(oldDialog.emitted("update:modelValue")).toHaveLength(1);
  await manager.owner.step(() => flushPromises());
  expect(vm.hasOpenEditor()).toBe(true);
  expect(vm.readEditingState()?.revision).not.toBe(999);
  expect(wrapper!.emitted("updateContent")?.length).toBe(1);
});

it("当前Dialog modelValue=false只请求关闭，未经明确放弃不销毁", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  const input = await managerRaw(manager);
  const confirm = manager.owner.spy(() =>
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel"),
  );
  try {
    wrapper!.findComponent(ElDialog).vm.$emit("update:modelValue", false);
    await manager.owner.step(() => flushPromises());
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.isConnected).toBe(true);
    expect(input.element.value).toBe("-");
    expect(confirm.value).toHaveBeenCalledTimes(1);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  } finally {
    confirm.restore();
  }
});

it("同ID新会话尚未挂载时不读取或收集旧子ref", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  await managerRaw(manager, "7");
  expect(vm.commitPendingEdit()).toBe(true);
  wrapper!
    .get('[data-test="form-edit-btn-form_apply"]')
    .element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("not-ready");
  expect(vm.commitPendingEdit()).toBe(false);
  expect(wrapper!.emitted("updateContent")?.length).toBe(1);
  await manager.owner.step(() => flushPromises());
  expect(vm.hasOpenEditor()).toBe(true);
  const content = (
    wrapper!.findComponent(FormDesigner).vm as unknown as RetainedVm
  ).captureContent();
  expect(content.status).toBe("captured");
  if (content.status === "captured") expect(JSON.parse(content.content.rules)[0].value).toBe(0);
});

it("旧页头关闭按钮的迟到click不取得新会话的放弃授权", async () => {
  const manager = await retainedProtocolManager();
  const { vm, target: wrapper } = manager;
  await managerRaw(manager, "7");
  const oldX = wrapper!.get('[data-test="form-manager-close"]').element;
  expect(vm.commitPendingEdit()).toBe(true);
  await manager.owner.step(() => flushPromises());
  await manager.owner.step(() =>
    wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
  );
  await manager.owner.step(() => flushPromises());
  await managerRaw(manager, "8");
  const confirm = manager.owner.spy(() =>
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel"),
  );
  try {
    oldX.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await manager.owner.step(() => flushPromises());
    expect(confirm.value).not.toHaveBeenCalled();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(wrapper!.emitted("updateContent")?.length).toBe(1);
  } finally {
    confirm.restore();
  }
});

describe("P1复审P2：模式冲突后打开与重开", () => {
  it.each(["legacy", "retained"] as const)(
    "%s挂载后改变模式不切换子实现，也不经旧出口提交",
    async (initial) => {
      const owner = beginManagerOwner();
      const wrapper = owner.mount(() =>
        mount(FormManager, {
          props: { forms: [{ ...APPLY_FORM, rules: numericDateRules }], editingMode: initial },
          attachTo: document.body,
        }),
      );
      const vm = wrapper.vm as unknown as ManagerVm;
      await owner.step(() =>
        wrapper.setProps({ editingMode: initial === "legacy" ? "retained" : "legacy" }),
      );
      await owner.step(() =>
        wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
      );
      await owner.step(() => flushPromises());
      expect(wrapper.findComponent(FormDesigner).props("editingMode")).toBe(initial);
      expect(vm.readEditingState()?.blockers[0]?.code).toBe("unsupported-mode");
      expect(vm.commitPendingEdit()).toBe(false);
      wrapper.findComponent(FormDesigner).vm.$emit("save", "[]", "{}");
      await owner.step(() => flushPromises());
      expect(vm.hasOpenEditor()).toBe(true);
      expect(wrapper.emitted("updateContent")).toBeUndefined();
    },
  );
  it.each(["legacy", "retained"] as const)(
    "%s成功关闭后改模式重开，拒绝新模式且旧内容不再提交",
    async (initial) => {
      const owner = beginDesignerOwner({ isolateMainStyle: initial === "legacy" });
      const wrapper = owner.mount(() =>
        mount(FormManager, {
          props: { forms: [{ ...APPLY_FORM, rules: numericDateRules }], editingMode: initial },
          attachTo: document.body,
        }),
      );
      const vm = wrapper.vm as unknown as ManagerVm;
      await owner.step(() =>
        wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
      );
      await owner.step(() => flushPromises());
      expect(vm.commitPendingEdit()).toBe(true);
      await owner.step(() => flushPromises());
      await owner.step(() =>
        wrapper.setProps({ editingMode: initial === "legacy" ? "retained" : "legacy" }),
      );
      await owner.step(() =>
        wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click"),
      );
      await owner.step(() => flushPromises());
      expect(wrapper.findComponent(FormDesigner).props("editingMode")).toBe(initial);
      expect(vm.commitPendingEdit()).toBe(false);
      expect(vm.hasOpenEditor()).toBe(true);
      expect(wrapper.emitted("updateContent")).toHaveLength(1);
    },
  );
});

it("Manager owner回归：结束后旧续体与finally不改写后例的值或spy", async () => {
  const first = await retainedProtocolManager();
  const firstConfirm = first.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  onTestFinished(release);
  const late = (async () => {
    try {
      await first.owner.step(() => gate);
      await managerRaw(first, "11");
      first.owner.spy(() => vi.spyOn(first.target.findComponent(FcDesigner).vm, "getJson"));
    } finally {
      firstConfirm.restore();
      first.owner.close();
    }
  })().catch((error: unknown) => error);
  finishManagerOwners();
  const next = await retainedProtocolManager();
  const designer = next.target.findComponent(FcDesigner);
  const spy = next.owner.spy(() => vi.spyOn(designer.vm, "getJson"));
  const installed = designer.vm.getJson;
  const nextConfirm = next.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const installedConfirm = ElMessageBox.confirm;
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  try {
    release();
    expect(await late).toEqual(new Error("Manager用例已结束，拒绝迟到续体"));
    expect(designer.vm.getRule()[0].value).toBe(0);
    expect(designer.vm.getJson).toBe(installed);
    expect(ElMessageBox.confirm).toBe(installedConfirm);
    expect(next.target.element.isConnected).toBe(true);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
    expect(next.vm.commitPendingEdit()).toBe(true);
    expect(JSON.parse(next.target.emitted("updateContent")![0]![1] as string)[0].value).toBe(0);
  } finally {
    release();
    spy.restore();
    nextConfirm.restore();
  }
});

it("Manager owner回归：登记后由真实afterEach关闭并恢复兼容描述符", () => {
  const original = originalElementString;
  const owner = beginManagerOwner();
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  wrapper = target;
  let cleaned = 0;
  owner.defer(() => {
    cleaned++;
  });
  onTestFinished(() => {
    expect(() => owner.assertActive()).toThrow("Manager用例已结束");
    expect(target.element.isConnected).toBe(false);
    expect(cleaned).toBe(1);
    expect(wrapper).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it.each([false, true])("Manager owner回归：体异常=%s仍关闭真实root且只恢复自有spy一次", (fail) => {
  const owner = beginManagerOwner();
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  const original = ElMessageBox.confirm;
  owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const failure = new Error("受控测试体异常");
  let caught: unknown;
  try {
    if (fail) throw failure;
  } catch (error) {
    caught = error;
  } finally {
    finishManagerOwners();
  }
  expect(caught).toBe(fail ? failure : undefined);
  expect(target.element.isConnected).toBe(false);
  expect(ElMessageBox.confirm).toBe(original);
  const next = beginManagerOwner();
  const installed = next.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  owner.close();
  expect(ElMessageBox.confirm).toBe(installed.value);
});

it("Manager owner回归：失效后拒绝迟到mount、spy、输入和清理登记", async () => {
  const owner = beginManagerOwner();
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  const input = target.get<HTMLInputElement>('[data-test="form-manager-new-name"]');
  finishManagerOwners();
  let mounts = 0;
  let spies = 0;
  expect(() =>
    owner.mount(() => {
      mounts++;
      return target;
    }),
  ).toThrow("Manager用例已结束");
  expect(() =>
    owner.spy(() => {
      spies++;
      return vi.spyOn(ElMessageBox, "confirm");
    }),
  ).toThrow("Manager用例已结束");
  expect(() => owner.defer(() => {})).toThrow("Manager用例已结束");
  await expect(owner.step(() => input.setValue("迟到"))).rejects.toThrow("Manager用例已结束");
  expect(mounts).toBe(0);
  expect(spies).toBe(0);
  expect(input.element.value).toBe("");
});

it("Manager owner回归：等待中的旧轮询恢复后不执行迟到动作", async () => {
  const owner = beginManagerOwner();
  let checks = 0;
  const pending = owner
    .waitFor(() => {
      checks++;
      owner.invalidate();
      throw new Error("受控未就绪");
    })
    .catch((error: unknown) => error);
  const error = await pending;
  expect(error).toEqual(new Error("Manager用例已结束，拒绝迟到续体"));
  expect(checks).toBe(1);
});

it("Manager owner回归：活动真实组件意外断开必须失败", () => {
  const owner = beginManagerOwner();
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  target.element.remove();
  expect(() => owner.assertActive()).toThrow("活动Manager用例的真实组件已断开");
});

it("Manager owner回归：全部先失效并逆序清理，卸载后抛错仍关闭其余root", () => {
  const first = beginManagerOwner();
  const a = first.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  const second = beginManagerOwner();
  const b = second.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  const order: string[] = [];
  first.defer(() => {
    order.push("first");
  });
  const failure = new Error("受控卸载后异常");
  const unmount = b.unmount.bind(b);
  b.unmount = () => {
    unmount();
    throw failure;
  };
  second.defer(() => {
    expect(() => first.assertActive()).toThrow("Manager用例已结束");
    order.push("second");
  });
  expect(() => finishManagerOwners()).toThrow(failure);
  expect(order).toEqual(["second", "first"]);
  expect(a.element.isConnected).toBe(false);
  expect(b.element.isConnected).toBe(false);
  expect(() => first.assertActive()).toThrow("Manager用例已结束");
  expect(() => second.assertActive()).toThrow("Manager用例已结束");
  second.close();
  first.close();
  expect(order).toEqual(["second", "first"]);
});

it("Manager style回归：同一节点文本属性及顺序原样恢复，重复close幂等", () => {
  const before = managerStyleSnapshot();
  const owner = beginManagerOwner();
  const scope = isolateManagerDesignerStyle(owner);
  expect(before.style.isConnected).toBe(false);
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  finishManagerOwners();
  expect(target.element.isConnected).toBe(false);
  expectManagerStyleRestored(before);
  scope.restore();
  owner.close();
  expectManagerStyleRestored(before);
});

it("Manager style回归：体异常后真实root和样式均清理", () => {
  const before = managerStyleSnapshot();
  const owner = beginManagerOwner();
  isolateManagerDesignerStyle(owner);
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  const failure = new Error("受控样式用例体异常");
  let caught: unknown;
  try {
    expect(before.style.isConnected).toBe(false);
    throw failure;
  } catch (error) {
    caught = error;
  } finally {
    finishManagerOwners();
  }
  expect(caught).toBe(failure);
  expect(target.element.isConnected).toBe(false);
  expectManagerStyleRestored(before);
});

it("Manager style回归：卸载真实root后抛错仍恢复样式", () => {
  const before = managerStyleSnapshot();
  const owner = beginManagerOwner();
  isolateManagerDesignerStyle(owner);
  expect(before.style.isConnected).toBe(false);
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  const unmount = target.unmount.bind(target);
  const failure = new Error("受控真实root卸载后异常");
  target.unmount = () => {
    unmount();
    throw failure;
  };
  expect(() => finishManagerOwners()).toThrow(failure);
  expect(target.element.isConnected).toBe(false);
  expectManagerStyleRestored(before);
});

it("Manager style回归：真实afterEach关闭已登记scope并恢复兼容环境", () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const settings = (
    window as unknown as { happyDOM: { settings: { disableComputedStyleRendering: boolean } } }
  ).happyDOM.settings;
  const originalCss = settings.disableComputedStyleRendering;
  const owner = beginManagerOwner();
  isolateManagerDesignerStyle(owner);
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  onTestFinished(() => {
    expect(() => owner.assertActive()).toThrow("Manager用例已结束");
    expect(target.element.isConnected).toBe(false);
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
    expect(settings.disableComputedStyleRendering).toBe(originalCss);
  });
  expect(before.style.isConnected).toBe(false);
});

it("Manager style回归：A结束后旧续体及finally不恢复B临时移离的样式", async () => {
  const before = managerStyleSnapshot();
  const first = beginManagerOwner();
  const oldScope = isolateManagerDesignerStyle(first);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  onTestFinished(release);
  const late = (async () => {
    try {
      await first.step(() => gate);
      isolateManagerDesignerStyle(first);
    } finally {
      oldScope.restore();
      first.close();
    }
  })().catch((error: unknown) => error);
  finishManagerOwners();
  expectManagerStyleRestored(before);
  const next = beginManagerOwner();
  isolateManagerDesignerStyle(next);
  const target = next.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  try {
    expect(before.style.isConnected).toBe(false);
    const input = target.get<HTMLInputElement>('[data-test="form-manager-new-name"]');
    await next.step(() => input.setValue("后例输入"));
    release();
    expect(await late).toEqual(new Error("Manager用例已结束，拒绝迟到续体"));
    expect(before.style.isConnected).toBe(false);
    expect(input.element.value).toBe("后例输入");
    expect(target.element.isConnected).toBe(true);
  } finally {
    release();
  }
  finishManagerOwners();
  expectManagerStyleRestored(before);
});

it.each(["missing", "duplicate"] as const)(
  "Manager style回归：%s识别失败不改变现有样式",
  (kind) => {
    const before = managerStyleSnapshot();
    const owner = beginManagerOwner();
    if (kind === "missing") {
      owner.defer(() => {
        before.parent.insertBefore(before.style, before.next);
      });
      before.style.remove();
    } else {
      const copy = before.style.cloneNode(true);
      owner.defer(() => {
        copy.parentNode?.removeChild(copy);
      });
      document.head.appendChild(copy);
    }
    const order = Array.from(document.head.childNodes);
    expect(() => isolateManagerDesignerStyle(owner)).toThrow("未找到唯一的设计器主样式表");
    expect(Array.from(document.head.childNodes)).toEqual(order);
    finishManagerOwners();
    expectManagerStyleRestored(before);
  },
);

it("Manager style回归：移离动作完成后异常也有已登记恢复", () => {
  const before = managerStyleSnapshot();
  const owner = beginManagerOwner();
  const remove = before.style.remove.bind(before.style);
  const failure = new Error("受控移离后异常");
  owner.spy(() =>
    vi.spyOn(before.style, "remove").mockImplementation(() => {
      remove();
      throw failure;
    }),
  );
  expect(() => isolateManagerDesignerStyle(owner)).toThrow(failure);
  expect(before.style.isConnected).toBe(false);
  finishManagerOwners();
  expectManagerStyleRestored(before);
});

it("文字style回归：真实afterEach先卸载目标再恢复样式和兼容环境", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const owner = beginManagerOwner();
  isolateManagerDesignerStyle(owner);
  const mounted: { target?: ReturnType<typeof mount> } = {};
  let checked = false;
  owner.defer(() => {
    expect(mounted.target?.element.isConnected).toBe(false);
    expect(before.style.isConnected).toBe(false);
    checked = true;
  });
  const { target } = mountText(textRules("textarea", true), "retained", owner);
  mounted.target = target;
  await owner.step(() => activateText(target, "text", owner));
  onTestFinished(() => {
    expect(checked).toBe(true);
    expect(() => owner.assertActive()).toThrow("Manager用例已结束");
    expect(target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it("文字style回归：已关闭owner拒绝挂载且不覆盖后例wrapper", () => {
  const before = managerStyleSnapshot();
  const current = beginManagerOwner();
  isolateManagerDesignerStyle(current);
  const target = current.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  wrapper = target;
  const ended = beginManagerOwner();
  ended.close();
  expect(() => mountText(textRules("text", false), "retained", ended)).toThrow("Manager用例已结束");
  expect(wrapper).toBe(target);
  expect(target.element.isConnected).toBe(true);
  expect(before.style.isConnected).toBe(false);
});

it.each(["body", "unmount"] as const)(
  "文字style回归：%s异常仍卸载真实目标并恢复样式",
  async (kind) => {
    const before = managerStyleSnapshot();
    const owner = beginManagerOwner();
    isolateManagerDesignerStyle(owner);
    let restoreUnmount = () => {};
    owner.defer(() => restoreUnmount());
    const { target } = mountText(textRules("text", false), "retained", owner);
    await owner.step(() => activateText(target, "text", owner));
    const failure = new Error(`受控文字${kind}异常`);
    if (kind === "unmount") {
      const unmount = target.unmount.bind(target);
      target.unmount = () => {
        unmount();
        throw failure;
      };
      restoreUnmount = () => {
        target.unmount = unmount;
      };
    }
    expect(() => {
      try {
        if (kind === "body") throw failure;
      } finally {
        finishManagerOwners();
      }
    }).toThrow(failure);
    expect(target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    owner.close();
    expectManagerStyleRestored(before);
  },
);

it("文字style回归：目标仍连接也不能用已关闭owner激活", async () => {
  const current = beginManagerOwner();
  isolateManagerDesignerStyle(current);
  const { target } = mountText(textRules("text", false), "retained", current);
  const ended = beginManagerOwner();
  ended.close();
  await current.step(() =>
    expect(activateText(target, "text", ended)).rejects.toThrow("Manager用例已结束"),
  );
  expect(target.element.isConnected).toBe(true);
  expect(target.find('[data-retained-input="text-toggle"]').exists()).toBe(false);
  await current.step(() => activateText(target, "text", current));
});

it("文字style回归：选中等待结束后旧续体与finally不改B的样式输入和spy", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  // 用例自身也登记owner；超时清理先失效所有owner，再放行被控制的旧续体。
  const testOwner = beginManagerOwner();
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  testOwner.defer(() => {
    entered();
    release();
  });
  const first = beginManagerOwner();
  const oldScope = isolateManagerDesignerStyle(first);
  const { target: oldTarget } = mountText(textRules("textarea", true), "retained", first);
  await first.step(() => activateText(oldTarget, "text", first));
  const originalWaitFor = vi.waitFor;
  const realWaitFor = originalWaitFor.bind(vi);
  const oldWait = first.spy(() => vi.spyOn(vi, "waitFor"));
  oldWait.value.mockImplementationOnce(async (callback, options) => {
    const result = await realWaitFor(callback, options);
    first.assertActive();
    entered();
    await gate;
    return result;
  });
  const late = (async () => {
    try {
      await activateText(oldTarget, "unset", first);
    } finally {
      oldWait.restore();
      oldScope.restore();
      first.close();
    }
  })().catch((error: unknown) => error);
  await testOwner.step(() => ready);
  first.close();
  expect(oldTarget.element.isConnected).toBe(false);
  expectManagerStyleRestored(before);
  const next = beginManagerOwner();
  isolateManagerDesignerStyle(next);
  const { target } = mountText(textRules("text", false), "retained", next);
  await next.step(() => activateText(target, "text", next));
  const input = target.get<HTMLInputElement>('[data-retained-input="text"]');
  await next.step(() => input.setValue("后例文字"));
  const nextWait = next.spy(() => vi.spyOn(vi, "waitFor"));
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  release();
  expect(await testOwner.step(() => late)).toEqual(new Error("Manager用例已结束，拒绝迟到续体"));
  expect(before.style.isConnected).toBe(false);
  expect(input.element.value).toBe("后例文字");
  expect(target.element.isConnected).toBe(true);
  expect(wrapper).toBe(target);
  expect(vi.waitFor).toBe(nextWait.value);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  onTestFinished(() => {
    expect(target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expect(vi.waitFor).toBe(originalWaitFor);
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it("文字style回归：装载前序列化异常不覆盖现有目标且仍恢复样式", () => {
  const before = managerStyleSnapshot();
  const owner = beginManagerOwner();
  isolateManagerDesignerStyle(owner);
  const target = owner.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  wrapper = target;
  const failure = new Error("受控装载前序列化异常");
  expect(() =>
    mountText(
      [
        {
          toJSON() {
            throw failure;
          },
        },
      ],
      "retained",
      owner,
    ),
  ).toThrow(failure);
  expect(wrapper).toBe(target);
  expect(target.element.isConnected).toBe(true);
  owner.close();
  expect(target.element.isConnected).toBe(false);
  expect(wrapper).toBeUndefined();
  expectManagerStyleRestored(before);
});

it("Manager旧状态style回归：显式选项在挂载前移离主样式且先卸载再恢复", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const testOwner = beginManagerOwner();
  const manager = await testOwner.step(() => retainedManager({ isolateMainStyle: true }));
  expect(before.style.isConnected).toBe(false);
  await manager.owner.step(() => managerRaw(manager, "7"));
  let cssAtUnmount: boolean | undefined;
  const unmount = manager.target.unmount.bind(manager.target);
  manager.target.unmount = () => {
    cssAtUnmount = before.style.isConnected;
    try {
      unmount();
    } finally {
      manager.target.unmount = unmount;
    }
  };
  onTestFinished(() => {
    expect(cssAtUnmount).toBe(false);
    expect(manager.target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it("Manager旧状态style回归：未传选项保持主CSS在场并正常清理", async () => {
  const before = managerStyleSnapshot();
  const testOwner = beginManagerOwner();
  const manager = await testOwner.step(() => retainedManager());
  await manager.owner.step(() => managerRaw(manager, "7"));
  expect(before.style.parentNode).toBe(before.parent);
  expect(before.style.nextSibling).toBe(before.next);
  expect(before.style.textContent).toBe(before.text);
  manager.owner.close();
  expect(manager.target.element.isConnected).toBe(false);
  expect(wrapper).toBeUndefined();
  expectManagerStyleRestored(before);
});

it.each(["body", "unmount"] as const)(
  "Manager旧状态style回归：%s异常仍关闭真实编辑器并恢复样式",
  async (kind) => {
    const before = managerStyleSnapshot();
    const testOwner = beginManagerOwner();
    const manager = await testOwner.step(() => retainedManager({ isolateMainStyle: true }));
    await manager.owner.step(() => managerRaw(manager, "7"));
    const failure = new Error(`受控Manager旧状态${kind}异常`);
    if (kind === "unmount") {
      const unmount = manager.target.unmount.bind(manager.target);
      manager.target.unmount = () => {
        try {
          unmount();
        } finally {
          manager.target.unmount = unmount;
        }
        throw failure;
      };
    }
    expect(() => {
      try {
        if (kind === "body") throw failure;
      } finally {
        manager.owner.close();
      }
    }).toThrow(failure);
    expect(manager.target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    manager.owner.close();
    expectManagerStyleRestored(before);
  },
  15_000,
);

it("Manager旧状态style回归：结束后旧续体和finally不改B的样式输入或spy", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const testOwner = beginManagerOwner();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  testOwner.defer(release);
  const first = await testOwner.step(() => retainedManager({ isolateMainStyle: true }));
  await first.owner.step(() => managerRaw(first, "7"));
  const firstConfirm = first.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const late = (async () => {
    try {
      await first.owner.step(() => gate);
      await managerRaw(first, "999");
    } finally {
      firstConfirm.restore();
      first.owner.close();
    }
  })().catch((error: unknown) => error);
  first.owner.close();
  expectManagerStyleRestored(before);
  const next = await testOwner.step(() => retainedManager({ isolateMainStyle: true }));
  const input = await next.owner.step(() => managerRaw(next, "23"));
  const nextConfirm = next.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  release();
  expect(await testOwner.step(() => late)).toEqual(new Error("Manager用例已结束，拒绝迟到续体"));
  expect(input.element.value).toBe("23");
  expect(next.target.element.isConnected).toBe(true);
  expect(wrapper).toBe(next.target);
  expect(before.style.isConnected).toBe(false);
  expect(ElMessageBox.confirm).toBe(nextConfirm.value);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  onTestFinished(() => {
    expect(next.target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
}, 15_000);

it("Manager协议夹具回归：挂载前移离并由原owner先卸载后恢复", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const testOwner = beginManagerOwner();
  const append = document.body.appendChild.bind(document.body);
  const stylesAtAppend: boolean[] = [];
  testOwner.spy(() =>
    vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
      stylesAtAppend.push(before.style.isConnected);
      return append(node);
    }),
  );
  const manager = await testOwner.step(() => retainedProtocolManager());
  expect(stylesAtAppend.length).toBeGreaterThan(0);
  expect(stylesAtAppend).not.toContain(true);
  expect(managerOwners).toContain(manager.owner);
  expect(before.style.isConnected).toBe(false);
  const designer = manager.target.findComponent(FcDesigner);
  expect(manager.target.props("forms")[0]!.rules).toBe(numericDateRules);
  expect(designer.vm.getRule().map((rule: { field: string }) => rule.field)).toEqual([
    "amount",
    "date",
  ]);
  await manager.owner.step(() => managerRaw(manager, "7"));
  let cssAtUnmount: boolean | undefined;
  const unmount = manager.target.unmount.bind(manager.target);
  manager.target.unmount = () => {
    cssAtUnmount = before.style.isConnected;
    try {
      unmount();
    } finally {
      manager.target.unmount = unmount;
    }
  };
  onTestFinished(() => {
    expect(cssAtUnmount).toBe(false);
    expect(manager.target.element.isConnected).toBe(false);
    expect(() => manager.owner.assertActive()).toThrow("Manager用例已结束");
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it.each(["body", "unmount"] as const)(
  "Manager协议夹具回归：%s异常仍关闭真实组件并恢复自有样式和spy",
  async (kind) => {
    const before = managerStyleSnapshot();
    const original = ElMessageBox.confirm;
    const testOwner = beginManagerOwner();
    const manager = await testOwner.step(() => retainedProtocolManager());
    await manager.owner.step(() => managerRaw(manager, "7"));
    manager.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
    const failure = new Error(`受控协议夹具${kind}异常`);
    if (kind === "unmount") {
      const unmount = manager.target.unmount.bind(manager.target);
      manager.target.unmount = () => {
        try {
          unmount();
        } finally {
          manager.target.unmount = unmount;
        }
        throw failure;
      };
    }
    expect(() => {
      try {
        if (kind === "body") throw failure;
      } finally {
        manager.owner.close();
      }
    }).toThrow(failure);
    expect(manager.target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expect(ElMessageBox.confirm).toBe(original);
    expectManagerStyleRestored(before);
    manager.owner.close();
    expectManagerStyleRestored(before);
  },
);

it("Manager协议夹具回归：旧续体及finally不触碰后例输入样式或spy", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const testOwner = beginManagerOwner();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  testOwner.defer(release);
  const first = await testOwner.step(() => retainedProtocolManager());
  await first.owner.step(() => managerRaw(first, "7"));
  const firstConfirm = first.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const late = (async () => {
    try {
      await first.owner.step(() => gate);
      await managerRaw(first, "999");
    } finally {
      firstConfirm.restore();
      first.owner.close();
    }
  })().catch((error: unknown) => error);
  first.owner.close();
  expectManagerStyleRestored(before);
  const next = await testOwner.step(() => retainedProtocolManager());
  const input = await next.owner.step(() => managerRaw(next, "23"));
  const nextConfirm = next.owner.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  release();
  expect(await testOwner.step(() => late)).toEqual(new Error("Manager用例已结束，拒绝迟到续体"));
  expect(input.element.value).toBe("23");
  expect(next.target.element.isConnected).toBe(true);
  expect(wrapper).toBe(next.target);
  expect(before.style.isConnected).toBe(false);
  expect(ElMessageBox.confirm).toBe(nextConfirm.value);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  onTestFinished(() => {
    expect(next.target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it.each([
  ["initial-flush", "resolve"],
  ["initial-flush", "reject"],
  ["field-switch", "resolve"],
  ["field-switch", "reject"],
  ["after-delete", "resolve"],
  ["after-delete", "reject"],
] as const)("共享设计器生命周期回归：%s/%s结束后不查询后例或点击旧菜单", async (phase, outcome) => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const testOwner = beginManagerOwner();
  let enter!: () => void;
  let release!: () => void;
  let reject!: (error: Error) => void;
  const ready = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve, fail) => {
    release = resolve;
    reject = fail;
  });
  // 登记发生在第一个await之前；afterEach先失效全部owner，再释放受控等待。
  testOwner.defer(() => {
    enter();
    release();
  });
  const first = beginManagerOwner();
  const oldStyle = isolateManagerDesignerStyle(first);
  const oldConfirm = first.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  let fixture: Awaited<ReturnType<typeof retainedEditor>> | undefined;
  if (phase !== "initial-flush")
    fixture = await testOwner.step(() => retainedEditor(numericDateRules, { owner: first }));
  if (phase === "after-delete") {
    await testOwner.step(() => selectRetained(fixture!, "amount"));
    await first.step(() =>
      fixture!.target.findComponent(FcDesigner).get("._fc-m-drag .icon-delete").trigger("click"),
    );
  }
  const realStep = first.step.bind(first);
  function pause<T>(action: () => T | Promise<T>): Promise<T> {
    return realStep(async () => {
      const value = await action();
      enter();
      await gate;
      return value;
    });
  }
  first.spy(() => vi.spyOn(first, "step").mockImplementationOnce(pause));
  let lateMenuAttempts = 0;
  const fault = new Error("受控旧等待拒绝");
  const late = (async () => {
    try {
      if (phase === "initial-flush")
        fixture = await retainedEditor(numericDateRules, { owner: first });
      else if (phase === "field-switch") await selectRetained(fixture!, "amount");
      else await first.step(flushPromises);
      await first.step(() => {
        lateMenuAttempts++;
        return fixture!.target
          .findComponent(FcDesigner)
          .findAll("._fc-l-item")
          .find((item) => item.text() === "计数器")!
          .trigger("click");
      });
    } finally {
      oldConfirm.restore();
      oldStyle.restore();
      first.close();
    }
  })().catch((error: unknown) => {
    enter();
    return error;
  });
  const oldRoot = wrapper!;
  await testOwner.step(() => ready);
  first.close();
  expect(oldRoot.element.isConnected).toBe(false);
  expectManagerStyleRestored(before);
  const next = beginManagerOwner();
  isolateManagerDesignerStyle(next);
  const target = next.mount(() =>
    mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
  );
  wrapper = target;
  const input = target.get<HTMLInputElement>('[data-test="form-manager-new-name"]');
  await next.step(() => input.setValue("后例输入"));
  const nextConfirm = next.spy(() => vi.spyOn(ElMessageBox, "confirm"));
  const query = next.spy(() => vi.spyOn(target, "find"));
  const get = next.spy(() => vi.spyOn(target, "get"));
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  if (outcome === "reject") reject(fault);
  else release();
  expect(await testOwner.step(() => late)).toEqual(
    outcome === "reject" ? fault : new Error("Manager用例已结束，拒绝迟到续体"),
  );
  expect(lateMenuAttempts).toBe(0);
  expect(query.value).not.toHaveBeenCalled();
  expect(get.value).not.toHaveBeenCalled();
  expect(input.element.value).toBe("后例输入");
  expect(target.element.isConnected).toBe(true);
  expect(wrapper).toBe(target);
  expect(before.style.isConnected).toBe(false);
  expect(ElMessageBox.confirm).toBe(nextConfirm.value);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(descriptor);
  onTestFinished(() => {
    expect(target.element.isConnected).toBe(false);
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it("共享设计器生命周期回归：真实afterEach关闭根与原owner，恢复样式和描述符", async () => {
  const before = managerStyleSnapshot();
  const original = originalElementString;
  const owner = beginManagerOwner();
  isolateManagerDesignerStyle(owner);
  const fixture = await retainedEditor(numericDateRules, { owner });
  expect(managerOwners).toContain(owner);
  expect(
    fixture.target
      .findComponent(FcDesigner)
      .vm.getRule()
      .map((rule: { field: string }) => rule.field),
  ).toEqual(["amount", "date"]);
  onTestFinished(() => {
    expect(fixture.target.element.isConnected).toBe(false);
    expect(() => owner.assertActive()).toThrow("Manager用例已结束");
    expect(wrapper).toBeUndefined();
    expectManagerStyleRestored(before);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(original);
  });
});

it.each([undefined, false, true] as const)(
  "共享协议选项回归：isolateMainStyle=%s在挂载前生效并恢复原节点",
  async (option) => {
    const before = managerStyleSnapshot();
    const testOwner = beginManagerOwner();
    const append = document.body.appendChild.bind(document.body);
    const cssAtAppend: boolean[] = [];
    testOwner.spy(() =>
      vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
        cssAtAppend.push(before.style.isConnected);
        return append(node);
      }),
    );
    const owner = beginDesignerOwner({
      ...(option === undefined ? {} : { isolateMainStyle: option }),
    });
    const target = owner.mount(() =>
      mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body }),
    );
    wrapper = target;
    expect(cssAtAppend.length).toBeGreaterThan(0);
    expect(cssAtAppend.every((connected) => connected === (option !== true))).toBe(true);
    const input = target.get<HTMLInputElement>('[data-test="form-manager-new-name"]');
    await owner.step(() => input.setValue("真实输入"));
    expect(input.element.value).toBe("真实输入");
    owner.close();
    expect(target.element.isConnected).toBe(false);
    expectManagerStyleRestored(before);
    owner.close();
    expectManagerStyleRestored(before);
  },
);
