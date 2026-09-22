// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import DingtalkDesigner from "./components/DingtalkDesigner.vue";
import NodeDrawer from "./components/NodeDrawer.vue";
import {
  CC_RECIPIENTS_PLACEHOLDER,
  convertApprovalToMulti,
  insertApprovalAfter,
} from "./operations.js";
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

/** 「+」现在是类型菜单：点触发器开菜单，再点菜单项（teleport 到 body） */
async function insertViaMenu(
  wrapper: ReturnType<typeof mount>,
  afterId: string,
  kind: "approval" | "cc" = "approval",
): Promise<void> {
  await wrapper.find(`[data-test="insert-btn-${afterId}"]`).trigger("click");
  await flushPromises();
  const item = document.querySelector(`[data-test="insert-kind-${kind}"]`);
  if (item instanceof HTMLElement) item.click();
  await flushPromises();
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
    await insertViaMenu(wrapper, "approval_1");
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
    await insertViaMenu(wrapper, "approval_1");
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
    await insertViaMenu(wrapper, "start");
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

describe("分支块交互（#24）", () => {
  /** 开始 → 前置 → 条件块{ 支1:审批A；支2:审批B } → 结束 */
  function buildBranching(): BpmnModel {
    return BpmnModel.create({ processId: "designer_branch", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "before", name: "前置" })
      .addExclusiveGateway({ id: "fork1", name: "金额判断" })
      .addUserTask({ id: "a_node", name: "审批A", assignee: "${a}" })
      .addUserTask({ id: "b_node", name: "审批B", assignee: "${b}" })
      .addExclusiveGateway({ id: "join1", name: "汇聚" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f0", sourceRef: "start", targetRef: "before" })
      .addSequenceFlow({ id: "f1", sourceRef: "before", targetRef: "fork1" })
      .addSequenceFlow({ id: "fa", sourceRef: "fork1", targetRef: "a_node" })
      .addSequenceFlow({ id: "fb", sourceRef: "fork1", targetRef: "b_node" })
      .addSequenceFlow({ id: "fa_j", sourceRef: "a_node", targetRef: "join1" })
      .addSequenceFlow({ id: "fb_j", sourceRef: "b_node", targetRef: "join1" })
      .addSequenceFlow({ id: "fj", sourceRef: "join1", targetRef: "end" });
  }

  function mountDesigner(model: BpmnModel) {
    return mount(DingtalkDesigner, { props: { model }, attachTo: document.body });
  }

  it("块容器渲染：标签 + 两条支路 + 块头操作按钮", () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    expect(wrapper.findAll('[data-test="branch-block"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test^="branch-head-"]')).toHaveLength(2);
    expect(wrapper.find('[data-test="add-branch-fork1"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="block-delete-fork1"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("加支路：块树分支数 +1，导出 XML 含新支路且竖排推导可用", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="add-branch-fork1"]').trigger("click");
    expect(wrapper.findAll('[data-test^="branch-head-"]')).toHaveLength(3);

    const xml = await exportXml(model);
    expect(xml).toContain('id="branch_node_1"');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
    wrapper.unmount();
  });

  it("删支路：块树与导出同步收缩", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="add-branch-fork1"]').trigger("click");
    await wrapper.find('[data-test="remove-branch-fork1-1"]').trigger("click");
    expect(wrapper.findAll('[data-test^="branch-head-"]')).toHaveLength(2);

    const xml = await exportXml(model);
    expect(xml).not.toContain('id="b_node"');
    expect(xml).toContain('id="a_node"');
    wrapper.unmount();
  });

  it("删整块：容器消失，前后直连且导出可推导", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="block-delete-fork1"]').trigger("click");
    expect(wrapper.findAll('[data-test="branch-block"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(3); // start/before/end

    const xml = await exportXml(model);
    expect(xml).not.toContain('id="fork1"');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
    wrapper.unmount();
  });

  it("默认分支：标记呈现 + 默认流转落 XML（无条件出线）", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="default-toggle-fork1-1"]').trigger("click");
    expect(wrapper.find('[data-test="branch-head-fork1-1"]').text()).toContain("默认");

    const xml = await exportXml(model);
    expect(xml).toContain('default="fb"');
    expect(xml).not.toContain(
      'id="fb" name="审批B" flowable:assignee="${b}">\n      <bpmn:conditionExpression',
    );
    wrapper.unmount();
  });

  it("默认开关 toggle：再次点击当前默认支路的按钮即取消默认", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="default-toggle-fork1-1"]').trigger("click");
    expect(await exportXml(model)).toContain('default="fb"');
    // 再点同一支路 → 取消默认
    await wrapper.find('[data-test="default-toggle-fork1-1"]').trigger("click");
    const xml = await exportXml(model);
    expect(xml).not.toContain("default=");
    // 支路头标记同步消失
    expect(wrapper.find('[data-test="branch-head-fork1-1"]').text()).not.toContain("默认");
    wrapper.unmount();
  });

  it("条件抽屉：支路头点击开抽屉，条件表达式写回 FormalExpression", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="branch-head-fork1-0"]').trigger("click");
    await flushPromises();

    const conditionInput = document.querySelector<HTMLInputElement>(
      '[data-test="drawer-condition"]',
    );
    expect(conditionInput).not.toBeNull();
    await setValue(conditionInput!, "${amount > 1000}");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).toContain("amount &gt; 1000");
    expect(xml).toContain("conditionExpression");
    wrapper.unmount();
  });

  it("条件抽屉守卫（W4）：给默认支路写条件被拦截，呈现可读错误且不半写模型", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    // 先把支路1（fa）设为默认流转
    await wrapper.find('[data-test="default-toggle-fork1-0"]').trigger("click");
    // 再打开支路1的条件抽屉，填入条件并保存
    await wrapper.find('[data-test="branch-head-fork1-0"]').trigger("click");
    await flushPromises();
    const nameInput = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]');
    const conditionInput = document.querySelector<HTMLInputElement>(
      '[data-test="drawer-condition"]',
    );
    expect(conditionInput).not.toBeNull();
    await setValue(nameInput!, "改个名");
    await setValue(conditionInput!, "${amount > 1000}");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    // 守卫抛错经 error emit 接入内联提示（AC#2：UI 呈现可读错误）
    const errEl = wrapper.find('[data-test="action-error"]');
    expect(errEl.exists()).toBe(true);
    expect(errEl.text()).toContain("默认流转");
    // 未半写：条件未落、名称也未落（先校验后写）
    const flow = model.elementOf("fa");
    expect(flow.get("conditionExpression")).toBeUndefined();
    expect(flow.get("name")).toBeUndefined();
    wrapper.unmount();
  });

  it("抽屉守卫错误在下次成功保存后清除（二轮 W1：不留陈旧横幅）", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    await wrapper.find('[data-test="default-toggle-fork1-0"]').trigger("click");
    await wrapper.find('[data-test="branch-head-fork1-0"]').trigger("click");
    await flushPromises();
    const conditionInput = document.querySelector<HTMLInputElement>(
      '[data-test="drawer-condition"]',
    );
    // 先造一次守卫错误（默认流转携条件）
    await setValue(conditionInput!, "${amount > 1000}");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();
    expect(wrapper.find('[data-test="action-error"]').exists()).toBe(true);
    // 清空条件再次保存 → 保存成功 → 横幅清除
    await setValue(conditionInput!, "");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();
    expect(wrapper.find('[data-test="action-error"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("删除含 active 节点的支路后重置 activeId（二轮 W2：回收 id 的新卡片不亮描边）", async () => {
    const model = buildBranching();
    const wrapper = mountDesigner(model);
    // 加支路得 branch_node_1（3 支路）
    await wrapper.find('[data-test="add-branch-fork1"]').trigger("click");
    await flushPromises();
    // start/before/a_node/b_node/branch_node_1/end → 点开第 5 张卡使其成为 active
    await wrapper.findAll('[data-test="node-card"]')[4]!.trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".node-card--active")).toHaveLength(1);
    // 删除支路 3（含 branch_node_1）
    await wrapper.find('[data-test="remove-branch-fork1-2"]').trigger("click");
    await flushPromises();
    // 再加支路：nextFreeId 回收 branch_node_1
    await wrapper.find('[data-test="add-branch-fork1"]').trigger("click");
    await flushPromises();
    // 回收 id 的新卡片不应处于 active 态
    expect(wrapper.findAll(".node-card--active")).toHaveLength(0);
    wrapper.unmount();
  });
});

