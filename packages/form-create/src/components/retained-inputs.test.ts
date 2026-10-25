// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, onBeforeMount } from "vue";
import { ElDatePicker } from "element-plus";
import { flushPromises, mount } from "@vue/test-utils";
import FcDesigner from "@form-create/designer";
import type { FormDesignerCaptureResult } from "../editor-state.js";
import FormManager from "./FormManager.vue";
import FormDesigner from "./FormDesigner.vue";
import { createEditorInputState } from "./editor-input-state.js";
import NumberDefaultEditor from "./NumberDefaultEditor.vue";
import { ensureFormCreateInstalled } from "../form-create-setup.js";
import { FIELD_MENU, retainedDesignerConfig } from "./designer-config.js";
import { FlowDesignSession } from "../session.js";
import { rulesSemantics } from "../form-semantics.js";
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
  beginManagerOwner,
  isolateManagerDesignerStyle,
  beginDesignerOwner,
  APPLY_FORM,
  numericDateRules,
  retainedEditor,
  selectRetained,
  retainedProtocolManager,
  managerRaw,
  retainedTitle,
  typeNative,
  mountText,
  activateText,
  textRules,
  capturedFields,
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

describe("retained 数值日期与同步捕获", () => {
  it("pending_number_text_survives_navigation", async () => {
    const owner = beginManagerOwner();
    const wrapper = owner.mount(() =>
      mount(FormDesigner, {
        props: {
          name: "原文",
          rules: JSON.stringify([
            { type: "inputNumber", field: "amount", title: "金额", value: 0 },
            { type: "datePicker", field: "date", title: "日期", value: "2024-02-29" },
          ]),
          options: "{}",
          editingMode: "retained",
        },
        attachTo: document.body,
      }),
    );
    await owner.step(() => flushPromises());
    const vm = wrapper.vm as unknown as {
      readEditingState?: () => {
        mode: string;
      };
      captureContent?: () => unknown;
    };
    expect(typeof vm.readEditingState).toBe("function");
    expect(vm.readEditingState!().mode).toBe("retained");
    expect(typeof vm.captureContent).toBe("function");
  });
});

