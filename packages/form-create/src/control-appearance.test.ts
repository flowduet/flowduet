// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { FormPreview, type ComponentAppearance, type FormDefinition } from "./index.js";

const NUMBER_FORM: FormDefinition = {
  id: "form_number_appearance",
  name: "数字外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "inputNumber",
      field: "amount",
      title: "申请数量",
      value: 1,
      props: { min: 0, max: 3, step: 1 },
    },
  ]),
  options: "{}",
};

const RADIO_FORM: FormDefinition = {
  id: "form_radio_appearance",
  name: "单选外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "radio",
      field: "decision",
      title: "审批选择",
      value: "no",
      options: [
        { label: "同意", value: "yes" },
        { label: "拒绝", value: "no" },
        { label: "禁用", value: "disabled", disabled: true },
      ],
    },
  ]),
  options: "{}",
};

const CHECKBOX_FORM: FormDefinition = {
  id: "form_checkbox_appearance",
  name: "多选外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "checkbox",
      field: "tags",
      title: "通知范围",
      value: ["a", "disabledChecked"],
      options: [
        { label: "甲", value: "a" },
        { label: "乙", value: "b" },
        { label: "半选", value: "mixed", indeterminate: true },
        { label: "禁用未选", value: "disabled", disabled: true },
        { label: "禁用已选", value: "disabledChecked", disabled: true },
      ],
    },
  ]),
  options: "{}",
};

const SWITCH_FORM: FormDefinition = {
  id: "form_switch_appearance",
  name: "开关外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "switch",
      field: "notify",
      title: "状态通知",
      value: false,
      props: {
        activeValue: true,
        inactiveValue: false,
        activeText: "开启通知",
        inactiveText: "关闭通知",
      },
    },
    {
      type: "switch",
      field: "disabledNotify",
      title: "禁用开关",
      value: true,
      props: { activeValue: true, inactiveValue: false, disabled: true },
    },
  ]),
  options: "{}",
};

const CONTROL_FORM: FormDefinition = {
  id: "form_controls_appearance",
  name: "四类控件外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    ...JSON.parse(NUMBER_FORM.rules),
    ...JSON.parse(RADIO_FORM.rules),
    ...JSON.parse(CHECKBOX_FORM.rules),
    ...JSON.parse(SWITCH_FORM.rules),
  ]),
  options: "{}",
};

const EXPLICIT_CONTROL_FORM: FormDefinition = {
  id: "form_explicit_controls_appearance",
  name: "显式控件配置验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "inputNumber",
      field: "amount",
      title: "显式数字",
      value: 2,
      style: "max-width: 260px",
      props: { size: "large", min: 0, max: 5 },
    },
    {
      type: "radio",
      field: "decision",
      title: "显式单选",
      value: "yes",
      props: { size: "large" },
      options: [{ label: "同意", value: "yes" }],
    },
    {
      type: "checkbox",
      field: "tags",
      title: "显式多选",
      value: ["a"],
      props: { size: "large" },
      options: [{ label: "甲", value: "a" }],
    },
    {
      type: "switch",
      field: "notify",
      title: "显式开关",
      value: true,
      props: { size: "large", width: 56 },
    },
  ]),
  options: JSON.stringify({
    form: { size: "small", labelPosition: "right", labelWidth: "88px", style: "padding: 7px" },
  }),
};

const BRAND_DARK_COMPACT: ComponentAppearance = {
  colorSource: "brand",
  mode: "dark",
  density: "compact",
};

const wrappers: ReturnType<typeof mount>[] = [];