describe("多人审批与抄送（#25）", () => {
  it("「+」菜单插入抄送节点：抽屉配收件人后导出 ccTo 与占位 delegate", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await insertViaMenu(wrapper, "approval_1", "cc");
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(4);

    // 打开抄送抽屉（新节点是 ServiceTask），配收件人
    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .filter((w) => w.text().includes("抄送节点"))[0];
    expect(ccCard).toBeDefined();
    await ccCard!.trigger("click");
    await flushPromises();
    const recipients = document.querySelector<HTMLInputElement>('[data-test="drawer-recipients"]');
    expect(recipients).not.toBeNull();
    await setValue(recipients!, "张三,李四");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).toContain('flowable:ccTo="张三,李四"');
    expect(xml).toContain('flowable:delegateExpression="${flowduetCcTask}"');
    wrapper.unmount();
  });

  it("抽屉切会签：单人任务转多实例，导出多实例形态", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();

    await wrapper.find('[data-test="kind-all"]').trigger("click");
    const assignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    await setValue(assignee!, "approvers");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).toContain('flowable:collection="approvers"');
    expect(xml).toContain("nrOfCompletedInstances == nrOfInstances");
    // 抽屉已关（EP Drawer 传送节点在 happy-dom 里残留，只查 open 态）
    expect(document.querySelector(".el-drawer.open")).toBeNull();
    wrapper.unmount();
  });

  it("会签切回单签：多实例移除，审批人留空（集合名不被当字面 assignee 落盘）", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "approvers",
    );
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    // 再次打开抽屉：完成方式回显会签；切回单签保存
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="kind-all"]').classes()).toContain("kind-card--on");
    await wrapper.find('[data-test="kind-single"]').trigger("click");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).not.toContain("multiInstanceLoopCharacteristics");
    // C1 回归：多→单切换清空了集合变量缓冲，不能把 "approvers" 当字面 assignee 落盘
    expect(xml).not.toContain('flowable:assignee="approvers"');
    expect(model.elementOf("approval_1").get("assignee")).toBeUndefined();
    wrapper.unmount();
  });

  it("切会签但审批人填成表达式：S1 形态校验拦截，模型不变", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "${manager}",
    );
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    expect(wrapper.find('[data-test="action-error"]').text()).toContain("集合变量名");
    // 校验失败：不落多实例、抽屉不关
    expect(model.elementOf("approval_1").get("loopCharacteristics")).toBeUndefined();
    wrapper.unmount();
  });

  it("插入抄送后不改收件人直接保存：W4 守卫拦截占位串，模型保持占位", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await insertViaMenu(wrapper, "approval_1", "cc");
    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .filter((w) => w.text().includes("抄送节点"))[0];
    await ccCard!.trigger("click");
    await flushPromises();
    // 不动收件人（仍是插入占位串），直接保存
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    expect(wrapper.find('[data-test="action-error"]').text()).toContain("抄送收件人");
    // 守卫拦截：ccTo 仍是占位串，未被“保存”成真实名单
    expect(model.elementOf("cc_1").get("ccTo")).toBe(CC_RECIPIENTS_PLACEHOLDER);
    wrapper.unmount();
  });

  it("formKey 占位字段读写落模型", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-formkey"]')!,
      "leave_form_v1",
    );
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).toContain('flowable:formKey="leave_form_v1"');
    wrapper.unmount();
  });

  it("抽屉保存多人节点后 elementVariable 保留（评审 W-1：不静默重置为默认名）", async () => {
    // 直接建带自定义 elementVariable 的多实例节点（模拟 convertApprovalToMulti 开形参）
    const model = BpmnModel.create({ processId: "designer_ev", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addApprovalTask({
        id: "mi1",
        name: "会签",
        collection: "approvers",
        mode: "all",
        elementVariable: "user",
      })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "mi1" })
      .addSequenceFlow({ id: "f2", sourceRef: "mi1", targetRef: "end" });
    const wrapper = mountDesigner(model);
    // 点开多人节点抽屉，只改节点名保存
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "改名会签",
    );
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const loop = model.elementOf("mi1").get("loopCharacteristics") as { get(k: string): unknown };
    // 未回落 DEFAULT_ELEMENT_VARIABLE（"assignee"），保留自定义 user
    expect(loop.get("elementVariable")).toBe("user");
    expect(model.elementOf("mi1").get("assignee")).toBe("${user}");
    expect(model.elementOf("mi1").get("name")).toBe("改名会签");
    wrapper.unmount();
  });

  it("单↔多切换缓冲暂存/恢复（评审 S-3）：同会话内误点后切回不丢字段", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();

    // 单签侧填 ${manager}
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "${manager}",
    );
    // 切会签 → 缓冲暂存单签值、多人侧无旧值可恢复→置空
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "",
    );
    // 会签侧填 approvers
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "approvers",
    );
    // 误点回单签 → 恢复同会话内暂存的 ${manager}
    await wrapper.find('[data-test="kind-single"]').trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "${manager}",
    );
    // 再切会签 → 恢复 approvers
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "approvers",
    );
    wrapper.unmount();
  });

  it("单↔多切换缓冲跨会话作废（PR #37 复核 3.2）：关闭重开后不恢复上次会话的旧值", async () => {
    const model = buildChain(); // approval_1 初始 assignee: "${manager}"
    const wrapper = mountDesigner(model);

    // 第一次会话：改为 ${director}（不保存）→ 切会签暂存 → 填 approvers → 不保存直接关闭
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "${director}",
    );
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "approvers",
    );
    (document.querySelector('[data-test="drawer-cancel"]') as HTMLElement).click();
    await flushPromises();

    // 第二次会话：重新打开 → 字段显示模型当前值（未保存过，仍是 ${manager}）
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "${manager}",
    );

    // 直接切会签：字段应为空——不恢复上次会话的 approvers
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "",
    );

    // 直接切回单签：字段应为 ${manager}（本次会话内暂存的当前模型值）——不恢复上次会话的 ${director}
    await wrapper.find('[data-test="kind-single"]').trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "${manager}",
    );
    wrapper.unmount();
  });

  it("非法集合变量错误文案明确 ASCII-only（评审 S-4）", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="kind-all"]').trigger("click");
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "审批人",
    );
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const errText = wrapper.find('[data-test="action-error"]').text();
    expect(errText).toContain("英文字母");
    expect(errText).toContain("approvers");
    // 校验失败：不落多实例
    expect(model.elementOf("approval_1").get("loopCharacteristics")).toBeUndefined();
    wrapper.unmount();
  });

  it("依次档携外部 completionCondition：抽屉保存拦截且模型零变更（评审 C-1）", async () => {
    const model = BpmnModel.create({ processId: "designer_c1", adapter: flowableAdapter })
      .addStartEvent({ id: "start", name: "开始" })
      .addApprovalTask({
        id: "mi1",
        name: "依次审批",
        collection: "approvers",
        mode: "sequential",
      })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "mi1" })
      .addSequenceFlow({ id: "f2", sourceRef: "mi1", targetRef: "end" });
    // 模拟外部导入形态：串行多实例 + 早停完成条件（Flowable 合法写法）
    const loop = model.elementOf("mi1").get("loopCharacteristics") as {
      set(k: string, v: unknown): void;
      get(k: string): unknown;
    };
    loop.set(
      "completionCondition",
      model.moddle.create("bpmn:FormalExpression", {
        body: "${nrOfCompletedInstances >= 2}",
      }),
    );

    const wrapper = mountDesigner(model);
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    // 抽屉回填时即报错（readMultiSafe 捕获抛错并 emit）
    expect(wrapper.find('[data-test="action-error"]').exists()).toBe(true);
    // 只改节点名保存：save 内 readApprovalMulti 再次报错拦截
    await setValue(document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!, "新名");
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    // 模型零变更：条件仍在、name 未被写、loop 未被抹除
    const condAfter = loop.get("completionCondition") as { get(k: string): unknown };
    expect(String(condAfter.get("body"))).toBe("${nrOfCompletedInstances >= 2}");
    expect(model.elementOf("mi1").get("name")).toBe("依次审批");
    wrapper.unmount();
  });

  it("抄送卡片字形为「抄」而非「审」（评审 W-5）", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await insertViaMenu(wrapper, "approval_1", "cc");
    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .filter((w) => w.text().includes("抄送节点"))[0];
    expect(ccCard).toBeDefined();
    expect(ccCard!.find('[data-test="node-glyph"]').text()).toBe("抄");
    expect(ccCard!.classes()).toContain("node-card--cc");
    wrapper.unmount();
  });
});

