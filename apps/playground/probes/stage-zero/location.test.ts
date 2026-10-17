import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { ModdleElement } from "@flowduet/core";
import NodeDrawer from "../../../../packages/designer/src/components/NodeDrawer.vue";
import {
  insertApprovalAfter,
  removeApprovalNode,
} from "../../../../packages/designer/src/operations";
import LocationProbe from "./LocationProbe.vue";
import type { ProbeDesignState } from "./design-state";
import {
  assertActiveTarget,
  createBrowserTestScope,
} from "../../src/test-utils/browser-test-scope";

let wrapper: ReturnType<typeof mount> | undefined;
let scope: ReturnType<typeof createBrowserTestScope>;
beforeEach(() => {
  scope = createBrowserTestScope();
});
afterEach(() => {
  const target = wrapper;
  wrapper = undefined;
  scope.close(
    () => target?.unmount(),
    () => {
      document.body.innerHTML = "";
    },
  );
});
async function setup(props: Record<string, unknown> = {}) {
  const target = (wrapper = scope.own(mount(LocationProbe, { props, attachTo: document.body })));
  await flushPromises();
  assertActiveTarget(target);
  await flushPromises();
  assertActiveTarget(target);
  return target;
}
async function click(target: ReturnType<typeof mount>, text: string) {
  assertActiveTarget(target);
  const button = target.findAll("button").find((el) => el.text() === text);
  expect(button, `缺少真实探针操作：${text}`).toBeDefined();
  await button!.trigger("click");
  assertActiveTarget(target);
  await flushPromises();
  assertActiveTarget(target);
}
function selected(target: ReturnType<typeof mount>) {
  assertActiveTarget(target);
  return target.findComponent(NodeDrawer).props("nodeId");
}

describe("真实视图定位确认", () => {
  it("从BPMN切回后确认实际节点抽屉，而非仅派发事件", async () => {
    const target = await setup();
    assertActiveTarget(target);
    await click(target, "定位采购审批");
    assertActiveTarget(target);
    expect(selected(target)).toBe("approval_1");
    expect(target.findComponent(NodeDrawer).props("modelValue")).toBe(true);
    expect(target.find('[data-test="location-result"]').text()).toContain("已确认");
  });
  it("单↔多转换后原分支诊断仍定位fa，条件与顺序保留", async () => {
    const target = await setup();
    assertActiveTarget(target);
    await click(target, "切为会签");
    assertActiveTarget(target);
    await click(target, "切回单签");
    assertActiveTarget(target);
    await click(target, "定位金额分支");
    assertActiveTarget(target);
    expect(selected(target)).toBe("fa");
    const model = target.findComponent(NodeDrawer).props("model");
    expect((model.elementOf("fa").get("conditionExpression") as ModdleElement).get("body")).toBe(
      "${amount > 100}",
    );
    expect(
      (model.elementOf("fork").get("outgoing") as ModdleElement[]).map((f) => f.get("id")),
    ).toEqual(["fa", "fb"]);
  });
  it("删除首节点后fa改接tail仍可定位，旧节点诊断拒绝", async () => {
    const target = await setup();
    assertActiveTarget(target);
    await click(target, "删除首节点（保留支路）");
    assertActiveTarget(target);
    await click(target, "定位金额分支");
    assertActiveTarget(target);
    expect(selected(target)).toBe("fa");
    const model = target.findComponent(NodeDrawer).props("model");
    expect(model.elementOf("fa").get("targetRef")).toBe(model.elementOf("tail"));
    await click(target, "定位采购审批");
    assertActiveTarget(target);
    expect(target.find('[data-test="location-result"]').text()).toContain("失效");
  });
  it("外层头嵌套块删除后确认实际分支配置", async () => {
    const target = await setup({ nested: true });
    assertActiveTarget(target);
    await click(target, "删除嵌套块（保留外层支路）");
    assertActiveTarget(target);
    await click(target, "定位金额分支");
    assertActiveTarget(target);
    expect(selected(target)).toBe("fa");
    const model = target.findComponent(NodeDrawer).props("model");
    expect(model.elementOf("fa").get("targetRef")).toBe(model.elementOf("tail"));
    expect(() => model.elementOf("inner")).toThrow();
  });
  it("现有抽屉含非法输入时不宣称后续分支已选中，输入保留", async () => {
    const target = await setup();
    assertActiveTarget(target);
    await click(target, "定位采购审批");
    assertActiveTarget(target);
    await target.find('[data-test="kind-all"]').trigger("click");
    assertActiveTarget(target);
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!;
    input.value = "bad,list";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    assertActiveTarget(target);
    await click(target, "定位金额分支");
    assertActiveTarget(target);
    expect(selected(target)).toBe("approval_1");
    expect(input.value).toBe("bad,list");
    expect(target.find('[data-test="location-result"]').text()).toContain("未确认");
  });
  it("异步切换期间删除再复用ID，旧请求拒绝而不选中新对象", async () => {
    const target = await setup({
      beforeLocate: async (p: ProbeDesignState) => {
        p.mutateModel(() => {
          const m = p.session.current!.model;
          removeApprovalNode(m, "approval_1");
          insertApprovalAfter(m, "tail", { name: "新对象" });
        });
      },
    });
    assertActiveTarget(target);
    await click(target, "定位采购审批");
    assertActiveTarget(target);
    expect(target.find('[data-test="location-result"]').text()).toContain("失效");
    expect(target.findComponent(NodeDrawer).props("modelValue")).toBe(false);
  });
  it("异步期间文档替换使旧诊断失效，实际epoch递增", async () => {
    const target = await setup({
      beforeLocate: async (p: ProbeDesignState) => {
        p.session.newDesign({ processId: "location_probe" });
        p.reconcile();
      },
    });
    assertActiveTarget(target);
    await click(target, "定位金额分支");
    assertActiveTarget(target);
    expect(target.find('[data-test="location-result"]').text()).toContain("失效");
    expect(target.find('[data-test="location-state"]').text()).toContain('"documentEpoch": 2');
  });
  it("异步定位请求失败不假报选中，保留当前模型与输入", async () => {
    const target = await setup({
      beforeLocate: async () => {
        throw new Error("请求取消");
      },
    });
    assertActiveTarget(target);
    await click(target, "定位采购审批");
    assertActiveTarget(target);
    expect(target.find('[data-test="location-result"]').text()).toContain("失败");
    expect(target.findComponent(NodeDrawer).props("modelValue")).toBe(false);
    expect(target.find('[data-test="location-state"]').text()).toContain("未应用节点名");
  });
  it("默认表单问题进入真实配置控件并写回同一模型", async () => {
    const target = await setup();
    assertActiveTarget(target);
    await click(target, "定位默认表单问题");
    assertActiveTarget(target);
    const select = target.find('[data-test="location-default-form"]');
    expect(select.exists()).toBe(true);
    await select.setValue("form_2");
    assertActiveTarget(target);
    expect(target.find('[data-test="location-state"]').text()).toContain(
      '"defaultFormKey": "form_2"',
    );
  });
});
