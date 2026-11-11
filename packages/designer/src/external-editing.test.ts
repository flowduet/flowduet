// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import NodePropertyFields from "./components/NodePropertyFields.vue";
import DingtalkDesigner from "./components/DingtalkDesigner.vue";
const wrappers: { unmount(): void }[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
});
function create() {
  const model = BpmnModel.create({ processId: "external", adapter: flowableAdapter })
    .addStartEvent({ id: "s" })
    .addUserTask({ id: "a", name: "同名" })
    .addUserTask({ id: "b", name: "同名" })
    .addEndEvent({ id: "e" })
    .addSequenceFlow({ id: "sa", sourceRef: "s", targetRef: "a" })
    .addSequenceFlow({ id: "ab", sourceRef: "a", targetRef: "b" })
    .addSequenceFlow({ id: "be", sourceRef: "b", targetRef: "e" });
  const wrapper = mount(DingtalkDesigner, {
    props: { model, propertyEditing: "external" },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return { model, wrapper };
}
describe("外置编辑显式接缝", () => {
  it("external_commit_pending_refuses", async () => {
    const { wrapper } = create();
    expect(wrapper.vm.commitPendingChanges()).toBe(false);
    await flushPromises();
    expect(wrapper.find('[data-test="action-error"]').text()).toContain("外置编辑");
  });
  it("external_structure_request_does_not_mutate_first", async () => {
    const { model, wrapper } = create();
    const before = (await model.toXML()).xml;
    await wrapper.find('[data-test="node-delete-a"]').trigger("click");
    expect(wrapper.emitted("operation-request")?.[0]?.[0]).toMatchObject({
      model,
      operation: { type: "remove-node", nodeId: "a" },
    });
    expect((await model.toXML()).xml).toBe(before);
  });
  it("外置选择仅发请求不打开抽屉", async () => {
    const { wrapper } = create();
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    expect(wrapper.emitted("selection-request")?.[0]?.[0]).toMatchObject({ id: "a" });
    expect(document.querySelector('[data-test="drawer-name"]')).toBeNull();
  });
  it("locate_same_name_by_actual_id", async () => {
    const { wrapper } = create();
    await wrapper.setProps({ selectedId: "b" });
    await flushPromises();
    expect(await wrapper.vm.focusElement("b")).toEqual({ status: "focused", selectedId: "b" });
    expect(wrapper.find('[data-entity-id="b"]').classes()).toContain("node-card--active");
    expect(document.activeElement).toBe(wrapper.find('[data-entity-id="b"]').element);
  });
  it("destroyed_view_cancels_focus", async () => {
    const { wrapper } = create();
    await wrapper.setProps({ selectedId: "a" });
    const pending = wrapper.vm.focusElement("a");
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(await pending).toEqual({ status: "cancelled" });
  });
  it("默认条可显式隐藏且旧默认不变", async () => {
    const { wrapper } = create();
    await wrapper.setProps({ formOptions: [{ id: "f", name: "表" }], showDefaultForm: false });
    expect(wrapper.find('[data-test="default-form-bar"]').exists()).toBe(false);
    await wrapper.setProps({ showDefaultForm: true });
    expect(wrapper.find('[data-test="default-form-select"]').attributes("disabled")).toBeDefined();
  });
  it("同一轮事件内编辑两个字段不覆盖前一个输入", () => {
    const w = mount(NodePropertyFields, {
      props: { draft: { kind: "branch", name: "原名称", condition: "原条件" } },
      attachTo: document.body,
    });
    wrappers.push(w);
    const name = w.get('[data-test="drawer-name"]').element as HTMLInputElement;
    const condition = w.get('[data-test="drawer-condition"]').element as HTMLInputElement;
    name.value = "新名称";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    condition.value = "新条件";
    condition.dispatchEvent(new Event("input", { bubbles: true }));
    expect(w.emitted("update:draft")?.at(-1)?.[0]).toEqual({
      kind: "branch",
      name: "新名称",
      condition: "新条件",
    });
  });
  it("输入法尚未完成时捕获拒绝旧值并报告未序列化输入", () => {
    const w = mount(NodePropertyFields, {
      props: { draft: { kind: "branch", name: "原名称", condition: "条件" } },
      attachTo: document.body,
    });
    wrappers.push(w);
    const input = w.get('[data-test="drawer-name"]').element as HTMLInputElement;
    input.focus();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "尚未完成";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    w.vm.flush();
    expect(w.vm.capture()).toBeNull();
    expect(w.emitted("unserialized-input")?.length).toBeGreaterThan(0);
    expect(input.value).toBe("尚未完成");
  });
});