function mountPreview(form: FormDefinition, appearance?: ComponentAppearance) {
  const wrapper = mount(FormPreview, {
    props: { form, appearance },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

describe("FormPreview 数字、单选、多选与开关实例外观（#105）", () => {
  it("数字字段经真实 FormCreate 保持输入、键盘增减、边界、清空与外观切换", async () => {
    const wrapper = mountPreview(NUMBER_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>(".el-input-number input");
    expect(input.element.value).toBe("1");
    expect(wrapper.get(".el-input-number").classes()).toContain("el-input-number--small");

    await input.trigger("keydown", { key: "ArrowDown", code: "ArrowDown" });
    await flushPromises();
    expect(input.element.value).toBe("0");
    await input.trigger("keydown", { key: "ArrowDown", code: "ArrowDown" });
    await flushPromises();
    expect(input.element.value).toBe("0");
    await input.trigger("keydown", { key: "ArrowUp", code: "ArrowUp" });
    await flushPromises();
    expect(input.element.value).toBe("1");

    await input.setValue("");
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toEqual({
      amount: null,
    });
    await wrapper.setProps({
      appearance: { colorSource: "brand", mode: "light", density: "comfortable" },
    });
    await flushPromises();
    expect(wrapper.get(".el-input-number input").element).toBe(input.element);
    expect(input.element.value).toBe("");
    expect(wrapper.props("form").rules).toBe(NUMBER_FORM.rules);
  });

  it("单选经真实包装保持选中值、禁用选项、焦点与外观切换", async () => {
    const wrapper = mountPreview(RADIO_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(3);
    expect(radios.map((radio) => radio.element.checked)).toEqual([false, true, false]);
    expect(radios[2]!.element.disabled).toBe(true);
    expect(wrapper.get(".el-radio").classes()).toContain("el-radio--small");

    await radios[0]!.setValue(true);
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toEqual({
      decision: "yes",
    });
    radios[0]!.element.focus();
    await wrapper.setProps({
      appearance: { colorSource: "host", mode: "light", density: "comfortable" },
    });
    await flushPromises();
    expect(wrapper.findAll('input[type="radio"]')[0]!.element).toBe(radios[0]!.element);
    expect(radios[0]!.element.checked).toBe(true);
    expect(document.activeElement).toBe(radios[0]!.element);
    expect(wrapper.props("form").rules).toBe(RADIO_FORM.rules);
  });

  it("多选经真实包装保持数组值、半选、禁用与外观切换", async () => {
    const wrapper = mountPreview(CHECKBOX_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    const boxes = wrapper.findAll<HTMLInputElement>('.el-checkbox input[type="checkbox"]');
    expect(boxes).toHaveLength(5);
    expect(boxes.map((box) => box.element.checked)).toEqual([true, false, false, false, true]);
    expect(boxes[2]!.element.indeterminate).toBe(true);
    expect(boxes[3]!.element.disabled).toBe(true);
    expect(boxes[4]!.element.disabled).toBe(true);
    expect(wrapper.get(".el-checkbox").classes()).toContain("el-checkbox--small");

    await boxes[1]!.setValue(true);
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toEqual({
      tags: ["a", "disabledChecked", "b"],
    });
    await boxes[0]!.setValue(false);
    await boxes[2]!.setValue(true);
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toEqual({
      tags: ["disabledChecked", "b", "mixed"],
    });

    boxes[2]!.element.focus();
    await wrapper.setProps({
      appearance: { colorSource: "brand", mode: "light", density: "comfortable" },
    });
    await flushPromises();
    expect(wrapper.findAll('.el-checkbox input[type="checkbox"]')[2]!.element).toBe(
      boxes[2]!.element,
    );
    expect(document.activeElement).toBe(boxes[2]!.element);
    expect(boxes[2]!.element.checked).toBe(true);
    expect(boxes[2]!.element.indeterminate).toBe(true);
    expect(wrapper.props("form").rules).toBe(CHECKBOX_FORM.rules);
  });

  it("开关经真实 FormCreate 保持 true/false、禁用、焦点与外观切换", async () => {
    const wrapper = mountPreview(SWITCH_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    const switches = wrapper.findAll<HTMLInputElement>(".el-switch input");
    expect(switches).toHaveLength(2);
    expect(switches[0]!.element.checked).toBe(false);
    expect(switches[1]!.element.checked).toBe(true);
    expect(switches[1]!.element.disabled).toBe(true);
    expect(wrapper.get(".el-switch").classes()).toContain("el-switch--small");

    await switches[0]!.setValue(true);
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toEqual({
      notify: true,
      disabledNotify: true,
    });
    switches[0]!.element.focus();
    await wrapper.setProps({ appearance: undefined });
    await flushPromises();
    await wrapper.setProps({
      appearance: { colorSource: "host", mode: "light", density: "comfortable" },
    });
    await flushPromises();
    expect(wrapper.findAll(".el-switch input")[0]!.element).toBe(switches[0]!.element);
    expect(switches[0]!.element.checked).toBe(true);
    expect(document.activeElement).toBe(switches[0]!.element);
    expect(wrapper.props("form").rules).toBe(SWITCH_FORM.rules);
  });

  it("四类字段的显式 large 与表单样式优先于紧凑适配且定义不变", async () => {
    const wrapper = mountPreview(EXPLICIT_CONTROL_FORM, BRAND_DARK_COMPACT);
    await flushPromises();

    expect(wrapper.get(".el-input-number").classes()).toContain("el-input-number--large");
    expect(wrapper.get<HTMLElement>(".el-input-number").element.style.maxWidth).toBe("260px");
    expect(wrapper.get(".el-radio").classes()).toContain("el-radio--large");
    expect(wrapper.get(".el-checkbox").classes()).toContain("el-checkbox--large");
    expect(wrapper.get(".el-switch").classes()).toContain("el-switch--large");
    expect(wrapper.get(".el-form").classes()).toContain("el-form--label-right");
    expect(wrapper.get<HTMLElement>(".el-form").element.style.padding).toBe("7px");
    expect(wrapper.get<HTMLElement>(".el-form-item__label").element.style.width).toBe("88px");
    expect(wrapper.props("form").rules).toBe(EXPLICIT_CONTROL_FORM.rules);
    expect(wrapper.props("form").options).toBe(EXPLICIT_CONTROL_FORM.options);
  });

  it("四类字段组合试填在换肤与启停中保留，定义换代恢复各自默认值", async () => {
    const wrapper = mountPreview(CONTROL_FORM, { mode: "light" });
    await flushPromises();
    const number = wrapper.get<HTMLInputElement>(".el-input-number input");
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]');
    const boxes = wrapper.findAll<HTMLInputElement>('.el-checkbox input[type="checkbox"]');
    const switches = wrapper.findAll<HTMLInputElement>(".el-switch input");
    await number.setValue("3");
    await radios[0]!.setValue(true);
    await boxes[1]!.setValue(true);
    await switches[0]!.setValue(true);

    for (const appearance of [
      BRAND_DARK_COMPACT,
      undefined,
      { colorSource: "host", mode: "light", density: "comfortable" },
    ] as const) {
      await wrapper.setProps({ appearance });
      await flushPromises();
      expect(number.element.value).toBe("3");
      expect(radios[0]!.element.checked).toBe(true);
      expect(boxes[1]!.element.checked).toBe(true);
      expect(switches[0]!.element.checked).toBe(true);
      expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toMatchObject({
        amount: 3,
        decision: "yes",
        notify: true,
      });
    }

    await wrapper.setProps({ form: { ...CONTROL_FORM } });
    await flushPromises();
    expect(wrapper.get<HTMLInputElement>(".el-input-number input").element.value).toBe("1");
    expect(wrapper.findAll<HTMLInputElement>('input[type="radio"]')[1]!.element.checked).toBe(true);
    expect(
      wrapper
        .findAll<HTMLInputElement>('.el-checkbox input[type="checkbox"]')
        .map((box) => box.element.checked),
    ).toEqual([true, false, false, false, true]);
    expect(
      wrapper.findAll<HTMLInputElement>(".el-switch input").map((input) => input.element.checked),
    ).toEqual([false, true]);
    expect(wrapper.props("form").rules).toBe(CONTROL_FORM.rules);
  });
});
