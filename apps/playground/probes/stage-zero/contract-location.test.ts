import ContractInstanceProbe from "./ContractInstanceProbe.vue";
import { afterEach, describe, it, expect } from "vitest";
import { mount, shallowMount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import DingtalkDesigner from "../../../../packages/designer/src/components/DingtalkDesigner.vue";
import NodePropertyFields from "../../../../packages/designer/src/components/NodePropertyFields.vue";
import {
  convertApprovalToMulti,
  removeApprovalNode,
  removeBlock,
} from "../../../../packages/designer/src/operations";
import { createContractController } from "./contracts/controller";
import type { EditTarget } from "./contracts/types";
import { fixture, deferred } from "./contracts/fixtures";
const mounted: { unmount(): void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
});
function setup(owner = "A", nested = false) {
  const f = fixture(owner, nested),
    c = createContractController(f);
  const view = mount(DingtalkDesigner, {
    props: { model: f.model, propertyEditing: "external", modelRevision: 0 },
    attachTo: document.body,
  });
  mounted.push(view);
  c.attachView({
    async route(t) {
      await view.setProps({ selectedId: t.ref.id, modelRevision: c.revision });
    },
    focus(t) {
      return view.vm.focusElement(t.ref.id);
    },
    selectedId() {
      return view.vm.actualSelectedId;
    },
  });
  return { ...f, c, view };
}
describe("真实外置定位与输入", () => {
  it("同名对象按实际ID选中，不打开抽屉", async () => {
    const f = setup();
    expect(await f.c.locate(f.target("tail"))).toMatchObject({
      status: "located",
      selectedId: "tail",
    });
    expect(f.view.vm.actualSelectedId).toBe("tail");
    expect(document.querySelector('[data-test="drawer-name"]')).toBeNull();
  });
  it("外来控制器即使同ID也拒绝", async () => {
    const a = setup(),
      b = setup("B");
    expect(await b.c.locate(a.target("approval_1"))).toMatchObject({ status: "stale-target" });
    expect(b.view.vm.actualSelectedId).toBeUndefined();
  });
  it("延迟期间ID重建拒绝旧目标", async () => {
    const f = setup(),
      gate = deferred<void>(),
      old = f.target("approval_1");
    f.c.attachView({
      route: () => gate.promise,
      focus: (t) => f.view.vm.focusElement(t.ref.id),
      selectedId: () => f.view.vm.actualSelectedId,
    });
    const pending = f.c.locate(old);
    f.model.removeNode(old.ref.id);
    f.model.addUserTask({ id: old.ref.id, name: "同名审批" });
    gate.resolve();
    expect(await pending).toMatchObject({ status: "stale-target" });
  });
  it("主动选择取消迟到定位", async () => {
    const f = setup(),
      gate = deferred<void>();
    f.c.attachView({
      route: () => gate.promise,
      focus: (t) => f.view.vm.focusElement(t.ref.id),
      selectedId: () => f.view.vm.actualSelectedId,
    });
    const pending = f.c.locate(f.target("approval_1"));
    f.c.cancelLocate();
    await f.view.setProps({ selectedId: "tail" });
    gate.resolve();
    expect(await pending).toMatchObject({ status: "cancelled" });
    expect(f.view.vm.actualSelectedId).toBe("tail");
  });
  it("fa_after_convert_delete_and_nested_block", async () => {
    const f = setup(),
      target = f.target("fa", "flow");
    f.drafts.stage(target, { kind: "branch", name: "未应用", condition: "${amount > 200}" });
    convertApprovalToMulti(f.model, "approval_1", { collection: "people", mode: "all" });
    removeApprovalNode(f.model, "approval_1");
    f.sync();
    await f.view.setProps({ modelRevision: 1 });
    expect(await f.c.locate(target)).toMatchObject({ status: "located", selectedId: "fa" });
    expect(f.drafts.input(target)).toMatchObject({ condition: "${amount > 200}" });
    expect(f.model.elementOf("fa").get("id")).toBe("fa");
  });
  it("嵌套块删除后外层fa身份和输入仍可定位", async () => {
    const f = setup("nested", true),
      target = f.target("fa", "flow");
    f.drafts.stage(target, { kind: "branch", name: "外层输入", condition: "${amount > 200}" });
    removeBlock(f.model, "inner");
    f.c.sync();
    await f.view.setProps({ modelRevision: f.c.revision });
    expect(await f.c.locate(target)).toMatchObject({ status: "located", selectedId: "fa" });
    expect(f.model.elementOf("fa").get("targetRef")).toBe(f.model.elementOf("approval_1"));
    expect(f.drafts.input(target)).toMatchObject({ condition: "${amount > 200}" });
  });
  it("invalid_input_switch_keeps_two_buffers", async () => {
    const f = setup(),
      a = f.target("approval_1"),
      b = f.target("tail");
    f.drafts.stage(a, {
      kind: "approval",
      name: "一",
      approvalKind: "all",
      assignee: "${bad}",
      formKey: "",
    });
    f.drafts.stage(b, {
      kind: "approval",
      name: "二",
      approvalKind: "all",
      assignee: "bad,list",
      formKey: "",
    });
    expect(await f.c.locate(a)).toMatchObject({ status: "located" });
    expect(await f.c.locate(b)).toMatchObject({ status: "located" });
    expect(f.drafts.input(a)).toMatchObject({ assignee: "${bad}" });
    expect(f.drafts.input(b)).toMatchObject({ assignee: "bad,list" });
    expect(f.model.elementOf(a.ref.id).get("name")).toBe("同名审批");
  });
  it("共享字段可捕获当前输入且不写模型", async () => {
    const f = setup(),
      t = f.target("approval_1"),
      draft = f.read(t);
    if (draft.kind !== "approval") throw new Error("夹具不符");
    const fields = mount(NodePropertyFields, { props: { draft }, attachTo: document.body });
    mounted.push(fields);
    const input = fields.get('[data-test="drawer-name"]').element as HTMLInputElement;
    input.value = "焦点原始输入";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fields.vm.flush();
    expect(fields.vm.capture()).toMatchObject({ name: "焦点原始输入" });
    expect(f.model.elementOf(t.ref.id).get("name")).toBe("同名审批");
    await nextTick();
    await flushPromises();
  });
  it("重新编辑后旧实例迟到输入不能覆盖新租约", async () => {
    const w = mount(ContractInstanceProbe, {
      props: { owner: "lease", includeForms: false },
      attachTo: document.body,
    });
    mounted.push(w);
    await flushPromises();
    const old = w.get('[data-property-target="approval_1"] [data-test="drawer-name"]')
      .element as HTMLInputElement;
    old.value = "原实例输入";
    old.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await w
      .findAll("button")
      .find((b) => b.text() === "实验：外部改首节点名称")!
      .trigger("click");
    await w
      .findAll("button")
      .find((b) => b.text() === "基于当前值重新编辑")!
      .trigger("click");
    await flushPromises();
    const current = w
      .findAll('[data-property-target="approval_1"] [data-test="drawer-name"]')
      .map((n) => n.element as HTMLInputElement)
      .find((n) => n !== old)!;
    current.value = "新租约输入";
    current.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    old.value = "旧实例迟到值";
    old.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    const t = w.vm.controller.target("node", "approval_1", "properties");
    if (!t.ok) throw new Error("目标不可编辑");
    expect(w.vm.controller.drafts.input(t.value)).toMatchObject({ name: "新租约输入" });
  });

  it("错误facet引用在导航前拒绝", async () => {
    const f = setup(),
      target = { ...f.target("approval_1"), facet: "default-form" } as EditTarget;
    expect(await f.c.locate(target)).toMatchObject({ status: "unsupported" });
    expect(f.view.vm.actualSelectedId).toBeUndefined();
  });
  it("从默认表单阶段返回流程后应用仍作用于原节点", async () => {
    const w = mount(ContractInstanceProbe, {
      props: { owner: "phase", includeForms: false },
      attachTo: document.body,
    });
    mounted.push(w);
    await flushPromises();
    const input = w.get('[data-property-target="approval_1"] [data-test="drawer-name"]')
      .element as HTMLInputElement;
    input.value = "流程待应用";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await w
      .findAll("button")
      .find((b) => b.text() === "定位默认表单")!
      .trigger("click");
    await flushPromises();
    await w
      .findAll("button")
      .find((b) => b.text() === "流程实验")!
      .trigger("click");
    await w
      .findAll("button")
      .find((b) => b.text() === "应用")!
      .trigger("click");
    await flushPromises();
    expect(w.vm.controller.model.elementOf("approval_1").get("name")).toBe("流程待应用");
  });
  it("默认探针包含两张真实会话表单，显式无表单夹具可关闭", () => {
    const w = shallowMount(ContractInstanceProbe, { props: { owner: "defaults" } });
    mounted.push(w);
    expect(w.vm.controller.session.current!.forms.map((f) => f.id)).toEqual(["form_1", "form_2"]);
  });
  it("首次输入前外部改了基础字段也必须冲突而非覆盖", async () => {
    const w = mount(ContractInstanceProbe, {
      props: { owner: "base", includeForms: false },
      attachTo: document.body,
    });
    mounted.push(w);
    await flushPromises();
    w.vm.controller.model.elementOf("approval_1").set("assignee", "外部审批人");
    const input = w.get('[data-property-target="approval_1"] [data-test="drawer-name"]')
      .element as HTMLInputElement;
    input.value = "用户新输入";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    const target = w.vm.controller.target("node", "approval_1", "properties");
    if (!target.ok) throw new Error("目标无效");
    expect(await w.vm.controller.apply(target.value)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(w.vm.controller.model.elementOf("approval_1").get("assignee")).toBe("外部审批人");
    expect(w.vm.controller.drafts.input(target.value)).toMatchObject({ name: "用户新输入" });
  });

  it("失效默认引用显示原key而不是伪装为无表单", () => {
    const w = mount(ContractInstanceProbe, {
      props: { owner: "default", includeForms: false, invalidDefault: true },
      attachTo: document.body,
    });
    mounted.push(w);
    const select = w.get('[data-test="contract-default-form"]').element as HTMLSelectElement;
    expect(select.value).toBe("missing_form");
    expect(select.selectedOptions[0]?.textContent).toContain("目录外");
  });
  it("默认配置首次改动前的外部变更也不能盲目覆盖", async () => {
    const w = mount(ContractInstanceProbe, {
      props: { owner: "defaultbase", includeForms: false },
      attachTo: document.body,
    });
    mounted.push(w);
    await flushPromises();
    w.vm.controller.model.setDefaultFormKey("external_form");
    const select = w.get('[data-test="contract-default-form"]').element as HTMLSelectElement;
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    const target = w.vm.controller.target("process", "contract", "default-form");
    if (!target.ok) throw new Error("目标无效");
    expect(await w.vm.controller.apply(target.value)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(w.vm.controller.model.defaultFormKey).toBe("external_form");
  });
});

describe("独立复核：还原、失焦冲突与放弃后的真实编辑器", () => {
  function probe(owner: string) {
    const wrapper = mount(ContractInstanceProbe, {
      props: { owner, includeForms: false },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    return wrapper;
  }
  it("放弃同生命期冲突后可以继续编辑当前对象", async () => {
    const w = probe("review-discard");
    await flushPromises();
    const edit = async (value: string) => {
      await w.get('[data-property-target="approval_1"] [data-test="drawer-name"]').setValue(value);
      await flushPromises();
    };
    await edit("旧输入");
    await w
      .findAll("button")
      .find((b) => b.text() === "实验：外部改首节点名称")!
      .trigger("click");
    await w
      .findAll("button")
      .find((b) => b.text() === "明确放弃旧输入")!
      .trigger("click");
    await flushPromises();
    await edit("放弃后新输入");
    await w
      .findAll("button")
      .find((b) => b.text() === "应用")!
      .trigger("click");
    await flushPromises();
    expect(w.vm.controller.model.elementOf("approval_1").get("name")).toBe("放弃后新输入");
  });
  it("还原后的显示基线不能被下一次输入悄悄重置", async () => {
    const w = probe("review-restore");
    await flushPromises();
    await w
      .findAll("button")
      .find((b) => b.text() === "还原")!
      .trigger("click");
    await flushPromises();
    w.vm.controller.model.elementOf("approval_1").set("assignee", "external-new");
    await w
      .get('[data-property-target="approval_1"] [data-test="drawer-name"]')
      .setValue("只改名称");
    await flushPromises();
    const target = w.vm.controller.target("node", "approval_1", "properties");
    if (!target.ok) throw new Error(target.message);
    const result = await w.vm.controller.apply(target.value);
    expect(result).toMatchObject({ ok: false, code: "conflict" });
    expect(w.vm.controller.model.elementOf("approval_1").get("assignee")).toBe("external-new");
  });
  it("失焦过程中宿主更新模型仍拒绝覆盖并保留本地输入", async () => {
    const w = probe("review-blur");
    await flushPromises();
    const field = w.get('[data-property-target="approval_1"] [data-test="drawer-name"]');
    await field.setValue("我的名称");
    await flushPromises();
    const input = field.element as HTMLInputElement;
    input.addEventListener(
      "blur",
      () => {
        w.vm.controller.model.elementOf("approval_1").set("assignee", "external-on-blur");
      },
      { once: true },
    );
    input.focus();
    const target = w.vm.controller.target("node", "approval_1", "properties");
    if (!target.ok) throw new Error(target.message);
    const result = await w.vm.controller.apply(target.value);
    expect(result).toMatchObject({ ok: false });
    expect(w.vm.controller.model.elementOf("approval_1").get("assignee")).toBe("external-on-blur");
    expect(w.vm.controller.drafts.input(target.value)).toMatchObject({ name: "我的名称" });
  });
});

describe("四项P2的真实组件回归", () => {
  it("表单还原后下一次候选不复活已放弃字段且保留其他表单输入", async () => {
    // 两张空表单足以复现内部字段复活，避免将八类控件全量初始化带入此接缝回归。
    const w = mount(ContractInstanceProbe, {
      props: { owner: "p2-form-restore", includeForms: false },
      attachTo: document.body,
    });
    mounted.push(w);
    await flushPromises();
    const c = w.vm.controller;
    const t = c.createForm("表单一"),
      other = c.createForm("表单二");
    if (!t.ok || !other.ok) throw new Error("创建失败");
    await flushPromises();
    const node = c.store.resolve(t.value.ref);
    const button = (text: string) => w.findAll("button").find((b) => b.text() === text)!;
    for (const [name, id] of [
      ["表单一", "form_1"],
      ["表单二", "form_2"],
    ]) {
      await button(`编辑 ${name} · ${id}`).trigger("click");
      await flushPromises();
      const view = w.get(`[data-form-id="${id}"]`);
      expect(view.isVisible()).toBe(true);
      await view
        .findAll("._fc-l-item")
        .find((item) => item.text() === "输入框")!
        .trigger("click");
      await flushPromises();
    }
    await button("编辑 表单一 · form_1").trigger("click");
    await flushPromises();
    const oldLease = c.store.editor(t.value)!.lease;
    const live = c.store.editor(t.value)!.adapter.capture();
    if (live?.kind !== "form-content") throw new Error("捕获失败");
    expect(JSON.parse(live.rules)).toHaveLength(1);
    expect(c.restore(t.value)).toMatchObject({ ok: true });
    await flushPromises();
    expect(c.store.resolve(t.value.ref)).toBe(node);
    const result = await c.prepare("draft-save");
    if (!result.ok) throw new Error(result.message);
    const forms: { id: string; rules: string }[] = JSON.parse(result.value.json).forms;
    expect(JSON.parse(forms.find((f) => f.id === "form_1")!.rules)).toHaveLength(0);
    expect(JSON.parse(forms.find((f) => f.id === "form_2")!.rules)).toHaveLength(1);
    expect(c.store.editor(t.value)?.lease).not.toBe(oldLease);
  }, 60000);
  it.each(["基于当前值重新编辑", "明确放弃旧输入"] as const)(
    "默认表单冲突%s后留在配置区且保留原流程选择",
    async (action) => {
      const w = mount(ContractInstanceProbe, {
        props: { owner: "p2-default", includeForms: false },
        attachTo: document.body,
      });
      mounted.push(w);
      await flushPromises();
      const button = (text: string) => w.findAll("button").find((b) => b.text() === text)!;
      await button("定位默认表单").trigger("click");
      await flushPromises();
      const t = w.vm.controller.target("process", "contract", "default-form");
      if (!t.ok) throw new Error(t.message);
      w.vm.controller.stage(t.value, { kind: "default-form", formKey: "local" });
      w.vm.controller.model.setDefaultFormKey("external");
      w.vm.refresh();
      await flushPromises();
      await button(action).trigger("click");
      await flushPromises();
      const visible = w.get('[data-test="contract-default-form"]').isVisible();
      expect(w.vm.controller.drafts.input(t.value)).toMatchObject({
        kind: "default-form",
        formKey: "external",
      });
      await button("流程实验").trigger("click");
      await flushPromises();
      const state = JSON.parse(w.get('[data-test="contract-state"]').text());
      expect({ visible, selected: state.selected.ref.id }).toEqual({
        visible: true,
        selected: "approval_1",
      });
    },
  );
});
