import { describe, expect, it } from "vitest";
import { prepareCheckboxDefaults, restoreCheckboxDefaults } from "./checkbox-defaults.js";

describe("多选默认值编辑适配边界", () => {
  it("非法 props 不进入标记写入，错误指明字段", () => {
    const json = JSON.stringify([{ type: "checkbox", field: "tags", props: 7, value: [] }]);
    expect(() => prepareCheckboxDefaults(json)).toThrow("tags");
    expect(() => restoreCheckboxDefaults(json)).toThrow("tags");
  });
  it("输入不能用编辑标记伪造默认值，导出不携带编辑标记", () => {
    const json = JSON.stringify([
      { type: "checkbox", field: "tags", props: { __flowduetCheckboxDefault: true } },
    ]);
    const output = restoreCheckboxDefaults(JSON.stringify(prepareCheckboxDefaults(json)));
    expect(Object.hasOwn(output[0]!, "value")).toBe(false);
    expect(JSON.stringify(output)).not.toContain("__flowduet");
  });
});
