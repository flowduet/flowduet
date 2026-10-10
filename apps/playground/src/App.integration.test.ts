import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { FlowDesignSession } from "@flowduet/form-create";
import { flowableAdapter, parse } from "@flowduet/core";
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
  // 本地草稿链路（#76）：残留会串扰下一次挂载的刷新恢复
  localStorage.clear();
});

/** 直接向文件选择器注入 File（happy-dom 下 files 为只读 FileList） */
function pickFile(
  target: ReturnType<typeof mount>,
  json: string,
  readText?: () => Promise<string>,
): void {
  const input = target.find<HTMLInputElement>('input[data-test="open-doc-input"]');
  const file = new File([json], "design.flowduet.json", { type: "application/json" });
  if (readText !== undefined) Object.defineProperty(file, "text", { value: readText });
  Object.defineProperty(input.element, "files", {
    value: [file],
    configurable: true,
  });
}

/** 原生 input 赋值并派发 input 事件（drawer 内 v-model 监听 input） */
async function setValue(input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}

/** 「+」类型菜单插入：点触发器后点 teleport 到 body 的菜单项 */
async function insertViaMenu(
  target: ReturnType<typeof mount>,
  afterId: string,
  kind: "approval" | "cc" = "approval",
): Promise<void> {
  await target.find(`[data-test="insert-btn-${afterId}"]`).trigger("click");
  await flushPromises();
  const item = document.querySelector(`[data-test="insert-kind-${kind}"]`);
  if (item instanceof HTMLElement) item.click();
  await flushPromises();
}

