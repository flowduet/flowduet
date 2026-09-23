import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { exportXml } from "@flowduet/designer";
import App from "./App.vue";

vi.mock("@flowduet/designer", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    exportXml: vi.fn(),
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
