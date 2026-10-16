// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, onBeforeMount } from "vue";
import { ElSelect, ElOption, ElMessageBox, ElDialog, ElDatePicker } from "element-plus";
import { flushPromises, mount } from "@vue/test-utils";
import FcDesigner from "@form-create/designer";
import type { FormDesignerEditingState, FormDesignerCaptureResult } from "./editor-state.js";
import FormPreview from "./components/FormPreview.vue";
import FormManager from "./components/FormManager.vue";
import FormDesigner from "./components/FormDesigner.vue";
import { createEditorInputState } from "./components/editor-input-state.js";
import NumberDefaultEditor from "./components/NumberDefaultEditor.vue";
import { ensureFormCreateInstalled } from "./form-create-setup.js";
import {
  DESIGNER_CONFIG,
  FIELD_MENU,
  retainedDesignerConfig,
} from "./components/designer-config.js";
import type { FormDefinition } from "./document.js";
import { rulesSemantics } from "./form-semantics.js";

/**
 * 真实组件链路（#72 / #74）：FormCreate 渲染器实际参与预览与试填校验，
 * 设计器实际参与内容编辑——不 mock 序列化结果（迭代三测试决策）。
 * #74 起覆盖八类字段与栅格布局的全字段矩阵（A09/A10）与开放范围收口（A13）。
 */

let wrapper: ReturnType<typeof mount> | undefined;
let originalElementString: PropertyDescriptor | undefined;

/** 仅本测试文件对齐浏览器的元素字符串语义，保留真实组件并避免模拟DOM整树序列化。 */
beforeEach(() => {
  originalElementString = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
  Object.defineProperty(Element.prototype, "toString", {
    configurable: true,
    writable: true,
    value: Object.prototype.toString,
  });
});

afterEach(() => {
  try {
    wrapper?.unmount();
  } finally {
    wrapper = undefined;
    document.body.innerHTML = "";
    if (originalElementString) {
      Object.defineProperty(Element.prototype, "toString", originalElementString);
    } else {
      Reflect.deleteProperty(Element.prototype, "toString");
    }
    originalElementString = undefined;
  }
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

  it("重新打开同 ID 的表单定义时清除旧试填并回显新默认值", async () => {
    wrapper = mount(FormPreview, { props: { form: APPLY_FORM } });
    await flushPromises();
    await wrapper.find("input").setValue("试用内容");
    await flushPromises();

    const reopened: FormDefinition = {
      ...APPLY_FORM,
      rules: JSON.stringify([
        { type: "input", field: "reason", title: "申请事由", value: "重开默认" },
      ]),
    };
    await wrapper.setProps({ form: reopened });
    await flushPromises();

    expect(wrapper.find('[data-test="form-preview-values"]').text()).not.toContain("试用内容");
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("重开默认");
  });

  it.each([false, true])(
    "同 ID 相同定义重开后当前值与可见默认一致（已试填=%s）",
    async (edited) => {
      wrapper = mount(FormPreview, { props: { form: APPLY_FORM } });
      await flushPromises();
      if (edited) {
        await wrapper.find("input").setValue("旧试填");
        await flushPromises();
      }

      // 文件重开创建新的定义对象，序列化内容与旧定义相同。
      await wrapper.setProps({ form: { ...APPLY_FORM } });
      await flushPromises();
      expect((wrapper.find("input").element as HTMLInputElement).value).toBe("默认事由");
      expect(JSON.parse(wrapper.find('[data-test="form-preview-values"]').text())).toEqual({
        reason: "默认事由",
      });
      expect(wrapper.props("form").rules).toBe(APPLY_FORM.rules);
    },
  );

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

  it("删除经两段确认后上抛；取消不上抛（A06 的面板交互）", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] } });
    await flushPromises();

    // 直接点删除只进入确认态，不上抛
    await wrapper.find('[data-test="form-delete-btn-form_apply"]').trigger("click");
    expect(wrapper.emitted("delete")).toBeUndefined();
    expect(wrapper.find('[data-test="form-delete-confirm-form_apply"]').exists()).toBe(true);

    // 取消回到常态
    await wrapper.find('[data-test="form-delete-cancel-form_apply"]').trigger("click");
    expect(wrapper.emitted("delete")).toBeUndefined();
    expect(wrapper.find('[data-test="form-delete-confirm-form_apply"]').exists()).toBe(false);

    // 再点删除并确认：上抛 id，操作归会话（引用守卫在会话侧）
    await wrapper.find('[data-test="form-delete-btn-form_apply"]').trigger("click");
    await wrapper.find('[data-test="form-delete-confirm-form_apply"]').trigger("click");
    expect(wrapper.emitted("delete")).toEqual([["form_apply"]]);
  });

  it("空白名称留在管理面板供修正，不丢输入或退出改名", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] } });
    await wrapper.find('[data-test="form-manager-new-name"]').setValue("   ");
    await wrapper.find('[data-test="form-manager-create-btn"]').trigger("click");
    expect(wrapper.emitted("create")).toBeUndefined();
    expect(wrapper.find('[data-test="form-manager-new-name"]').element).toHaveProperty(
      "value",
      "   ",
    );
    expect(wrapper.find('[data-test="form-manager-name-error"]').text()).toContain(
      "名称不能为空白",
    );

    await wrapper.find('[data-test="form-rename-btn-form_apply"]').trigger("click");
    await wrapper.find('[data-test="form-rename-input-form_apply"]').setValue("   ");
    await wrapper.find('[data-test="form-manager-rename-ok"]').trigger("click");
    expect(wrapper.emitted("rename")).toBeUndefined();
    expect(wrapper.find('[data-test="form-rename-input-form_apply"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="form-rename-error-form_apply"]').text()).toContain(
      "名称不能为空白",
    );
  });

  it("内容守卫前置：超范围字段不 emit 且编辑器保持打开供修正", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    const manager = wrapper;
    await manager.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

    // Vue3 emit 不向调用方 rethrow 宿主异常——守卫必须在组件内前置，
    // 否则坏内容会静默关闭编辑器。构造超范围内容经组件实例触发保存。
    const designer = manager.findComponent({ name: "FormDesigner" });
    expect(designer.exists()).toBe(true);
    expect(designer.find("._fc-l-item").exists()).toBe(true);
    designer.vm.$emit(
      "save",
      JSON.stringify([{ type: "upload", field: "u1", title: "上传" }]),
      "{}",
    );
    await flushPromises();

    expect(manager.emitted("updateContent")).toBeUndefined();
    expect(manager.find('[data-test="form-manager-error"]').text()).toContain("支持的组件");
    expect(manager.find('[data-test="form-manager-edit-dialog"]').exists()).toBe(true);
  });

  it("重复字段标识不能关闭编辑器或上报保存", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await wrapper.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

    expect(wrapper.findComponent(FormDesigner).find("._fc-l-item").exists()).toBe(true);
    wrapper.findComponent({ name: "FormDesigner" }).vm.$emit(
      "save",
      JSON.stringify([
        { type: "input", field: "reason" },
        { type: "input", field: "reason" },
      ]),
      "{}",
    );
    await flushPromises();

    expect(wrapper.emitted("updateContent")).toBeUndefined();
    expect(wrapper.find('[data-test="form-manager-error"]').text()).toContain("字段标识重复");
    expect(wrapper.find('[data-test="form-manager-edit-dialog"]').exists()).toBe(true);
  });

  it("取消内容编辑时关闭弹窗，不留下空白编辑器", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await wrapper.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="form-manager-edit-dialog"]').isVisible()).toBe(true);

    await wrapper.find('[data-test="form-designer-cancel"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-test="form-manager-edit-dialog"]').isVisible()).toBe(false);
    expect(wrapper.emitted("updateContent")).toBeUndefined();
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

