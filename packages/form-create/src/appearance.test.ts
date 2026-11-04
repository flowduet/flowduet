// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, reactive, watch } from "vue";
import { ElButton, ElConfigProvider, ElInput } from "element-plus";
import { FormPreview, type ComponentAppearance, type FormDefinition } from "./index.js";

const TEXT_FORM: FormDefinition = {
  id: "form_text_appearance",
  name: "文本外观验收",
  provider: "form-create/element-plus",
  rules: JSON.stringify([
    {
      type: "input",
      field: "reason",
      title: "申请事由",
      value: "默认事由",
      $required: true,
    },
    {
      type: "input",
      field: "detail",
      title: "详细说明",
      value: "默认说明",
      props: { type: "textarea", rows: 3 },
    },
  ]),
  options: "{}",
};

const LIGHT_HOST_STYLE = {
  "--el-bg-color-page": "#F2F7F6",
  "--el-bg-color": "#FAFCFC",
  "--el-fill-color-light": "#EEF5F4",
  "--el-text-color-primary": "#182625",
  "--el-text-color-regular": "#4A5A58",
  "--el-color-primary": "#0F6B65",
};
const DARK_HOST_STYLE = {
  "--el-bg-color-page": "#101817",
  "--el-bg-color": "#162220",
  "--el-fill-color-light": "#1F302D",
  "--el-text-color-primary": "#E6F2F0",
  "--el-text-color-regular": "#B8CECA",
  "--el-color-primary": "#7FCFC7",
};

const wrappers: ReturnType<typeof mount>[] = [];

