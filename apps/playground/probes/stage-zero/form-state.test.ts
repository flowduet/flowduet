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

// 夹具的业务值用手工期望核对；提供者往返另外经真实浏览器执行。
import { formRules, formStateFixture } from "./form-state/fixtures";
import { assertFormDefinitionValid } from "../../../../packages/form-create/src/form-schema";
describe("C1 typed_defaults_roundtrip 夹具与既有守卫", () => {
  it.each([
    ["F01", "empty", ""],
    ["F02", "normal-default", "第一行\n第二行"],
    ["F03", "zero", 0],
    ["F03", "negative", -2],
    ["F03", "decimal", 1.5],
    ["F04", "zero", 0],
    ["F04", "string-zero", "0"],
    ["F05", "empty-array", []],
    ["F05", "selected-array", ["gz", "sz"]],
    ["F06", "zero", 0],
    ["F06", "string-zero", "0"],
    ["F08", "false", false],
    ["F08", "true", true],
  ] as const)("typed_defaults_roundtrip %s/%s", (field, variant, want) => {
    const output = JSON.parse(formRules("a", { field, variant }));
    expect(output[0].value).toEqual(want);
    assertFormDefinitionValid(
      {
        id: "f",
        name: "类型",
        provider: "form-create/element-plus",
        rules: JSON.stringify(output),
        options: "{}",
      },
      new Set(),
    );
  });
  it("checkbox_empty_array_vs_absent；textarea_newline_and_grid_order", () => {
    expect(
      Object.hasOwn(JSON.parse(formRules("a", { field: "F05", variant: "unset" }))[0], "value"),
    ).toBe(false);
    const grid = JSON.parse(formRules("a", { field: "F02", layout: "grid" }));
    expect(grid[0].type).toBe("fcRow");
    expect(grid[0].children.map((col: { props: { span: number } }) => col.props.span)).toEqual([
      12, 12,
    ]);
    expect(grid[0].children[0].children[0]).toMatchObject({
      type: "input",
      field: "a_notes",
      value: "第一行\n第二行",
      props: { type: "textarea" },
    });
    expect(grid[0].children[1].children).toEqual([]);
  });
  it.each(["", "date", "datetime", "week", "month", "year"])(
    "imported_single_date_shapes_keep_type %s",
    (dateType) => {
      const rules = formRules("a", { field: "I01", dateType });
      assertFormDefinitionValid(
        { id: "f", name: "日期", provider: "form-create/element-plus", rules, options: "{}" },
        new Set(),
      );
      expect(JSON.parse(rules)[0].props.type).toBe(dateType || undefined);
    },
  );
  it("同ID双控制器不共享当前定义或编辑目标", () => {
    const a = formStateFixture("C-A", { field: "F01" }),
      b = formStateFixture("C-B", { field: "F01" });
    try {
      expect(a.forms[0]!.ref.id).toBe(b.forms[0]!.ref.id);
      expect(a.forms[0]!.ref).not.toBe(b.forms[0]!.ref);
      expect(b.controller.store.resolve(a.forms[0]!.ref)).toBeUndefined();
      expect(JSON.parse(a.controller.session.current!.forms[0]!.rules)[0]).toMatchObject({
        field: "a_subject",
        value: "事项甲",
      });
    } finally {
      a.controller.dispose();
      b.controller.dispose();
    }
  });
});

it("逻辑已关闭的弹层退场动画不能误判为未确认输入", () => {
  const root = document.createElement("div"),
    input = document.createElement("input"),
    panel = document.createElement("div");
  input.setAttribute("aria-controls", "c_popup");
  input.setAttribute("aria-expanded", "false");
  panel.id = "c_popup";
  panel.setAttribute("role", "listbox");
  root.append(input);
  document.body.append(root, panel);
  input.focus();
  expect(observeLiveState(root, { composing: false, dragging: false }).openLayers).toEqual([]);
  input.setAttribute("aria-expanded", "true");
  expect(observeLiveState(root, { composing: false, dragging: false }).openLayers).toHaveLength(1);
});
