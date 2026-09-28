import { describe, expect, it } from "vitest";
import {
  assertFormDefinitionValid,
  assertSupportedFieldTypes,
  parseFormRules,
} from "./form-schema.js";
import type { FieldRule } from "./form-schema.js";

/**
 * 表单开放范围守卫矩阵（#74 / A13）：
 * 八类常用字段 + 基础栅格布局放行；范围外的类型、形态与结构明确拒绝。
 */

/**
 * 八类字段 + 栅格布局的合法矩阵（含默认值、必填、选项与布局列）。
 * 注意：与 document.test.ts / components.test.ts 的矩阵 fixture 刻意同构，
 * 新增字段类型时三处同步更新
 */
const MATRIX_RULES: FieldRule[] = [
  { type: "input", field: "reason", title: "申请事由", value: "默认事由", $required: true },
  { type: "input", field: "detail", title: "详细说明", props: { type: "textarea" } },
  { type: "inputNumber", field: "amount", title: "金额", value: 0 },
  {
    type: "radio",
    field: "urgent",
    title: "是否加急",
    options: [
      { label: "是", value: "1" },
      { label: "否", value: "0" },
    ],
    value: "0",
    effect: { fetch: "" },
  },
  {
    type: "checkbox",
    field: "tags",
    title: "标签",
    options: [{ label: "甲", value: "a" }],
    value: [],
  },
  { type: "select", field: "level", title: "级别", options: [{ label: "普通", value: "1" }] },
  { type: "datePicker", field: "applyDate", title: "申请日期" },
  {
    type: "switch",
    field: "notify",
    title: "通知",
    value: false,
    props: { activeValue: true, inactiveValue: false },
  },
  {
    type: "fcRow",
    children: [
      {
        type: "col",
        props: { span: 12 },
        children: [{ type: "input", field: "leftCol", title: "列甲" }],
      },
      {
        type: "col",
        props: { span: 12 },
        children: [{ type: "datePicker", field: "rightCol", title: "列乙" }],
      },
    ],
  } as unknown as FieldRule,
];

function validForm(
  overrides: Record<string, unknown> = {},
): Parameters<typeof assertFormDefinitionValid>[0] {
  return {
    id: "form_matrix",
    name: "矩阵表单",
    provider: "form-create/element-plus",
    rules: JSON.stringify(MATRIX_RULES),
    options: JSON.stringify({ labelWidth: "100px" }),
    ...overrides,
  };
}

describe("assertSupportedFieldTypes（开放范围矩阵）", () => {
  it("八类字段与栅格布局整棵规则树放行（含数字 0、开关 false、空多选默认值）", () => {
    expect(() => assertSupportedFieldTypes(MATRIX_RULES, "form_matrix")).not.toThrow();
    expect(() => assertFormDefinitionValid(validForm(), new Set())).not.toThrow();
  });

  it("范围外类型逐一拒绝并点名类型与字段：上传、滑块、级联、富文本", () => {
    for (const type of ["upload", "slider", "cascader", "editor"]) {
      expect(() =>
        assertSupportedFieldTypes([{ type, field: "f1", title: "越界字段" }], "form_matrix"),
      ).toThrow(new RegExp(`类型是 ${type}`));
    }
    // 拒绝信息一次性说清开放范围，便于定位与修复
    expect(() =>
      assertSupportedFieldTypes([{ type: "upload", field: "f1" }], "form_matrix"),
    ).toThrow("文本 / 多行文本 / 数字 / 单选 / 多选 / 下拉单选 / 日期 / 开关 / 栅格布局");
  });

  it("子表单/重复明细类组件（group/subForm/tableForm）拒绝", () => {
    for (const type of ["group", "subForm", "tableForm", "tableFormColumn"]) {
      expect(() => assertSupportedFieldTypes([{ type, field: "f1" }], "form_matrix")).toThrow(
        "支持的组件",
      );
    }
  });
});

