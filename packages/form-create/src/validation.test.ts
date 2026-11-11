// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { FormDefinition } from "./document.js";

vi.mock("@form-create/element-ui", async () => {
  const { defineComponent, h, onMounted } = await import("vue");
  const validationError = { errors: [{ message: "必填字段为空" }] };
  const rejectingRenderer = defineComponent({
    setup(_props, { emit }) {
      onMounted(() => {
        emit("update:api", {
          validate(callback: (result: unknown) => void) {
            callback(validationError);
            return Promise.reject(validationError);
          },
        });
      });
      return () => h("div");
    },
  });
  return { default: { $form: () => rejectingRenderer, install() {} } };
});

import FormPreview from "./components/FormPreview.vue";

let wrapper: ReturnType<typeof mount> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

const FORM: FormDefinition = {
  id: "form_required",
  name: "必填测试表单",
  provider: "form-create/element-plus",
  rules: JSON.stringify([{ type: "input", field: "reason", title: "申请事由", $required: true }]),
  options: "{}",
};

describe("FormPreview 的异步校验结果处理", () => {
  it("消费失败 Promise，同时显示回调返回的必填错误", async () => {
    const unhandled: unknown[] = [];
    const listener = (reason: unknown): void => unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      wrapper = mount(FormPreview, { props: { form: FORM } });
      await flushPromises();
      await wrapper.find('[data-test="form-preview-validate"]').trigger("click");
      await flushPromises();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(wrapper.find('[data-test="form-preview-validation"]').text()).toContain("校验未通过");
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });
});
