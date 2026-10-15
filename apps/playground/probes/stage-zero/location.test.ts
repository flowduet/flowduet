import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { ModdleElement } from "@flowduet/core";
import NodeDrawer from "../../../../packages/designer/src/components/NodeDrawer.vue";
import {
  insertApprovalAfter,
  removeApprovalNode,
} from "../../../../packages/designer/src/operations";
import LocationProbe from "./LocationProbe.vue";
import type { ProbeDesignState } from "./design-state";

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});
async function setup(props: Record<string, unknown> = {}) {
  wrapper = mount(LocationProbe, { props, attachTo: document.body });
  await flushPromises();
  await flushPromises();
  return wrapper;
}
async function click(text: string) {
  const button = wrapper!.findAll("button").find((el) => el.text() === text);
  expect(button, `缺少真实探针操作：${text}`).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}
function selected() {
  return wrapper!.findComponent(NodeDrawer).props("nodeId");
}

describe("真实视图定位确认", () => {
  it("从BPMN切回后确认实际节点抽屉，而非仅派发事件", async () => {
    await setup();
    await click("定位采购审批");
    expect(selected()).toBe("approval_1");
    expect(wrapper!.findComponent(NodeDrawer).props("modelValue")).toBe(true);
    expect(wrapper!.find('[data-test="location-result"]').text()).toContain("已确认");
  });
  it("单↔多转换后原分支诊断仍定位fa，条件与顺序保留", async () => {
    await setup();
    await click("切为会签");
    await click("切回单签");
    await click("定位金额分支");
    expect(selected()).toBe("fa");
    const model = wrapper!.findComponent(NodeDrawer).props("model");
    expect((model.elementOf("fa").get("conditionExpression") as ModdleElement).get("body")).toBe(
      "${amount > 100}",
    );
    expect(
      (model.elementOf("fork").get("outgoing") as ModdleElement[]).map((f) => f.get("id")),
    ).toEqual(["fa", "fb"]);
  });
  it("删除首节点后fa改接tail仍可定位，旧节点诊断拒绝", async () => {
    await setup();
    await click("删除首节点（保留支路）");
    await click("定位金额分支");
    expect(selected()).toBe("fa");
    const model = wrapper!.findComponent(NodeDrawer).props("model");
    expect(model.elementOf("fa").get("targetRef")).toBe(model.elementOf("tail"));
    await click("定位采购审批");
    expect(wrapper!.find('[data-test="location-result"]').text()).toContain("失效");
  });
  it("外层头嵌套块删除后确认实际分支配置", async () => {
    await setup({ nested: true });
    await click("删除嵌套块（保留外层支路）");
    await click("定位金额分支");
    expect(selected()).toBe("fa");
    const model = wrapper!.findComponent(NodeDrawer).props("model");
    expect(model.elementOf("fa").get("targetRef")).toBe(model.elementOf("tail"));
    expect(() => model.elementOf("inner")).toThrow();
  });
  it("现有抽屉含非法输入时不宣称后续分支已选中，输入保留", async () => {
    await setup();
    await click("定位采购审批");
    await wrapper!.find('[data-test="kind-all"]').trigger("click");
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!;
    input.value = "bad,list";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await click("定位金额分支");
    expect(selected()).toBe("approval_1");
    expect(input.value).toBe("bad,list");
    expect(wrapper!.find('[data-test="location-result"]').text()).toContain("未确认");
  });
  it("异步切换期间删除再复用ID，旧请求拒绝而不选中新对象", async () => {
    await setup({
      beforeLocate: async (p: ProbeDesignState) => {
        p.mutateModel(() => {
          const m = p.session.current!.model;
          removeApprovalNode(m, "approval_1");
          insertApprovalAfter(m, "tail", { name: "新对象" });
        });
      },
    });
    await click("定位采购审批");
    expect(wrapper!.find('[data-test="location-result"]').text()).toContain("失效");
    expect(wrapper!.findComponent(NodeDrawer).props("modelValue")).toBe(false);
  });
  it("异步期间文档替换使旧诊断失效，实际epoch递增", async () => {
    await setup({
      beforeLocate: async (p: ProbeDesignState) => {
        p.session.newDesign({ processId: "location_probe" });
        p.reconcile();
      },
    });
    await click("定位金额分支");
    expect(wrapper!.find('[data-test="location-result"]').text()).toContain("失效");
    expect(wrapper!.find('[data-test="location-state"]').text()).toContain('"documentEpoch": 2');
  });
  it("异步定位请求失败不假报选中，保留当前模型与输入", async () => {
    await setup({
      beforeLocate: async () => {
        throw new Error("请求取消");
      },
    });
    await click("定位采购审批");
    expect(wrapper!.find('[data-test="location-result"]').text()).toContain("失败");
    expect(wrapper!.findComponent(NodeDrawer).props("modelValue")).toBe(false);
    expect(wrapper!.find('[data-test="location-state"]').text()).toContain("未应用节点名");
  });
  it("默认表单问题进入真实配置控件并写回同一模型", async () => {
    await setup();
    await click("定位默认表单问题");
    const select = wrapper!.find('[data-test="location-default-form"]');
    expect(select.exists()).toBe(true);
    await select.setValue("form_2");
    expect(wrapper!.find('[data-test="location-state"]').text()).toContain(
      '"defaultFormKey": "form_2"',
    );
  });
});