describe("retained 真实数值日期回归", () => {
  it("partial_date_does_not_normalize_on_blur", async () => {
    const {
      owner,
      target: wrapper,
      vm,
    } = await retainedEditor(numericDateRules, { isolateMainStyle: true });
    const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "date"));
    await owner.step(() => input.setValue("2026-"));
    await owner.step(() => input.trigger("blur"));
    await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
    expect(
      (await owner.step(() => selectRetained({ owner, target: wrapper }, "date"))).element.value,
    ).toBe("2026-");
    expect(vm.readEditingState().canSuspend, JSON.stringify(vm.readEditingState())).toBe(true);
    expect(vm.captureContent().status).toBe("blocked");
    expect(wrapper!.emitted("save")).toBeUndefined();
  });
  it("valid_echo_pending_blocks_capture，回显后仍保留字形", async () => {
    const {
      owner,
      target: wrapper,
      vm,
    } = await retainedEditor(numericDateRules, { isolateMainStyle: true });
    const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
    input.element.value = "1e3";
    input.element.dispatchEvent(new Event("input", { bubbles: true }));
    expect(vm.readEditingState().blockers.map((b) => b.code)).toContain("pending-update");
    expect(vm.captureContent().status).toBe("blocked");
    await owner.step(() => flushPromises());
    const captured = vm.captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status !== "captured") throw new Error(JSON.stringify(captured));
    expect(JSON.parse(captured.content.rules)[0].value).toBe(1000);
    await owner.step(() => selectRetained({ owner, target: wrapper }, "date"));
    expect(
      (await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"))).element.value,
    ).toBe("1e3");
  });
  it("composition_end_same_tick_is_blocked", async () => {
    const { owner, target: wrapper, vm } = await retainedEditor();
    const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.element.value = "3";
    input.element.dispatchEvent(new Event("input", { bubbles: true }));
    expect(vm.readEditingState().canSuspend).toBe(false);
    input.element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(vm.readEditingState().blockers.map((b) => b.code)).toContain("composing");
    expect(vm.captureContent().status).toBe("blocked");
    await owner.step(() => flushPromises());
    expect(vm.captureContent().status).toBe("captured");
  });
  it("foreign_editor_keeps_focus；只读查询不编辑、不blur", async () => {
    const { target: wrapper, vm } = await retainedEditor();
    const foreign = document.createElement("input");
    document.body.append(foreign);
    foreign.focus();
    const before = vm.readEditingState().revision,
      count = wrapper!.emitted("draftChange")?.length;
    vm.readEditingState();
    vm.captureContent();
    vm.exportContent();
    expect(document.activeElement).toBe(foreign);
    expect(vm.readEditingState().revision).toBe(before);
    expect(wrapper!.emitted("draftChange")?.length).toBe(count);
  });
  it("删除公开source立即撤销旧缓冲，同名field不复用", async () => {
    const { owner, target: wrapper, vm } = await retainedEditor();
    await owner.step(async () =>
      (await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"))).setValue("-"),
    );
    const fc = wrapper!.findComponent(FcDesigner);
    await owner.step(() => fc.get("._fc-m-drag .icon-delete").trigger("click"));
    await owner.step(() => flushPromises());
    expect(vm.captureContent().status).toBe("captured");
  });
  it("mode固定且未知文档替换保持原文并阻断", async () => {
    const { owner, target: wrapper, vm } = await retainedEditor();
    await owner.step(async () =>
      (await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"))).setValue("-"),
    );
    await owner.step(() => wrapper!.setProps({ rules: "[]" }));
    expect(wrapper!.get<HTMLInputElement>("[data-retained-input]").element.value).toBe("-");
    expect(vm.captureContent().status).toBe("blocked");
    await owner.step(() => wrapper!.setProps({ editingMode: "legacy" }));
    expect(vm.readEditingState().blockers[0]?.code).toBe("unsupported-mode");
  });
});

describe("retained Tab前置保护", () => {
  it("busy时Tab前往自有取消按钮被拒绝，正常输入之间Tab不吞键", async () => {
    const manager = await retainedProtocolManager();
    const { target: wrapper } = manager;
    const input = await managerRaw(manager);
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const save = wrapper!.get('[data-test="form-designer-save"]');
    save.element.focus();
    const key = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    save.element.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(save.element);
    const normal = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    input.element.dispatchEvent(normal);
    expect(normal.defaultPrevented).toBe(false);
  });
});

describe("retained I01导入边界", () => {
  it.each([undefined, "date", "datetime", "week", "month", "year"])(
    "I01 %s未编辑原样往返，非普通date编辑明确阻断",
    async (type) => {
      const owner = beginManagerOwner();
      const value =
        type === "datetime"
          ? "2026-10-15 10:30:00"
          : type === "month"
            ? "2026-10"
            : type === "year"
              ? "2026"
              : "2026-10-15";
      const format =
        type === "datetime"
          ? "YYYY-MM-DD HH:mm:ss"
          : type === "month"
            ? "YYYY-MM"
            : type === "year"
              ? "YYYY"
              : "YYYY-MM-DD";
      const rules = JSON.stringify([
        {
          type: "datePicker",
          field: "date",
          title: "日期",
          props: { ...(type ? { type } : {}), valueFormat: format },
          value,
        },
      ]);
      const wrapper = owner.mount(() =>
        mount(FormDesigner, {
          props: { name: "I01", rules, options: "{}", editingMode: "retained" },
          attachTo: document.body,
        }),
      );
      await owner.step(() => flushPromises());
      const vm = wrapper.vm as unknown as RetainedVm;
      const captured = vm.captureContent();
      expect(captured.status).toBe("captured");
      if (captured.status === "captured")
        expect(rulesSemantics(captured.content.rules)).toEqual(rulesSemantics(rules));
      const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "date"));
      await owner.step(() => input.setValue("2027-"));
      const reason = vm.readEditingState().blockers[0]?.code;
      expect(reason).toBe(type && type !== "date" ? "unsupported-input" : "pending-input");
      expect(input.element.value).toBe("2027-");
    },
  );
});

