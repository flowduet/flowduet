// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, reactive } from "vue";
import { FormPreview, type ComponentAppearance, type FormDefinition } from "./index.js";

const BRAND_DARK_COMPACT: ComponentAppearance = {
  colorSource: "brand",
  mode: "dark",
  density: "compact",
};

const DATE_CASES = [
  { type: "date", value: "2026-11-15", format: "YYYY-MM-DD", table: ".el-date-table" },
  {
    type: "datetime",
    value: "2026-11-15 09:30:45",
    format: "YYYY-MM-DD HH:mm:ss",
    table: ".el-date-table",
  },
  { type: "week", value: "2026-46th", format: "YYYY-wo", table: ".el-date-table" },
  { type: "month", value: "2026-11", format: "YYYY-MM", table: ".el-month-table" },
  { type: "year", value: "2026", format: "YYYY", table: ".el-year-table" },
] as const;

function dateForm(type: (typeof DATE_CASES)[number]["type"]): FormDefinition {
  const item = DATE_CASES.find((candidate) => candidate.type === type)!;
  return {
    id: `form_date_${type}`,
    name: `${type} 日期外观验收`,
    provider: "form-create/element-plus",
    rules: JSON.stringify([
      {
        type: "datePicker",
        field: type,
        title: `${type} 单值`,
        value: item.value,
        props: {
          type: item.type,
          format: item.format,
          valueFormat: item.format,
          clearable: true,
          popperClass: `business-${type}-panel`,
        },
      },
    ]),
    options: "{}",
  };
}

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
  vi.useRealTimers();
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