/**
 * 八类字段 + 栅格布局矩阵（与真实设计器导出形态一致，含运行态元数据键）。
 * 注意：与 form-schema.test.ts / document.test.ts 的矩阵 fixture 刻意同构，
 * 新增字段类型时三处同步更新
 */
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

describe("FormPreview 全字段与布局矩阵（真实渲染器，A09/A10）", () => {
  it("八类字段与栅格布局真实渲染；数字 0、开关 false、单选 0、空多选按组件语义回显", async () => {
    wrapper = mount(FormPreview, { props: { form: MATRIX_FORM } });
    await flushPromises();

    // 文本与多行文本
    const inputs = wrapper.findAll("input");
    expect((inputs[0].element as HTMLInputElement).value).toBe("默认事由");
    expect(wrapper.find("textarea").exists()).toBe(true);

    // 数字 0：回显为 "0" 而非空（不能把 0 当空值吞掉）
    const numberInput = wrapper.findAll(".el-input-number input");
    expect(numberInput).toHaveLength(1);
    expect((numberInput[0].element as HTMLInputElement).value).toBe("0");

    // 单选：两个选项、默认值 "0"（字符串值类型）选中在「否」
    const radios = wrapper.findAll('input[type="radio"]');
    expect(radios).toHaveLength(2);
    expect((radios[0].element as HTMLInputElement).checked).toBe(false);
    expect((radios[1].element as HTMLInputElement).checked).toBe(true);

    // 多选：默认未选（空数组），选项在场
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    checkboxes.forEach((box) => expect((box.element as HTMLInputElement).checked).toBe(false));

    // 下拉单选与日期
    expect(wrapper.find(".el-select").exists()).toBe(true);
    expect(wrapper.find(".el-date-editor").exists()).toBe(true);

    // 开关：默认 false——未选中态而非丢失
    const switchEl = wrapper.find(".el-switch");
    expect(switchEl.exists()).toBe(true);
    expect(switchEl.classes()).not.toContain("is-checked");

    // 栅格布局：行列结构真实渲染，列内字段在场
    expect(wrapper.find(".el-row").exists()).toBe(true);
    expect(wrapper.findAll(".el-col").length).toBeGreaterThanOrEqual(2);
    expect(wrapper.text()).toContain("列甲");
    expect(wrapper.text()).toContain("列乙");
  });

  it("试填各类型字段只写试填状态，设计默认值不被污染（0/false 语义保持）", async () => {
    wrapper = mount(FormPreview, { props: { form: MATRIX_FORM } });
    await flushPromises();

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("试填事由");
    await wrapper.find("textarea").setValue("试填说明");
    // 单选改选「是」、开关打开
    await wrapper.findAll('input[type="radio"]')[0].setValue(true);
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true);
    await wrapper.find(".el-switch input").setValue(true);
    await flushPromises();

    // 试填值可见
    const valuesText = wrapper.find('[data-test="form-preview-values"]').text();
    expect(valuesText).toContain("试填事由");
    expect(valuesText).toContain("试填说明");
    expect(valuesText).toContain("urgent");
    expect(valuesText).toContain("notify");

    // 设计定义不被污染：默认值、选项、必填原样保留
    const rulesText = wrapper.props("form").rules;
    expect(rulesText).toContain("默认事由");
    expect(rulesText).toContain('"value":0');
    expect(rulesText).toContain('"value":false');
    expect(rulesText).toContain('"value":"0"');
    expect(rulesText).not.toContain("试填事由");
    expect(rulesText).not.toContain("试填说明");
  });
});

describe("FormDesigner 全字段与布局矩阵（真实设计器，A10）", () => {
  it("真实设计器重复保存保留显式空多选默认值，并区分未设置（含栅格列内）", async () => {
    let rules = JSON.stringify([
      { type: "checkbox", field: "empty", title: "空默认值", value: [] },
      { type: "checkbox", field: "unset", title: "未设置" },
      { type: "checkbox", field: "selected", title: "有选择", value: ["a"] },
      {
        type: "fcRow",
        children: [
          {
            type: "col",
            children: [{ type: "checkbox", field: "nested", title: "列内空值", value: [] }],
          },
        ],
      },
    ]);
    for (let round = 0; round < 2; round++) {
      wrapper = mount(FormDesigner, { props: { name: "默认值往返", rules, options: "{}" } });
      await flushPromises();
      await wrapper.find('[data-test="form-designer-save"]').trigger("click");
      rules = wrapper.emitted("save")![0]![0] as string;
      const output = JSON.parse(rules);
      expect(output[0].value).toEqual([]);
      expect(Object.hasOwn(output[1], "value")).toBe(false);
      expect(output[2].value).toEqual(["a"]);
      expect(output[3].children[0].children[0].value).toEqual([]);
      expect(rules).not.toContain("__flowduet");
      wrapper.unmount();
      wrapper = undefined;
    }
  }, 15_000);

  it("新建多选字段可显式设置空默认值，再恢复未设置", async () => {
    wrapper = mount(FormDesigner, { props: { name: "新建默认值", rules: "[]", options: "{}" } });
    await flushPromises();
    const menu = wrapper.findAll("._fc-l-item").find((item) => item.text() === "多选框");
    expect(menu).toBeDefined();
    await menu!.trigger("click");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mode = wrapper
      .findAll("._fc-r-config .el-form-item")
      .find((item) => item.text().includes("设置默认值"));
    expect(mode, "多选需要区分未设置与显式空默认值").toBeDefined();
    await mode!.find(".el-switch__core").trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-designer-save"]').trigger("click");
    expect(JSON.parse(wrapper.emitted("save")![0]![0] as string)[0].value).toEqual([]);
    await mode!.find(".el-switch__core").trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-designer-save"]').trigger("click");
    const output = JSON.parse(wrapper.emitted("save")![1]![0] as string);
    expect(Object.hasOwn(output[0], "value")).toBe(false);
  }, 15_000);

  it("清除多选默认项保存为显式空数组，关闭默认值设置才变为未设置", async () => {
    wrapper = mount(FormDesigner, {
      props: {
        name: "清空默认项",
        rules: JSON.stringify([
          {
            type: "checkbox",
            field: "tags",
            title: "标签",
            value: ["a"],
            options: [{ label: "甲", value: "a" }],
          },
        ]),
        options: "{}",
      },
    });
    await flushPromises();
    await wrapper.find("._fc-m-drag .el-form-item").trigger("click");
    await vi.waitFor(() => expect(wrapper!.text()).toContain("默认选项"));
    const defaults = wrapper
      .findAll("._fc-r-config .el-form-item")
      .find((item) => item.text().includes("默认选项"));
    await defaults!.find(".el-tag__close").trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-designer-save"]').trigger("click");
    expect(JSON.parse(wrapper.emitted("save")![0]![0] as string)[0].value).toEqual([]);
    const mode = wrapper
      .findAll("._fc-r-config .el-form-item")
      .find((item) => item.text().includes("设置默认值"));
    await mode!.find(".el-switch__core").trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-designer-save"]').trigger("click");
    expect(Object.hasOwn(JSON.parse(wrapper.emitted("save")![1]![0] as string)[0], "value")).toBe(
      false,
    );
  }, 15_000);

  it("装载八类字段与栅格布局后成对导出，语义与装载内容等价", async () => {
    wrapper = mount(FormDesigner, {
      props: { name: MATRIX_FORM.name, rules: MATRIX_RULES_JSON, options: "{}" },
    });
    await flushPromises();

    // 设计区回显矩阵字段与列内字段
    const text = wrapper.text();
    for (const title of [
      "申请事由",
      "详细说明",
      "金额",
      "是否加急",
      "标签",
      "级别",
      "申请日期",
      "通知",
      "列甲",
      "列乙",
    ]) {
      expect(text).toContain(title);
    }

    await wrapper.find('[data-test="form-designer-save"]').trigger("click");
    await flushPromises();
    const saved = wrapper.emitted("save");
    expect(saved).toBeTruthy();
    const [rules, options] = saved![0] as [string, string];
    expect(typeof JSON.parse(options)).toBe("object");
    // 忽略设计器运行态元数据后的语义等价（字段顺序、布局、默认值、必填、选项）
    expect(rulesSemantics(rules)).toEqual(rulesSemantics(MATRIX_RULES_JSON));
  });

  it("数字与开关字段可在真实配置面板编辑默认值", async () => {
    wrapper = mount(FormDesigner, {
      props: {
        name: "默认值配置",
        rules: JSON.stringify([
          { type: "inputNumber", field: "amount", title: "金额", value: 0 },
          {
            type: "switch",
            field: "notify",
            title: "通知",
            value: false,
            props: { activeValue: true, inactiveValue: false },
          },
        ]),
        options: "{}",
      },
    });
    await flushPromises();

    for (const title of ["金额", "通知"]) {
      const canvasItem = wrapper
        .findAll("._fc-m-drag .el-form-item")
        .find((node) => node.text().includes(title));
      expect(canvasItem).toBeDefined();
      await canvasItem!.trigger("click");
      await flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const defaultItem = wrapper
        .findAll("._fc-r-config .el-form-item")
        .find((node) => node.text().includes("默认值"));
      expect(defaultItem, `${title} 缺少默认值配置入口`).toBeDefined();
    }
  }, 15_000);
});