/** 打开新建设计中唯一的审批节点抽屉（最小流程卡片序：开始、审批、结束） */
async function openApprovalDrawer(target: ReturnType<typeof mount>): Promise<void> {
  await target.findAll('[data-test="node-card"]')[1]!.trigger("click");
  await flushPromises();
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
    // （#76 起有未保存修改时先弹替换确认，openDocument 代表用户确认替换）
    await openDocument(
      JSON.stringify({
        ...document_,
        xml: document_.xml.replace('defaultFormKey="form_1"', 'defaultFormKey="ghost_form"'),
      }),
    );
    expect(wrapper.find('[data-test="reference-issues"]').text()).toContain("ghost_form");
    // A16（表单语境）：引用失效后导出报当前错误，旧的有效 XML 不再呈现为当前结果
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("ghost_form");
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(false);
    await wrapper.find('[data-test="default-form-select"]').setValue("form_1");
    await flushPromises();
    expect(wrapper.find('[data-test="reference-issues"]').exists()).toBe(false);
    // 修复后恢复导出（A16 后半）：引用修好后仍需业务配置完整——补上审批人，
    // 当前配置重新产出有效 XML
    const ghostCard = wrapper
      .findAll('[data-test="node-card"]')
      .find((card) => card.text().includes("审批节点"));
    await ghostCard!.trigger("click");
    await flushPromises();
    const ghostAssignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    ghostAssignee!.value = "${boss}";
    ghostAssignee!.dispatchEvent(new Event("input", { bubbles: true }));
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

    // 即使目录恰好存在同样带空格的 ID，该引用仍不允许预览。
    // （#76 起有未保存修改时先弹替换确认，openDocument 代表用户确认替换）
    await openDocument(
      JSON.stringify({
        ...document_,
        forms: document_.forms.map((form) => ({ ...form, id: " form_1 " })),
        xml: document_.xml.replace('defaultFormKey="form_1"', 'defaultFormKey=" form_1 "'),
      }),
    );
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

/**
 * 多表单管理与节点覆盖闭环（#73）：双表单（默认继承 + 显式覆盖）经真实
 * 组件串联的创建、绑定、保存打开恢复、删除守卫与预览目标隔离。
 */

/** 新建设计并在表单管理面板新建多张表单（名称依次传入） */
async function setupWithForms(names: string[]): Promise<void> {
  await wrapper!.find('[data-test="new-design-btn"]').trigger("click");
  await flushPromises();
  await wrapper!.find('[data-test="form-manager-btn"]').trigger("click");
  await flushPromises();
  for (const name of names) {
    await wrapper!.find('[data-test="form-manager-new-name"]').setValue(name);
    await wrapper!.find('[data-test="form-manager-create-btn"]').trigger("click");
    await flushPromises();
  }
  document
    .querySelector<HTMLElement>('[data-test="form-manager-dialog"] .el-dialog__headerbtn')!
    .click();
  await flushPromises();
}

/** 打开指定卡片的配置抽屉（卡片按文本匹配） */
async function openCardOf(text: string): Promise<void> {
  const card = wrapper!
    .findAll('[data-test="node-card"]')
    .find((candidate) => candidate.text().includes(text));
  await card!.trigger("click");
  await flushPromises();
}

describe("Playground 多表单管理与节点覆盖闭环（#73）", () => {
  it("双表单：抽屉选覆盖、保存打开后默认/覆盖关系恢复、导出含两处引用", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await setupWithForms(["申请单", "复核单"]);

    // 默认 = 申请单；审批节点抽屉选「复核单」显式覆盖
    await wrapper.find('[data-test="default-form-select"]').setValue("form_1");
    await flushPromises();
    await openCardOf("审批节点");
    const select = document.querySelector<HTMLSelectElement>('[data-test="drawer-form-select"]');
    expect(select).not.toBeNull();
    // 继承选项呈现当前默认名，覆盖选项可区分
    expect(select!.selectedOptions[0]?.text).toContain("继承默认（申请单）");
    select!.value = "form_2";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    await flushPromises();

    // 卡片摘要：节点指定复核单（不再随默认变化）
    expect(wrapper.find('[data-test="node-form-approval_1"]').text()).toContain(
      "表单：复核单（节点指定）",
    );

    // 保存文档：forms 双表单 + xml 双引用
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
    const document_ = JSON.parse(await created[0]!.text()) as {
      forms: { id: string }[];
      xml: string;
    };
    clickSpy.mockRestore();
    objectUrlSpy.mockRestore();
    expect(document_.forms.map((form) => form.id)).toEqual(["form_1", "form_2"]);
    expect(document_.xml).toContain('flowduet:defaultFormKey="form_1"');
    expect(document_.xml).toContain('flowable:formKey="form_2"');

    // 换新设计后从文件打开：默认与覆盖关系逐项恢复
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    pickFile(wrapper, JSON.stringify(document_));
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="node-form-approval_1"]').text()).toContain(
      "表单：复核单（节点指定）",
    );
    expect(wrapper.find('[data-test="default-form-select"]').element).toHaveProperty(
      "value",
      "form_1",
    );

    // 补审批人后组合导出：部署 XML 同时携带默认与覆盖引用
    await openCardOf("审批节点");
    const assignee = document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]');
    assignee!.value = "${boss}";
    assignee!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
    await flushPromises();
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-preview"]').text()).toContain(
          'flowable:formKey="form_2"',
        );
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="xml-preview"]').text()).toContain(
      'flowduet:defaultFormKey="form_1"',
    );
  });

  it("删除守卫：被默认引用拒绝并说明位置，解除引用后可删除（A06）", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await setupWithForms(["申请单"]);

    await wrapper.find('[data-test="default-form-select"]').setValue("form_1");
    await flushPromises();

    // 删除被默认引用的表单：两段确认后错误就地反馈引用位置
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-delete-btn-form_1"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-delete-confirm-form_1"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("流程默认表单");
    expect(
      wrapper.find('[data-test="form-manager-dialog"] [data-test="form-manager-error"]').text(),
    ).toContain("流程默认表单");
    expect(wrapper.find('[data-test="form-item-form_1"]').exists()).toBe(true);

    // 解除默认引用后再删：成功，列表清空（上一轮错误横幅随操作自动清除）
    document
      .querySelector<HTMLElement>('[data-test="form-manager-dialog"] .el-dialog__headerbtn')!
      .click();
    await flushPromises();
    await wrapper.find('[data-test="default-form-select"]').setValue("");
    await flushPromises();
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="form-manager-error"]').exists()).toBe(false);
    await wrapper.find('[data-test="form-delete-btn-form_1"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-delete-confirm-form_1"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="form-manager-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="form-manager-error"]').exists()).toBe(false);
  });

  // 真实 FcDesigner 装载较重（单跑已近 4s），并发全量时给足超时上限
  it(
    "预览多目标：同表单双节点切换清理旧试填值；失效只阻止相关目标（AC5）",
    { timeout: 15000 },
    async () => {
      wrapper = mount(App, { attachTo: document.body });
      await setupWithForms(["申请单"]);

      // 给申请单塞带默认值的字段（经真实 FormDesigner 的保存通道写入目录）
      await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
      await flushPromises();
      await wrapper.find('[data-test="form-edit-btn-form_1"]').trigger("click");
      await flushPromises();
      wrapper
        .findComponent({ name: "FormDesigner" })
        .vm.$emit(
          "save",
          JSON.stringify([
            { type: "input", field: "reason", title: "申请事由", value: "默认事由" },
          ]),
          "{}",
        );
      await flushPromises();
      document
        .querySelector<HTMLElement>('[data-test="form-manager-dialog"] .el-dialog__headerbtn')!
        .click();
      await flushPromises();

      // 默认 = form_1；approval_1 显式覆盖为同一张表单（两个目标同表单不同节点）
      await wrapper.find('[data-test="default-form-select"]').setValue("form_1");
      await flushPromises();
      await openCardOf("审批节点");
      const select = document.querySelector<HTMLSelectElement>('[data-test="drawer-form-select"]');
      select!.value = "form_1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
      await flushPromises();
      document.querySelector<HTMLElement>('[data-test="drawer-save"]')!.click();
      await flushPromises();

      // 再插入一个继承节点（同样解析到 form_1）
      await wrapper.find('[data-test="insert-btn-approval_1"]').trigger("click");
      await flushPromises();
      document.querySelector<HTMLElement>('[data-test="insert-kind-approval"]')!.click();
      await flushPromises();

      // 预览覆盖节点：试填写入值
      await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
      await flushPromises();
      await wrapper.find('[data-test="preview-node-select"]').setValue("approval_1");
      await flushPromises();
      const input = document.querySelector<HTMLInputElement>(
        '[data-test="form-preview-render"] input',
      );
      expect(input).not.toBeNull();
      input!.value = "试用内容";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushPromises();
      expect(wrapper.find('[data-test="form-preview-values"]').text()).toContain("试用内容");

      // 切到继承节点：目标即重挂（同表单也不带入旧试填值）
      await wrapper.find('[data-test="preview-node-select"]').setValue("approval_2");
      await flushPromises();
      expect(wrapper.find('[data-test="form-preview"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="form-preview-values"]').text()).not.toContain("试用内容");

      // 失效只阻止相关目标：篡改覆盖节点的 key 后重开——
      // 覆盖节点预览报失效（保留原 key），继承节点仍渲染同一张有效表单
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
      clickSpy.mockRestore();
      objectUrlSpy.mockRestore();
      const document_ = JSON.parse(await created[0]!.text()) as { xml: string };
      pickFile(
        wrapper,
        JSON.stringify({
          ...document_,
          xml: document_.xml.replace('flowable:formKey="form_1"', 'flowable:formKey="ghost_form"'),
        }),
      );
      document
        .querySelector<HTMLElement>('[data-test="form-preview-dialog"] .el-dialog__headerbtn')!
        .click();
      await flushPromises();
      await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
      await flushPromises();

      await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
      await flushPromises();
      await wrapper.find('[data-test="preview-node-select"]').setValue("approval_1");
      await flushPromises();
      expect(wrapper.find('[data-test="preview-target-error"]').text()).toContain("ghost_form");
      expect(wrapper.find('[data-test="form-preview-render"]').exists()).toBe(false);

      await wrapper.find('[data-test="preview-node-select"]').setValue("approval_2");
      await flushPromises();
      expect(wrapper.find('[data-test="preview-target-error"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="form-preview-render"]').exists()).toBe(true);
    },
  );
});