describe("assertSupportedFieldTypes（组件语义边界）", () => {
  it("下拉多选形态（props.multiple）拒绝：本版本只支持下拉单选", () => {
    expect(() =>
      assertSupportedFieldTypes(
        [{ type: "select", field: "s1", title: "下拉", props: { multiple: true } }],
        "form_matrix",
      ),
    ).toThrow("只支持下拉单选");
    // 显式 false 与缺省同义，放行
    expect(() =>
      assertSupportedFieldTypes(
        [{ type: "select", field: "s1", props: { multiple: false }, options: [] }],
        "form_matrix",
      ),
    ).not.toThrow();
  });

  it("日期范围形态拒绝：daterange / datetimerange / monthrange / dates 超出日期单值", () => {
    for (const type of ["daterange", "datetimerange", "monthrange", "dates"]) {
      expect(() =>
        assertSupportedFieldTypes([
          { type: "datePicker", field: "d1", title: "日期", props: { type } },
        ]),
      ).toThrow("只支持日期单值");
    }
    // 单值形态（含缺省）放行
    for (const type of [undefined, "date", "datetime", "week", "month", "year"]) {
      expect(() =>
        assertSupportedFieldTypes([
          { type: "datePicker", field: "d1", props: type === undefined ? {} : { type } },
        ]),
      ).not.toThrow();
    }
  });

  it("下拉远程搜索（props.remote）拒绝：本版本只支持静态选项", () => {
    expect(() =>
      assertSupportedFieldTypes([
        { type: "select", field: "s1", title: "下拉", props: { remote: true }, options: [] },
      ]),
    ).toThrow("remote 远程搜索");
    expect(() =>
      assertSupportedFieldTypes([
        { type: "select", field: "s1", props: { remote: false }, options: [] },
      ]),
    ).not.toThrow();
  });

  it("远程数据源（effect.fetch 非空）拒绝：本版本只支持静态选项", () => {
    expect(() =>
      assertSupportedFieldTypes([
        { type: "radio", field: "r1", title: "单选", effect: { fetch: "https://api.example.com" } },
      ]),
    ).toThrow("远程数据源");
    // 设计器默认产出的空串是未启用态，放行
    expect(() =>
      assertSupportedFieldTypes([
        { type: "radio", field: "r1", effect: { fetch: "" }, options: [] },
      ]),
    ).not.toThrow();
  });
});

describe("assertSupportedFieldTypes（布局结构边界）", () => {
  it("栅格嵌套栅格拒绝（复杂嵌套布局不开放）", () => {
    const nested = [
      {
        type: "fcRow",
        children: [
          {
            type: "col",
            props: { span: 12 },
            children: [
              {
                type: "fcRow",
                children: [{ type: "col", props: { span: 24 }, children: [] }],
              },
            ],
          },
        ],
      },
    ];
    expect(() => assertSupportedFieldTypes(nested as unknown as FieldRule[])).toThrow("不支持嵌套");
  });

  it("col 只能位于 fcRow 内：顶层 col 与字段旁 col 均拒绝", () => {
    expect(() =>
      assertSupportedFieldTypes([{ type: "col", props: { span: 12 } } as unknown as FieldRule]),
    ).toThrow("只能位于栅格布局");
    expect(() =>
      assertSupportedFieldTypes([
        { type: "input", field: "a" },
        { type: "col", props: { span: 12 } } as unknown as FieldRule,
      ]),
    ).toThrow("只能位于栅格布局");
  });

  it("fcRow 内只能是 col：直接嵌字段或混入其他子级拒绝", () => {
    expect(() =>
      assertSupportedFieldTypes([
        { type: "fcRow", children: [{ type: "input", field: "x" }] } as unknown as FieldRule,
      ]),
    ).toThrow("内只能是栅格列");
    expect(() =>
      assertSupportedFieldTypes([
        { type: "fcRow", children: ["静态文本"] } as unknown as FieldRule,
      ]),
    ).toThrow("栅格列");
  });

  it("栅格列内字段的标识参与全树唯一性与非空校验", () => {
    const inColumn = (field: unknown): unknown[] => [
      {
        type: "fcRow",
        children: [
          {
            type: "col",
            props: { span: 24 },
            children: [{ type: "input", field, title: "列内字段" }],
          },
        ],
      },
    ];
    expect(() =>
      assertSupportedFieldTypes(inColumn("") as unknown as FieldRule[], "form_matrix"),
    ).toThrow("字段标识");
    // 与顶层字段重复也拒绝：唯一性口径覆盖布局内部
    expect(() =>
      assertSupportedFieldTypes(
        [{ type: "input", field: "dup" }, ...inColumn("dup")] as unknown as FieldRule[],
        "form_matrix",
      ),
    ).toThrow("字段标识重复");
  });
});

describe("parseFormRules 与 assertFormDefinitionValid 的既有口径保持", () => {
  it("rules 必须是数组、每项带非空 type", () => {
    expect(() => parseFormRules("{}")).toThrow("字段规则数组");
    expect(() => parseFormRules('["x"]')).toThrow("字段规则对象");
    expect(() => parseFormRules('[{"type":""}]')).toThrow("非空的 type");
  });

  it("表单定义基础守卫：空白 id、重复 id、空名、未知提供者", () => {
    const known = new Set<string>();
    expect(() => assertFormDefinitionValid(validForm({ id: "  " }), known)).toThrow(
      "id 不能为空白",
    );
    expect(() => assertFormDefinitionValid(validForm({ name: "" }), new Set())).toThrow(
      "不能为空白",
    );
    expect(() => assertFormDefinitionValid(validForm({ provider: "x/y" }), new Set())).toThrow(
      "只支持 form-create/element-plus",
    );
    const ids = new Set<string>();
    assertFormDefinitionValid(validForm(), ids);
    expect(() => assertFormDefinitionValid(validForm({ name: "重复" }), ids)).toThrow("id 重复");
  });
});