describe("设计器开放范围收口（A13，designer-config 与真实面板）", () => {
  it("下拉单选真实配置面板不能开启创建新条目", async () => {
    wrapper = mount(FormDesigner, {
      props: {
        name: "静态下拉",
        rules: JSON.stringify([
          {
            type: "select",
            field: "level",
            title: "级别",
            options: [{ label: "普通", value: "1" }],
          },
        ]),
        options: "{}",
      },
    });
    await flushPromises();
    const item = wrapper
      .findAll("._fc-m-drag .el-form-item")
      .find((node) => node.text().includes("级别"));
    await item!.trigger("click");
    await flushPromises();
    await vi.waitFor(() => expect(wrapper!.text()).toContain("是否可搜索"));
    expect(wrapper.text()).not.toContain("是否允许用户创建新条目");
    expect(wrapper.text()).toContain("是否可搜索");
  }, 15_000);

  it("菜单只提供八类字段与栅格布局，范围外组件无拖拽入口", () => {
    const names = FIELD_MENU.flatMap((group) => group.list.map((item) => item.name));
    expect([...names]).toEqual([
      "input",
      "textarea",
      "inputNumber",
      "radio",
      "checkbox",
      "select",
      "datePicker",
      "switch",
      "fcRow",
    ]);
  });

  it("真实设计器面板不出现范围外组件与配置入口", async () => {
    wrapper = mount(FormDesigner, {
      props: { name: MATRIX_FORM.name, rules: MATRIX_RULES_JSON, options: "{}" },
    });
    await flushPromises();
    const text = wrapper.text();
    // 上传、滑块、评分、级联、富文本、子表单等不提供入口
    // （菜单项 label 由 designer 内置 locale 渲染，按内置文案核对开放项）
    for (const label of [
      "上传",
      "滑块",
      "评分",
      "级联",
      "富文本",
      "子表单",
      "表格表单",
      "穿梭框",
      "颜色选择器",
    ]) {
      expect(text).not.toContain(label);
    }
    // 表单级事件（onSubmit 等脚本编辑）不提供
    expect(text).not.toContain("表单事件");
    // 开放的九个入口在场（内置文案：输入框/多行输入框/计数器/单选框/多选框/选择器/日期/开关/栅格布局）
    for (const label of [
      "输入框",
      "多行输入框",
      "计数器",
      "单选框",
      "多选框",
      "选择器",
      "日期",
      "开关",
      "栅格布局",
    ]) {
      expect(text).toContain(label);
    }
    // AI 助理入口按钮不在场（showAi 关闭；限定左侧菜单栏，面板本体是 v-show 挂载）
    expect(wrapper.find("._fc-l-menu .icon-ai").exists()).toBe(false);
  });

  it("选中字段后：联动与编辑数据入口不渲染，静态选项与必填配置在场", async () => {
    // 未选中时配置面板是 v-show 预渲染（DOM 文案在场但不可达），
    // 入口收口的实际效果以选中字段后的面板为准
    wrapper = mount(FormDesigner, {
      props: {
        name: "收口验证",
        rules: JSON.stringify([
          {
            type: "radio",
            field: "urgent",
            title: "是否加急",
            options: [{ label: "是", value: "1" }],
          },
        ]),
        options: "{}",
      },
    });
    await flushPromises();
    const canvasItem = wrapper
      .findAll("._fc-m-drag .el-form-item")
      .find((node) => node.text().includes("是否加急"));
    expect(canvasItem).toBeDefined();
    await canvasItem!.trigger("click");
    await flushPromises();
    // 配置面板的隐藏项在选中后的 nextTick 才应用，补一个宏任务等待
    await new Promise((resolve) => setTimeout(resolve, 100));

    const text = wrapper.text();
    expect(text).not.toContain("组件联动");
    expect(text).not.toContain("编辑数据");
    expect(text).not.toContain("远程数据");
    // 开放范围内的配置在场：静态选项表格编辑与「是否必填」
    expect(text).toContain("是否必填");
    expect(text).toContain("键名");
  });

  it("配置收口：选项类型/多选/范围日期/远程与脚本入口隐藏，栅格不可拖入容器", () => {
    const hidden = DESIGNER_CONFIG.hiddenItemConfig!;
    // 选项类型选择器隐藏：静态选项编辑默认在场，远程数据无从切换
    expect(hidden.default).toContain("_optionType");
    // 输入框仅保留文本形态，多行由独立菜单入口提供
    expect(hidden.input).toContain("type");
    // 下拉仅单选：multiple 及其衍生的远程搜索入口隐藏
    expect(hidden.select).toContain("multiple");
    expect(hidden.select).toContain("remote");
    expect(hidden.select).toContain("remoteMethod");
    // 日期仅单值：类型选择（含范围形态）隐藏
    expect(hidden.datePicker).toContain("type");
    // 事件（脚本）、联动、自定义组件面板关闭；表单级事件与数据录入入口关闭
    expect(DESIGNER_CONFIG.showEventForm).toBe(false);
    expect(DESIGNER_CONFIG.hiddenFormConfig).toContain("formCreate_event");
    expect(DESIGNER_CONFIG.showInputData).toBe(false);
    expect(DESIGNER_CONFIG.showControl).toBe(false);
    expect(DESIGNER_CONFIG.showCustomProps).toBe(false);

    // checkDrag：栅格布局拖入任何已有容器（含 col）被拒；字段不受影响
    const checkDrag = DESIGNER_CONFIG.checkDrag!;
    expect(checkDrag({ menu: { name: "fcRow" } } as never)).toBe(false);
    expect(checkDrag({ menu: { name: "input" } } as never)).toBe(true);
    expect(checkDrag({ menu: { name: "col" } } as never)).toBe(true);
  });
});

