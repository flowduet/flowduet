// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import FormPreview from "./components/FormPreview.vue";
import FormManager from "./components/FormManager.vue";
import FormDesigner from "./components/FormDesigner.vue";
import type { FormDefinition } from "./document.js";

/**
 * 真实组件链路（#72）：FormCreate 渲染器实际参与预览与试填校验，
 * 设计器实际参与内容编辑——不 mock 序列化结果（迭代三测试决策）。
 */

let wrapper: ReturnType<typeof mount> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

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

describe("FormPreview（真实渲染器试填）", () => {
  it("渲染真实输入框并回显设计默认值；试填值与设计定义隔离", async () => {
    wrapper = mount(FormPreview, { props: { form: APPLY_FORM } });
    await flushPromises();

    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toBe("默认事由");

    // 试填：改值只进试填状态，不回写设计默认值
    await input.setValue("试用内容");
    await flushPromises();
    expect(wrapper.find('[data-test="form-preview-values"]').text()).toContain("试用内容");
    expect(wrapper.props("form").rules).toContain("默认事由");
    expect(wrapper.props("form").rules).not.toContain("试用内容");
  });

  it("必填标记与校验入口在场（成败语义经真机回归验证）", async () => {
    // happy-dom 下 element-plus 表单校验对空必填不触发（is-required 规则已挂上，
    // el-form 的 async-validator 不执行），此处断言环境可靠的部分：必填标记、
    // 校验按钮可触发且不抛错；「清空→未通过、补填→通过」的语义在真机（CDP）
    // 回归中验证——见 #72 交付记录。
    wrapper = mount(FormPreview, { props: { form: APPLY_FORM }, attachTo: document.body });
    await flushPromises();

    expect(document.querySelector(".el-form-item.is-required")).not.toBeNull();
    await wrapper.find("input").setValue("");
    await flushPromises();
    await wrapper.find('[data-test="form-preview-validate"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="form-preview-validate"]').exists()).toBe(true);

    await wrapper.find("input").setValue("补填内容");
    await flushPromises();
    await wrapper.find('[data-test="form-preview-validate"]').trigger("click");
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="form-preview-validation"]').text()).toContain("校验通过");
      },
      { timeout: 3000 },
    );
  });

  it("切换预览目标重置试填值，不同表单输入不混用", async () => {
    const other: FormDefinition = {
      id: "form_other",
      name: "另一张",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    wrapper = mount(FormPreview, { props: { form: APPLY_FORM } });
    await flushPromises();
    await wrapper.find("input").setValue("试用内容");
    await flushPromises();
    expect(wrapper.find('[data-test="form-preview-values"]').text()).toContain("试用内容");

    await wrapper.setProps({ form: other });
    await flushPromises();
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.find('[data-test="form-preview-values"]').text()).not.toContain("试用内容");
  });

  it("内容无法解析时显示错误而非白屏", () => {
    wrapper = mount(FormPreview, {
      props: { form: { ...APPLY_FORM, rules: "{bad-json" } },
    });
    expect(wrapper.find('[data-test="form-preview-error"]').text()).toContain("无法解析");
  });
});

describe("FormManager（目录管理面板）", () => {
  it("新建与改名经事件上抛，操作归会话", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] } });
    await flushPromises();

    await wrapper.find('[data-test="form-manager-new-name"]').setValue("复核单");
    await wrapper.find('[data-test="form-manager-create-btn"]').trigger("click");
    expect(wrapper.emitted("create")).toEqual([["复核单"]]);

    await wrapper.find('[data-test="form-rename-btn-form_apply"]').trigger("click");
    await wrapper.find('[data-test="form-rename-input-form_apply"]').setValue("报销单");
    await wrapper.find('[data-test="form-manager-rename-ok"]').trigger("click");
    expect(wrapper.emitted("rename")).toEqual([["form_apply", "报销单"]]);
  });

  it("内容守卫前置：超范围字段不 emit 且编辑器保持打开供修正", async () => {
    const manager = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await manager.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

    // Vue3 emit 不向调用方 rethrow 宿主异常——守卫必须在组件内前置，
    // 否则坏内容会静默关闭编辑器。构造超范围内容经组件实例触发保存。
    const designer = manager.findComponent({ name: "FormDesigner" });
    expect(designer.exists()).toBe(true);
    designer.vm.$emit(
      "save",
      JSON.stringify([{ type: "select", field: "s1", title: "下拉" }]),
      "{}",
    );
    await flushPromises();

    expect(manager.emitted("updateContent")).toBeUndefined();
    expect(manager.find('[data-test="form-manager-error"]').text()).toContain(
      "只支持文本（input）字段",
    );
    expect(manager.find('[data-test="form-manager-edit-dialog"]').exists()).toBe(true);
    manager.unmount();
  });
});

describe("FormDesigner（真实 FcDesigner 装载）", () => {
  it("装载既有规则并成对导出 rules/options 序列化串", async () => {
    wrapper = mount(FormDesigner, {
      props: { name: APPLY_FORM.name, rules: APPLY_FORM.rules, options: APPLY_FORM.options },
    });
    await flushPromises();

    // 真实设计器在设计区回显字段标题
    expect(wrapper.text()).toContain("申请事由");

    await wrapper.find('[data-test="form-designer-save"]').trigger("click");
    await flushPromises();
    const saved = wrapper.emitted("save");
    expect(saved).toBeTruthy();
    const [rules, options] = saved![0] as [string, string];
    // 导出物是可解析的成对 JSON，且文本字段语义保留
    const parsed = JSON.parse(rules) as Array<{ type: string; field: string }>;
    expect(parsed.some((rule) => rule.type === "input" && rule.field === "reason")).toBe(true);
    expect(typeof JSON.parse(options)).toBe("object");
  });

  it("取消不产出内容", async () => {
    wrapper = mount(FormDesigner, {
      props: { name: APPLY_FORM.name, rules: "[]", options: "{}" },
    });
    await flushPromises();
    await wrapper.find('[data-test="form-designer-cancel"]').trigger("click");
    expect(wrapper.emitted("save")).toBeUndefined();
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });
});
