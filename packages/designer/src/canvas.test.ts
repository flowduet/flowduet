// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import BpmnCanvas from "./components/BpmnCanvas.vue";
import DingtalkDesigner from "./components/DingtalkDesigner.vue";
import { READONLY_FLOW_PROPS } from "./canvas-props.js";
import { exportXml } from "./export.js";

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

  it("条件出线可查看表达式，默认出线保留兜底标记", async () => {
    const model = buildModel();
    model.elementOf("f3").set("name", "大额复核");
    model
      .elementOf("f3")
      .set(
        "conditionExpression",
        model.moddle.create("bpmn:FormalExpression", { body: "${amount > 1000}" }),
      );
    model.elementOf("f4").set("name", "常规审批");
    model.elementOf("fork").set("default", model.elementOf("f4"));

    const wrapper = mount(BpmnCanvas, { props: { model }, attachTo: document.body });
    await flushPromises();
    const labels = wrapper.findAll('[data-test="canvas-edge-label"]');
    expect(labels.some((label) => label.text().includes("大额复核"))).toBe(true);
    expect(labels.some((label) => label.text().includes("常规审批 · 默认"))).toBe(true);
    expect(
      labels.some((label) => {
        const title = label.find("title");
        return title.exists() && title.text() === "${amount > 1000}";
      }),
    ).toBe(true);
    wrapper.unmount();
  });

  it("抽屉修改条件后，钉钉式、BPMN 与导出 XML 读取同一规则", async () => {
    const model = buildModel();
    const editor = mount(DingtalkDesigner, { props: { model }, attachTo: document.body });
    await editor.find('[data-test="default-toggle-fork-1"]').trigger("click");
    await editor.find('[data-test="branch-head-fork-0"]').trigger("click");
    await flushPromises();

    const nameInput = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]');
    const conditionInput = document.querySelector<HTMLInputElement>(
      '[data-test="drawer-condition"]',
    );
    expect(nameInput).not.toBeNull();
    expect(conditionInput).not.toBeNull();
    nameInput!.value = "大额复核";
    nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    conditionInput!.value = "${amount > 1000}";
    conditionInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    expect(editor.find('[data-test="branch-head-fork-0"]').text()).toContain("${amount > 1000}");
    expect(editor.find('[data-test="branch-head-fork-1"]').text()).toContain("其他情况（默认）");

    const canvas = mount(BpmnCanvas, { props: { model }, attachTo: document.body });
    await flushPromises();
    const labels = canvas.findAll('[data-test="canvas-edge-label"]');
    expect(labels.some((label) => label.text().includes("大额复核"))).toBe(true);
    expect(
      labels.some((label) => {
        const title = label.find("title");
        return title.exists() && title.text() === "${amount > 1000}";
      }),
    ).toBe(true);

    const xml = await exportXml(model);
    expect(xml).toContain('default="f4"');
    expect(xml).toContain("amount &gt; 1000");
    canvas.unmount();
    editor.unmount();
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

  it("原地刷新：宿主递增 version prop 触发几何重算（W-b）", async () => {
    // 与「互切零转换」的重挂路径并列：挂载期间原地编辑后递增 version 即原地重算，
    // 无需重挂——#27 三区布局边编辑边看预览的刷新接缝。
    const model = buildModel();
    const wrapper = mount(BpmnCanvas, { props: { model, version: 0 }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.text()).toContain("部门会签");

    // 宿主原地编辑模型（不重挂）→ 递增 version 触发重算
    model.elementOf("counter_sign").set("name", "改会签");
    await wrapper.setProps({ version: 1 });
    await flushPromises();
    expect(wrapper.text()).toContain("改会签");
    wrapper.unmount();
  });
});
