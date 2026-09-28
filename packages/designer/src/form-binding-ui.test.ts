// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import DingtalkDesigner from "./components/DingtalkDesigner.vue";
import type { DesignerFormOption } from "./form-options.js";

/**
 * 表单集成模式 UI（#72）：中立选项驱动——默认表单选择条、审批节点有效表单
 * 摘要（继承/节点指定/失效）；不传 formOptions 时原有纯流程形态完全不变。
 */

let wrapper: ReturnType<typeof mount> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

const FORM_OPTIONS: readonly DesignerFormOption[] = [
  { id: "form_apply", name: "申请单" },
  { id: "form_review", name: "复核单" },
];

function buildModel(): BpmnModel {
  return BpmnModel.create({ processId: "form_ui_flow", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "solo", name: "经理审批", assignee: "${manager}" })
    .addApprovalTask({ id: "counter", name: "部门会签", collection: "approvers", mode: "all" })
    .addTask("cc", { id: "cc_1", name: "抄送备案", recipients: "张三" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "solo" })
    .addSequenceFlow({ id: "f2", sourceRef: "solo", targetRef: "counter" })
    .addSequenceFlow({ id: "f3", sourceRef: "counter", targetRef: "cc_1" })
    .addSequenceFlow({ id: "f4", sourceRef: "cc_1", targetRef: "end" });
}

function mountDesigner(model: BpmnModel, withForms = true): ReturnType<typeof mount> {
  return mount(DingtalkDesigner, {
    props: withForms ? { model, formOptions: FORM_OPTIONS } : { model },
    attachTo: document.body,
  });
}

describe("纯流程模式兼容（不传 formOptions）", () => {
  it("无默认表单条与表单行，原有使用方式不变", async () => {
    wrapper = mountDesigner(buildModel(), false);
    await flushPromises();
    expect(wrapper.find('[data-test="default-form-bar"]').exists()).toBe(false);
    expect(wrapper.find('[data-test^="node-form-"]').exists()).toBe(false);
  });
});

describe("默认表单选择条", () => {
  it("选择默认表单写入 model 并触发 change；切回「无」清除引用", async () => {
    const model = buildModel();
    wrapper = mountDesigner(model);
    await flushPromises();

    const select = wrapper.find('[data-test="default-form-select"]');
    await select.setValue("form_apply");
    expect(model.defaultFormKey).toBe("form_apply");
    expect(wrapper.emitted("change")).toBeTruthy();

    await select.setValue("");
    expect(model.defaultFormKey).toBeUndefined();
  });
});

describe("审批节点有效表单摘要", () => {
  it("默认继承与节点指定各自标注；修改默认只影响继承节点", async () => {
    const model = buildModel();
    model.setDefaultFormKey("form_apply");
    model.elementOf("solo").set("formKey", "form_review");
    wrapper = mountDesigner(model);
    await flushPromises();

    // 显式覆盖节点：节点指定，不随默认变化
    expect(wrapper.find('[data-test="node-form-solo"]').text()).toContain("复核单");
    expect(wrapper.find('[data-test="node-form-solo"]').text()).toContain("节点指定");
    // 多实例继承节点：继承默认
    expect(wrapper.find('[data-test="node-form-counter"]').text()).toContain("申请单");
    expect(wrapper.find('[data-test="node-form-counter"]').text()).toContain("继承默认");

    // 网关与抄送不参与解析：无表单行（本模型无网关，抄送卡片核验）
    expect(wrapper.find('[data-test="node-form-cc_1"]').exists()).toBe(false);

    // 换默认：继承节点跟随，显式覆盖保持（重挂呈现最新模型状态）
    model.setDefaultFormKey("form_review");
    wrapper.unmount();
    wrapper = mountDesigner(model);
    await flushPromises();
    expect(wrapper.find('[data-test="node-form-counter"]').text()).toContain("复核单");
    expect(wrapper.find('[data-test="node-form-solo"]').text()).toContain("节点指定");
  });

  it("默认或节点 key 不在目录中：保留原值并显示失效", async () => {
    const model = buildModel();
    model.setDefaultFormKey("missing_form");
    wrapper = mountDesigner(model);
    await flushPromises();
    expect(wrapper.find('[data-test="default-form-invalid"]').text()).toContain("引用失效");
    expect(wrapper.find('[data-test="node-form-counter"]').text()).toContain("missing_form");
    expect(wrapper.find('[data-test="node-form-counter"]').classes()).toContain(
      "node-card-form--invalid",
    );
  });

  it("带首尾空格的 key 即使碰巧匹配目录 ID 也标记失效", async () => {
    const model = buildModel();
    model.process.set("defaultFormKey", " form_apply ");
    wrapper = mount(DingtalkDesigner, {
      props: { model, formOptions: [{ id: " form_apply ", name: "异常 ID 表单" }] },
      attachTo: document.body,
    });
    await flushPromises();

    expect(wrapper.find('[data-test="default-form-invalid"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="node-form-counter"]').classes()).toContain(
      "node-card-form--invalid",
    );
  });
});

/**
 * 审批节点表单覆盖选择（#73）：表单集成模式下，抽屉内的自由文本 formKey
 * 占位升级为目录选择——继承默认 / 显式覆盖 / 失效 key 保留修复；
 * 纯流程模式（不传 formOptions）保持自由文本合同（A17）。
 */

/** 打开指定卡片的配置抽屉（卡片顺序 = buildModel 的链序：start/solo/counter/cc_1/end） */
async function openCardDrawer(index: number): Promise<void> {
  await wrapper!.findAll('[data-test="node-card"]')[index]!.trigger("click");
  await flushPromises();
}

