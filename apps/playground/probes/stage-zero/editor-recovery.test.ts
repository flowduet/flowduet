import { it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import FormDesigner from "../../../../packages/form-create/src/components/FormDesigner.vue";
it("真实FormDesigner断言中断后卸载，已卸载导出明确返回null", async () => {
  const view = mount(FormDesigner, {
    props: { name: "清理边界", rules: "[]", options: "{}" },
    attachTo: document.body,
  });
  const capture = view.vm.exportContent;
  try {
    await flushPromises();
    expect(view.findAll("._fc-l-item").length).toBeGreaterThan(0);
    expect(() => {
      throw Error("测试体中断");
    }).toThrow("测试体中断");
  } finally {
    view.unmount();
  }
  expect(document.querySelectorAll(".form-designer-host")).toHaveLength(0);
  expect(capture()).toBeNull();
  document.body.innerHTML = "";
});
