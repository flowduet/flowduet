import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "./App.vue";

let wrapper: ReturnType<typeof mount> | undefined;

// happy-dom 缺 ResizeObserver，VueFlow 初始化需要——与 designer canvas 测试同款最小桩
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

/** 直接向文件选择器注入 File（happy-dom 下 files 为只读 FileList） */
function pickFile(target: ReturnType<typeof mount>, json: string): void {
  const input = target.find<HTMLInputElement>('input[data-test="open-doc-input"]');
  Object.defineProperty(input.element, "files", {
    value: [new File([json], "design.flowduet.json", { type: "application/json" })],
    configurable: true,
  });
}

describe("Playground 与 designer 的导出链路", () => {
  it("插入抄送草稿后自动与手动导出均报错，配置收件人后自动恢复 XML", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(true);

    await wrapper.find('[data-test="insert-btn-approval_1"]').trigger("click");
    await flushPromises();
    const ccMenuItem = document.querySelector<HTMLElement>('[data-test="insert-kind-cc"]');
    expect(ccMenuItem).not.toBeNull();
    ccMenuItem!.click();
    await flushPromises();

    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("收件人");
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(false);

    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("收件人");

    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .find((card) => card.text().includes("抄送节点"));
    expect(ccCard).toBeDefined();
    await ccCard!.trigger("click");
    await flushPromises();
    const recipients = document.querySelector<HTMLInputElement>('[data-test="drawer-recipients"]');
    expect(recipients).not.toBeNull();
    recipients!.value = "李四";
    recipients!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    await flushPromises();
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-preview"]').text()).toContain('flowable:ccTo="李四"');
      },
      { timeout: 3000 },
    );

    expect(wrapper.find('[data-test="xml-error"]').exists()).toBe(false);
  });
});