/** 原生 select 赋值并派发 change（v-model 的 change 通道） */
async function pickOption(value: string): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>('[data-test="drawer-form-select"]');
  if (select === null) throw new Error("抽屉内没有表单选择器");
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await flushPromises();
}

async function saveDrawer(): Promise<void> {
  (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
  await flushPromises();
}

describe("审批节点表单覆盖选择（#73）", () => {
  it("选择覆盖写入 formKey；选回继承清除覆盖恢复继承（A02/A03）", async () => {
    const model = buildModel();
    model.setDefaultFormKey("form_apply");
    wrapper = mountDesigner(model);
    await flushPromises();

    await openCardDrawer(1); // solo：单签
    const select = document.querySelector<HTMLSelectElement>('[data-test="drawer-form-select"]');
    expect(select).not.toBeNull();
    // 继承选项呈现当前默认表单名，让「继承什么」可见
    expect(select!.selectedOptions[0]?.text).toContain("继承默认");
    expect(select!.selectedOptions[0]?.text).toContain("申请单");

    await pickOption("form_review");
    await saveDrawer();
    expect(String(model.elementOf("solo").get("formKey"))).toBe("form_review");

    // 重开抽屉选回继承：覆盖清除，节点回到继承默认
    await openCardDrawer(1);
    await pickOption("");
    await saveDrawer();
    expect(model.elementOf("solo").get("formKey")).toBeUndefined();
  });

  it("目录外 key 以只读项保留原值，改选即修复（A11）", async () => {
    const model = buildModel();
    model.elementOf("solo").set("formKey", "ghost_form");
    wrapper = mountDesigner(model);
    await flushPromises();

    await openCardDrawer(1);
    const select = document.querySelector<HTMLSelectElement>('[data-test="drawer-form-select"]');
    expect(select!.value).toBe("ghost_form");
    expect(select!.selectedOptions[0]?.text).toContain("目录外");

    await pickOption("form_apply");
    await saveDrawer();
    expect(String(model.elementOf("solo").get("formKey"))).toBe("form_apply");
  });

  it("同名不同 ID 的表单在选项中附 ID 区分（A05）", async () => {
    const model = buildModel();
    wrapper = mount(DingtalkDesigner, {
      props: {
        model,
        formOptions: [
          { id: "form_apply", name: "申请单" },
          { id: "form_apply_2", name: "申请单" },
        ],
      },
      attachTo: document.body,
    });
    await flushPromises();

    await openCardDrawer(1);
    const options = Array.from(
      document.querySelectorAll<HTMLSelectElement>('[data-test="drawer-form-select"] option'),
    );
    const labelled = options.map((option) => option.text ?? option.textContent ?? "");
    expect(labelled.some((text) => text.includes("申请单（form_apply）"))).toBe(true);
    expect(labelled.some((text) => text.includes("申请单（form_apply_2）"))).toBe(true);
  });

  it("多实例审批同样获得覆盖入口；抄送抽屉不出现表单入口（A19）", async () => {
    const model = buildModel();
    wrapper = mountDesigner(model);
    await flushPromises();

    await openCardDrawer(2); // counter：会签
    expect(document.querySelector('[data-test="drawer-form-select"]')).not.toBeNull();
    await saveDrawer();

    await openCardDrawer(3); // cc_1：抄送
    expect(document.querySelector('[data-test="drawer-form-select"]')).toBeNull();
    expect(document.querySelector('[data-test="drawer-formkey"]')).toBeNull();
  });

  it("四种审批形态互切后节点 ID 与覆盖 key 均保留（A04）", async () => {
    const model = buildModel();
    model.elementOf("solo").set("formKey", "form_review");
    wrapper = mountDesigner(model);
    await flushPromises();

    /**
     * 依次切到每种形态再保存：单↔多边界走同 id 转换（重建节点），
     * 多人三档之间走 setApprovalMode（原位改 MI）——两条路径都不得丢 formKey。
     */
    const switches: { kind: string; needsCollection: boolean }[] = [
      { kind: "all", needsCollection: true }, // 单签 → 会签（重建）
      { kind: "any", needsCollection: false }, // 会签 → 或签（档间直改）
      { kind: "sequential", needsCollection: false }, // 或签 → 依次（档间直改）
      { kind: "single", needsCollection: false }, // 依次 → 单签（重建）
    ];
    for (const step of switches) {
      await openCardDrawer(1);
      (document.querySelector(`[data-test="kind-${step.kind}"]`) as HTMLElement).click();
      await flushPromises();
      if (step.needsCollection) {
        const assignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
        assignee!.value = "approvers";
        assignee!.dispatchEvent(new Event("input", { bubbles: true }));
        await flushPromises();
      }
      await saveDrawer();
      expect(String(model.elementOf("solo").get("formKey"))).toBe("form_review");
    }
    // 节点 ID 全程未换（同 id 转换而非删旧建新）
    expect(() => model.elementOf("solo")).not.toThrow();
  });

  it("纯流程模式：自由文本 formKey 输入保持既有合同（A17）", async () => {
    const model = buildModel();
    wrapper = mountDesigner(model, false);
    await flushPromises();

    await openCardDrawer(1);
    expect(document.querySelector('[data-test="drawer-form-select"]')).toBeNull();
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-formkey"]');
    expect(input).not.toBeNull();
    input!.value = "handwritten_form_v1";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await saveDrawer();
    expect(String(model.elementOf("solo").get("formKey"))).toBe("handwritten_form_v1");
  });
});
