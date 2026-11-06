// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, reactive } from "vue";
import { FormPreview, type ComponentAppearance, type FormDefinition } from "./index.js";

const SELECT_FORM: FormDefinition = {
  id: "form_select_appearance",
  name: "下拉单选外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "select",
      field: "decision",
      title: "审批选择",
      value: "no",
      validate: [{ required: true, message: "请选择审批选择", trigger: "change" }],
      props: {
        clearable: true,
        valueOnClear: "",
        placeholder: "请选择审批结果",
        popperClass: "business-select-panel",
      },
      options: [
        { label: "同意", value: "yes" },
        { label: "拒绝", value: "no" },
        { label: "禁用选项", value: "disabled", disabled: true },
      ],
    },
  ]),
  options: "{}",
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

describe("FormPreview 下拉单选与所属弹层实例外观（#106）", () => {
  it.each(["*", "default", "select"])(
    "保留 options.global.%s 的业务面板类名，启停适配不覆盖全局默认",
    async (type) => {
      const form: FormDefinition = {
        ...SELECT_FORM,
        rules: JSON.stringify([
          {
            type: "select",
            field: "globalChoice",
            value: "yes",
            options: [{ label: "全局配置选项", value: "yes" }],
          },
        ]),
        options: JSON.stringify({ global: { [type]: { props: { popperClass: "global-panel" } } } }),
      };
      const wrapper = mountPreview(form);
      await flushPromises();
      await wrapper.get(".el-select__wrapper").trigger("click");
      await flushPromises();
      const input = wrapper.get(".el-select__input").element;
      for (const appearance of [undefined, BRAND_DARK_COMPACT, undefined]) {
        await wrapper.setProps({ appearance });
        await flushPromises();
        expect(document.querySelector(".el-select__popper")!.classList).toContain("global-panel");
        expect(wrapper.get(".el-select__input").element).toBe(input);
      }
      expect(wrapper.props("form")).toEqual(form);
    },
  );

  it("经真实 FormCreate 打开面板并合并业务类名与所属实例标识", async () => {
    const wrapper = mountPreview(SELECT_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    const preview = wrapper.get<HTMLElement>('[data-test="form-preview"]');

    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();

    const panel = document.querySelector<HTMLElement>(".el-select-dropdown");
    expect(panel).not.toBeNull();
    expect(panel!.classList.contains("business-select-panel")).toBe(true);
    expect(
      [...panel!.classList].some((name) => name.startsWith("flowduet-form-preview-select-")),
    ).toBe(true);
    const popper = document.querySelector<HTMLElement>(".el-select__popper")!;
    expect(getComputedStyle(popper).getPropertyValue("--fd-primary")).toBe(
      preview.element.style.getPropertyValue("--fd-primary"),
    );
    expect(preview.element.contains(panel)).toBe(false);
    expect(wrapper.props("form").rules).toBe(SELECT_FORM.rules);
  });

  it.each([null, [], ["field-panel"]])(
    "字段级 popperClass %j 继续覆盖全局默认",
    async (popperClass) => {
      const rules = JSON.parse(SELECT_FORM.rules);
      rules[0].props.popperClass = popperClass;
      const form: FormDefinition = {
        ...SELECT_FORM,
        rules: JSON.stringify(rules),
        options: JSON.stringify({
          global: {
            "*": { props: { popperClass: "shared-panel" } },
            select: { props: { popperClass: "select-panel" } },
          },
        }),
      };
      const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
      await flushPromises();
      await wrapper.get(".el-select__wrapper").trigger("click");
      await flushPromises();
      const panel = document.querySelector(".el-select__popper")!;
      expect(panel.classList).not.toContain("shared-panel");
      expect(panel.classList).not.toContain("select-panel");
      expect(panel.classList.contains("field-panel")).toBe(
        Array.isArray(popperClass) && popperClass.length > 0,
      );
      expect(wrapper.props("form")).toEqual(form);
    },
  );

  it("真实选择、禁用选项、清除、必填标记与成功反馈保持既有行为", async () => {
    const wrapper = mountPreview(SELECT_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    const readValue = () =>
      JSON.parse(wrapper.get('[data-test="form-preview-values"]').text()).decision;

    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    const options = Array.from(document.querySelectorAll<HTMLElement>(".el-select-dropdown__item"));
    expect(options.find((option) => option.textContent === "禁用选项")?.classList).toContain(
      "is-disabled",
    );
    options.find((option) => option.textContent === "同意")!.click();
    await flushPromises();
    expect(readValue()).toBe("yes");

    await wrapper.get(".el-select").trigger("mouseenter");
    await wrapper.get(".el-select__clear").trigger("click");
    await flushPromises();
    expect(readValue()).toBe("");
    // happy-dom 的既有边界：空必填不执行 async-validator；失败到成功交给 Chromium 实测。
    expect(wrapper.get(".el-form-item").classes()).toContain("is-required");

    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    Array.from(document.querySelectorAll<HTMLElement>(".el-select-dropdown__item"))
      .find((option) => option.textContent === "拒绝")!
      .click();
    await wrapper.get('[data-test="form-preview-validate"]').trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.get('[data-test="form-preview-validation"]').text()).toContain("校验通过");
    });
    expect(readValue()).toBe("no");
    expect(wrapper.props("form").rules).toBe(SELECT_FORM.rules);
  });

  it("品牌面板保留仅使用 EP 变量的业务选中与禁用颜色", async () => {
    const rules = JSON.parse(SELECT_FORM.rules);
    rules[0].props.popperStyle = {
      "--el-color-primary": "rgb(18, 52, 86)",
      "--el-text-color-placeholder": "rgb(113, 130, 147)",
    };
    const form = { ...SELECT_FORM, rules: JSON.stringify(rules) };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();
    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    const selected = document.querySelector<HTMLElement>(".el-select-dropdown__item.is-selected")!;
    const disabled = document.querySelector<HTMLElement>(".el-select-dropdown__item.is-disabled")!;
    expect(getComputedStyle(selected).color).toBe("rgb(18, 52, 86)");
    expect(getComputedStyle(disabled).color).toBe("rgb(113, 130, 147)");
    expect(wrapper.props("form")).toEqual(form);
  });

  it.each([
    ["host", "compact"],
    ["host", "comfortable"],
    ["brand", "compact"],
    ["brand", "comfortable"],
  ] as const)("%s／%s 保留显式选项及空面板字号", async (colorSource, density) => {
    const rules = JSON.parse(SELECT_FORM.rules);
    rules[0].props.popperStyle = { "--el-font-size-base": "28px" };
    rules.push({
      type: "select",
      field: "emptyFont",
      props: {
        popperClass: "explicit-empty-font",
        popperStyle: { "--el-select-font-size": "26px" },
      },
      options: [],
    });
    const form = { ...SELECT_FORM, rules: JSON.stringify(rules) };
    const wrapper = mountPreview(form, { colorSource, mode: "light", density });
    await flushPromises();
    await wrapper.findAll(".el-select__wrapper")[0]!.trigger("click");
    await flushPromises();
    const selected = document.querySelector<HTMLElement>(".el-select-dropdown__item.is-selected")!;
    expect.soft(getComputedStyle(selected).fontSize).toBe("28px");
    await wrapper.findAll(".el-select__wrapper")[1]!.trigger("click");
    await flushPromises();
    const empty = document.querySelector<HTMLElement>(
      ".explicit-empty-font .el-select-dropdown__empty",
    )!;
    expect(getComputedStyle(empty).fontSize).toBe("26px");
    expect(wrapper.props("form")).toEqual(form);
  });

  it("显式 appendTo 与数组 popperClass 优先，实例标识仍追加且不写回规则", async () => {
    const external = document.createElement("div");
    external.dataset.test = "external-select-target";
    document.body.append(external);
    const form: FormDefinition = {
      ...SELECT_FORM,
      rules: JSON.stringify([
        {
          type: "select",
          field: "externalDecision",
          title: "外部挂载下拉",
          value: "no",
          props: {
            appendTo: '[data-test="external-select-target"]',
            popperClass: ["business-first", "business-second"],
            popperStyle: { "--fd-primary": "#010203" },
          },
          options: [{ label: "拒绝", value: "no" }],
        },
      ]),
    };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();

    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".el-select-dropdown")!;
    expect(external.contains(panel)).toBe(true);
    expect(
      external
        .querySelector<HTMLElement>(".el-select__popper")!
        .style.getPropertyValue("--fd-primary"),
    ).toBe("#010203");
    expect(wrapper.get('[data-test="form-preview"]').element.contains(panel)).toBe(false);
    expect(panel.classList).toContain("business-first");
    expect(panel.classList).toContain("business-second");
    expect(
      [...panel.classList].some((name) => name.startsWith("flowduet-form-preview-select-")),
    ).toBe(true);
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("显式 teleported=false 保持原位渲染且不让 appendTo 改变归属", async () => {
    const external = document.createElement("div");
    external.dataset.test = "ignored-select-target";
    document.body.append(external);
    const form: FormDefinition = {
      ...SELECT_FORM,
      rules: JSON.stringify([
        {
          type: "select",
          field: "inlineDecision",
          title: "原位下拉",
          value: "no",
          props: {
            teleported: false,
            appendTo: '[data-test="ignored-select-target"]',
          },
          options: [{ label: "拒绝", value: "no" }],
        },
      ]),
    };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();

    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".el-select-dropdown")!;
    expect(wrapper.get(".el-select").element.contains(panel)).toBe(true);
    expect(external.contains(panel)).toBe(false);
    expect(
      [...panel.classList].some((name) => name.startsWith("flowduet-form-preview-select-")),
    ).toBe(true);
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("面板打开及关闭时换肤与启停保留选择、输入 DOM 和焦点，定义换代仍重置", async () => {
    const wrapper = mountPreview(SELECT_FORM, { colorSource: "host", mode: "light" });
    await flushPromises();
    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    Array.from(document.querySelectorAll<HTMLElement>(".el-select-dropdown__item"))
      .find((option) => option.textContent === "同意")!
      .click();
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>(".el-select__input");
    await input.trigger("keydown", { key: "ArrowDown", code: "ArrowDown" });
    await flushPromises();
    expect(document.querySelector<HTMLElement>(".el-select__popper")!.style.display).not.toBe(
      "none",
    );
    input.element.focus();
    const variants = [
      BRAND_DARK_COMPACT,
      undefined,
      { colorSource: "brand", mode: "light", density: "comfortable" },
      { colorSource: "host", mode: "light", density: "compact" },
    ] as const;

    for (const appearance of variants) {
      await wrapper.setProps({ appearance });
      await flushPromises();
      const panel = document.querySelector<HTMLElement>(".el-select__popper")!;
      expect(panel).not.toBeNull();
      expect(wrapper.get(".el-select__input").element).toBe(input.element);
      expect(document.activeElement).toBe(input.element);
      expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toMatchObject({
        decision: "yes",
      });
    }

    await input.trigger("keydown", { key: "Escape", code: "Escape" });
    await flushPromises();
    expect(document.querySelector<HTMLElement>(".el-select__popper")!.style.display).toBe("none");
    for (const appearance of variants) {
      await wrapper.setProps({ appearance });
      await flushPromises();
      expect(wrapper.get(".el-select__input").element).toBe(input.element);
      expect(document.activeElement).toBe(input.element);
      expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toMatchObject({
        decision: "yes",
      });
    }

    await wrapper.setProps({ form: { ...SELECT_FORM } });
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toMatchObject({
      decision: "no",
    });
    expect(wrapper.props("form").rules).toBe(SELECT_FORM.rules);
  });

  it("同 app 双实例同时打开的面板归属与变量独立，卸载和重挂正确清理", async () => {
    const state = reactive({ showFirst: true });
    const Host = defineComponent({
      components: { FormPreview },
      setup() {
        return { state, form: SELECT_FORM };
      },
      template: `
        <section data-test="first-select">
          <FormPreview
            v-if="state.showFirst"
            :form="form"
            :appearance="{ colorSource: 'host', mode: 'light', density: 'comfortable' }"
          />
        </section>
        <section data-test="second-select">
          <FormPreview :form="form" :appearance="{ colorSource: 'brand', mode: 'dark', density: 'compact' }" />
        </section>
      `,
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrappers.push(wrapper);
    await flushPromises();
    const ownerClass = (element: HTMLElement) =>
      [...element.classList].find((name) => name.startsWith("flowduet-form-preview-select-"));

    for (const selector of [
      '[data-test="first-select"] .el-select__wrapper',
      '[data-test="second-select"] .el-select__wrapper',
    ]) {
      await wrapper.get(selector).trigger("click");
      await flushPromises();
    }
    const panels = Array.from(document.querySelectorAll<HTMLElement>(".el-select__popper"));
    expect(panels).toHaveLength(2);
    const firstPanel = panels.find(
      (panel) => getComputedStyle(panel).getPropertyValue("--el-color-primary") === "",
    )!;
    const secondPanel = panels.find(
      (panel) => getComputedStyle(panel).getPropertyValue("--el-color-primary") === "#A5BBFF",
    )!;
    const firstOwner = ownerClass(firstPanel);
    const secondOwner = ownerClass(secondPanel);
    expect(firstOwner).toBeDefined();
    expect(secondOwner).toBeDefined();
    expect(firstOwner).not.toBe(secondOwner);
    expect(firstPanel.getAttribute("style")).not.toContain("--el-");
    expect(getComputedStyle(secondPanel).getPropertyValue("--fd-control-height")).toBe("24px");

    state.showFirst = false;
    await flushPromises();
    expect(firstPanel.isConnected).toBe(false);
    expect(secondPanel.isConnected).toBe(true);
    expect(getComputedStyle(secondPanel).getPropertyValue("--el-color-primary")).toBe("#A5BBFF");

    state.showFirst = true;
    await flushPromises();
    await wrapper.get('[data-test="first-select"] .el-select__wrapper').trigger("click");
    await flushPromises();
    const remountedPanel = Array.from(
      document.querySelectorAll<HTMLElement>(".el-select__popper"),
    ).find((panel) => panel !== secondPanel)!;
    expect(ownerClass(remountedPanel)).toBeDefined();
    expect(ownerClass(remountedPanel)).not.toBe(firstOwner);
    expect(ownerClass(secondPanel)).toBe(secondOwner);
  });

  it("不同 Vue app 的同页实例也使用不同标识且品牌面板互不覆盖", async () => {
    const first = mountPreview(SELECT_FORM, {
      colorSource: "brand",
      mode: "light",
      density: "comfortable",
    });
    const second = mountPreview(SELECT_FORM, BRAND_DARK_COMPACT);
    await flushPromises();
    await first.get(".el-select__wrapper").trigger("click");
    await second.get(".el-select__wrapper").trigger("click");
    await flushPromises();

    const panels = Array.from(document.querySelectorAll<HTMLElement>(".el-select__popper"));
    expect(panels).toHaveLength(2);
    const owners = panels.map(
      (panel) =>
        [...panel.classList].find((name) => name.startsWith("flowduet-form-preview-select-")) ??
        "missing",
    );
    expect(new Set(owners).size).toBe(2);
    expect(getComputedStyle(panels[0]!).getPropertyValue("--el-color-primary")).toBe("#2D3E97");
    expect(getComputedStyle(panels[1]!).getPropertyValue("--el-color-primary")).toBe("#A5BBFF");
  });

  it("旧路径不追加实例标识或实例变量，仍使用 EP 原缺省挂载", async () => {
    const wrapper = mountPreview(SELECT_FORM);
    await flushPromises();
    await wrapper.get(".el-select__wrapper").trigger("click");
    await flushPromises();

    const panel = document.querySelector<HTMLElement>(".el-select__popper")!;
    expect(panel.classList.contains("business-select-panel")).toBe(true);
    expect(
      [...panel.classList].some((name) => name.startsWith("flowduet-form-preview-select-")),
    ).toBe(false);
    expect(getComputedStyle(panel).getPropertyValue("--fd-primary")).toBe("");
    expect(panel.getAttribute("style")).not.toContain("--fd-");
    expect(wrapper.get('[data-test="form-preview"]').element.contains(panel)).toBe(false);
    expect(wrapper.props("form").rules).toBe(SELECT_FORM.rules);
  });

  it("空选项、禁用及栅格列内下拉保持真实状态并获得所属面板", async () => {
    const form: FormDefinition = {
      ...SELECT_FORM,
      rules: JSON.stringify([
        {
          type: "select",
          field: "emptyDecision",
          title: "空选项下拉",
          props: { placeholder: "暂无可选项" },
          options: [],
        },
        {
          type: "select",
          field: "disabledDecision",
          title: "禁用下拉",
          value: "no",
          props: { disabled: true },
          options: [{ label: "禁用已选", value: "no" }],
        },
        {
          type: "fcRow",
          children: [
            {
              type: "col",
              children: [
                {
                  type: "select",
                  field: "nestedDecision",
                  title: "栅格列内下拉",
                  value: "no",
                  options: [{ label: "列内拒绝", value: "no" }],
                },
              ],
            },
          ],
        },
      ]),
    };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();
    const selects = wrapper.findAll(".el-select");
    expect(selects).toHaveLength(3);
    expect(selects[1]!.get(".el-select__wrapper").classes()).toContain("is-disabled");
    expect(selects[1]!.get<HTMLInputElement>(".el-select__input").element.disabled).toBe(true);

    await selects[0]!.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    expect(document.querySelector(".el-select-dropdown__empty")).not.toBeNull();
    await selects[0]!.get(".el-select__input").trigger("keydown", {
      key: "Escape",
      code: "Escape",
    });
    await flushPromises();

    await selects[2]!.get(".el-select__wrapper").trigger("click");
    await flushPromises();
    const visiblePanel = Array.from(
      document.querySelectorAll<HTMLElement>(".el-select__popper"),
    ).find((panel) => panel.style.display !== "none")!;
    expect(
      [...visiblePanel.classList].some((name) => name.startsWith("flowduet-form-preview-select-")),
    ).toBe(true);
    expect(getComputedStyle(visiblePanel).getPropertyValue("--fd-primary")).toBe("#A5BBFF");
    expect(wrapper.props("form").rules).toBe(form.rules);
  });
});