describe("Playground 设计文档闭环（#71：保存 → 打开 → 继续编辑）", () => {
  it("打开省略节点连线标记的标准 BPMN 后，可通过设计器继续增删节点", async () => {
    wrapper = mount(App, { attachTo: document.body });
    const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs" targetNamespace="urn:test">
      <bpmn:process id="standard_flow" isExecutable="true">
        <bpmn:startEvent id="s" />
        <bpmn:userTask id="t" name="原审批" />
        <bpmn:endEvent id="e" />
        <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t" />
        <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e" />
      </bpmn:process>
    </bpmn:definitions>`;
    pickFile(
      wrapper,
      JSON.stringify({ format: "flowduet.design", version: 1, engine: "flowable", xml, forms: [] }),
    );
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已打开设计文档");
    const count = wrapper.findAll('[data-test="node-card"]').length;

    await wrapper.find('[data-test="insert-btn-t"]').trigger("click");
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="insert-kind-approval"]')!.click();
    await flushPromises();

    expect(wrapper.find('[data-test="action-error"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(count + 1);

    await wrapper.find('[data-test="node-delete-t"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="action-error"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(count);
    expect(wrapper.text()).not.toContain("原审批");
  });

  it("新建草稿可保存并报告待修复项；配齐后下载文档，从文件打开继续编辑，双视图同一新模型", async () => {
    wrapper = mount(App, { attachTo: document.body });

    // 新建最小流程：审批人未配是业务草稿——部署导出被拦截，保存不受影响
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已新建设计");
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-error"]').text()).toContain("审批人");
      },
      { timeout: 3000 },
    );

    // 草稿保存：成功 + 报告待修复项（与部署导出的拦截形成对照）
    const createdDraft: Blob[] = [];
    const objectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob: Blob): string => {
        createdDraft.push(blob);
        return "blob:mock";
      });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await wrapper.find('[data-test="save-doc-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("待修复 1 项");
    expect(JSON.parse(await createdDraft[0]!.text()).format).toBe("flowduet.design");

    // 继续编辑：插入抄送节点并配置收件人
    await wrapper.find('[data-test="insert-btn-approval_1"]').trigger("click");
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="insert-kind-cc"]')!.click();
    await flushPromises();
    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .find((card) => card.text().includes("抄送节点"));
    expect(ccCard).toBeDefined();
    await ccCard!.trigger("click");
    await flushPromises();
    const recipients = document.querySelector<HTMLInputElement>('[data-test="drawer-recipients"]');
    recipients!.value = "王五";
    recipients!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    await flushPromises();

    // 补齐审批人，配置完整后再次保存
    const approvalCard = wrapper
      .findAll('[data-test="node-card"]')
      .find((card) => card.text().includes("审批节点"));
    await approvalCard!.trigger("click");
    await flushPromises();
    const assignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    assignee!.value = "${boss}";
    assignee!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    await flushPromises();

    await wrapper.find('[data-test="save-doc-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("无待修复项");
    const json = await createdDraft[1]!.text();
    clickSpy.mockRestore();
    objectUrlSpy.mockRestore();

    // 从文件打开：整体替换，旧实例状态不保留（演示流程节点退场）
    pickFile(wrapper, json);
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已打开设计文档");
    expect(wrapper.text()).not.toContain("合同会签");
    expect(wrapper.text()).not.toContain("演示审批流");

    // 打开后的新模型可继续编辑：导出预览展示同一新模型（抄送与审批人齐备）
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-preview"]').text()).toContain('flowable:ccTo="王五"');
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="xml-error"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("抄送节点");

    // BPMN 只读投影：切视图后画布渲染同一新模型，不保留旧实例
    await wrapper.find('[data-test="view-bpmn"]').find("input").setValue();
    await flushPromises();
    expect(wrapper.find('[data-test="bpmn-canvas"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="canvas-bpmn:ServiceTask"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("合同会签");
  });

  it("打开坏文档报错，当前编辑内容不被替换", async () => {
    wrapper = mount(App, { attachTo: document.body });
    // 演示流程在场作为「当前编辑内容」
    expect(wrapper.text()).toContain("合同会签");

    pickFile(wrapper, "{not-a-json");
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();

    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("不是合法 JSON");
    expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
    // 原模型仍在场可继续编辑
    expect(wrapper.text()).toContain("合同会签");
  });
});

describe("Playground 默认表单闭环（#72：表单 → 绑定 → 保存 → 打开 → 导出）", () => {
  it("真实组件串联：新建表单、设默认、下载文档、从文件打开恢复绑定、组合导出含默认引用", async () => {
    wrapper = mount(App, { attachTo: document.body });

    // 新建最小流程（业务草稿）
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();

    // 表单管理：新建「申请单」（内容为空表单——真实设计器的装载与内容保存
    // 在 form-create 组件测试覆盖，此处验证装配链路）
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-manager-new-name"]').setValue("申请单");
    await wrapper.find('[data-test="form-manager-create-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("申请单");

    // 流程默认表单选择条：设为 form_1；审批卡片显示继承
    const strip = wrapper.find('[data-test="default-form-select"]');
    expect(strip.exists()).toBe(true);
    await strip.setValue("form_1");
    await flushPromises();
    expect(wrapper.find('[data-test="node-form-approval_1"]').text()).toContain(
      "表单：申请单（继承默认）",
    );

    // 下载设计文档：forms 携带表单，xml 含默认引用
    const created: Blob[] = [];
    const objectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob: Blob): string => {
        created.push(blob);
        return "blob:mock";
      });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await wrapper.find('[data-test="save-doc-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已保存设计文档");
    const document_ = JSON.parse(await created[0]!.text()) as {
      forms: { id: string; name: string }[];
      xml: string;
    };
    expect(document_.forms).toEqual([expect.objectContaining({ id: "form_1", name: "申请单" })]);
    expect(document_.xml).toContain('flowduet:defaultFormKey="form_1"');
    const json = JSON.stringify(document_);
    clickSpy.mockRestore();
    objectUrlSpy.mockRestore();

    // 组合部署导出：草稿（审批人未配）被拦截，报告业务待修复项
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("审批人");

    // 新建设计替换当前状态，再从文件打开：表单与默认绑定恢复
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="node-form-approval_1"]').exists()).toBe(false);

    pickFile(wrapper, json);
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已打开设计文档");
    expect(wrapper.find('[data-test="node-form-approval_1"]').text()).toContain(
      "表单：申请单（继承默认）",
    );

    // 打开后的模型可继续编辑并导出同一绑定（抽屉补审批人后部署导出放行）
    const approvalCard = wrapper
      .findAll('[data-test="node-card"]')
      .find((card) => card.text().includes("审批节点"));
    await approvalCard!.trigger("click");
    await flushPromises();
    const assignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    assignee!.value = "${boss}";
    assignee!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    await flushPromises();
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-preview"]').text()).toContain(
          'flowduet:defaultFormKey="form_1"',
        );
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="xml-error"]').exists()).toBe(false);

    // 失效默认引用修复后，顶部诊断须随模型原位编辑立即消失。
    pickFile(
      wrapper,
      JSON.stringify({
        ...document_,
        xml: document_.xml.replace('defaultFormKey="form_1"', 'defaultFormKey="ghost_form"'),
      }),
    );
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="reference-issues"]').text()).toContain("ghost_form");
    await wrapper.find('[data-test="default-form-select"]').setValue("form_1");
    await flushPromises();
    expect(wrapper.find('[data-test="reference-issues"]').exists()).toBe(false);

    // 即使目录恰好存在同样带空格的 ID，该引用仍不允许预览。
    pickFile(
      wrapper,
      JSON.stringify({
        ...document_,
        forms: document_.forms.map((form) => ({ ...form, id: " form_1 " })),
        xml: document_.xml.replace('defaultFormKey="form_1"', 'defaultFormKey=" form_1 "'),
      }),
    );
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="preview-node-select"]').setValue("approval_1");
    await flushPromises();
    expect(wrapper.find('[data-test="preview-target-error"]').text()).toContain("引用失效");
  });

  it("流程新增审批节点后，再次打开预览能选择新节点", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();
    const before = document.querySelectorAll('[data-test="preview-node-select"] option').length;
    const close = document.querySelector<HTMLElement>(
      '[data-test="form-preview-dialog"] .el-dialog__headerbtn',
    );
    expect(close).not.toBeNull();
    close!.click();
    await flushPromises();

    await wrapper.find('[data-test="insert-btn-approval_1"]').trigger("click");
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="insert-kind-approval"]')!.click();
    await flushPromises();

    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();
    expect(document.querySelectorAll('[data-test="preview-node-select"] option')).toHaveLength(
      before + 1,
    );
  });

  it("删除当前预览节点后，重新打开预览不会解析已删除的 ID", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="preview-node-select"]').setValue("approval_1");
    await flushPromises();
    document
      .querySelector<HTMLElement>('[data-test="form-preview-dialog"] .el-dialog__headerbtn')!
      .click();
    await flushPromises();

    await wrapper.find('[data-test="node-delete-approval_1"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-test="preview-target-hint"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="preview-node-select"]').text()).not.toContain("经理审批");
  });
});