describe("exportXml 草稿 fail-fast（评审 S-5）", () => {
  /**
   * #25 引入的两个「插入即带占位」形态可绕过抽屉直接导出：
   * exportXml 前置扫描拒绝部署合法但运行时静默失效的脏数据。
   * 全模型系统性校验另立 #35。
   */
  it("抄送节点占位收件人未改：导出前报错，不产出部署后静默丢知会的 XML", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await insertViaMenu(wrapper, "approval_1", "cc");
    // 不开抽屉配置，直接导出
    await expect(exportXml(model)).rejects.toThrow(/占位串/);
    await expect(exportXml(model)).rejects.toThrow(/抄送节点/);
    wrapper.unmount();
  });

  it("抄送节点填真实名单后：导出放行", async () => {
    const model = buildChain();
    const wrapper = mountDesigner(model);
    await insertViaMenu(wrapper, "approval_1", "cc");
    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .filter((w) => w.text().includes("抄送节点"))[0];
    await ccCard!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-recipients"]')!,
      "张三,李四",
    );
    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();

    const xml = await exportXml(model);
    expect(xml).toContain('flowable:ccTo="张三,李四"');
    wrapper.unmount();
  });

  it("多实例集合变量空白（宿主直写脏数据）：导出前报错", async () => {
    const model = buildChain();
    insertApprovalAfter(model, "approval_1", { name: "会签" });
    convertApprovalToMulti(model, "approval_2", { collection: "approvers", mode: "all" });
    // 模拟宿主绕开守卫直写脏数据
    const loop = model.elementOf("approval_2").get("loopCharacteristics") as {
      set(k: string, v: unknown): void;
    };
    loop.set("collection", "   ");
    await expect(exportXml(model)).rejects.toThrow(/集合变量为空白/);
  });
});
