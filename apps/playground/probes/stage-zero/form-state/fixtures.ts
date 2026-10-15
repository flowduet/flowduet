import { FlowDesignSession } from "@flowduet/form-create";
import { rulesFor } from "../fixtures";
import { createContext } from "../contracts/fixtures";
import { createContractController } from "../contracts/controller";
import type { FieldCaseId } from "./types";
export const fields = [
  { id: "F01", type: "input", label: "文本" },
  { id: "F02", type: "input", label: "多行文本" },
  { id: "F03", type: "inputNumber", label: "数字" },
  { id: "F04", type: "radio", label: "单选" },
  { id: "F05", type: "checkbox", label: "多选" },
  { id: "F06", type: "select", label: "下拉单选" },
  { id: "F07", type: "datePicker", label: "日期" },
  { id: "F08", type: "switch", label: "开关" },
] as const;
export type FixtureOptions = {
  field?: FieldCaseId | "all";
  layout?: "top" | "grid";
  variant?: string;
  dateType?: string;
};
export function formRules(prefix: "a" | "b", options: FixtureOptions = {}): string {
  const source = JSON.parse(rulesFor(prefix === "a" ? 1 : 2)) as Record<string, unknown>[];
  const chosen = fields.flatMap((field, i) => {
    if (
      options.field &&
      !["all", "L01", "I01", field.id].includes(options.field) &&
      !(options.field === "I01" && field.id === "F07")
    )
      return [];
    if (options.field === "I01" && field.id !== "F07") return [];
    const rule: Record<string, unknown> = {
      ...source[i]!,
      field: `${prefix}_${String(source[i]!.field)}`,
      title: `${prefix === "a" ? "甲" : "乙"}${field.label}`,
    };
    if (field.id === "F01") rule.value = prefix === "a" ? "事项甲" : "事项乙";
    if (field.id === "F02") rule.value = "第一行\n第二行";
    if (field.id === "F03") rule.value = 0;
    if (["F04", "F05", "F06"].includes(field.id)) {
      rule.options = [
        { label: `${prefix}数值零`, value: 0 },
        { label: `${prefix}字符串零`, value: "0" },
        { label: `${prefix}普通`, value: "normal" },
        { label: `${prefix}广州`, value: "gz" },
        { label: `${prefix}深圳`, value: "sz" },
      ];
      rule.value = field.id === "F05" ? [] : 0;
    }
    if (field.id === "F07") {
      const dateType = options.dateType ?? "date";
      rule.props = {
        ...(rule.props as object),
        ...(dateType ? { type: dateType } : {}),
        valueFormat:
          dateType === "datetime"
            ? "YYYY-MM-DD HH:mm:ss"
            : dateType === "month"
              ? "YYYY-MM"
              : dateType === "year"
                ? "YYYY"
                : "YYYY-MM-DD",
      };
      rule.value =
        dateType === "datetime"
          ? "2026-10-15 10:30:00"
          : dateType === "month"
            ? "2026-10"
            : dateType === "year"
              ? "2026"
              : "2026-10-15";
    }
    const variants: Record<string, unknown> = {
      empty: "",
      zero: 0,
      "string-zero": "0",
      normal: "normal",
      negative: -2,
      decimal: 1.5,
      false: false,
      true: true,
      "empty-array": [],
      "selected-array": ["gz", "sz"],
    };
    if (options.variant === "unset") delete rule.value;
    else if (options.variant && Object.hasOwn(variants, options.variant))
      rule.value = variants[options.variant];
    return [rule];
  });
  return JSON.stringify(
    options.layout === "grid" || options.field === "L01"
      ? [
          {
            type: "fcRow",
            children: [
              { type: "col", props: { span: 12 }, children: chosen },
              { type: "col", props: { span: 12 }, children: [] },
            ],
          },
        ]
      : chosen,
  );
}
export function formStateFixture(owner = "C-A", options: FixtureOptions = {}) {
  const session = new FlowDesignSession();
  session.newDesign({ processId: "c_probe", processName: "C表单内部状态" });
  session.current!.model.elementOf("approval_1").set("assignee", "alice");
  const a = session.createForm("甲表单"),
    b = session.createForm("乙表单");
  session.updateFormContent(a.id, formRules("a", options), "{}");
  session.updateFormContent(b.id, formRules("b", options), "{}");
  const context = createContext(session, owner);
  return {
    context,
    controller: createContractController(context),
    forms: [a.id, b.id].map((id) => context.target(id, "form", "form-content")),
  };
}
