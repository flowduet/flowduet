// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, reactive } from "vue";
import { ElButton } from "element-plus";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import { DingtalkDesigner, resolveComponentAppearance, type ComponentAppearance } from "./index.js";

const wrappers: { unmount(): void }[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

function buildModel(): BpmnModel {
  return BpmnModel.create({ processId: "appearance_flow", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "approval", name: "经理审批", assignee: "${manager}" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "approval" })
    .addSequenceFlow({ id: "f2", sourceRef: "approval", targetRef: "end" });
}

function mountDesigner(model: BpmnModel, appearance?: unknown) {
  const wrapper = mount(DingtalkDesigner, {
    props: { model, appearance: appearance as ComponentAppearance },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

async function openApproval(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
  await flushPromises();
}

describe("公开实例外观配置（#103）", () => {
  it("合法对象省略配色与密度时补为跟随宿主和舒适档", () => {
    expect(resolveComponentAppearance({ mode: "light" })).toEqual({
      colorSource: "host",
      mode: "light",
      density: "comfortable",
    });
  });

  it("非法配置整份拒绝并保留上次有效值，同时报告字段原因", () => {
    const previous = {
      colorSource: "brand",
      mode: "dark",
      density: "compact",
    } as const;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      resolveComponentAppearance(
        { colorSource: "host", mode: "light", density: "large" },
        previous,
      ),
    ).toBe(previous);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.density"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("comfortable"));
  });

  it("null 不是省略配置，任一字段为 null 都整份拒绝", () => {
    const previous = resolveComponentAppearance({ colorSource: "brand", mode: "dark" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(resolveComponentAppearance({ colorSource: null, mode: "light" }, previous)).toBe(
      previous,
    );
    expect(resolveComponentAppearance({ mode: "light", density: null }, previous)).toBe(previous);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.colorSource"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.density"));
  });

  it("配置属性 getter 抛错时整份拒绝并告警，不向集成方逸出异常", () => {
    const previous = resolveComponentAppearance({ colorSource: "brand", mode: "dark" });
    const invalid = Object.defineProperty({}, "mode", {
      get() {
        throw new Error("getter exploded");
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => resolveComponentAppearance(invalid, previous)).not.toThrow();
    expect(resolveComponentAppearance(invalid, previous)).toBe(previous);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("getter exploded"));
  });

  it("公开组件传合法紧凑配置后，抽屉与真实 EP 控件使用 small", async () => {
    const wrapper = mountDesigner(buildModel(), {
      colorSource: "brand",
      mode: "dark",
      density: "compact",
    });
    await openApproval(wrapper);

    const drawer = document.querySelector<HTMLElement>('[data-test="node-drawer"]');
    expect(drawer?.classList.contains("flowduet-appearance")).toBe(true);
    expect(drawer?.classList.contains("flowduet-appearance--brand")).toBe(true);
    expect(drawer?.style.getPropertyValue("--fd-control-height")).toBe("24px");
    expect(drawer?.style.getPropertyValue("--el-color-primary")).toBe("#A5BBFF");
    expect(drawer?.style.getPropertyValue("--fd-on-primary")).toBe("#171F3E");
    expect(drawer?.style.getPropertyValue("--fd-surface")).toBe("#1D2435");
    expect(drawer?.style.getPropertyValue("--fd-primary-soft")).toBe("#2A3354");
    expect(drawer?.style.getPropertyValue("--fd-radius")).toBe("8px");
    expect(
      document
        .querySelector('[data-test="drawer-name"]')
        ?.closest(".el-input")
        ?.classList.contains("el-input--small"),
    ).toBe(true);
    expect(document.querySelector('[data-test="drawer-save"]')?.classList).toContain(
      "el-button--small",
    );
  });

  it("跟随宿主时读取当前 EP 角色派生自有变量，实例范围不写任何 EP 变量", async () => {
    const wrapper = mountDesigner(buildModel());
    const host = wrapper.element as HTMLElement;
    const hostValues: Record<string, string> = {
      "--el-color-primary": "#409EFF",
      "--el-color-primary-light-3": "#79BBFF",
      "--el-color-primary-dark-2": "#337ECC",
      "--el-color-white": "#FFFFFF",
      "--el-bg-color-page": "#F2F3F5",
      "--el-bg-color": "#FFFFFF",
      "--el-fill-color-light": "#F5F7FA",
      "--el-text-color-primary": "#303133",
      "--el-text-color-regular": "#606266",
      "--el-border-color-light": "#E4E7ED",
      "--el-disabled-text-color": "#A8ABB2",
      "--el-disabled-bg-color": "#F5F7FA",
      "--el-font-family": "Host Sans, sans-serif",
      "--el-font-size-base": "14px",
      "--el-border-radius-base": "4px",
    };
    for (const [name, value] of Object.entries(hostValues)) host.style.setProperty(name, value);
    await wrapper.setProps({ appearance: { mode: "light" } });
    await openApproval(wrapper);

    const drawer = document.querySelector<HTMLElement>('[data-test="node-drawer"]')!;
    expect(drawer.style.getPropertyValue("--fd-primary-ink")).toBe("#006EC6");
    expect(drawer.style.getPropertyValue("--fd-primary-soft")).toBe("#E6F2FF");
    expect(drawer.style.getPropertyValue("--fd-muted")).toBe("#6E6F70");
    expect(drawer.style.getPropertyValue("--fd-control-border")).toBe("#8B8C8D");
    expect(drawer.style.getPropertyValue("--fd-font-family")).toBe("Host Sans, sans-serif");
    expect(drawer.getAttribute("style")).not.toContain("--el-");
  });

  it("宿主以 rgb() 声明主色时按同一 R2 规则派生，不回退默认蓝", async () => {
    const wrapper = mountDesigner(buildModel());
    (wrapper.element as HTMLElement).style.setProperty("--el-color-primary", "rgb(15, 107, 101)");
    await wrapper.setProps({ appearance: { mode: "light" } });
    await openApproval(wrapper);

    const drawer = document.querySelector<HTMLElement>('[data-test="node-drawer"]')!;
    expect(drawer.style.getPropertyValue("--fd-primary")).toBe("#0F6B65");
    expect(drawer.style.getPropertyValue("--fd-primary-soft")).toBe("#DFF6F3");
    expect(drawer.style.getPropertyValue("--fd-primary-ink")).toBe("#0F6B65");
  });

  it("完成方式在新外观下同时用文字和边框表达选中，不只换颜色", async () => {
    const wrapper = mountDesigner(buildModel(), { mode: "light" });
    await openApproval(wrapper);
    const countersign = document.querySelector<HTMLButtonElement>('[data-test="kind-all"]')!;
    countersign.click();
    await flushPromises();

    expect(countersign.getAttribute("aria-pressed")).toBe("true");
    expect(countersign.textContent).toContain("已选中");
    const single = document.querySelector<HTMLButtonElement>('[data-test="kind-single"]')!;
    expect(single.getAttribute("aria-pressed")).toBe("false");
    expect(single.textContent).not.toContain("已选中");
  });

  it("运行中切换外观和启停适配保留输入 DOM、焦点与草稿，不改 BPMN XML", async () => {
    const model = buildModel();
    const beforeXml = (await model.toXML()).xml;
    const wrapper = mountDesigner(model, { mode: "light" });
    await openApproval(wrapper);
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!;
    input.value = "尚未提交的中文名称";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    await flushPromises();

    await wrapper.setProps({
      appearance: { colorSource: "brand", mode: "dark", density: "compact" },
    });
    expect(document.querySelector('[data-test="drawer-name"]')).toBe(input);
    expect(input.value).toBe("尚未提交的中文名称");
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('[data-test="node-drawer"]')?.classList).toContain(
      "flowduet-appearance--dark",
    );

    await wrapper.setProps({ appearance: undefined });
    expect(document.querySelector('[data-test="node-drawer"]')?.classList).not.toContain(
      "flowduet-appearance",
    );
    expect(document.querySelector('[data-test="drawer-name"]')).toBe(input);
    expect(input.value).toBe("尚未提交的中文名称");
    expect(document.activeElement).toBe(input);

    await wrapper.setProps({ appearance: { mode: "light" } });
    expect(document.querySelector('[data-test="node-drawer"]')?.classList).toContain(
      "flowduet-appearance",
    );
    expect(document.querySelector('[data-test="drawer-name"]')).toBe(input);
    expect(input.value).toBe("尚未提交的中文名称");
    expect(document.activeElement).toBe(input);
    expect((await model.toXML()).xml).toBe(beforeXml);
    expect(wrapper.emitted("change")).toBeUndefined();
  });

  it("非法配置保留上次有效呈现；合法停用后的非法输入不会复活旧主题", async () => {
    const model = buildModel();
    const beforeXml = (await model.toXML()).xml;
    const wrapper = mountDesigner(model, { mode: "light" });
    await openApproval(wrapper);
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!;
    input.value = "保留这份草稿";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    const drawer = document.querySelector<HTMLElement>('[data-test="node-drawer"]')!;
    const originalPrimary = drawer.style.getPropertyValue("--fd-primary");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    (wrapper.element as HTMLElement).style.setProperty("--el-color-primary", "#000000");
    await wrapper.setProps({
      appearance: { mode: "dark", density: "large" } as unknown as ComponentAppearance,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.density"));
    expect(drawer.style.getPropertyValue("--fd-primary")).toBe(originalPrimary);
    expect(drawer.classList).toContain("flowduet-appearance--light");
    expect(document.querySelector('[data-test="drawer-name"]')).toBe(input);
    expect(input.value).toBe("保留这份草稿");
    expect(document.activeElement).toBe(input);

    await wrapper.setProps({ appearance: undefined });
    expect(drawer.classList).not.toContain("flowduet-appearance");
    await wrapper.setProps({ appearance: { mode: "not-theme" } as unknown as ComponentAppearance });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.mode"));
    expect(drawer.classList).not.toContain("flowduet-appearance");
    expect(input.value).toBe("保留这份草稿");
    expect((await model.toXML()).xml).toBe(beforeXml);
  });

  it("公开组件消费 getter 异常配置时不炸渲染，并保留有效呈现与草稿", async () => {
    const errors: unknown[] = [];
    const wrapper = mount(DingtalkDesigner, {
      props: { model: buildModel(), appearance: { colorSource: "brand", mode: "dark" } },
      global: { config: { errorHandler: (error) => errors.push(error) } },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await openApproval(wrapper);
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!;
    input.value = "getter 前的草稿";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const invalid = reactive(
      Object.defineProperty({}, "mode", {
        enumerable: true,
        get() {
          throw new Error("component getter exploded");
        },
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await wrapper.setProps({ appearance: invalid as ComponentAppearance });
    expect(errors).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("component getter exploded"));
    expect(document.querySelector('[data-test="node-drawer"]')?.classList).toContain(
      "flowduet-appearance--dark",
    );
    expect(input.value).toBe("getter 前的草稿");
  });

  it("输入法组合期间切换外观不丢字、不自动提交，显式确定仍受既有保护", async () => {
    const model = buildModel();
    const beforeXml = (await model.toXML()).xml;
    const wrapper = mountDesigner(model, { colorSource: "brand", mode: "light" });
    await openApproval(wrapper);
    const input = document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!;
    input.focus();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "组合中的中文";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    await flushPromises();

    await wrapper.setProps({
      appearance: { colorSource: "brand", mode: "dark", density: "compact" },
    });
    expect(document.querySelector('[data-test="drawer-name"]')).toBe(input);
    expect(input.value).toBe("组合中的中文");
    expect(document.activeElement).toBe(input);
    expect((await model.toXML()).xml).toBe(beforeXml);
    expect(wrapper.emitted("change")).toBeUndefined();

    (document.querySelector('[data-test="drawer-save"]') as HTMLElement).click();
    await flushPromises();
    expect(wrapper.find('[data-test="action-error"]').text()).toContain("输入法尚未完成");
    expect(input.value).toBe("组合中的中文");
    expect((await model.toXML()).xml).toBe(beforeXml);
  });

  it("同一 Vue app 双实例独立切换和卸载，不污染另一实例或无关宿主控件", async () => {
    const firstModel = buildModel();
    const secondModel = buildModel();
    const Host = defineComponent({
      components: { DingtalkDesigner, ElButton },
      data() {
        return {
          firstModel,
          secondModel,
          showFirst: true,
          firstAppearance: { mode: "light" } as ComponentAppearance | undefined,
          secondAppearance: {
            colorSource: "brand",
            mode: "dark",
            density: "compact",
          } as ComponentAppearance,
        };
      },
      template: `
        <div>
          <ElButton data-test="host-control">无关宿主控件</ElButton>
          <button data-test="switch-first" @click="firstAppearance = { colorSource: 'brand', mode: 'light', density: 'compact' }">切换第一个</button>
          <button data-test="unmount-first" @click="showFirst = false">卸载第一个</button>
          <DingtalkDesigner v-if="showFirst" data-test="first-designer" :model="firstModel" :appearance="firstAppearance" />
          <DingtalkDesigner data-test="second-designer" :model="secondModel" :appearance="secondAppearance" />
        </div>
      `,
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrappers.push(wrapper);
    const htmlClass = document.documentElement.className;
    const open = async (id: string) => {
      const cards = document.querySelectorAll(`[data-test="${id}"] [data-test="node-card"]`);
      (cards[1] as HTMLElement).click();
      await flushPromises();
    };
    await open("first-designer");
    await open("second-designer");

    const firstDrawer = document.querySelector<HTMLElement>(".flowduet-appearance--host")!;
    const secondDrawer = document.querySelector<HTMLElement>(".flowduet-appearance--brand")!;
    expect(firstDrawer.getAttribute("style")).not.toContain("--el-");
    expect(secondDrawer.style.getPropertyValue("--el-color-primary")).toBe("#A5BBFF");
    const secondStyle = secondDrawer.getAttribute("style");
    const hostControl = document.querySelector<HTMLElement>('[data-test="host-control"]')!;
    const hostControlStyle = hostControl.getAttribute("style");

    (document.querySelector('[data-test="switch-first"]') as HTMLElement).click();
    await flushPromises();
    expect(firstDrawer.classList).toContain("flowduet-appearance--light");
    expect(firstDrawer.style.getPropertyValue("--el-color-primary")).toBe("#2D3E97");
    expect(secondDrawer.getAttribute("style")).toBe(secondStyle);
    expect(hostControl.getAttribute("style")).toBe(hostControlStyle);
    expect(hostControl.classList).not.toContain("flowduet-appearance");
    expect(document.documentElement.className).toBe(htmlClass);

    (document.querySelector('[data-test="unmount-first"]') as HTMLElement).click();
    await flushPromises();
    expect(firstDrawer.isConnected).toBe(false);
    expect(secondDrawer.isConnected).toBe(true);
    expect(secondDrawer.getAttribute("style")).toBe(secondStyle);
    expect(hostControl.getAttribute("style")).toBe(hostControlStyle);
  });

  it("外置属性编辑接受合法外观配置但不渲染抽屉，首次非法配置保持旧路径", async () => {
    const model = buildModel();
    const external = mount(DingtalkDesigner, {
      props: {
        model,
        propertyEditing: "external",
        appearance: { colorSource: "brand", mode: "dark" },
      },
      attachTo: document.body,
    });
    wrappers.push(external);
    await external.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    expect(external.emitted("selection-request")).toBeTruthy();
    expect(document.querySelector('[data-test="node-drawer"]')).toBeNull();
    expect(document.querySelector(".flowduet-appearance")).toBeNull();
    external.unmount();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const invalid = mountDesigner(buildModel(), { density: "compact" });
    await openApproval(invalid);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("appearance.mode"));
    const drawer = document.querySelector<HTMLElement>('[data-test="node-drawer"]')!;
    expect(drawer.classList).not.toContain("flowduet-appearance");
    expect(drawer.getAttribute("style")).not.toContain("--fd-");
  });

  it("发起与结束节点的新外观空状态使用中性标题，并可取消关闭", async () => {
    const wrapper = mountDesigner(buildModel(), { mode: "light" });
    for (const index of [0, 2]) {
      await wrapper.findAll('[data-test="node-card"]')[index]!.trigger("click");
      await flushPromises();
      expect(document.querySelector(".el-drawer__title")?.textContent).toBe("节点属性");
      expect(document.querySelector(".drawer-empty")?.textContent).toBe("该元素无可配置字段");
      (document.querySelector('[data-test="drawer-cancel"]') as HTMLElement).click();
      await flushPromises();
    }
  });
});
