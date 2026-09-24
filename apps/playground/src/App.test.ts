import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { exportXml } from "@flowduet/designer";
import App from "./App.vue";

vi.mock("@flowduet/designer", async () => {
  const { defineComponent, h } = await import("vue");
  // 只替换被测的导出面：exportXml（联动行为）与两个 Vue 组件。
  // 草稿扫描器与抄送判定谓词取真实实现——@flowduet/form-create 的保存链路
  // 经 designer 公开入口使用它们，mock 缺席会让保存侧调用 undefined。
  const actual = await vi.importActual<typeof import("@flowduet/designer")>("@flowduet/designer");
  return {
    exportXml: vi.fn(),
    collectDraftIssues: actual.collectDraftIssues,
    isCcServiceTask: actual.isCcServiceTask,
    BpmnCanvas: defineComponent({ render: () => null }),
    DingtalkDesigner: defineComponent({
      emits: ["change"],
      setup(_, { emit }) {
        return () =>
          h("button", { "data-test": "fake-edit", onClick: () => emit("change") }, "编辑");
      },
    }),
  };
});

let wrapper: ReturnType<typeof mount> | undefined;
const exportMock = vi.mocked(exportXml);

beforeEach(() => exportMock.mockReset());
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Playground XML 预览", () => {
  it("手动导出失败时清除旧 XML 并显示当前错误", async () => {
    exportMock.mockResolvedValueOnce("<xml>旧流程</xml>");
    exportMock.mockRejectedValueOnce(new Error("抄送节点 cc_2 的收件人未配置"));
    wrapper = mount(App, { attachTo: document.body });

    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-preview"]').text()).toContain("旧流程");
    expect(wrapper.find('[data-test="xml-hint"]').exists()).toBe(false);

    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("cc_2");
  });

  it("编辑后立刻隐藏过期 XML，自动导出失败再修复时恢复预览", async () => {
    exportMock.mockResolvedValueOnce("<xml>旧流程</xml>");
    exportMock.mockRejectedValueOnce(new Error("抄送收件人未配置"));
    exportMock.mockResolvedValueOnce("<xml>修复后的流程</xml>");
    wrapper = mount(App, { attachTo: document.body });

    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-preview"]').text()).toContain("旧流程");

    await wrapper.find('[data-test="fake-edit"]').trigger("click");
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(false);
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("抄送收件人未配置");
      },
      { timeout: 3000 },
    );

    await wrapper.find('[data-test="fake-edit"]').trigger("click");
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-preview"]').text()).toContain("修复后的流程");
      },
      { timeout: 3000 },
    );
    expect(wrapper.find('[data-test="xml-error"]').exists()).toBe(false);
  });

  it("较早的手动导出晚于编辑后的自动导出完成时不覆盖当前错误", async () => {
    let resolveOld!: (xml: string) => void;
    const oldExport = new Promise<string>((resolve) => {
      resolveOld = resolve;
    });
    exportMock.mockReturnValueOnce(oldExport);
    exportMock.mockRejectedValueOnce(new Error("当前草稿缺少条件"));
    wrapper = mount(App, { attachTo: document.body });

    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await wrapper.find('[data-test="fake-edit"]').trigger("click");
    await vi.waitFor(
      () => {
        expect(wrapper!.find('[data-test="xml-error"]').text()).toContain("当前草稿缺少条件");
      },
      { timeout: 3000 },
    );

    resolveOld("<xml>旧流程</xml>");
    await flushPromises();
    expect(wrapper.find('[data-test="xml-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="xml-error"]').text()).toContain("当前草稿缺少条件");
  });

  it("编辑后立即手动导出会取消待执行的自动导出", async () => {
    exportMock.mockResolvedValueOnce("<xml>当前流程</xml>");
    wrapper = mount(App, { attachTo: document.body });
    vi.useFakeTimers();

    await wrapper.find('[data-test="fake-edit"]').trigger("click");
    await wrapper.find('[data-test="export-btn"]').trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(350);

    expect(exportMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="xml-preview"]').text()).toContain("当前流程");
  });
});

describe("Playground 设计文档链路（#71）", () => {
  /** 直接向文件选择器注入 File 并触发 change（happy-dom 下 files 为只读 FileList） */
  function pickFile(target: ReturnType<typeof mount>, json: string): void {
    const input = target.find<HTMLInputElement>('input[data-test="open-doc-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File([json], "design.flowduet.json", { type: "application/json" })],
      configurable: true,
    });
  }

  it("新建设计立即刷新导出预览并提示状态", async () => {
    exportMock.mockResolvedValueOnce("<xml>新流程</xml>");
    wrapper = mount(App, { attachTo: document.body });

    await wrapper.find('[data-test="new-design-btn"]').trigger("click");
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已新建设计");
    // 整体替换 = 一次编辑：防抖自动导出走新模型
    await vi.waitFor(
      () => {
        expect(exportMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-test="xml-preview"]').text()).toContain("新流程");
      },
      { timeout: 3000 },
    );
  });

  it("打开坏文档显示错误，不出现成功状态", async () => {
    wrapper = mount(App, { attachTo: document.body });
    pickFile(wrapper, "{not-a-json");
    await wrapper.find('input[data-test="open-doc-input"]').trigger("change");
    await flushPromises();

    expect(wrapper.find('[data-test="doc-error"]').text()).toContain("不是合法 JSON");
    expect(wrapper.find('[data-test="doc-status"]').exists()).toBe(false);
  });

  it("下载设计文档成功后提示保存结果", async () => {
    const created: Blob[] = [];
    const objectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob: Blob): string => {
        created.push(blob);
        return "blob:mock";
      });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    wrapper = mount(App, { attachTo: document.body });

    await wrapper.find('[data-test="save-doc-btn"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-test="doc-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="doc-status"]').text()).toContain("已保存设计文档");
    const json = await created[0]!.text();
    expect(JSON.parse(json).format).toBe("flowduet.design");

    clickSpy.mockRestore();
    objectUrlSpy.mockRestore();
  });
});
