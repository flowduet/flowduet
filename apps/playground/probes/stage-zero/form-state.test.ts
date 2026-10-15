import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import FormDesigner from "../../../../packages/form-create/src/components/FormDesigner.vue";
import { describeValue, equivalentContent, observeLiveState } from "./form-state/state-evidence";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  try {
    mounted.splice(0).forEach((view) => view.unmount());
  } finally {
    document.body.innerHTML = "";
  }
});
const content = (rule: Record<string, unknown>) => ({
  rules: JSON.stringify([rule]),
  options: "{}",
});
describe("C0 表单状态观察", () => {
  it.each([
    [{}, { present: false, type: "undefined", json: null }],
    [{ value: 0 }, { present: true, type: "number", json: "0" }],
    [{ value: false }, { present: true, type: "boolean", json: "false" }],
    [{ value: [] }, { present: true, type: "array", json: "[]" }],
    [{ value: "" }, { present: true, type: "string", json: '\"\"' }],
    [{ value: null }, { present: true, type: "object", json: "null" }],
  ])("value_presence_and_types_are_distinct：%j", (rule, expected) => {
    expect(describeValue(rule)).toEqual(expected);
  });
  it.each([
    [0, "0"],
    [false, undefined],
    [[], undefined],
    ["", undefined],
  ])("不把不同默认值归一：%j / %j", (left, right) => {
    const base = { type: "input", field: "a" };
    expect(
      equivalentContent(content({ ...base, value: left }), content({ ...base, value: right })),
    ).toBe(false);
  });
  it("允许运行态元数据变化，但字段/选项/列顺序变化不等价", () => {
    const a = {
      rules:
        '[{"type":"select","field":"a","options":[{"label":"甲","value":0},{"label":"乙","value":"0"}]}]',
      options: '{"a":1,"b":2}',
    };
    expect(
      equivalentContent(a, {
        ...a,
        rules: a.rules.replace('"type"', '"_fc_id":"new","type"'),
        options: '{"b":2,"a":1}',
      }),
    ).toBe(true);
    expect(
      equivalentContent(a, { ...a, rules: a.rules.replace('"field":"a"', '"field":"b"') }),
    ).toBe(false);
    expect(
      equivalentContent(a, {
        ...a,
        rules: a.rules.replace(
          '[{"label":"甲","value":0},{"label":"乙","value":"0"}]',
          '[{"label":"乙","value":"0"},{"label":"甲","value":0}]',
        ),
      }),
    ).toBe(false);
    const grid = {
      rules:
        '[{"type":"fcRow","children":[{"type":"col","children":[{"type":"input","field":"a","value":[]}]},{"type":"col","children":[]}]}]',
      options: "{}",
    };
    expect(equivalentContent(grid, { ...grid, rules: grid.rules.replace(',"value":[]', "") })).toBe(
      false,
    );
    expect(equivalentContent(a, { ...a, rules: "bad" })).toBe(false);
  });
  it("observe_does_not_flush_focused_input：读取原生文字/选区不失焦", () => {
    const root = document.createElement("div"),
      input = document.createElement("input");
    root.append(input);
    document.body.append(root);
    input.value = "中文末尾未失焦";
    input.focus();
    input.setSelectionRange(2, 5);
    let blurred = 0;
    input.addEventListener("blur", () => blurred++);
    const observed = observeLiveState(root, { composing: false, dragging: false });
    expect(observed.pendingControls[0]).toMatchObject({
      text: "中文末尾未失焦",
      selection: [2, 5],
    });
    expect(document.activeElement).toBe(input);
    expect(blurred).toBe(0);
  });
  it("真实FormDesigner装载与菜单仍在，不用组件桩证明观察", async () => {
    const view = mount(FormDesigner, {
      props: { name: "C观察", rules: "[]", options: "{}" },
      attachTo: document.body,
    });
    mounted.push(view);
    await flushPromises();
    expect(view.findAll("._fc-l-item").length).toBeGreaterThan(0);
    observeLiveState(view.element as HTMLElement, { composing: false, dragging: false });
    expect(view.emitted("save")).toBeUndefined();
    expect(view.props("rules")).toBe("[]");
  });
});
