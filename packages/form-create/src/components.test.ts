// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import FormPreview from "./components/FormPreview.vue";
import FormManager from "./components/FormManager.vue";
import FormDesigner from "./components/FormDesigner.vue";
import { DESIGNER_CONFIG, FIELD_MENU } from "./components/designer-config.js";
import type { FormDefinition } from "./document.js";
import { rulesSemantics } from "./form-semantics.js";

/**
 * 真实组件链路（#72 / #74）：FormCreate 渲染器实际参与预览与试填校验，
 * 设计器实际参与内容编辑——不 mock 序列化结果（迭代三测试决策）。
 * #74 起覆盖八类字段与栅格布局的全字段矩阵（A09/A10）与开放范围收口（A13）。
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
    const manager = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await manager.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

    // Vue3 emit 不向调用方 rethrow 宿主异常——守卫必须在组件内前置，
    // 否则坏内容会静默关闭编辑器。构造超范围内容经组件实例触发保存。
    const designer = manager.findComponent({ name: "FormDesigner" });
    expect(designer.exists()).toBe(true);
    designer.vm.$emit(
      "save",
      JSON.stringify([{ type: "upload", field: "u1", title: "上传" }]),
      "{}",
    );
    await flushPromises();

    expect(manager.emitted("updateContent")).toBeUndefined();
    expect(manager.find('[data-test="form-manager-error"]').text()).toContain("支持的组件");
    expect(manager.find('[data-test="form-manager-edit-dialog"]').exists()).toBe(true);
    manager.unmount();
  });

  it("重复字段标识不能关闭编辑器或上报保存", async () => {
    wrapper = mount(FormManager, { props: { forms: [APPLY_FORM] }, attachTo: document.body });
    await wrapper.find('[data-test="form-edit-btn-form_apply"]').trigger("click");
    await flushPromises();

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
