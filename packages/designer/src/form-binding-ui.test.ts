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
