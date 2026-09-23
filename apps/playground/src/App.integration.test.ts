import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "./App.vue";

let wrapper: ReturnType<typeof mount> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

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