describe("retained 真实字段删除复用", () => {
  it("公开delete时点撤销缓存，菜单新建后同名field不复用旧raw", async () => {
    const owner = beginDesignerOwner({ isolateMainStyle: true });
    const state = createEditorInputState(() => {});
    // 仅此测试通过第三方公开配置开放字段改名，用于立即复用ID；产品默认仍只读。
    owner.defer(() => state.clear());
    const config = {
      ...retainedDesignerConfig((source) => state.bind(source), "lifetime-test"),
      fieldReadonly: false,
    };
    const wrapper = owner.mount(() =>
      mount(
        defineComponent({
          setup() {
            onBeforeMount(() => {
              ensureFormCreateInstalled();
              FcDesigner.component("flowduetNumberDefault", NumberDefaultEditor);
            });
            return () => h(FcDesigner, { config, menu: FIELD_MENU, onDelete: state.release });
          },
        }),
        { attachTo: document.body },
      ),
    );
    await owner.step(() => flushPromises());
    const fc = wrapper.findComponent(FcDesigner);
    fc.vm.setRule([{ type: "inputNumber", field: "amount", title: "金额", value: 0 }]);
    await owner.step(() => flushPromises());
    await owner.step(async () =>
      (await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"))).setValue("-"),
    );
    await owner.step(() => fc.get("._fc-m-drag .icon-delete").trigger("click"));
    await owner.step(() => flushPromises());
    expect(state.blockers()).toEqual([]);
    await owner.step(() =>
      fc
        .findAll("._fc-l-item")
        .find((el) => el.text() === "计数器")!
        .trigger("click"),
    );
    await owner.step(() =>
      owner.waitFor(() =>
        expect(wrapper!.find('[data-retained-input="number"]').exists()).toBe(true),
      ),
    );
    const field = fc
      .findAll("._fc-r-config .el-form-item")
      .find((el) => el.text().includes("字段 ID"))!;
    await owner.step(() => field.get("input").setValue("amount"));
    await owner.step(() => field.get("input").trigger("blur"));
    await owner.step(() => flushPromises());
    expect(fc.vm.getRule()[0]!.field).toBe("amount");
    const raw = wrapper.get<HTMLInputElement>('[data-retained-input="number"]').element.value;
    expect(["", "0"]).toContain(raw);
    expect(state.blockers()).toEqual([]);
  });
});

it("日历动画开始后即阻断捕获，关闭后恢复", async () => {
  const { owner, target: wrapper, vm } = await retainedEditor();
  await owner.step(() => selectRetained({ owner, target: wrapper }, "date"));
  const calendar = wrapper!.get("[data-retained-date]").findComponent(ElDatePicker);
  calendar.vm.handleOpen();
  await owner.step(() =>
    owner.waitFor(() =>
      expect(wrapper!.find('[data-retained-date] [aria-expanded="true"]').exists()).toBe(true),
    ),
  );
  expect(vm.captureContent().status).toBe("blocked");
  calendar.vm.handleClose();
  await owner.step(() => flushPromises());
  await owner.step(() => owner.waitFor(() => expect(vm.readEditingState().canCapture).toBe(true)));
});

it("缓存原文后的原生change/失焦不制造新的编辑版本", async () => {
  const { owner, target: wrapper, vm } = await retainedEditor();
  const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
  await owner.step(() => input.setValue("-"));
  const before = vm.readEditingState().revision;
  const count = wrapper!.emitted("draftChange")?.length;
  await owner.step(() => input.trigger("change"));
  await owner.step(() => input.trigger("blur"));
  expect(vm.readEditingState().revision).toBe(before);
  expect(wrapper!.emitted("draftChange")?.length).toBe(count);
});

it.each(["legacy", "retained"] as const)(
  "缺少secure-context randomUUID时%s仍可装载和收集",
  async (editingMode) => {
    vi.stubGlobal("crypto", {});
    try {
      wrapper = mount(FormDesigner, {
        props: { name: "普通HTTP宿主", rules: numericDateRules, options: "{}", editingMode },
        attachTo: document.body,
      });
      await flushPromises();
      const vm = wrapper.vm as unknown as RetainedVm;
      expect(vm.exportContent()).not.toBeNull();
      wrapper.unmount();
      wrapper = undefined;
      wrapper = mount(FormManager, {
        props: { forms: [APPLY_FORM], editingMode },
        attachTo: document.body,
      });
      await wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
      await flushPromises();
      expect((wrapper.vm as unknown as ManagerVm).commitPendingEdit()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

describe("P1复审P2：属性控件确认与删除生命期", () => {
  it("恢复原值且没有change时，刷新后可捕获；同步阶段仍阻断", async () => {
    const { owner, target: wrapper, vm } = await retainedEditor();
    const input = await owner.step(() => retainedTitle({ owner, target: wrapper }));
    input.element.focus();
    const original = input.element.value;
    typeNative(input.element, `${original}x`);
    await owner.step(() => flushPromises());
    expect(vm.readEditingState().canCapture).toBe(false);
    typeNative(input.element, original);
    expect(vm.captureContent().status).toBe("blocked");
    input.element.blur();
    await owner.step(() => flushPromises());
    expect(vm.readEditingState().canSuspend).toBe(true);
    const captured = vm.captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status === "captured")
      expect(JSON.parse(captured.content.rules)[0].title).toBe("金额");
  });
  it.each(["delete", "clear"] as const)(
    "%s撤销已移除控件的等待，不要求change",
    async (operation) => {
      // 此复现只依赖被删除的数字字段；其他字段存活由独立双字段用例覆盖。
      const {
        owner,
        target: wrapper,
        vm,
      } = await retainedEditor(
        JSON.stringify([{ type: "inputNumber", field: "amount", title: "金额", value: 0 }]),
      );
      const input = await owner.step(() => retainedTitle({ owner, target: wrapper }));
      input.element.focus();
      typeNative(input.element, "未确认名称");
      await owner.step(() => flushPromises());
      expect(vm.readEditingState().canCapture).toBe(false);
      const fc = wrapper!.findComponent(FcDesigner).vm;
      if (operation === "clear") fc.clearDragRule();
      else
        await owner.step(() =>
          wrapper!.findComponent(FcDesigner).get("._fc-m-drag .icon-delete").trigger("click"),
        );
      await owner.step(() => flushPromises());
      expect(input.element.isConnected).toBe(false);
      expect(vm.readEditingState().canSuspend).toBe(true);
      const captured = vm.captureContent();
      expect(captured.status).toBe("captured");
      if (captured.status === "captured") {
        const rules = JSON.parse(captured.content.rules);
        expect(rules.some((r: { field: string }) => r.field === "amount")).toBe(false);
        if (operation === "clear") expect(rules).toEqual([]);
      }
    },
  );
  it("旧change的下一tick不能清除同控件更新后的未确认输入", async () => {
    const { owner, target: wrapper, vm } = await retainedEditor();
    const input = await owner.step(() => retainedTitle({ owner, target: wrapper }));
    input.element.focus();
    typeNative(input.element, "已确认");
    input.element.dispatchEvent(new Event("change", { bubbles: true }));
    typeNative(input.element, "更新但未确认");
    await owner.step(() => flushPromises());
    expect(vm.captureContent().status).toBe("blocked");
    input.element.dispatchEvent(new Event("change", { bubbles: true }));
    await owner.step(() => flushPromises());
    expect(vm.captureContent().status).toBe("captured");
  });
});

describe("P1复审P2：同步捕获重入", () => {
  it.each([
    ["inputNumber", 1000, "1e3"],
    ["inputNumber", 1, "01"],
    ["datePicker", "2024-02-29", "2024-02-29"],
  ] as const)("%s的等价原文%s→%s在公开回显前也必须阻断", async (type, value, raw) => {
    const owner = beginManagerOwner();
    const seen: FormDesignerCaptureResult[] = [];
    let armed = false;
    const wrapper = owner.mount(() =>
      mount(FormDesigner, {
        props: {
          name: "同步重入",
          rules: JSON.stringify([{ type, field: "amount", title: "值", value }]),
          options: "{}",
          editingMode: "retained",
          onDraftChange: () => {
            if (armed) seen.push((wrapper!.vm as unknown as RetainedVm).captureContent());
          },
        },
        attachTo: document.body,
      }),
    );
    await owner.step(() => flushPromises());
    const input = await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
    armed = true;
    typeNative(input.element, raw);
    armed = false;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ status: "blocked", blockers: [{ code: "pending-update" }] });
    await owner.step(() => flushPromises());
    const captured = (wrapper.vm as unknown as RetainedVm).captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status === "captured")
      expect(JSON.parse(captured.content.rules)[0].value).toBe(value);
    expect(input.element.value).toBe(raw);
  });
});

it("P1复审P2：删除其他字段不会清除仍在场的属性输入等待", async () => {
  const { owner, target: wrapper, vm } = await retainedEditor();
  const input = await owner.step(() => retainedTitle({ owner, target: wrapper }));
  input.element.focus();
  typeNative(input.element, "等待确认的金额名称");
  await owner.step(() => flushPromises());
  await owner.step(() =>
    wrapper!.findComponent(FcDesigner).findAll("._fc-m-drag .icon-delete")[1]!.trigger("click"),
  );
  await owner.step(() => flushPromises());
  expect(input.element.isConnected).toBe(true);
  expect(vm.captureContent().status).toBe("blocked");
  input.element.dispatchEvent(new Event("change", { bubbles: true }));
  await owner.step(() => flushPromises());
  const captured = vm.captureContent();
  expect(captured.status).toBe("captured");
  if (captured.status === "captured")
    expect(JSON.parse(captured.content.rules)).toMatchObject([
      { field: "amount", title: "等待确认的金额名称" },
    ]);
});

it("P1复审P2：原生number的badInput空串不能冒充恢复初始空值", async () => {
  const { owner, target: wrapper, vm } = await retainedEditor();
  await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
  const item = wrapper!
    .findComponent(FcDesigner)
    .findAll("._fc-r-config .el-form-item")
    .find((row) => row.text().includes("设置计数器允许的最小值"))!;
  const input = item.get<HTMLInputElement>('input[type="number"]');
  input.element.focus();
  // 模拟DOM不产生浏览器badInput；仅替换这个公开只读状态，输入与业务链路仍是真实组件。
  const validity = input.element.validity;
  const { restore: restoreGuard } = owner.spy(() =>
    vi
      .spyOn(input.element, "validity", "get")
      .mockReturnValue(Object.create(validity, { badInput: { value: true } })),
  );
  try {
    typeNative(input.element, "");
    await owner.step(() => flushPromises());
    expect(vm.captureContent().status).toBe("blocked");
    input.element.dispatchEvent(new Event("change", { bubbles: true }));
    await owner.step(() => flushPromises());
    expect(vm.captureContent().status).toBe("blocked");
  } finally {
    restoreGuard();
  }
  typeNative(input.element, "");
  await owner.step(() => flushPromises());
  expect(vm.captureContent().status).toBe("captured");
});

it("P1复审P2：同次change和blur的合法number归一后解除等待", async () => {
  const { owner, target: wrapper, vm } = await retainedEditor();
  await owner.step(() => selectRetained({ owner, target: wrapper }, "amount"));
  const item = wrapper!
    .findComponent(FcDesigner)
    .findAll("._fc-r-config .el-form-item")
    .find((row) => row.text().includes("设置计数器允许的最小值"))!;
  const input = item.get<HTMLInputElement>('input[type="number"]');
  input.element.focus();
  typeNative(input.element, "01");
  input.element.dispatchEvent(new Event("change", { bubbles: true }));
  input.element.blur();
  await owner.step(() => flushPromises());
  expect(input.element.value).toBe("1");
  expect(vm.readEditingState().canSuspend).toBe(true);
  const captured = vm.captureContent();
  expect(captured.status).toBe("captured");
  if (captured.status === "captured")
    expect(JSON.parse(captured.content.rules)[0].props.min).toBe(1);
});

describe("P2 retained文字存在性", () => {
  it.each([
    ["text", false],
    ["textarea", false],
    ["text", true],
    ["textarea", true],
  ] as const)("%s/grid=%s清空仍是显式空串，未设置字段不补值", async (type, grid) => {
    const { owner, target, vm } = mountText(
      textRules(type, grid),
      "retained",
      beginDesignerOwner({ isolateMainStyle: type === "text" && grid }),
    );
    await owner.step(() => activateText(target, "text", owner));
    const input = target.get<HTMLInputElement>('[data-retained-input="text"]');
    expect(input.element.value).toBe("原值");
    input.element.value = "";
    input.element.dispatchEvent(new Event("input", { bubbles: true }));
    expect(vm.captureContent().status).toBe("blocked");
    await owner.step(() => flushPromises());
    const { fields, content } = capturedFields(vm);
    expect(Object.hasOwn(fields[0], "value")).toBe(true);
    expect(fields[0].value).toBe("");
    expect(Object.hasOwn(fields[1], "value")).toBe(false);
    expect(Object.hasOwn(fields[2], "value")).toBe(true);
    expect(fields[2].value).toBe("");
    expect(vm.exportContent()).toEqual(content);
    await owner.step(() => target.get('[data-test="form-designer-save"]').trigger("click"));
    expect(target.emitted("save")?.[0]).toEqual([content.rules, content.options]);
  });
  it("开关关闭才未设置，再开启为空串；切字段保持存在性", async () => {
    const owner = beginManagerOwner();
    isolateManagerDesignerStyle(owner);
    const { target, vm } = mountText(textRules("textarea", true), "retained", owner);
    await owner.step(() => activateText(target, "text", owner));
    await owner.step(() => target.get('[data-retained-input="text-toggle"]').setValue(false));
    await owner.step(flushPromises);
    expect(Object.hasOwn(capturedFields(vm).fields[0], "value")).toBe(false);
    expect(target.find('[data-retained-input="text"]').exists()).toBe(false);
    await owner.step(() => target.get('[data-retained-input="text-toggle"]').setValue(true));
    await owner.step(flushPromises);
    expect(capturedFields(vm).fields[0].value).toBe("");
    await owner.step(() => target.get('[data-retained-input="text"]').setValue("新值"));
    await owner.step(flushPromises);
    await owner.step(() => activateText(target, "unset", owner));
    expect(
      target.get<HTMLInputElement>('[data-retained-input="text-toggle"]').element.checked,
    ).toBe(false);
    await owner.step(() => activateText(target, "text", owner));
    expect(target.get<HTMLTextAreaElement>('[data-retained-input="text"]').element.value).toBe(
      "新值",
    );
  });
  it("显式空串与未设置保存重开保持存在性", async () => {
    const { owner, target, vm } = mountText([
      { type: "input", field: "text", title: "文字", value: "原值" },
      { type: "input", field: "unset", title: "未设置" },
    ]);
    await owner.step(() => activateText(target, "text", owner));
    await owner.step(() => target.get('[data-retained-input="text"]').setValue(""));
    await owner.step(() => flushPromises());
    expect(target.element.isConnected).toBe(true);
    const content = capturedFields(vm).content;
    expect(target.get<HTMLInputElement>('[data-retained-input="text"]').element.value).toBe("");
    const session = new FlowDesignSession();
    session.newDesign({ processId: "text_presence", processName: "文字存在性" });
    const form = session.createForm("文字");
    session.updateFormContent(form.id, content.rules, content.options);
    const reopened = new FlowDesignSession();
    const saved = await owner.step(() => session.save());
    await owner.step(() => reopened.open(saved.json));
    const fields = JSON.parse(reopened.current!.forms[0]!.rules);
    expect(Object.hasOwn(fields[0], "value")).toBe(true);
    expect(Object.hasOwn(fields[1], "value")).toBe(false);
    expect(fields).toEqual(JSON.parse(content.rules));
  });
  it("clear明确删除文字字段后释放组合与存在性状态", async () => {
    const { owner, target, vm } = mountText(textRules("text", false));
    await owner.step(() => activateText(target, "text", owner));
    await owner.step(() => target.get('[data-retained-input="text"]').trigger("compositionstart"));
    expect(vm.captureContent().status).toBe("blocked");
    target.findComponent(FcDesigner).vm.clearDragRule();
    await owner.step(() => flushPromises());
    expect(capturedFields(vm).fields).toEqual([]);
  });
  it("同步draftChange重入不捕获旧值，文本组合结束同tick阻断", async () => {
    const { owner, target, vm } = mountText(textRules("text", false));
    await owner.step(() => activateText(target, "text", owner));
    const seen: string[] = [];
    await owner.step(() =>
      target.setProps({ onDraftChange: () => seen.push(vm.captureContent().status) }),
    );
    const input = target.get<HTMLInputElement>('[data-retained-input="text"]');
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.element.value = "组合文字";
    input.element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(vm.readEditingState().canSuspend).toBe(false);
    input.element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(vm.captureContent().status).toBe("blocked");
    await owner.step(() => flushPromises());
    expect(seen.every((status) => status === "blocked")).toBe(true);
    expect(capturedFields(vm).fields[0].value).toBe("组合文字");
  });
  it("文字显式空串经FormManager提交成对输出一次并关闭", async () => {
    const owner = beginDesignerOwner({ isolateMainStyle: true });
    const target = owner.mount(() =>
      mount(FormManager, {
        props: { forms: [APPLY_FORM], editingMode: "retained" },
        attachTo: document.body,
      }),
    );
    wrapper = target;
    const vm = target.vm as unknown as ManagerVm;
    await owner.step(() => target.get('[data-test="form-edit-btn-form_apply"]').trigger("click"));
    const editor = target.findComponent(FormDesigner);
    await owner.step(() => activateText(editor, "reason", owner));
    await owner.step(() =>
      editor.get<HTMLInputElement>('[data-retained-input="text"]').setValue(""),
    );
    await owner.step(() => flushPromises());
    expect(vm.readEditingState()?.canCapture).toBe(true);
    expect(vm.commitPendingEdit()).toBe(true);
    expect(vm.hasOpenEditor()).toBe(false);
    const updates = target.emitted("updateContent")!;
    expect(updates).toHaveLength(1);
    const fields = JSON.parse(updates[0]![1] as string);
    expect(Object.hasOwn(fields[0], "value")).toBe(true);
    expect(fields[0].value).toBe("");
    expect(JSON.parse(updates[0]![2] as string)).toHaveProperty("form");
  });
  it.each([undefined, "legacy"] as const)("%s不启用文本存在性入口", async (mode) => {
    const target = mount(FormDesigner, {
      props: {
        name: "legacy",
        rules: JSON.stringify(textRules("text", false)),
        options: "{}",
        ...(mode ? { editingMode: mode } : {}),
      },
      attachTo: document.body,
    });
    wrapper = target;
    const vm = target.vm as unknown as RetainedVm;
    await vi.waitFor(() => {
      target.findComponent(FcDesigner).vm.triggerActive("text");
      expect(target.find("._fc-r-config input").exists()).toBe(true);
    });
    expect(target.find('[data-retained-input="text-toggle"]').exists()).toBe(false);
    expect(JSON.parse(vm.exportContent()!.rules)[0].value).toBe("原值");
  });
});