describe("FormPreview 日期单值与时间面板实例外观（#107）", () => {
  it.each(DATE_CASES)("真实 $type 路径保留值与格式并追加所属日期面板标识", async (item) => {
    const form = dateForm(item.type);
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>(".el-date-editor .el-input__inner");
    expect(input.element.value).toBe(item.value);

    await input.trigger("click");
    await flushPromises();

    const panel = document.querySelector<HTMLElement>(`.business-${item.type}-panel`);
    expect(panel).not.toBeNull();
    if (panel === null) return;
    expect(panel.querySelector(item.table)).not.toBeNull();
    expect(
      [...panel.classList].some((name) => name.startsWith("flowduet-form-preview-date-")),
    ).toBe(true);
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it.each(["*", "default", "datePicker"])(
    "保留 options.global.%s 的业务日期面板类名且启停不换输入",
    async (type) => {
      const source = dateForm("date");
      const rules = JSON.parse(source.rules);
      delete rules[0].props.popperClass;
      const form: FormDefinition = {
        ...source,
        rules: JSON.stringify(rules),
        options: JSON.stringify({
          global: { [type]: { props: { popperClass: "global-date-panel" } } },
        }),
      };
      const wrapper = mountPreview(form);
      await flushPromises();
      const input = wrapper.get<HTMLInputElement>(".el-date-editor .el-input__inner");
      await input.trigger("click");
      await flushPromises();
      for (const appearance of [undefined, BRAND_DARK_COMPACT, undefined]) {
        await wrapper.setProps({ appearance });
        await flushPromises();
        expect(document.querySelector(".el-picker__popper")!.classList).toContain(
          "global-date-panel",
        );
        expect(wrapper.get(".el-date-editor .el-input__inner").element).toBe(input.element);
      }
      expect(wrapper.props("form")).toEqual(form);
    },
  );

  it("week 的选中行与 datetime 时间列表分别使用可读的前景和背景", async () => {
    const week = mountPreview(dateForm("week"), BRAND_DARK_COMPACT);
    await flushPromises();
    await week.get(".el-date-editor .el-input__inner").trigger("click");
    await flushPromises();
    const weekPanel = document.querySelector<HTMLElement>(".business-week-panel")!;
    const currentWeek = weekPanel.querySelector<HTMLElement>(
      ".el-date-table__row.current td.available:not(.start-date):not(.end-date) .el-date-table-cell",
    )!;
    expect(getComputedStyle(currentWeek).color).toBe("#A5BBFF");
    expect(getComputedStyle(currentWeek).backgroundColor).toBe("#2A3354");
    await week.unmount();
    wrappers.pop();

    const datetime = mountPreview(dateForm("datetime"), BRAND_DARK_COMPACT);
    await flushPromises();
    await datetime.get(".el-date-editor .el-input__inner").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".business-datetime-panel")!;
    const timeInput = panel.querySelectorAll<HTMLInputElement>(
      ".el-date-picker__time-header .el-input__inner",
    )[1]!;
    timeInput.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
    await flushPromises();
    const active = panel.querySelector<HTMLElement>(".el-time-spinner__item.is-active")!;
    expect(getComputedStyle(active).color).toBe("#A5BBFF");
    expect(getComputedStyle(active).backgroundColor).toBe("#2A3354");
  });

  it("品牌面板保留仅使用 EP 变量的业务选中背景与非当前月前景", async () => {
    const source = dateForm("date");
    const rules = JSON.parse(source.rules);
    rules[0].props.popperStyle = {
      "--el-color-primary": "rgb(18, 52, 86)",
      "--el-text-color-placeholder": "rgb(113, 130, 147)",
    };
    const form = { ...source, rules: JSON.stringify(rules) };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();
    await wrapper.get(".el-date-editor .el-input__inner").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".business-date-panel")!;
    const selected = panel.querySelector<HTMLElement>(
      "td.current:not(.disabled) .el-date-table-cell__text",
    )!;
    const off = panel.querySelector<HTMLElement>("td.prev-month, td.next-month")!;
    expect(getComputedStyle(selected).backgroundColor).toBe("rgb(18, 52, 86)");
    expect(getComputedStyle(off).color).toBe("rgb(113, 130, 147)");
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("跟随宿主保留今天且选中的月份与年份白色前景", async () => {
    // 固定 EP 的 today 来源，避免测试随真实日期离开 2026 年 11 月后失效。
    vi.useFakeTimers({ now: new Date(2026, 10, 6, 12) });
    for (const type of ["month", "year"] as const) {
      const wrapper = mountPreview(dateForm(type), { colorSource: "host", mode: "light" });
      await flushPromises();
      await wrapper.get(".el-date-editor .el-input__inner").trigger("click");
      await flushPromises();
      const panel = document.querySelector<HTMLElement>(`.business-${type}-panel`)!;
      const selected = panel.querySelector<HTMLElement>(
        "td.today.current:not(.disabled) .el-date-table-cell__text",
      )!;
      expect(selected).not.toBeNull();
      expect(getComputedStyle(selected).color).toBe("#fff");
      expect(getComputedStyle(selected).backgroundColor).toBe("#409EFF");
      await wrapper.unmount();
      wrappers.pop();
    }
  });

  it("显式 appendTo、数组类名和 popperStyle 优先且不写回定义", async () => {
    const external = document.createElement("div");
    external.dataset.test = "external-date-target";
    document.body.append(external);
    const source = dateForm("date");
    const rules = JSON.parse(source.rules);
    rules[0].props.appendTo = '[data-test="external-date-target"]';
    rules[0].props.popperClass = ["business-date-first", "business-date-second"];
    rules[0].props.popperStyle = { "--fd-primary": "#010203" };
    const form = { ...source, rules: JSON.stringify(rules) };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();
    await wrapper.get(".el-date-editor .el-input__inner").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".el-picker__popper")!;
    expect(external.contains(panel)).toBe(true);
    expect(panel.classList).toContain("business-date-first");
    expect(panel.classList).toContain("business-date-second");
    expect(panel.style.getPropertyValue("--fd-primary")).toBe("#010203");
    expect(
      [...panel.classList].some((name) => name.startsWith("flowduet-form-preview-date-")),
    ).toBe(true);
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("显式 teleported=false 保持原位面板且忽略 appendTo", async () => {
    const external = document.createElement("div");
    external.dataset.test = "ignored-date-target";
    document.body.append(external);
    const source = dateForm("date");
    const rules = JSON.parse(source.rules);
    rules[0].props.teleported = false;
    rules[0].props.appendTo = '[data-test="ignored-date-target"]';
    const form = { ...source, rules: JSON.stringify(rules) };
    const wrapper = mountPreview(form, BRAND_DARK_COMPACT);
    await flushPromises();
    await wrapper.get(".el-date-editor .el-input__inner").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".business-date-panel")!;
    expect(wrapper.get('[data-test="form-preview"]').element.contains(panel)).toBe(true);
    expect(external.contains(panel)).toBe(false);
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("清空与禁用保持原值语义，旧路径不追加实例资源", async () => {
    const source = dateForm("date");
    const rules = JSON.parse(source.rules);
    rules.push({
      type: "datePicker",
      field: "disabledDate",
      title: "禁用日期",
      value: "2026-11-16",
      props: { type: "date", disabled: true },
    });
    const form = { ...source, rules: JSON.stringify(rules) };
    const wrapper = mountPreview(form);
    await flushPromises();
    const editors = wrapper.findAll(".el-date-editor");
    expect(editors[1]!.get<HTMLInputElement>(".el-input__inner").element.disabled).toBe(true);
    await editors[1]!.get(".el-input__inner").trigger("click");
    await flushPromises();
    expect(
      Array.from(document.querySelectorAll<HTMLElement>(".el-picker__popper")).filter(
        (panel) => panel.style.display !== "none",
      ),
    ).toHaveLength(0);

    await editors[0]!.trigger("mouseenter");
    await editors[0]!.get(".clear-icon").trigger("click");
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text())).toMatchObject({
      date: null,
      disabledDate: "2026-11-16",
    });
    await editors[0]!.get(".el-input__inner").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".el-picker__popper")!;
    expect(panel.classList).toContain("business-date-panel");
    expect(
      [...panel.classList].some((name) => name.startsWith("flowduet-form-preview-date-")),
    ).toBe(false);
    expect(getComputedStyle(panel).getPropertyValue("--fd-primary")).toBe("");
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("datetime 的选中日期和实际时间子面板共享所属实例且选中文字可读", async () => {
    const wrapper = mountPreview(dateForm("datetime"), BRAND_DARK_COMPACT);
    await flushPromises();
    const preview = wrapper.get<HTMLElement>('[data-test="form-preview"]');
    await wrapper.get(".el-date-editor .el-input__inner").trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".business-datetime-panel")!;
    const selected = panel.querySelector<HTMLElement>(
      ".el-date-table td.current:not(.disabled) .el-date-table-cell__text",
    )!;
    expect(getComputedStyle(panel).getPropertyValue("--fd-primary")).toBe(
      preview.element.style.getPropertyValue("--fd-primary"),
    );
    expect(getComputedStyle(selected).color).toBe("#171F3E");
    expect(getComputedStyle(selected).backgroundColor).toBe("#A5BBFF");

    const timeInput = panel.querySelectorAll<HTMLInputElement>(
      ".el-date-picker__time-header .el-input__inner",
    )[1]!;
    timeInput.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
    await flushPromises();
    const timePanel = panel.querySelector<HTMLElement>(".el-time-panel");
    expect(timePanel).not.toBeNull();
    expect(timePanel!.closest(".el-picker__popper")).toBe(panel);
    expect(document.querySelectorAll(".business-datetime-panel")).toHaveLength(1);
    expect(timePanel!.querySelectorAll(".el-time-spinner__item.is-active").length).toBeGreaterThan(
      0,
    );
    timeInput.focus();
    await wrapper.setProps({
      appearance: { colorSource: "brand", mode: "light", density: "comfortable" },
    });
    await flushPromises();
    expect(document.activeElement).toBe(timeInput);
    expect(panel.querySelector(".el-time-panel")).toBe(timePanel);
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text()).datetime).toBe(
      "2026-11-15 09:30:45",
    );
  });

  it("打开与关闭时换肤和启停保留日期、输入 DOM 与焦点，定义重开仍重置", async () => {
    const form = dateForm("date");
    const wrapper = mountPreview(form, { colorSource: "host", mode: "light" });
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>(".el-date-editor .el-input__inner");
    await input.trigger("click");
    await flushPromises();
    const panel = document.querySelector<HTMLElement>(".business-date-panel")!;
    const target = Array.from(
      panel.querySelectorAll<HTMLElement>("td.available:not(.current):not(.disabled)"),
    ).find((cell) => cell.textContent?.trim() === "20")!;
    target.click();
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text()).date).toBe(
      "2026-11-20",
    );

    await input.trigger("click");
    await flushPromises();
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
      expect(wrapper.get(".el-date-editor .el-input__inner").element).toBe(input.element);
      expect(document.activeElement).toBe(input.element);
      expect(panel.style.display).not.toBe("none");
      expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text()).date).toBe(
        "2026-11-20",
      );
    }
    await input.trigger("keydown", { key: "Escape", code: "Escape" });
    await flushPromises();
    for (const appearance of variants) {
      await wrapper.setProps({ appearance });
      await flushPromises();
      expect(wrapper.get(".el-date-editor .el-input__inner").element).toBe(input.element);
      expect(document.activeElement).toBe(input.element);
    }
    await wrapper.setProps({ form: { ...form } });
    await flushPromises();
    expect(wrapper.get<HTMLInputElement>(".el-date-editor .el-input__inner").element.value).toBe(
      "2026-11-15",
    );
    expect(JSON.parse(wrapper.get('[data-test="form-preview-values"]').text()).date).toBe(
      "2026-11-15",
    );
    expect(wrapper.props("form").rules).toBe(form.rules);
  });

  it("同 app 双实例面板归属独立，卸载和重挂正确清理样式与面板", async () => {
    const state = reactive({ showFirst: true });
    const Host = defineComponent({
      components: { FormPreview },
      setup() {
        return { state, form: dateForm("date") };
      },
      template: `
        <section data-test="first-date">
          <FormPreview v-if="state.showFirst" :form="form" :appearance="{ colorSource: 'host', mode: 'light' }" />
        </section>
        <section data-test="second-date">
          <FormPreview :form="form" :appearance="{ colorSource: 'brand', mode: 'dark', density: 'compact' }" />
        </section>
      `,
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrappers.push(wrapper);
    await flushPromises();
    for (const selector of [
      '[data-test="first-date"] .el-input__inner',
      '[data-test="second-date"] .el-input__inner',
    ]) {
      wrapper.get<HTMLInputElement>(selector).element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          code: "ArrowDown",
          bubbles: false,
          cancelable: true,
        }),
      );
      await flushPromises();
    }
    const panels = Array.from(document.querySelectorAll<HTMLElement>(".el-picker__popper"));
    expect(panels).toHaveLength(2);
    const owner = (panel: HTMLElement) =>
      [...panel.classList].find((name) => name.startsWith("flowduet-form-preview-date-"));
    const firstPanel = panels.find(
      (panel) => getComputedStyle(panel).getPropertyValue("--el-color-primary") === "",
    )!;
    const secondPanel = panels.find(
      (panel) => getComputedStyle(panel).getPropertyValue("--el-color-primary") === "#A5BBFF",
    )!;
    const firstOwner = owner(firstPanel);
    const secondOwner = owner(secondPanel);
    expect(firstOwner).toBeDefined();
    expect(secondOwner).toBeDefined();
    expect(firstOwner).not.toBe(secondOwner);

    state.showFirst = false;
    await flushPromises();
    expect(firstPanel.isConnected).toBe(false);
    expect(secondPanel.isConnected).toBe(true);
    expect(getComputedStyle(secondPanel).getPropertyValue("--el-color-primary")).toBe("#A5BBFF");

    state.showFirst = true;
    await flushPromises();
    wrapper
      .get<HTMLInputElement>('[data-test="first-date"] .el-input__inner')
      .element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          code: "ArrowDown",
          bubbles: false,
          cancelable: true,
        }),
      );
    await flushPromises();
    const remounted = Array.from(document.querySelectorAll<HTMLElement>(".el-picker__popper")).find(
      (panel) => panel !== secondPanel,
    )!;
    expect(owner(remounted)).toBeDefined();
    expect(owner(remounted)).not.toBe(firstOwner);
    expect(owner(secondPanel)).toBe(secondOwner);
  });
});