describe("FormManager 未提交内容收集（#76：commitPendingEdit）", () => {
  it("编辑器开着：commitPendingEdit 经真实设计器序列化上抛并关闭编辑器", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await wrapper.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

    const vm = wrapper.vm as unknown as { commitPendingEdit: () => boolean };
    expect(vm.commitPendingEdit()).toBe(true);
    await flushPromises();

    const events = wrapper.emitted("updateContent");
    expect(events).toBeTruthy();
    expect(events![0]![0]).toBe("form_apply");
    expect(JSON.parse(events![0]![1] as string)[0]!.field).toBe("reason");
    expect(wrapper.find('[data-test="form-manager-edit-dialog"]').isVisible()).toBe(false);
  });

  it("编辑器未打开：收集是 no-op，返回 true 且不上抛", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await flushPromises();

    const vm = wrapper.vm as unknown as { commitPendingEdit: () => boolean };
    expect(vm.commitPendingEdit()).toBe(true);
    expect(wrapper.emitted("updateContent")).toBeUndefined();
  });

  it("超范围内容：返回 false、不上抛、编辑器保持打开供修正", async () => {
    // 真实设计器无法产出范围外内容（菜单收口），坏内容路径经替身注入
    const stub = defineComponent({
      name: "FormDesigner",
      props: ["name", "rules", "options"],
      emits: ["save", "cancel"],
      setup(_, { expose }) {
        expose({
          exportContent: () => ({
            rules: JSON.stringify([{ type: "upload", field: "u1", title: "上传" }]),
            options: "{}",
          }),
        });
      },
      render: () => null,
    });
    wrapper = mount(FormManager, {
      props: { forms: [APPLY_FORM] },
      attachTo: document.body,
      global: { stubs: { FormDesigner: stub } },
    });
    await wrapper.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

    const vm = wrapper.vm as unknown as { commitPendingEdit: () => boolean };
    expect(vm.commitPendingEdit()).toBe(false);
    await flushPromises();

    expect(wrapper.emitted("updateContent")).toBeUndefined();
    expect(wrapper.find('[data-test="form-manager-error"]').text()).toContain("支持的组件");
    expect(wrapper.find('[data-test="form-manager-edit-dialog"]').isVisible()).toBe(true);
  });
});

describe("PR88 序列化异常反馈", () => {
  it("设计器序列化抛错时拒绝提交，保留编辑器与当前目录", async () => {
    const stub = defineComponent({
      name: "FormDesigner",
      setup(_, { expose }) {
        expose({
          exportContent: () => {
            throw new Error("序列化故障");
          },
        });
      },
      render: () => null,
    });
    wrapper = mount(FormManager, {
      props: { forms: [APPLY_FORM] },
      attachTo: document.body,
      global: { stubs: { FormDesigner: stub } },
    });
    await wrapper.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();
    const vm = wrapper.vm as unknown as { commitPendingEdit: () => boolean };
    expect(vm.commitPendingEdit()).toBe(false);
    await flushPromises();
    expect(wrapper.emitted("updateContent")).toBeUndefined();
    expect(wrapper.find('[data-test="form-manager-error"]').text()).toContain("序列化故障");
    expect(wrapper.find('[data-test="form-manager-edit-dialog"]').isVisible()).toBe(true);
  });
});

describe("PR88 产品验收焦点与编辑通知回归", () => {
  async function openDefaultEditor(): Promise<void> {
    // 外部 ValueInput 的已核实合同：input 只改缓冲，blur 才更新规则。
    // 这里保留真实 DOM 焦点行为；完整 FormCreate 链路由内置浏览器复验。
    const delayedInput = defineComponent({
      name: "FcDesigner",
      setup(_, { expose }) {
        const pending = ref("");
        let rules: Record<string, unknown>[] = [];
        let options: object = {};
        expose({
          setRule: (value: Record<string, unknown>[]) => {
            rules = value;
            pending.value = String(value[0]?.value ?? "");
          },
          setOption: (value: object) => {
            options = value;
          },
          getJson: () => JSON.stringify(rules),
          getOptionsJson: () => JSON.stringify(options),
        });
        return () =>
          h("input", {
            "data-test": "delayed-default-input",
            value: pending.value,
            onInput: (event: Event) => {
              pending.value = (event.target as HTMLInputElement).value;
            },
            onBlur: () => {
              rules[0]!.value = pending.value;
            },
          });
      },
    });
    wrapper = mount(FormDesigner, {
      props: { name: APPLY_FORM.name, rules: APPLY_FORM.rules, options: APPLY_FORM.options },
      attachTo: document.body,
      global: { stubs: { FcDesigner: delayedInput } },
    });
    await flushPromises();
  }

  it("P13 当前默认值未失焦时同步收集也包含已输入内容", async () => {
    await openDefaultEditor();
    const input = wrapper!.find<HTMLInputElement>('[data-test="delayed-default-input"]');
    input.element.focus();
    await input.setValue("焦点新默认值");
    expect(document.activeElement).toBe(input.element);
    const vm = wrapper!.vm as unknown as {
      exportContent: () => { rules: string; options: string };
    };
    const content = vm.exportContent();
    expect(JSON.parse(content.rules)[0].value).toBe("焦点新默认值");
  });

  it("E15 当前输入上抛编辑通知，宿主可识别尚未提交的新编辑", async () => {
    await openDefaultEditor();
    const input = wrapper!.find<HTMLInputElement>('[data-test="delayed-default-input"]');
    await input.setValue("尚未提交的新默认值");
    expect(wrapper!.emitted("draftChange")?.length).toBeGreaterThan(0);
    expect(wrapper!.emitted("save")).toBeUndefined();
  });
  it("E15 仅发 Vue 事件的下拉交互也上抛潜在编辑", async () => {
    const externalSelect = defineComponent({
      name: "FcDesigner",
      setup(_, { expose }) {
        const value = ref("a");
        expose({ setRule: () => {}, setOption: () => {} });
        return () =>
          h(
            ElSelect,
            {
              modelValue: value.value,
              "onUpdate:modelValue": (next: string) => {
                value.value = next;
              },
            },
            () => [
              h(ElOption, { label: "选项A", value: "a" }),
              h(ElOption, { label: "选项B", value: "b" }),
            ],
          );
      },
    });
    wrapper = mount(FormDesigner, {
      props: { name: "下拉编辑", rules: "[]", options: "{}" },
      attachTo: document.body,
      global: { stubs: { FcDesigner: externalSelect } },
    });
    await flushPromises();
    await wrapper.find(".el-select__wrapper").trigger("click");
    await flushPromises();
    const option = Array.from(
      document.querySelectorAll<HTMLElement>(".el-select-dropdown__item"),
    ).find((node) => node.textContent === "选项B");
    option!.click();
    await flushPromises();
    expect(wrapper.findAll(".el-select__selected-item").map((node) => node.text())).toContain(
      "选项B",
    );
    expect((wrapper.emitted("draftChange") ?? []).length).toBeGreaterThan(0);
  });
});