/**
 * 文档兼容检查与原子打开（#75，A11–A13、A20）：
 * 经 Playground 的公开文件打开入口注入文档，验证实际解析/恢复结果——
 * 合法内容恢复、业务未配齐的以草稿打开、真正不兼容的内容明确拒绝，
 * 拒绝时先持有的未保存设计与表单目录不被部分覆盖。
 */

/** 文档 JSON 包装（默认空表单目录） */
function designDoc(xml: string, forms: unknown[] = []): string {
  return JSON.stringify({ format: "flowduet.design", version: 1, engine: "flowable", xml, forms });
}

/** 单审批节点最小流程骨架；extraAttrs 注入 userTask、decls 注入 definitions */
function minimalFlowXml(extraAttrs = "", decls = "", processAttrs = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ${decls} id="compat_defs" targetNamespace="http://example.com/compat">
  <bpmn:process id="compat_flow" name="兼容检查流程" isExecutable="true" ${processAttrs}>
    <bpmn:startEvent id="s" name="开始" />
    <bpmn:userTask id="t1" name="审批节点" ${extraAttrs} />
    <bpmn:endEvent id="e" name="结束" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t1" />
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
}

async function openDocument(json: string): Promise<void> {
  pickFile(wrapper!, json);
  await wrapper!.find('input[data-test="open-doc-input"]').trigger("change");
  await flushPromises();
  // 有未保存修改时宿主先弹替换确认（#76）：这里代表用户确认替换；
  // 打开失败路径的「未保存内容保留」断言不受影响。
  const confirm = document.querySelector<HTMLElement>('[data-test="discard-ok"]');
  if (confirm !== null) {
    confirm.click();
    await flushPromises();
  }
}

/** 只延迟文件 I/O，后续文档解析与原子恢复仍走真实公开入口。 */
function pendingFileRead(): {
  text: Promise<string>;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
} {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const text = new Promise<string>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { text, resolve, reject };
}

describe("Playground 文件读取与打开竞态（A14）", () => {
  it.each(["成功", "读取失败", "坏文档"])("旧文件迟到%s不覆盖新文件或其反馈", async (outcome) => {
    wrapper = mount(App, { attachTo: document.body });
    const oldJson = designDoc(
      minimalFlowXml('fa:assignee="oldA75"', 'xmlns:fa="http://flowable.org/bpmn"'),
    );
    const newJson = designDoc(
      minimalFlowXml('fa:assignee="newB75"', 'xmlns:fa="http://flowable.org/bpmn"').replace(
        'name="兼容检查流程"',
        'name="新请求B75"',
      ),
      [
        {
          id: "new_form",
          name: "新请求表单B75",
          provider: "form-create/element-plus",
          rules: "[]",
          options: "{}",
        },
      ],
    );
    const slow = pendingFileRead();
    pickFile(wrapper, oldJson, () => slow.text);
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await openDocument(newJson);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("新请求B75");

    if (outcome === "读取失败") slow.reject(new Error("旧文件读取失败75"));
    else slow.resolve(outcome === "坏文档" ? "{bad-json" : oldJson);
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("新请求B75");
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-preview"]').text()).toContain('assignee="newB75"');
    expect(wrapper.find('[data-test="xml-preview"]').text()).not.toContain("oldA75");
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="form-item-new_form"]').text()).toContain("新请求表单B75");
  });

  it("较新文件失败后，旧文件迟到也不能替换原未保存设计", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await setupWithForms(["未保存申请单"]);
    const slow = pendingFileRead();
    const oldJson = designDoc(minimalFlowXml());
    pickFile(wrapper, oldJson, () => slow.text);
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await openDocument("{new-bad-json");
    slow.resolve(oldJson);
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("不是合法 JSON");
    expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("审批节点");
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="form-item-form_1"]').text()).toContain("未保存申请单");
  });

  it.each(["成功", "读取失败"])("新建设计后旧文件迟到%s被忽略", async (outcome) => {
    wrapper = mount(App, { attachTo: document.body });
    const slow = pendingFileRead();
    const oldJson = designDoc(minimalFlowXml());
    pickFile(wrapper, oldJson, () => slow.text);
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    if (outcome === "读取失败") slow.reject(new Error("旧文件读取失败75"));
    else slow.resolve(oldJson);
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已新建设计");
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("审批节点");
    expect(wrapper.text()).not.toContain("兼容检查流程");
  });
});