function mountPreview(appearance?: ComponentAppearance) {
  const wrapper = mount(FormPreview, {
    props: { form: TEXT_FORM, appearance },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

describe("FormPreview 文本与多行文本实例外观（#104）", () => {
  it("公开品牌紧凑配置适配真实文本字段与自有操作按钮", async () => {
    const wrapper = mountPreview({ colorSource: "brand", mode: "dark", density: "compact" });
    await flushPromises();

    const preview = wrapper.find<HTMLElement>('[data-test="form-preview"]');
    expect(preview.classes()).toContain("flowduet-appearance--brand");
    expect(preview.classes()).toContain("flowduet-appearance--dark");
    expect(preview.element.style.getPropertyValue("--fd-control-height")).toBe("24px");
    expect(preview.element.style.getPropertyValue("--el-color-primary")).toBe("#A5BBFF");
    expect(wrapper.find("input").exists()).toBe(true);
    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(wrapper.find('[data-test="form-preview-validate"]').classes()).toContain(
      "el-button--small",
    );
  });

  it("新适配为缺省标签位置补顶置，旧路径保留 FormCreate 原默认", async () => {
    const adapted = mountPreview({ mode: "light" });
    await flushPromises();
    expect(adapted.find(".el-form").classes()).toContain("el-form--label-top");
    expect(
      adapted.find<HTMLElement>('[data-test="form-preview"]').element.getAttribute("style"),
    ).not.toContain("--el-");
    adapted.unmount();
    wrappers.pop();

    const legacy = mountPreview();
    await flushPromises();
    expect(legacy.find(".el-form").classes()).not.toContain("el-form--label-top");
    expect(legacy.find(".el-form").classes()).toContain("el-form--label-right");
    expect(legacy.find('[data-test="form-preview-validate"]').classes()).toContain(
      "el-button--small",
    );
  });

  it("旧路径继续继承外层 EP size，自有操作按钮保持固定 small", async () => {
    const Host = defineComponent({
      components: { ElConfigProvider, FormPreview },
      setup() {
        return { form: TEXT_FORM };
      },
      template: `
        <ElConfigProvider size="large">
          <FormPreview :form="form" />
        </ElConfigProvider>
      `,
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrappers.push(wrapper);
    await flushPromises();

    expect(wrapper.find(".el-input").classes()).toContain("el-input--large");
    expect(wrapper.find('[data-test="form-preview-validate"]').classes()).toContain(
      "el-button--small",
    );
    expect(wrapper.find('[data-test="form-preview"]').classes()).not.toContain(
      "flowduet-appearance",
    );
  });

  it("显式表单、字段与栅格配置优先于新默认且原定义不变", async () => {
    const explicit: FormDefinition = {
      ...TEXT_FORM,
      rules: JSON.stringify([
        {
          type: "input",
          field: "reason",
          title: "显式事由",
          style: "max-width: 260px",
          props: { size: "large" },
        },
        {
          type: "input",
          field: "detail",
          title: "显式说明",
          props: { type: "textarea", rows: 5 },
        },
        {
          type: "fcRow",
          props: { gutter: 18 },
          children: [
            {
              type: "col",
              props: { span: 12 },
              children: [{ type: "input", field: "nested", title: "栅格文本" }],
            },
          ],
        },
      ]),
      options: JSON.stringify({
        form: {
          size: "large",
          labelPosition: "right",
          labelWidth: "87px",
          inline: true,
          style: "padding: 7px",
        },
      }),
    };
    const wrapper = mount(FormPreview, {
      props: {
        form: explicit,
        appearance: { colorSource: "brand", mode: "dark", density: "compact" },
      },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await flushPromises();

    const form = wrapper.find<HTMLElement>(".el-form");
    expect(form.classes()).toContain("el-form--label-right");
    expect(form.classes()).toContain("el-form--inline");
    expect(form.classes()).toContain("el-form--large");
    expect(form.element.style.padding).toBe("7px");
    expect(wrapper.find<HTMLElement>(".el-form-item__label").element.style.width).toBe("87px");
    expect(wrapper.find(".el-input").classes()).toContain("el-input--large");
    expect(wrapper.find<HTMLElement>(".el-input").element.style.maxWidth).toBe("260px");
    expect(wrapper.find("textarea").attributes("rows")).toBe("5");
    const rowMargins = wrapper
      .findAll<HTMLElement>(".el-row")
      .map((row) => [row.element.style.marginLeft, row.element.style.marginRight]);
    expect(rowMargins).toContainEqual(["-9px", "-9px"]);
    expect(wrapper.props("form").rules).toBe(explicit.rules);
    expect(wrapper.props("form").options).toBe(explicit.options);
  });

  it("跟随宿主在同周期主题更新后采样，实例范围不写任何 EP 变量", async () => {
    const state = reactive({ dark: false });
    const Host = defineComponent({
      components: { FormPreview },
      setup() {
        return {
          state,
          form: TEXT_FORM,
          lightHostStyle: LIGHT_HOST_STYLE,
          darkHostStyle: DARK_HOST_STYLE,
        };
      },
      template: `
        <FormPreview
          :form="form"
          :style="state.dark ? darkHostStyle : lightHostStyle"
          :appearance="{ colorSource: 'host', mode: state.dark ? 'dark' : 'light' }"
        />
      `,
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrappers.push(wrapper);
    await flushPromises();
    const preview = wrapper.find<HTMLElement>('[data-test="form-preview"]');
    expect(preview.element.style.getPropertyValue("--fd-surface")).toBe("#FAFCFC");
    expect(preview.element.style.getPropertyValue("--fd-primary")).toBe("#0F6B65");

    state.dark = true;
    await flushPromises();
    expect(preview.element.style.getPropertyValue("--fd-surface")).toBe("#162220");
    expect(preview.element.style.getPropertyValue("--fd-secondary")).toBe("#B8CECA");
    expect(preview.element.style.getPropertyValue("--fd-primary")).toBe("#7FCFC7");
    // 此处的 --el-* 是宿主经公开 style 传入的输入，不是适配器新增；无宿主写入的零回写断言见上例。
    expect(preview.element.style.getPropertyValue("--el-color-primary")).toBe("#7FCFC7");
  });

  it("合法宿主更新等待采样时接到非法配置，仍落地最新有效快照", async () => {
    const state = reactive({ dark: false, invalid: false });
    const Host = defineComponent({
      components: { FormPreview },
      setup() {
        return {
          state,
          form: TEXT_FORM,
          lightHostStyle: LIGHT_HOST_STYLE,
          darkHostStyle: DARK_HOST_STYLE,
        };
      },
      template: `
        <FormPreview
          :form="form"
          :style="state.dark ? darkHostStyle : lightHostStyle"
          :appearance="state.invalid
            ? { mode: 'dark', density: 'invalid' }
            : { colorSource: 'host', mode: state.dark ? 'dark' : 'light' }"
        />
      `,
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrappers.push(wrapper);
    await flushPromises();
    const preview = wrapper.find<HTMLElement>('[data-test="form-preview"]');
    expect(preview.element.style.getPropertyValue("--fd-surface")).toBe("#FAFCFC");
    expect(preview.element.style.getPropertyValue("--fd-primary")).toBe("#0F6B65");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // 宿主后置 watcher 在预览合法采样挂起后写入非法配置，形成同周期 watcher 重跑。
    const stopInvalidating = watch(
      () => state.dark,
      () => {
        state.invalid = true;
      },
      { flush: "post" },
    );
    state.dark = true;
    await flushPromises();
    stopInvalidating();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.density"));
    expect(preview.classes()).toContain("flowduet-appearance--host");
    expect(preview.classes()).toContain("flowduet-appearance--dark");
    expect(preview.element.style.getPropertyValue("--fd-surface")).toBe("#162220");
    expect(preview.element.style.getPropertyValue("--fd-primary")).toBe("#7FCFC7");
  });

  it("品牌浅色直切宿主深色时读取宿主而非尚未移除的旧品牌变量", async () => {
    const wrapper = mountPreview({ colorSource: "brand", mode: "light" });
    await flushPromises();
    const preview = wrapper.find<HTMLElement>('[data-test="form-preview"]');
    expect(preview.element.style.getPropertyValue("--fd-surface")).toBe("#FFFFFF");

    await wrapper.setProps({ appearance: { colorSource: "host", mode: "dark" } });
    await flushPromises();
    expect(preview.element.style.getPropertyValue("--fd-primary")).toBe("#409EFF");
    expect(preview.element.style.getPropertyValue("--fd-surface")).toBe("#141414");
    expect(preview.element.getAttribute("style")).not.toContain("--el-");
  });

  it("外观变化不重置试填，同 ID 定义重开仍清空旧值与反馈", async () => {
    const wrapper = mountPreview({ colorSource: "brand", mode: "light" });
    await flushPromises();
    await wrapper.find("input").setValue("需要隔离的旧事由");
    await wrapper.find("textarea").setValue("需要隔离的旧说明");
    await wrapper.find('[data-test="form-preview-validate"]').trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="form-preview-validation"]').text()).toContain("校验通过");
    });

    await wrapper.setProps({ appearance: { colorSource: "brand", mode: "dark" } });
    await flushPromises();
    expect(wrapper.find<HTMLInputElement>("input").element.value).toBe("需要隔离的旧事由");

    const reopened: FormDefinition = {
      ...TEXT_FORM,
      rules: JSON.stringify([
        { type: "input", field: "reason", title: "申请事由", value: "重开事由" },
        {
          type: "input",
          field: "detail",
          title: "详细说明",
          value: "重开说明",
          props: { type: "textarea" },
        },
      ]),
    };
    await wrapper.setProps({ form: reopened });
    await flushPromises();
    expect(wrapper.find<HTMLInputElement>("input").element.value).toBe("重开事由");
    expect(wrapper.find<HTMLTextAreaElement>("textarea").element.value).toBe("重开说明");
    expect(wrapper.find('[data-test="form-preview-values"]').text()).not.toContain("需要隔离");
    expect(wrapper.find('[data-test="form-preview-validation"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="form-preview"]').classes()).toContain(
      "flowduet-appearance--dark",
    );
  });

  it("合成中文组合期间换肤不丢字、不重建输入或提前产生校验反馈", async () => {
    const wrapper = mountPreview({ colorSource: "brand", mode: "light" });
    await flushPromises();
    const input = wrapper.find<HTMLInputElement>("input");
    input.element.focus();
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.element.value = "组合中的中文";
    input.element.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    await flushPromises();

    await wrapper.setProps({
      appearance: { colorSource: "brand", mode: "dark", density: "compact" },
    });
    await flushPromises();
    expect(wrapper.find("input").element).toBe(input.element);
    expect(input.element.value).toBe("组合中的中文");
    expect(document.activeElement).toBe(input.element);
    expect(wrapper.find('[data-test="form-preview-validation"]').exists()).toBe(false);

    input.element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    input.element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('[data-test="form-preview-values"]').text()).toContain("组合中的中文");
  });

  it("非法配置整份拒绝并告警，合法停用后的非法输入不复活旧主题", async () => {
    const wrapper = mountPreview({ colorSource: "host", mode: "light", density: "comfortable" });
    await flushPromises();
    const preview = wrapper.find<HTMLElement>('[data-test="form-preview"]');
    const input = wrapper.find<HTMLInputElement>("input");
    await input.setValue("非法配置前的试填");
    input.element.focus();
    const originalPrimary = preview.element.style.getPropertyValue("--fd-primary");
    preview.element.style.setProperty("--el-color-primary", "#000000");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await wrapper.setProps({
      appearance: { mode: "dark", density: "invalid" } as unknown as ComponentAppearance,
    });
    await flushPromises();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.density"));
    expect(preview.classes()).toContain("flowduet-appearance--light");
    expect(preview.element.style.getPropertyValue("--fd-primary")).toBe(originalPrimary);
    expect(input.element.value).toBe("非法配置前的试填");
    expect(document.activeElement).toBe(input.element);

    await wrapper.setProps({ appearance: undefined });
    expect(preview.classes()).not.toContain("flowduet-appearance");
    await wrapper.setProps({ appearance: { mode: "invalid" } as unknown as ComponentAppearance });
    await flushPromises();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.mode"));
    expect(preview.classes()).not.toContain("flowduet-appearance");
    expect(input.element.value).toBe("非法配置前的试填");
    expect(document.activeElement).toBe(input.element);
  });

  it("运行时换肤与启停保留文本试填、输入 DOM、焦点、有效反馈及原定义", async () => {
    const wrapper = mountPreview({ colorSource: "host", mode: "light" });
    await flushPromises();
    const input = wrapper.find("input");
    const textarea = wrapper.find("textarea");
    await input.setValue("中文试填事由");
    await textarea.setValue("多行中文试填说明");
    await wrapper.find('[data-test="form-preview-validate"]').trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="form-preview-validation"]').text()).toContain("校验通过");
    });
    input.element.focus();
    const inputElement = input.element as HTMLInputElement;
    const textareaElement = textarea.element as HTMLTextAreaElement;
    const feedback = wrapper.find('[data-test="form-preview-validation"]').text();

    for (const appearance of [
      { colorSource: "brand", mode: "dark", density: "compact" },
      { colorSource: "brand", mode: "light", density: "comfortable" },
      { colorSource: "host", mode: "light", density: "compact" },
      undefined,
      { colorSource: "host", mode: "light", density: "comfortable" },
    ] as const) {
      await wrapper.setProps({ appearance });
      await flushPromises();
      expect(wrapper.find("input").element).toBe(inputElement);
      expect(wrapper.find("textarea").element).toBe(textareaElement);
      expect(inputElement.value).toBe("中文试填事由");
      expect(textareaElement.value).toBe("多行中文试填说明");
      expect(document.activeElement).toBe(inputElement);
      expect(wrapper.find('[data-test="form-preview-validation"]').text()).toBe(feedback);
    }
    expect(wrapper.props("form").rules).toBe(TEXT_FORM.rules);
    expect(wrapper.props("form").options).toBe(TEXT_FORM.options);
  });

  it("同 app 双预览切换、卸载与重挂互不影响，并保留宿主处理器", async () => {
    const state = reactive({
      showFirst: true,
      firstAppearance: { colorSource: "host", mode: "light" } as ComponentAppearance,
    });
    const Host = defineComponent({
      components: { ElButton, ElInput, FormPreview },
      setup() {
        return { state, form: TEXT_FORM };
      },
      template: `
        <div>
          <ElInput data-test="host-input" model-value="宿主原值" />
          <ElButton data-test="host-button">宿主按钮</ElButton>
          <button type="button" data-test="switch-first" @click="state.firstAppearance = { colorSource: 'brand', mode: 'light', density: 'compact' }">切换第一个</button>
          <button type="button" data-test="toggle-first" @click="state.showFirst = !state.showFirst">切换挂载</button>
          <section data-test="first-instance">
            <FormPreview v-if="state.showFirst" :form="form" :appearance="state.firstAppearance" />
          </section>
          <section data-test="second-instance">
            <FormPreview :form="form" :appearance="{ colorSource: 'brand', mode: 'dark', density: 'compact' }" />
          </section>
        </div>
      `,
    });
    const originalBeforeUnload = window.onbeforeunload;
    const originalDrop = document.body.ondrop;
    const hostBeforeUnload = () => "host";
    const hostDrop = () => undefined;
    window.onbeforeunload = hostBeforeUnload;
    document.body.ondrop = hostDrop;
    try {
      const wrapper = mount(Host, { attachTo: document.body });
      wrappers.push(wrapper);
      await flushPromises();
      const first = wrapper.find<HTMLElement>(
        '[data-test="first-instance"] [data-test="form-preview"]',
      );
      const second = wrapper.find<HTMLElement>(
        '[data-test="second-instance"] [data-test="form-preview"]',
      );
      const secondStyle = second.element.getAttribute("style");
      const hostInput = wrapper.find<HTMLElement>('[data-test="host-input"]');
      const hostInputStyle = hostInput.element.getAttribute("style");
      const htmlClass = document.documentElement.className;
      const styleCount = document.head.querySelectorAll("style").length;
      expect(first.element.getAttribute("style")).not.toContain("--el-");
      expect(second.element.style.getPropertyValue("--el-color-primary")).toBe("#A5BBFF");

      await wrapper.find('[data-test="switch-first"]').trigger("click");
      await flushPromises();
      expect(first.element.style.getPropertyValue("--el-color-primary")).toBe("#2D3E97");
      expect(second.element.getAttribute("style")).toBe(secondStyle);
      expect(hostInput.element.getAttribute("style")).toBe(hostInputStyle);

      await wrapper.find('[data-test="toggle-first"]').trigger("click");
      await flushPromises();
      expect(first.element.isConnected).toBe(false);
      expect(second.element.isConnected).toBe(true);
      expect(second.element.getAttribute("style")).toBe(secondStyle);
      expect(window.onbeforeunload).toBe(hostBeforeUnload);
      expect(document.body.ondrop).toBe(hostDrop);
      expect(document.documentElement.className).toBe(htmlClass);

      await wrapper.find('[data-test="toggle-first"]').trigger("click");
      await flushPromises();
      const remounted = wrapper.find<HTMLElement>(
        '[data-test="first-instance"] [data-test="form-preview"]',
      );
      expect(remounted.element.style.getPropertyValue("--el-color-primary")).toBe("#2D3E97");
      expect(second.element.getAttribute("style")).toBe(secondStyle);
      expect(hostInput.element.getAttribute("style")).toBe(hostInputStyle);
      expect(document.head.querySelectorAll("style")).toHaveLength(styleCount);
      expect(window.onbeforeunload).toBe(hostBeforeUnload);
      expect(document.body.ondrop).toBe(hostDrop);
    } finally {
      window.onbeforeunload = originalBeforeUnload;
      document.body.ondrop = originalDrop;
    }
  });
});
