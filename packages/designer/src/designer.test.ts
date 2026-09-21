// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import DingtalkDesigner from "./components/DingtalkDesigner.vue";
import NodeDrawer from "./components/NodeDrawer.vue";
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

/** 多实例审批链：addApprovalTask 落 loopCharacteristics + assignee=${elementVariable} */
function buildMultiInstanceChain(): BpmnModel {
  return BpmnModel.create({ processId: "designer_mi", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addApprovalTask({ id: "approval_mi", name: "多人会签", collection: "approvers", mode: "all" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval_mi" })
    .addSequenceFlow({ id: "f2", sourceRef: "approval_mi", targetRef: "end" });
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

  it("抽屉保存去除字段前后空白：落盘不带空格（与内核 assignee trim 口径一致）", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();

    const nameInput = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]');
    const assigneeInput = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    await setValue(nameInput!, "  总监审批  ");
    await setValue(assigneeInput!, "  ${director}  ");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const el = model.elementOf("approval_1");
    expect(el.get("name")).toBe("总监审批");
    expect(el.get("assignee")).toBe("${director}");
    wrapper.unmount();
  });

  it("多实例审批卡片摘要显示「多人 · 集合」而非单人审批人", () => {
    const wrapper = mountDesigner(buildMultiInstanceChain());
    expect(wrapper.text()).toContain("多人 · 集合 approvers");
    wrapper.unmount();
  });

  it("删除激活节点后重置 activeId：回收 id 的新卡片不亮 active 描边", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    // 点开 approval_1 抽屉（激活该卡片）
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    // 删除激活的 approval_1（抽屉随之关闭）
    await wrapper.find('[data-test="node-delete-approval_1"]').trigger("click");
    await flushPromises();
    // 插入新节点：nextNodeId 回收 approval_1
    await wrapper.find('[data-test="insert-after-start"]').trigger("click");
    await flushPromises();
    // 回收 id 的新卡片不应处于 active 态
    expect(wrapper.findAll(".node-card--active")).toHaveLength(0);
    wrapper.unmount();
  });
});

describe("NodeDrawer 节点缺失防御", () => {
  it("打开抽屉时节点已被宿主删除：渲染不抛未捕获异常", async () => {
    const model = buildChain();
    model.removeNode("approval_1"); // 宿主先删节点，抽屉持 stale nodeId 打开
    const errors: unknown[] = [];
    const wrapper = mount(NodeDrawer, {
      props: { model, nodeId: "approval_1", modelValue: true },
      global: { config: { errorHandler: (err) => void errors.push(err) } },
      attachTo: document.body,
    });
    await flushPromises();
    expect(errors).toHaveLength(0);
    wrapper.unmount();
  });

  it("抽屉打开后节点被删除再指向：回填 watch 不抛未捕获异常", async () => {
    const model = buildChain();
    const errors: unknown[] = [];
    const wrapper = mount(NodeDrawer, {
      props: { model, nodeId: undefined, modelValue: true },
      global: { config: { errorHandler: (err) => void errors.push(err) } },
      attachTo: document.body,
    });
    model.removeNode("approval_1");
    await wrapper.setProps({ nodeId: "approval_1" }); // watch 触发回填 → elementOf 命中已删节点
    await flushPromises();
    expect(errors).toHaveLength(0);
    wrapper.unmount();
  });
});