describe("Playground 文档兼容检查与原子打开（#75）", () => {
  it("字符引用 URI 文件可打开并导出；非法 xml 重绑定文件拒绝且未保存内容不丢失", async () => {
    wrapper = mount(App, { attachTo: document.body });
    const encoded = minimalFlowXml(
      'fa:assignee="john"',
      'xmlns:fa="http://flowable.org/bp&#x6D;n"',
    );
    await openDocument(designDoc(encoded));
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    const exported = await parse(wrapper.find('[data-test="xml-preview"]').text(), {
      adapter: flowableAdapter,
      rejectWarnings: true,
      rejectUnregisteredNamespaces: true,
    });
    expect(exported.elementOf("t1").get("assignee")).toBe("john");

    await setupWithForms(["未保存申请单"]);
    const invalid = minimalFlowXml(
      'xml:assignee="john"',
      'xmlns:xml="http://camunda.org/schema/1.0/bpmn"',
    );
    await openDocument(designDoc(invalid));
    expect(wrapper.find('[data-test="doc-error"]').text()).toMatch(/xmlns:xml.*非法.*命名空间声明/);
    expect(wrapper.text()).toContain("审批节点");
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("未保存申请单");
  });

  it("导入失效表单 key 的可恢复文档：以草稿打开、key 保留并定位、预览与部署导出受阻（A11）", async () => {
    wrapper = mount(App, { attachTo: document.body });
    const xml = minimalFlowXml(
      'fa:assignee="${manager}" fa:formKey="ghost_form"',
      'xmlns:fa="http://flowable.org/bpmn" xmlns:fd="urn:flowduet:bpmn"',
      'fd:defaultFormKey="missing_form"',
    );
    const validForm = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([{ type: "input", field: "reason", title: "申请事由" }]),
      options: "{}",
    };
    await openDocument(designDoc(xml, [validForm]));

    // 草稿打开成功：不是「文档结构损坏」的报错形态
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("兼容检查流程");
    // 引用失效定位：默认与节点覆盖两条都报出，key 原样保留
    const issues = wrapper.find('[data-test="reference-issues"]').text();
    expect(issues).toContain("missing_form");
    expect(issues).toContain("ghost_form");
    expect(issues).toContain("已保留原值");

    // 相关预览受阻：覆盖节点预览报失效（不回退默认、不渲染其他表单）
    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="preview-node-select"]').setValue("t1");
    await flushPromises();
    expect(wrapper.find('[data-test="preview-target-error"]').text()).toContain("ghost_form");
    expect(wrapper.find('[data-test="form-preview-render"]').exists()).toBe(false);

    // 部署导出受阻：组合校验拦截失效引用（草稿不冒充可部署产物）
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("missing_form");
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(false);
  });

  it("先持有未保存设计与表单目录，打开失败后全部保留（A12）", async () => {
    wrapper = mount(App, { attachTo: document.body });
    // 未保存状态 = 新建的最小流程 + 目录里新建的表单（从未点过下载）
    await setupWithForms(["未保存申请单"]);
    expect(wrapper.text()).toContain("审批节点");

    // 未知引擎：拒绝
    await openDocument(
      JSON.stringify({
        format: "flowduet.design",
        version: 1,
        engine: "camunda",
        xml: minimalFlowXml(),
        forms: [],
      }),
    );
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("不支持的目标引擎");
    expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
    // 未保存的模型与表单目录原样在场
    expect(wrapper.text()).toContain("审批节点");
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("未保存申请单");

    // 坏 XML：同样拒绝且不部分覆盖（表单管理弹窗开着也不受影响）
    await openDocument(designDoc("<bpmn:not-closed"));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("文档 XML 无法解析");
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("未保存申请单");

    // 假 flowable 前缀但 URI 不匹配：按实际 URI 拒绝
    const fakePrefixXml = minimalFlowXml(
      'flowable:assignee="${manager}"',
      'xmlns:flowable="http://vendor.example/private-ns"',
    );
    await openDocument(designDoc(fakePrefixXml));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("不支持的扩展");
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("未保存申请单");

    // 重复表单 ID 与未知提供者：目录级拒绝（其余组合由 document.test.ts 单测兜底）
    const baseForm = {
      id: "form_dup",
      name: "重复项",
      provider: "form-create/element-plus",
      rules: "[]",
      options: "{}",
    };
    await openDocument(designDoc(minimalFlowXml(), [baseForm, { ...baseForm, name: "再来一份" }]));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("id 重复");
    await openDocument(
      designDoc(minimalFlowXml(), [{ ...baseForm, provider: "other-vendor/antd" }]),
    );
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain(
      "只支持 form-create/element-plus",
    );
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("未保存申请单");
    document
      .querySelector<HTMLElement>('[data-test="form-manager-dialog"] .el-dialog__headerbtn')!
      .click();
    await flushPromises();
    expect(wrapper.text()).toContain("审批节点");
  });

  it("多流程、超编辑子集与超表单范围的文档拒绝打开并点名（A13）", async () => {
    wrapper = mount(App, { attachTo: document.body });
    expect(wrapper.text()).toContain("合同会签");

    const multiProcessXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="multi_defs" targetNamespace="http://example.com/multi">
  <bpmn:process id="flow_a" isExecutable="true">
    <bpmn:startEvent id="a_s" />
    <bpmn:endEvent id="a_e" />
    <bpmn:sequenceFlow id="a_f1" sourceRef="a_s" targetRef="a_e" />
  </bpmn:process>
  <bpmn:process id="flow_b" isExecutable="true">
    <bpmn:startEvent id="b_s" />
    <bpmn:endEvent id="b_e" />
    <bpmn:sequenceFlow id="b_f1" sourceRef="b_s" targetRef="b_e" />
  </bpmn:process>
</bpmn:definitions>`;
    await openDocument(designDoc(multiProcessXml));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("2 个流程");

    const scriptTaskXml = minimalFlowXml().replace(
      '<bpmn:userTask id="t1" name="审批节点"  />',
      '<bpmn:scriptTask id="t1" name="系统脚本" />',
    );
    await openDocument(designDoc(scriptTaskXml));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("t1");
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("ScriptTask");

    const uploadForm = {
      id: "form_upload",
      name: "上传表单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([{ type: "upload", field: "attachment", title: "附件" }]),
      options: "{}",
    };
    await openDocument(designDoc(minimalFlowXml(), [uploadForm]));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("支持的组件");

    // 三次拒绝后当前演示设计原样在场
    expect(wrapper.text()).toContain("合同会签");
  });

  it("标准草稿无 Flowable 扩展可打开；缺审批人仍拦截部署导出（A20 前半）", async () => {
    wrapper = mount(App, { attachTo: document.body });
    // flowableAdapter 产出的未配置审批人标准流程：无任何 Flowable 扩展声明与使用
    const standardXml = minimalFlowXml();
    await openDocument(designDoc(standardXml));

    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("兼容检查流程");
    expect(wrapper.findAll('[data-test="node-card"]').length).toBeGreaterThan(0);

    // 缺业务配置：打开为草稿可以，部署导出被拦（不因「能打开」冒充可部署）
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("审批人");
  });

  it("前缀更名 URI 不变可识别、未使用声明放行、实际使用冲突扩展拒绝（A20 后半）", async () => {
    wrapper = mount(App, { attachTo: document.body });

    // fa 前缀 + 正确 flowable URI：assignee 语义恢复
    const renamedXml = minimalFlowXml(
      'fa:assignee="${manager}"',
      'xmlns:fa="http://flowable.org/bpmn"',
    );
    await openDocument(designDoc(renamedXml));
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("兼容检查流程");

    // 仅声明未使用的 camunda 命名空间：不构成冲突
    const declaredOnlyXml = minimalFlowXml(
      "",
      'xmlns:camunda="http://camunda.org/schema/1.0/bpmn"',
    );
    await openDocument(designDoc(declaredOnlyXml));
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    const nodeCardCount = wrapper.findAll('[data-test="node-card"]').length;

    // 实际使用 camunda 扩展：按 URI 拒绝（前缀叫什么不重要）
    const actuallyUsedXml = minimalFlowXml(
      'camunda:assignee="demo"',
      'xmlns:camunda="http://camunda.org/schema/1.0/bpmn"',
    );
    await openDocument(designDoc(actuallyUsedXml));
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("camunda:assignee");
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain(
      "http://camunda.org/schema/1.0/bpmn",
    );
    // 拒绝后当前设计仍是上一次成功打开的内容（打开尝试会清空状态文案，以节点为准）
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(nodeCardCount);
  });
});

describe("Playground 本地草稿与未完成设计保护（#76）", () => {
  it("A07：抽屉输入未确认即保存草稿，刷新后恢复收集到的内容且部署导出仍受阻", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "初审节点",
    );

    // 抽屉不点确定，直接保存草稿：当前输入必须被收集，不能只保存旧模型
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已保存到本地");
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);

    // 审批人未配齐是业务草稿：部署导出仍被拦截
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-error"]').text()).toContain("审批人");
      },
      { timeout: 3000 },
    );

    // 卸载重挂 = 刷新：本地草稿恢复，抽屉里收集过的节点名在场
    wrapper.unmount();
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已恢复本地草稿");
    expect(wrapper.text()).toContain("初审节点");
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-error"]').text()).toContain("审批人");
      },
      { timeout: 3000 },
    );
  });

  it("收集被抽屉守卫拦截时中止保存：错误可见且不显示保存成功（AC2）", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    await openApprovalDrawer(wrapper);
    // 切会签 + 表达式形态的审批人：格式非法（守卫不可绕过），非业务草稿
    document.querySelector<HTMLElement>('[data-test="kind-all"]')!.click();
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "${managers}",
    );

    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("抽屉");
    expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
    expect(localStorage.getItem("flowduet.playground.design")).toBeNull();
    // 抽屉保持打开、输入保留供修正；修正为合法集合变量后保存成功
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "${managers}",
    );
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "managers",
    );
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已保存到本地");
  });

  it("AC7：恢复含有效表单定义的草稿后可继续试填，试填不落本地草稿", async () => {
    wrapper = mount(App, { attachTo: document.body });
    const form = {
      id: "form_apply",
      name: "申请单",
      provider: "form-create/element-plus",
      rules: JSON.stringify([{ type: "input", field: "reason", title: "申请事由" }]),
      options: "{}",
    };
    const xml = minimalFlowXml(
      'fa:assignee="${manager}"',
      'xmlns:fa="http://flowable.org/bpmn" xmlns:fd="urn:flowduet:bpmn"',
      'fd:defaultFormKey="form_apply"',
    );
    await openDocument(designDoc(xml, [form]));
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已保存到本地");

    // 刷新恢复：表单目录与默认绑定都在，可继续试填
    wrapper.unmount();
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已恢复本地草稿");
    await wrapper.find('[data-test="form-preview-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="preview-node-select"]').setValue("t1");
    await flushPromises();
    const previewInput = document.querySelector<HTMLInputElement>(
      '[data-test="form-preview-render"] input',
    );
    expect(previewInput).not.toBeNull();
    previewInput!.value = "预览试填事由";
    previewInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await wrapper.find('[data-test="form-preview-dialog"] .el-dialog__headerbtn').trigger("click");
    await flushPromises();

    // 再保存一次：本地草稿中的表单规则不含试填值（试填与设计隔离）
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    const saved = JSON.parse(localStorage.getItem("flowduet.playground.design")!);
    expect(JSON.stringify(saved.forms[0]!.rules)).not.toContain("预览试填");
  });

  it("A15：本地草稿与文件下载/打开复用同一文档合同，两条途径恢复结果一致", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "初审节点",
    );
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    const localJson = localStorage.getItem("flowduet.playground.design");
    expect(localJson).not.toBeNull();
    expect(JSON.parse(localJson!).format).toBe("flowduet.design");

    // 文件打开走同一 openDesignDocument 合同：同内容文件恢复结果与本地一致
    wrapper.unmount();
    localStorage.clear();
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
    pickFile(wrapper, localJson!);
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已打开设计文档");
    // 与本地恢复同内容：同一快照打开后再保存，产物与原本地草稿逐字一致
    expect(wrapper.text()).toContain("初审节点");
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(localStorage.getItem("flowduet.playground.design")).toBe(localJson);
  });

  it("A14：本地存储写入被拒时不显示保存成功，错误可见", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    try {
      await wrapper.find('[data-test="save-local-btn"]').trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-test="doc-error"]').text()).toContain("本地存储");
      expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
    } finally {
      setItemSpy.mockRestore();
    }
  });
});

describe("Playground 未保存替换提示（#76：新建/打开前确认）", () => {
  it("打开文件前提示替换影响；取消后模型、表单、未提交输入与未保存状态全部保持", async () => {
    wrapper = mount(App, { attachTo: document.body });
    // 未保存内容同时含表单目录：取消替换后必须一并保留
    await setupWithForms(["未保存申请单"]);
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "初审节点",
    );
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(true);

    pickFile(
      wrapper,
      designDoc(minimalFlowXml('fa:assignee="${manager}"', 'xmlns:fa="http://flowable.org/bpmn"')),
    );
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await flushPromises();

    const dialog = wrapper.find('[data-test="discard-dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("未保存");
    document.querySelector<HTMLElement>('[data-test="discard-cancel"]')!.click();
    await flushPromises();

    // 取消 = 什么都不动：未保存标记、抽屉缓冲、当前模型全部保持
    expect(wrapper.find('[data-test="discard-dialog"]').isVisible()).toBe(false);
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(true);
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!.value).toBe(
      "初审节点",
    );
    expect(wrapper.text()).toContain("审批节点");
    // 表单目录原样在场（AC4：模型、表单、未提交输入、未保存状态全部保持）
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-test=form-item-form_1]").text()).toContain("未保存申请单");
    expect(wrapper.text()).not.toContain("已打开设计文档");
  });

  it("确认替换后载入新文档并重置未保存状态", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "会被替换的名字",
    );
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(true);

    pickFile(
      wrapper,
      designDoc(minimalFlowXml('fa:assignee="${manager}"', 'xmlns:fa="http://flowable.org/bpmn"')),
    );
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="discard-ok"]')!.click();
    await flushPromises();

    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已打开设计文档");
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(false);
  });

  it("无未保存修改时打开文件直通，不弹替换确认", async () => {
    wrapper = mount(App, { attachTo: document.body });
    pickFile(
      wrapper,
      designDoc(minimalFlowXml('fa:assignee="${manager}"', 'xmlns:fa="http://flowable.org/bpmn"')),
    );
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已打开设计文档");
    expect(wrapper.find('[data-test="discard-dialog"]').exists()).toBe(false);
  });

  it("新建设计同样受替换提示保护；确认后载入最小流程并重置未保存状态", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    await insertViaMenu(wrapper, "start");
    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(4);
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(true);

    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    document.querySelector<HTMLElement>('[data-test="discard-ok"]')!.click();
    await flushPromises();

    expect(wrapper.findAll('[data-test="node-card"]')).toHaveLength(3);
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已新建设计");
  });
});

describe("Playground 表单目录联动导出预览（A16 目录侧，#76）", () => {
  it("修复失效引用后 XML 预览自动恢复：旧错误不再冒充当前结果", async () => {
    wrapper = mount(App, { attachTo: document.body });
    // 默认 key 指向不存在的 form_1：部署导出被引用完整性校验拦截
    const xml = minimalFlowXml(
      'fa:assignee="${manager}"',
      'xmlns:fa="http://flowable.org/bpmn" xmlns:fd="urn:flowduet:bpmn"',
      'fd:defaultFormKey="form_1"',
    );
    await openDocument(designDoc(xml));
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("form_1");
      },
      { timeout: 3000 },
    );

    // 新建表单（目录自动分配 id=form_1）修复引用：目录变化必须重刷导出预览
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="form-manager-new-name"]').setValue("申请单");
    await wrapper.find('[data-test="form-manager-create-btn"]').trigger("click");
    await flushPromises();
    document
      .querySelector<HTMLElement>('[data-test="form-manager-dialog"] .el-dialog__headerbtn')!
      .click();
    await flushPromises();

    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-preview"]').text()).toContain("defaultFormKey");
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="xml-error"]').exists()).toBe(false);
  });
});

describe("Playground 抄送草稿保存（#76 AC9）", () => {
  it("存量占位收件人属业务草稿：可保存恢复并报告待修复，部署导出仍拦截", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    // 插入抄送节点（默认收件人为占位串）但不进抽屉：模型留存量占位
    await insertViaMenu(wrapper, "approval_1", "cc");
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("占位串");

    wrapper.unmount();
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已恢复本地草稿");
    expect(wrapper.text()).toContain("抄送节点");
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("收件人");
      },
      { timeout: 3000 },
    );
  });

  it("抽屉里空白收件人可保存为业务草稿，恢复后部署仍拦截", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await flushPromises();
    await insertViaMenu(wrapper, "approval_1", "cc");
    const ccCard = wrapper
      .findAll('[data-test="node-card"]')
      .find((card) => card.text().includes("抄送节点"));
    await ccCard!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-recipients"]')!,
      "",
    );
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("待修复");
    expect(localStorage.getItem("flowduet.playground.design")).not.toBeNull();
    wrapper.unmount();
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("收件人"),
    );
  });
});

describe("Playground 保存竞态（真实组件，#76 AC5）", () => {
  it("序列化期间改动默认表单绑定：完成后报告快照而非当前状态已保存", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await setupWithForms(["申请单"]);
    // 保存发起后、任何 await 之前同步改默认绑定（select 常驻 DOM，原生事件零渲染等待），
    // 确保编辑落在快照世代之后
    wrapper.find('[data-test="save-local-btn"]').trigger("click");
    const select = document.querySelector<HTMLSelectElement>('[data-test="default-form-select"]');
    select!.value = "form_1";
    select!.dispatchEvent(new Event("change"));
    await flushPromises();

    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="doc-status"]').text()).toContain("序列化期间又有新编辑");
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(true);
    // 快照属于旧世代：尚未绑定默认表单
    const saved = JSON.parse(localStorage.getItem("flowduet.playground.design")!);
    expect(saved.xml).not.toContain('defaultFormKey="form_1"');
  });
});

describe("PR88 保存与抽屉边界回归", () => {
  it.each(["成功", "失败"])("旧保存晚到%s不覆盖较新本地草稿及反馈", async (outcome) => {
    const original = FlowDesignSession.prototype.save;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let count = 0;
    const spy = vi.spyOn(FlowDesignSession.prototype, "save").mockImplementation(async function () {
      const result = await original.call(this);
      if (++count === 1) {
        await gate;
        if (outcome === "失败") throw new Error("旧保存失败");
      }
      return result;
    });
    try {
      wrapper = mount(App, { attachTo: document.body });
      await setupWithForms(["申请单"]);
      await wrapper.find('[data-test="save-local-btn"]').trigger("click");
      await vi.waitFor(() => expect(count).toBe(1));
      const select = document.querySelector<HTMLSelectElement>(
        '[data-test="default-form-select"]',
      )!;
      select.value = "form_1";
      select.dispatchEvent(new Event("change"));
      await wrapper.find('[data-test="save-local-btn"]').trigger("click");
      await vi.waitFor(() => expect(count).toBe(2));
      await flushPromises();
      expect(JSON.parse(localStorage.getItem("flowduet.playground.design")!).xml).toContain(
        'defaultFormKey="form_1"',
      );
      release();
      await flushPromises();
      expect(JSON.parse(localStorage.getItem("flowduet.playground.design")!).xml).toContain(
        'defaultFormKey="form_1"',
      );
      expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="doc-status"]').text()).not.toContain("尚未保存");
      expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    } finally {
      release();
      spy.mockRestore();
    }
  });

  it("保存期间新建设计使旧保存失效，不落盘或覆盖新建反馈", async () => {
    const original = FlowDesignSession.prototype.save;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let ready = false;
    const spy = vi.spyOn(FlowDesignSession.prototype, "save").mockImplementation(async function () {
      const result = await original.call(this);
      ready = true;
      await gate;
      return result;
    });
    try {
      wrapper = mount(App, { attachTo: document.body });
      await wrapper.find('[data-test="save-local-btn"]').trigger("click");
      await vi.waitFor(() => expect(ready).toBe(true));
      await wrapper.find('[data-test="new-design-btn"]').trigger("click");
      release();
      await flushPromises();
      expect(localStorage.getItem("flowduet.playground.design")).toBeNull();
      expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已新建设计");
      expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(false);
    } finally {
      release();
      spy.mockRestore();
    }
  });

  it("切换抽屉目标前收集未提交名称，保存后不丢失", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "未提交的新名称",
    );
    await wrapper.findAll('[data-test="node-card"]')[2]!.trigger("click");
    await flushPromises();
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(JSON.parse(localStorage.getItem("flowduet.playground.design")!).xml).toContain(
      "未提交的新名称",
    );
  });

  it("非法集合格式阻止切换，保留原节点及输入", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.findAll('[data-test="node-card"]')[2]!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "张三,李四",
    );
    await wrapper.findAll('[data-test="node-card"]')[1]!.trigger("click");
    await flushPromises();
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "张三,李四",
    );
    expect(wrapper.find('[data-test="action-error"]').text()).toContain("集合变量名");
  });

  it("单签切多人未配置集合可保存恢复，部署仍拒绝", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    await openApprovalDrawer(wrapper);
    document.querySelector<HTMLElement>('[data-test="kind-all"]')!.click();
    await flushPromises();
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("待修复");
    wrapper.unmount();
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    await openApprovalDrawer(wrapper);
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "",
    );
    await vi.waitFor(() =>
      expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("集合"),
    );
  });
});

describe("PR88 产品验收视图切换回归", () => {
  it("P24 切换只读视图前收集当前抽屉输入，保存恢复不丢失", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "切视图保留名称",
    );
    await wrapper.find('[data-test="view-bpmn"] input').setValue();
    await flushPromises();
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    expect(JSON.parse(localStorage.getItem("flowduet.playground.design")!).xml).toContain(
      "切视图保留名称",
    );
  });

  it("P24 非法格式阻止离开当前视图，输入仍在原抽屉", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await wrapper.findAll('[data-test="node-card"]')[2]!.trigger("click");
    await flushPromises();
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!,
      "张三,李四",
    );
    await wrapper.find('[data-test="view-bpmn"] input').setValue();
    await flushPromises();
    expect(wrapper.find('[data-test="view-dingtalk"] input').element.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-assignee"]')!.value).toBe(
      "张三,李四",
    );
    expect(wrapper.find('[data-test="action-error"]').text()).toContain("集合变量名");
  });
});

describe("E16 文件读取期间新编辑保护", () => {
  it("新抽屉输入取消迟到打开，模型目录缓冲dirty保持，重试仍可打开", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await setupWithForms(["保留目录76"]);
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    const slow = pendingFileRead();
    const incoming = designDoc(
      minimalFlowXml().replace('name="兼容检查流程"', 'name="迟到文档76"'),
    );
    pickFile(wrapper, incoming, () => slow.text);
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await openApprovalDrawer(wrapper);
    await setValue(
      document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!,
      "读取期间新输入76",
    );
    slow.resolve(incoming);
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("新编辑");
    expect(document.querySelector<HTMLInputElement>('[data-test="drawer-name"]')!.value).toBe(
      "读取期间新输入76",
    );
    expect(wrapper.find('[data-test="dirty-badge"]').exists()).toBe(true);
    // 目录必须仍是旧会话的目录，不能仅跳过宿主 adoptModel 而留半换状态。
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    const saved = JSON.parse(localStorage.getItem("flowduet.playground.design")!);
    expect(saved.xml).toContain("读取期间新输入76");
    expect(saved.forms[0].name).toBe("保留目录76");
    await openDocument(incoming);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("迟到文档76");
  });

  it("读取期间新打开表单编辑器也保持当前目录及编辑器", async () => {
    wrapper = mount(App, { attachTo: document.body });
    await setupWithForms(["保留编辑器76"]);
    await wrapper.find('[data-test="save-local-btn"]').trigger("click");
    await flushPromises();
    const slow = pendingFileRead();
    const incoming = designDoc(minimalFlowXml());
    pickFile(wrapper, incoming, () => slow.text);
    await wrapper.find('[data-test="open-doc-input"]').trigger("change");
    await wrapper.find('[data-test="form-manager-btn"]').trigger("click");
    await wrapper.find('[data-test="form-edit-btn-form_1"]').trigger("click");
    await flushPromises();
    slow.resolve(incoming);
    await flushPromises();
    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("新编辑");
    expect(wrapper.find('[data-test="form-designer-name"]').text()).toContain("保留编辑器76");
  });
});
