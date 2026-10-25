import { describe, expect, it } from "vitest";
import { prepareCheckboxDefaults, restoreCheckboxDefaults } from "./checkbox-defaults.js";
import { prepareTextDefaults, restoreTextDefaults } from "./text-defaults.js";

describe("retained文字临时规则适配", () => {
  it("不信外部同名标记；顶层与col内空串恢复，输出剥离全部编辑标记", () => {
    const rules = prepareCheckboxDefaults(
      JSON.stringify([
        { type: "input", field: "unset", props: { __flowduetTextDefault: true } },
        {
          type: "fcRow",
          children: [
            {
              type: "col",
              children: [
                {
                  type: "input",
                  field: "empty",
                  value: "",
                  props: { type: "textarea", __flowduetTextDefault: false },
                },
              ],
            },
          ],
        },
        { type: "checkbox", field: "check", value: [] },
      ]),
    );
    prepareTextDefaults(rules);
    // 锁定提供者省略空默认值之后，由编辑标记恢复，不给未设置补值。
    const parsed = JSON.parse(JSON.stringify(rules));
    delete parsed[1].children[0].children[0].value;
    delete parsed[2].value;
    const output = restoreCheckboxDefaults(JSON.stringify(parsed));
    restoreTextDefaults(output);
    expect(Object.hasOwn(output[0]!, "value")).toBe(false);
    expect(
      (output[1]!.children as { children: { value: unknown }[] }[])[0]!.children[0]!.value,
    ).toBe("");
    expect(output[2]!.value).toEqual([]);
    expect(JSON.stringify(output)).not.toContain("__flowduet");
  });
  it("非文字值及选项顺序原样保留", () => {
    const original = [
      { type: "inputNumber", field: "n", value: 0 },
      { type: "switch", field: "s", value: false },
      { type: "checkbox", field: "c", value: [] },
      { type: "checkbox", field: "u" },
      {
        type: "radio",
        field: "r",
        value: 0,
        options: [
          { value: "0", label: "字符串" },
          { value: 0, label: "数字" },
        ],
      },
      { type: "select", field: "z", value: "0" },
    ];
    const rules = prepareCheckboxDefaults(JSON.stringify(original));
    prepareTextDefaults(rules);
    const output = restoreCheckboxDefaults(JSON.stringify(rules));
    restoreTextDefaults(output);
    expect(output).toEqual(original);
  });
  it("沿用props守卫，不吞非法结构", () => {
    expect(() => prepareTextDefaults([{ type: "input", field: "bad", props: 7 }])).toThrow("bad");
    expect(() => restoreTextDefaults([{ type: "input", field: "bad", props: [] }])).toThrow("bad");
  });
});