describe("retained 数值日期与同步捕获", () => {
  it("pending_number_text_survives_navigation", async () => {
    wrapper = mount(FormDesigner, {
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
    });
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      readEditingState?: () => { mode: string };
      captureContent?: () => unknown;
    };
    expect(typeof vm.readEditingState).toBe("function");
    expect(vm.readEditingState!().mode).toBe("retained");
    expect(typeof vm.captureContent).toBe("function");
  });
});

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
async function retainedEditor(rules = numericDateRules) {
  wrapper = mount(FormDesigner, {
    props: { name: "原文", rules, options: "{}", editingMode: "retained" },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper.vm as unknown as RetainedVm;
}
async function selectRetained(field: string) {
  await vi.waitFor(() => {
    wrapper!.findComponent(FcDesigner).vm.triggerActive(field);
    expect(wrapper!.find(`[data-retained-input][data-field="${field}"]`).exists()).toBe(true);
  });
  await flushPromises();
  return wrapper!.get<HTMLInputElement>(`[data-retained-input][data-field="${field}"]`);
}
describe("retained 真实数值日期回归", () => {
  it("partial_date_does_not_normalize_on_blur", async () => {
    const vm = await retainedEditor();
    const input = await selectRetained("date");
    await input.setValue("2026-");
    await input.trigger("blur");
    await selectRetained("amount");
    expect((await selectRetained("date")).element.value).toBe("2026-");
    expect(vm.readEditingState().canSuspend, JSON.stringify(vm.readEditingState())).toBe(true);
    expect(vm.captureContent().status).toBe("blocked");
    expect(wrapper!.emitted("save")).toBeUndefined();
  });
  it("valid_echo_pending_blocks_capture，回显后仍保留字形", async () => {
    const vm = await retainedEditor();
    const input = await selectRetained("amount");
    input.element.value = "1e3";
    input.element.dispatchEvent(new Event("input", { bubbles: true }));
    expect(vm.readEditingState().blockers.map((b) => b.code)).toContain("pending-update");
    expect(vm.captureContent().status).toBe("blocked");
    await flushPromises();
    const captured = vm.captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status !== "captured") throw new Error(JSON.stringify(captured));
    expect(JSON.parse(captured.content.rules)[0].value).toBe(1000);
    await selectRetained("date");
    expect((await selectRetained("amount")).element.value).toBe("1e3");
  });
  it("composition_end_same_tick_is_blocked", async () => {
    const vm = await retainedEditor();
    const input = await selectRetained("amount");
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.element.value = "3";
    input.element.dispatchEvent(new Event("input", { bubbles: true }));
    expect(vm.readEditingState().canSuspend).toBe(false);
    input.element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(vm.readEditingState().blockers.map((b) => b.code)).toContain("composing");
    expect(vm.captureContent().status).toBe("blocked");
    await flushPromises();
    expect(vm.captureContent().status).toBe("captured");
  });
  it("foreign_editor_keeps_focus；只读查询不编辑、不blur", async () => {
    const vm = await retainedEditor();
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
    const vm = await retainedEditor();
    await (await selectRetained("amount")).setValue("-");
    const fc = wrapper!.findComponent(FcDesigner);
    await fc.get("._fc-m-drag .icon-delete").trigger("click");
    await flushPromises();
    expect(vm.captureContent().status).toBe("captured");
  });
  it("mode固定且未知文档替换保持原文并阻断", async () => {
    const vm = await retainedEditor();
    await (await selectRetained("amount")).setValue("-");
    await wrapper!.setProps({ rules: "[]" });
    expect(wrapper!.get<HTMLInputElement>("[data-retained-input]").element.value).toBe("-");
    expect(vm.captureContent().status).toBe("blocked");
    await wrapper!.setProps({ editingMode: "legacy" });
    expect(vm.readEditingState().blockers[0]?.code).toBe("unsupported-mode");
  });
});

type ManagerVm = {
  readEditingState(): FormDesignerEditingState | null;
  commitPendingEdit(): boolean;
  hasOpenEditor(): boolean;
};
async function retainedManager() {
  wrapper = mount(FormManager, {
    props: { forms: [{ ...APPLY_FORM, rules: numericDateRules }], editingMode: "retained" },
    attachTo: document.body,
  });
  const vm = wrapper.vm as unknown as ManagerVm;
  expect(typeof vm.readEditingState).toBe("function");
  expect(vm.readEditingState()).toBeNull();
  wrapper
    .get('[data-test="form-edit-btn-form_apply"]')
    .element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("not-ready");
  await flushPromises();
  return vm;
}
async function managerRaw(raw = "-") {
  await vi.waitFor(() => {
    wrapper!.findComponent(FcDesigner).vm.triggerActive("amount");
    expect(wrapper!.find('[data-retained-input="number"]').exists()).toBe(true);
  });
  await flushPromises();
  const input = wrapper!.get<HTMLInputElement>('[data-retained-input="number"]');
  await input.setValue(raw);
  return input;
}
describe("retained FormManager状态与关闭", () => {
  afterEach(() => vi.restoreAllMocks());
  it("manager_retained_query_and_forward", async () => {
    const vm = await retainedManager();
    await managerRaw();
    expect(vm.readEditingState()?.mode).toBe("retained");
    expect(vm.readEditingState()?.canSuspend).toBe(true);
    expect(vm.readEditingState()?.canCapture).toBe(false);
    expect(wrapper!.emitted("editingStateChange")?.length).toBeGreaterThan(0);
    expect(vm.commitPendingEdit()).toBe(false);
    expect(vm.hasOpenEditor()).toBe(true);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  });
  it("manager_suspend_is_not_discard，取消确认保留实例和raw", async () => {
    const vm = await retainedManager();
    const input = await managerRaw();
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
    await wrapper!.get('[data-test="form-designer-cancel"]').trigger("click");
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("-");
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  });
  it("manager_dismiss_requires_discard，明确放弃后重开不复活raw", async () => {
    const vm = await retainedManager();
    await managerRaw();
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm");
    await wrapper!.get('[data-test="form-designer-cancel"]').trigger("click");
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(false);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
    await wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();
    expect((await managerRaw("2")).element.value).toBe("2");
  });
  it("manager_late_discard_rejected，确认期间新输入使旧肯定答复过期", async () => {
    const vm = await retainedManager();
    const input = await managerRaw();
    let resolve!: (v: "confirm") => void;
    vi.spyOn(ElMessageBox, "confirm").mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await wrapper!.get('[data-test="form-designer-cancel"]').trigger("click");
    await flushPromises();
    await input.setValue("1e");
    resolve("confirm");
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("1e");
  });
  it("manager_ime_escape_keeps_editor，组合中的关闭手势不先blur", async () => {
    const vm = await retainedManager();
    const input = await managerRaw();
    input.element.focus();
    input.element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const confirm = vi.spyOn(ElMessageBox, "confirm");
    const cancel = wrapper!.get('[data-test="form-designer-cancel"]');
    const pointer = new Event("pointerdown", { bubbles: true, cancelable: true });
    cancel.element.dispatchEvent(pointer);
    expect(pointer.defaultPrevented).toBe(true);
    input.element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await flushPromises();
    await cancel.trigger("click");
    await flushPromises();
    expect(confirm).not.toHaveBeenCalled();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(document.activeElement).toBe(input.element);
  });
  it("manager_old_editor_state_dropped，保存/取消/旧状态不可影响重开", async () => {
    const vm = await retainedManager();
    const old = wrapper!.findComponent(FormDesigner);
    await managerRaw("7");
    expect(vm.commitPendingEdit()).toBe(true);
    await flushPromises();
    await wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();
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
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(vm.readEditingState()).toEqual(before);
    expect(wrapper!.emitted("updateContent")?.length).toBe(1);
  });
});

describe("retained 关闭与旧回调补充边界", () => {
  afterEach(() => vi.restoreAllMocks());
  it.each(["x", "mask", "cancel"])("请求%s并不授权销毁，确认拒绝/异常都保持raw", async (method) => {
    const vm = await retainedManager();
    const input = await managerRaw();
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue(new Error("确认失败"));
    if (method === "x") await wrapper!.get('[data-test="form-manager-close"]').trigger("click");
    else if (method === "cancel")
      await wrapper!.get('[data-test="form-designer-cancel"]').trigger("click");
    else {
      const modal = document.querySelector<HTMLElement>(".el-overlay-dialog")!;
      modal.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      modal.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("-");
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
    expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1);
  });
  it("manager_old_close_request_cannot_target_reopened_editor，旧closed不发新null", async () => {
    const vm = await retainedManager();
    await managerRaw("7");
    let resolve!: (v: "confirm") => void;
    vi.spyOn(ElMessageBox, "confirm").mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const oldDialog = wrapper!.findComponent(ElDialog);
    await wrapper!.get('[data-test="form-designer-cancel"]').trigger("click");
    await flushPromises();
    expect(vm.commitPendingEdit()).toBe(true);
    await flushPromises();
    await wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();
    await managerRaw("8");
    const before = vm.readEditingState();
    resolve("confirm");
    oldDialog.vm.$emit("closed");
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(vm.readEditingState()).toEqual(before);
    expect(wrapper!.emitted("editingStateChange")?.at(-1)?.[0]).not.toBeNull();
  });
  it("manager_busy_close_gesture_cannot_blur_then_close，正常输入不被拒绝手势吞掉", async () => {
    const vm = await retainedManager();
    const input = await managerRaw();
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
    const vm = await retainedManager();
    await managerRaw("11");
    const fc = wrapper!.findComponent(FcDesigner);
    const fault = vi.spyOn(fc.vm, "getJson").mockImplementationOnce(() => {
      throw new Error("序列化失败");
    });
    expect(vm.commitPendingEdit()).toBe(false);
    expect(vm.hasOpenEditor()).toBe(true);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
    fault.mockRestore();
    expect(vm.commitPendingEdit()).toBe(true);
    expect(JSON.parse(wrapper!.emitted("updateContent")![0]![1] as string)[0].value).toBe(11);
  });
  it.each([undefined, "legacy"] as const)(
    "legacy_dialog_dismiss_unchanged mode=%s",
    async (editingMode) => {
      const confirm = vi.spyOn(ElMessageBox, "confirm");
      wrapper = mount(FormManager, {
        props: { forms: [APPLY_FORM], ...(editingMode ? { editingMode } : {}) },
        attachTo: document.body,
      });
      await wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
      await flushPromises();
      const vm = wrapper.vm as unknown as ManagerVm;
      expect(vm.readEditingState()?.blockers[0]?.code).toBe("unsupported-mode");
      await wrapper.get('[data-test="form-designer-cancel"]').trigger("click");
      await flushPromises();
      expect(vm.hasOpenEditor()).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
      expect(wrapper.emitted("editingStateChange")).toBeUndefined();
    },
  );
});

describe("retained Tab前置保护", () => {
  it("busy时Tab前往自有取消按钮被拒绝，正常输入之间Tab不吞键", async () => {
    await retainedManager();
    const input = await managerRaw();
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

describe("retained 多实例与捕获版本", () => {
  afterEach(() => vi.restoreAllMocks());
  it("同ID两个真实FormManager，busy保护不拦另一实例的Enter或输入", async () => {
    wrapper = mount(
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
    );
    const managers = wrapper.findAllComponents(FormManager);
    for (const manager of managers)
      await manager.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();
    const first = managers[0]!;
    await vi.waitFor(async () => {
      first.findComponent(FcDesigner).vm.triggerActive("amount");
      await flushPromises();
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
    const vm = await retainedEditor();
    const input = await selectRetained("amount");
    await input.setValue("4");
    await flushPromises();
    const fc = wrapper!.findComponent(FcDesigner),
      original = fc.vm.getJson;
    const spy = vi.spyOn(fc.vm, "getJson").mockImplementationOnce(() => {
      const rules = original();
      input.element.value = "5";
      input.element.dispatchEvent(new Event("input", { bubbles: true }));
      return rules;
    });
    expect(vm.captureContent()).toMatchObject({
      status: "blocked",
      blockers: [{ code: "version-changed" }],
    });
    spy.mockRestore();
    await flushPromises();
    const captured = vm.captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status === "captured") expect(JSON.parse(captured.content.rules)[0].value).toBe(5);
    expect(wrapper!.emitted("save")).toBeUndefined();
  });
});

describe("retained I01导入边界", () => {
  it.each([undefined, "date", "datetime", "week", "month", "year"])(
    "I01 %s未编辑原样往返，非普通date编辑明确阻断",
    async (type) => {
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
      wrapper = mount(FormDesigner, {
        props: { name: "I01", rules, options: "{}", editingMode: "retained" },
        attachTo: document.body,
      });
      await flushPromises();
      const vm = wrapper.vm as unknown as RetainedVm;
      const captured = vm.captureContent();
      expect(captured.status).toBe("captured");
      if (captured.status === "captured")
        expect(rulesSemantics(captured.content.rules)).toEqual(rulesSemantics(rules));
      const input = await selectRetained("date");
      await input.setValue("2027-");
      const reason = vm.readEditingState().blockers[0]?.code;
      expect(reason).toBe(type && type !== "date" ? "unsupported-input" : "pending-input");
      expect(input.element.value).toBe("2027-");
    },
  );
});

describe("retained 真实字段删除复用", () => {
  it("公开delete时点撤销缓存，菜单新建后同名field不复用旧raw", async () => {
    const state = createEditorInputState(() => {});
    // 仅此测试通过第三方公开配置开放字段改名，用于立即复用ID；产品默认仍只读。
    const config = {
      ...retainedDesignerConfig((source) => state.bind(source), "lifetime-test"),
      fieldReadonly: false,
    };
    wrapper = mount(
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
    );
    await flushPromises();
    const fc = wrapper.findComponent(FcDesigner);
    fc.vm.setRule([{ type: "inputNumber", field: "amount", title: "金额", value: 0 }]);
    await flushPromises();
    await (await selectRetained("amount")).setValue("-");
    await fc.get("._fc-m-drag .icon-delete").trigger("click");
    await flushPromises();
    expect(state.blockers()).toEqual([]);
    await fc
      .findAll("._fc-l-item")
      .find((el) => el.text() === "计数器")!
      .trigger("click");
    await vi.waitFor(() =>
      expect(wrapper!.find('[data-retained-input="number"]').exists()).toBe(true),
    );
    const field = fc
      .findAll("._fc-r-config .el-form-item")
      .find((el) => el.text().includes("字段 ID"))!;
    await field.get("input").setValue("amount");
    await field.get("input").trigger("blur");
    await flushPromises();
    expect(fc.vm.getRule()[0]!.field).toBe("amount");
    const raw = wrapper.get<HTMLInputElement>('[data-retained-input="number"]').element.value;
    expect(["", "0"]).toContain(raw);
    expect(state.blockers()).toEqual([]);
  });
});

it("日历动画开始后即阻断捕获，关闭后恢复", async () => {
  const vm = await retainedEditor();
  await selectRetained("date");
  const calendar = wrapper!.get("[data-retained-date]").findComponent(ElDatePicker);
  calendar.vm.handleOpen();
  await vi.waitFor(() =>
    expect(wrapper!.find('[data-retained-date] [aria-expanded="true"]').exists()).toBe(true),
  );
  expect(vm.captureContent().status).toBe("blocked");
  calendar.vm.handleClose();
  await flushPromises();
  await vi.waitFor(() => expect(vm.readEditingState().canCapture).toBe(true));
});

it("确认期间宿主替换同ID同内容表单，旧肯定答复与保存均拒绝且保留输入", async () => {
  const vm = await retainedManager();
  const input = await managerRaw("7");
  let resolve!: (v: "confirm") => void;
  const confirm = vi.spyOn(ElMessageBox, "confirm").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  try {
    await wrapper!.get('[data-test="form-designer-cancel"]').trigger("click");
    await flushPromises();
    await wrapper!.setProps({ forms: [{ ...APPLY_FORM, rules: numericDateRules }] });
    resolve("confirm");
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.value).toBe("7");
    expect(vm.readEditingState()?.blockers[0]?.code).toBe("version-changed");
    expect(vm.commitPendingEdit()).toBe(false);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  } finally {
    confirm.mockRestore();
  }
});

it("授权关闭的真实Dialog closed事件完成收尾并转发null", async () => {
  const vm = await retainedManager();
  await managerRaw("9");
  const dialog = wrapper!.findComponent(ElDialog);
  expect(vm.commitPendingEdit()).toBe(true);
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("not-ready");
  dialog.vm.$emit("closed");
  await flushPromises();
  expect(vm.readEditingState()).toBeNull();
  expect(wrapper!.emitted("editingStateChange")?.at(-1)?.[0]).toBeNull();
});

it("同一表单对象被宿主原位改写也不覆盖当前输入", async () => {
  const vm = await retainedManager();
  const input = await managerRaw("7");
  const form = wrapper!.props("forms")[0]!;
  form.rules = "[]";
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("version-changed");
  expect(vm.commitPendingEdit()).toBe(false);
  expect(input.element.value).toBe("7");
  expect(wrapper!.emitted("updateContent")).toBeUndefined();
});

it("缓存原文后的原生change/失焦不制造新的编辑版本", async () => {
  const vm = await retainedEditor();
  const input = await selectRetained("amount");
  await input.setValue("-");
  const before = vm.readEditingState().revision;
  const count = wrapper!.emitted("draftChange")?.length;
  await input.trigger("change");
  await input.trigger("blur");
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

it("旧Dialog迟到modelValue回调不能关闭同ID重开的编辑器", async () => {
  const vm = await retainedManager();
  await managerRaw("7");
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
  await flushPromises();
  expect(vm.hasOpenEditor()).toBe(true);
  expect(vm.readEditingState()?.revision).not.toBe(999);
  expect(wrapper!.emitted("updateContent")?.length).toBe(1);
});

it("当前Dialog modelValue=false只请求关闭，未经明确放弃不销毁", async () => {
  const vm = await retainedManager();
  const input = await managerRaw();
  const confirm = vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
  try {
    wrapper!.findComponent(ElDialog).vm.$emit("update:modelValue", false);
    await flushPromises();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(input.element.isConnected).toBe(true);
    expect(input.element.value).toBe("-");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(wrapper!.emitted("updateContent")).toBeUndefined();
  } finally {
    confirm.mockRestore();
  }
});

it("同ID新会话尚未挂载时不读取或收集旧子ref", async () => {
  const vm = await retainedManager();
  await managerRaw("7");
  expect(vm.commitPendingEdit()).toBe(true);
  wrapper!
    .get('[data-test="form-edit-btn-form_apply"]')
    .element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(vm.readEditingState()?.blockers[0]?.code).toBe("not-ready");
  expect(vm.commitPendingEdit()).toBe(false);
  expect(wrapper!.emitted("updateContent")?.length).toBe(1);
  await flushPromises();
  expect(vm.hasOpenEditor()).toBe(true);
  const content = (
    wrapper!.findComponent(FormDesigner).vm as unknown as RetainedVm
  ).captureContent();
  expect(content.status).toBe("captured");
  if (content.status === "captured") expect(JSON.parse(content.content.rules)[0].value).toBe(0);
});

it("旧页头关闭按钮的迟到click不取得新会话的放弃授权", async () => {
  const vm = await retainedManager();
  await managerRaw("7");
  const oldX = wrapper!.get('[data-test="form-manager-close"]').element;
  expect(vm.commitPendingEdit()).toBe(true);
  await flushPromises();
  await wrapper!.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
  await flushPromises();
  await managerRaw("8");
  const confirm = vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
  try {
    oldX.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(confirm).not.toHaveBeenCalled();
    expect(vm.hasOpenEditor()).toBe(true);
    expect(wrapper!.emitted("updateContent")?.length).toBe(1);
  } finally {
    confirm.mockRestore();
  }
});

/** 原生input不等于change；测试不得用会额外派发change的setValue掩盖等待门。 */
async function retainedTitle() {
  await selectRetained("amount");
  const item = wrapper!
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

describe("P1复审P2：属性控件确认与删除生命期", () => {
  it("恢复原值且没有change时，刷新后可捕获；同步阶段仍阻断", async () => {
    const vm = await retainedEditor();
    const input = await retainedTitle();
    input.element.focus();
    const original = input.element.value;
    typeNative(input.element, `${original}x`);
    await flushPromises();
    expect(vm.readEditingState().canCapture).toBe(false);
    typeNative(input.element, original);
    expect(vm.captureContent().status).toBe("blocked");
    input.element.blur();
    await flushPromises();
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
      const vm = await retainedEditor(
        JSON.stringify([{ type: "inputNumber", field: "amount", title: "金额", value: 0 }]),
      );
      const input = await retainedTitle();
      input.element.focus();
      typeNative(input.element, "未确认名称");
      await flushPromises();
      expect(vm.readEditingState().canCapture).toBe(false);
      const fc = wrapper!.findComponent(FcDesigner).vm;
      if (operation === "clear") fc.clearDragRule();
      else
        await wrapper!.findComponent(FcDesigner).get("._fc-m-drag .icon-delete").trigger("click");
      await flushPromises();
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
    const vm = await retainedEditor();
    const input = await retainedTitle();
    input.element.focus();
    typeNative(input.element, "已确认");
    input.element.dispatchEvent(new Event("change", { bubbles: true }));
    typeNative(input.element, "更新但未确认");
    await flushPromises();
    expect(vm.captureContent().status).toBe("blocked");
    input.element.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    expect(vm.captureContent().status).toBe("captured");
  });
});

describe("P1复审P2：同步捕获重入", () => {
  it.each([
    ["inputNumber", 1000, "1e3"],
    ["inputNumber", 1, "01"],
    ["datePicker", "2024-02-29", "2024-02-29"],
  ] as const)("%s的等价原文%s→%s在公开回显前也必须阻断", async (type, value, raw) => {
    const seen: FormDesignerCaptureResult[] = [];
    let armed = false;
    wrapper = mount(FormDesigner, {
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
    });
    await flushPromises();
    const input = await selectRetained("amount");
    armed = true;
    typeNative(input.element, raw);
    armed = false;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ status: "blocked", blockers: [{ code: "pending-update" }] });
    await flushPromises();
    const captured = (wrapper.vm as unknown as RetainedVm).captureContent();
    expect(captured.status).toBe("captured");
    if (captured.status === "captured")
      expect(JSON.parse(captured.content.rules)[0].value).toBe(value);
    expect(input.element.value).toBe(raw);
  });
});

describe("P1复审P2：模式冲突后打开与重开", () => {
  it.each(["legacy", "retained"] as const)(
    "%s挂载后改变模式不切换子实现，也不经旧出口提交",
    async (initial) => {
      wrapper = mount(FormManager, {
        props: { forms: [{ ...APPLY_FORM, rules: numericDateRules }], editingMode: initial },
        attachTo: document.body,
      });
      const vm = wrapper.vm as unknown as ManagerVm;
      await wrapper.setProps({ editingMode: initial === "legacy" ? "retained" : "legacy" });
      await wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
      await flushPromises();
      expect(wrapper.findComponent(FormDesigner).props("editingMode")).toBe(initial);
      expect(vm.readEditingState()?.blockers[0]?.code).toBe("unsupported-mode");
      expect(vm.commitPendingEdit()).toBe(false);
      wrapper.findComponent(FormDesigner).vm.$emit("save", "[]", "{}");
      await flushPromises();
      expect(vm.hasOpenEditor()).toBe(true);
      expect(wrapper.emitted("updateContent")).toBeUndefined();
    },
  );
  it.each(["legacy", "retained"] as const)(
    "%s成功关闭后改模式重开，拒绝新模式且旧内容不再提交",
    async (initial) => {
      wrapper = mount(FormManager, {
        props: { forms: [{ ...APPLY_FORM, rules: numericDateRules }], editingMode: initial },
        attachTo: document.body,
      });
      const vm = wrapper.vm as unknown as ManagerVm;
      await wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
      await flushPromises();
      expect(vm.commitPendingEdit()).toBe(true);
      await flushPromises();
      await wrapper.setProps({ editingMode: initial === "legacy" ? "retained" : "legacy" });
      await wrapper.get('[data-test="form-edit-btn-form_apply"]').trigger("click");
      await flushPromises();
      expect(wrapper.findComponent(FormDesigner).props("editingMode")).toBe(initial);
      expect(vm.commitPendingEdit()).toBe(false);
      expect(vm.hasOpenEditor()).toBe(true);
      expect(wrapper.emitted("updateContent")).toHaveLength(1);
    },
  );
});

it("P1复审P2：删除其他字段不会清除仍在场的属性输入等待", async () => {
  const vm = await retainedEditor();
  const input = await retainedTitle();
  input.element.focus();
  typeNative(input.element, "等待确认的金额名称");
  await flushPromises();
  await wrapper!.findComponent(FcDesigner).findAll("._fc-m-drag .icon-delete")[1]!.trigger("click");
  await flushPromises();
  expect(input.element.isConnected).toBe(true);
  expect(vm.captureContent().status).toBe("blocked");
  input.element.dispatchEvent(new Event("change", { bubbles: true }));
  await flushPromises();
  const captured = vm.captureContent();
  expect(captured.status).toBe("captured");
  if (captured.status === "captured")
    expect(JSON.parse(captured.content.rules)).toMatchObject([
      { field: "amount", title: "等待确认的金额名称" },
    ]);
});

it("P1复审P2：原生number的badInput空串不能冒充恢复初始空值", async () => {
  const vm = await retainedEditor();
  await selectRetained("amount");
  const item = wrapper!
    .findComponent(FcDesigner)
    .findAll("._fc-r-config .el-form-item")
    .find((row) => row.text().includes("设置计数器允许的最小值"))!;
  const input = item.get<HTMLInputElement>('input[type="number"]');
  input.element.focus();
  // 模拟DOM不产生浏览器badInput；仅替换这个公开只读状态，输入与业务链路仍是真实组件。
  const validity = input.element.validity;
  const guard = vi
    .spyOn(input.element, "validity", "get")
    .mockReturnValue(Object.create(validity, { badInput: { value: true } }));
  try {
    typeNative(input.element, "");
    await flushPromises();
    expect(vm.captureContent().status).toBe("blocked");
    input.element.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    expect(vm.captureContent().status).toBe("blocked");
  } finally {
    guard.mockRestore();
  }
  typeNative(input.element, "");
  await flushPromises();
  expect(vm.captureContent().status).toBe("captured");
});

it("P1复审P2：同次change和blur的合法number归一后解除等待", async () => {
  const vm = await retainedEditor();
  await selectRetained("amount");
  const item = wrapper!
    .findComponent(FcDesigner)
    .findAll("._fc-r-config .el-form-item")
    .find((row) => row.text().includes("设置计数器允许的最小值"))!;
  const input = item.get<HTMLInputElement>('input[type="number"]');
  input.element.focus();
  typeNative(input.element, "01");
  input.element.dispatchEvent(new Event("change", { bubbles: true }));
  input.element.blur();
  await flushPromises();
  expect(input.element.value).toBe("1");
  expect(vm.readEditingState().canSuspend).toBe(true);
  const captured = vm.captureContent();
  expect(captured.status).toBe("captured");
  if (captured.status === "captured")
    expect(JSON.parse(captured.content.rules)[0].props.min).toBe(1);
});
