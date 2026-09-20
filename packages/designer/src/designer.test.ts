// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import DingtalkDesigner from "./components/DingtalkDesigner.vue";
import { exportXml } from "./export.js";

/**
 * 组件一致性冒烟（外部行为级）：操作后块树与导出 XML 反映正确。
 * 深层交互（分支块、三档抽屉）随 #24/#25 扩展。
 */

function buildChain(): BpmnModel {
  return BpmnModel.create({ processId: "designer_smoke", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "approval_1", name: "经理审批", assignee: "${manager}" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_1" })
    .addSequenceFlow({ id: "f2", sourceRef: "approval_1", targetRef: "end" });
}

function mountDesigner(model: BpmnModel) {
  return mount(DingtalkDesigner, { props: { model }, attachTo: document.body });
}

/** 原生 input 赋值并派发 input 事件（v-model 监听 input） */
async function setValue(input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}

describe("DingtalkDesigner 审批节点闭环", () => {
  it("挂载即渲染块树：链上节点全部出卡片", () => {
    const wrapper = mountDesigner(buildChain());
    const cards = wrapper.findAll('[data-test="node-card"]');
    expect(cards).toHaveLength(3);
    expect(wrapper.text()).toContain("经理审批");
    wrapper.unmount();
  });

  it("卡间「+」插入审批节点：块树与导出 XML 同步反映（零坐标导出带 DI）", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="insert-after-approval_1"]').trigger("click");
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(4);
    expect(wrapper.text()).toContain("审批节点");

    const xml = await exportXml(model);
    expect(xml).toContain('id="approval_2"');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
    wrapper.unmount();
  });

  it("抽屉改节点名与审批人：保存直达模型字段", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();

    // EP Drawer 恒定 Teleport 到 body，且透传属性落在 <input> 本身：
    // data-test 选择器直接命中输入框
    const nameInput = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]');
    const assigneeInput = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    expect(nameInput).not.toBeNull();
    expect(assigneeInput).not.toBeNull();
    await setValue(nameInput!, "总监审批");
    await setValue(assigneeInput!, "${director}");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).toContain('name="总监审批"');
    expect(xml).toContain('flowable:assignee="${director}"');
    wrapper.unmount();
  });

  it("删除中段节点：前后重链，导出链完整", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="insert-after-approval_1"]').trigger("click");
    // 删除新插入的中段节点（approval_2 夹在 approval_1 与 end 之间）
    await wrapper.find('[data-test="node-delete-approval_2"]').trigger("click");
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(3);

    const xml = await exportXml(model);
    expect(xml).not.toContain('id="approval_2"');
    // 重链后整图仍可竖排推导（渲染本身即验证）且 start→…→end 连通
    expect(xml).toContain('sourceRef="approval_1"');
    wrapper.unmount();
  });
});
