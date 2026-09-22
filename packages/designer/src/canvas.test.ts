// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import BpmnCanvas from "./components/BpmnCanvas.vue";
import { READONLY_FLOW_PROPS } from "./canvas-props.js";

/**
 * 只读投影组件冒烟（#26）：同一模型实例的画布呈现——节点词汇、
 * 多实例标记、连线数量；互切一致性的模型侧证据由几何解析器与
 * 导出链共同保证（同一 resolve/compile 源）。
 *
 * happy-dom 缺 ResizeObserver，VueFlow 初始化需要——此处补最小桩。
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

function buildModel(): BpmnModel {
  // 零坐标建模（钉钉式产出形态）：画布几何走竖排推导
  return BpmnModel.create({ processId: "canvas_smoke", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addApprovalTask({
      id: "counter_sign",
      name: "部门会签",
      collection: "approvers",
      mode: "all",
    })
    .addExclusiveGateway({ id: "fork", name: "判断" })
    .addTask("cc", { id: "cc_notify", name: "抄送知会", recipients: "张三" })
    .addUserTask({ id: "b_node", name: "复核" })
    .addExclusiveGateway({ id: "join", name: "汇聚" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "counter_sign" })
    .addSequenceFlow({ id: "f2", sourceRef: "counter_sign", targetRef: "fork" })
    .addSequenceFlow({ id: "f3", sourceRef: "fork", targetRef: "cc_notify" })
    .addSequenceFlow({ id: "f4", sourceRef: "fork", targetRef: "b_node" })
    .addSequenceFlow({ id: "f5", sourceRef: "cc_notify", targetRef: "join" })
    .addSequenceFlow({ id: "f6", sourceRef: "b_node", targetRef: "join" })
    .addSequenceFlow({ id: "f7", sourceRef: "join", targetRef: "end" });
}

describe("BpmnCanvas 只读投影", () => {
  it("挂载渲染：节点词汇（事件/多实例/网关/抄送）与连线齐备", async () => {
    const wrapper = mount(BpmnCanvas, { props: { model: buildModel() }, attachTo: document.body });
    await flushPromises();

    expect(wrapper.find('[data-test="canvas-bpmn:StartEvent"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="canvas-bpmn:EndEvent"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="canvas-bpmn:ExclusiveGateway"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="canvas-bpmn:ServiceTask"]').exists()).toBe(true);
    // 多实例并行标记（三竖条）
    expect(wrapper.find('[data-test="mi-parallel"]').exists()).toBe(true);
    // 抄送声部（虚线任务 + 珊瑚橙图标）
    expect(wrapper.find('.bpmn-task[data-cc="true"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("部门会签");
    wrapper.unmount();
  });

  it("只读配置清单逐一核验（AC1：编辑面全部禁用，缩放平移保留）", () => {
    // 单一出处常量即组件实际 v-bind 的配置，断言常量即可回归只读边界
    expect(READONLY_FLOW_PROPS).toMatchObject({
      nodesDraggable: false,
      nodesConnectable: false,
      edgesUpdatable: false,
      elementsSelectable: false,
      connectOnClick: false,
      deleteKeyCode: null,
      selectionKeyCode: null,
      zoomOnScroll: true,
      panOnDrag: true,
    });
  });

  it("互切零转换：编辑后重新挂载画布，呈现与导出一致", async () => {
    const model = buildModel();
    // 先挂一次（初见），模拟切走
    const first = mount(BpmnCanvas, { props: { model }, attachTo: document.body });
    await flushPromises();
    expect(first.text()).toContain("部门会签");
    first.unmount();

    // 钉钉式视图编辑（模型侧直接改字段），切回 = 重新挂载画布
    model.elementOf("counter_sign").set("name", "改会签");
    const second = mount(BpmnCanvas, { props: { model }, attachTo: document.body });
    await flushPromises();
    expect(second.text()).toContain("改会签");
    second.unmount();
  });

  it("半损模型（不可达元素）：渲染可读错误态而非白屏（W-2）", async () => {
    // 缺坐标 + 孤立节点 → 竖排推导守卫抛错；画布应降级为错误横幅，不炸渲染树
    const orphan = BpmnModel.create({ processId: "canvas_orphan", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addUserTask({ id: "t1", name: "主链任务" })
      .addEndEvent({ id: "end" })
      .addUserTask({ id: "orphan", name: "孤立任务" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    const wrapper = mount(BpmnCanvas, { props: { model: orphan }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('[data-test="canvas-error"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("不在块树中");
    // 错误态下不渲染任何节点词汇（VueFlow 未挂载）
    expect(wrapper.find('[data-test="canvas-bpmn:StartEvent"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
