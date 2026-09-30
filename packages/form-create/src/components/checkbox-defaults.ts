import { parseFormRules } from "../form-schema.js";
import type { FieldRule } from "../form-schema.js";

/** 仅用于提供者编辑态，保存文档前移除，不属于表单协议。 */
export const CHECKBOX_DEFAULT_STATE = "__flowduetCheckboxDefault";

function visitRules(rules: FieldRule[], visit: (rule: FieldRule) => void): void {
  for (const rule of rules) {
    visit(rule);
    if (Array.isArray(rule.children)) {
      visitRules(rule.children as FieldRule[], visit);
    }
  }
}

/** 输入标记以真实 value 为准，外部文档不能自行注入编辑态。 */
export function prepareCheckboxDefaults(json: string): FieldRule[] {
  const rules = parseFormRules(json);
  visitRules(rules, (rule) => {
    const props = (rule.props ?? {}) as Record<string, unknown>;
    delete props[CHECKBOX_DEFAULT_STATE];
    if (rule.type === "checkbox" && Array.isArray(rule.value)) {
      props[CHECKBOX_DEFAULT_STATE] = true;
    }
    if (Object.keys(props).length > 0) rule.props = props;
    else delete rule.props;
  });
  return rules;
}

/** FormCreate 3.5 会删掉规则中的空数组；用其保留的编辑态恢复显式空默认值。 */
export function restoreCheckboxDefaults(json: string): FieldRule[] {
  const rules = parseFormRules(json);
  visitRules(rules, (rule) => {
    const props = (rule.props ?? {}) as Record<string, unknown>;
    if (
      rule.type === "checkbox" &&
      props[CHECKBOX_DEFAULT_STATE] === true &&
      rule.value === undefined
    ) {
      rule.value = [];
    }
    delete props[CHECKBOX_DEFAULT_STATE];
    if (Object.keys(props).length > 0) rule.props = props;
    else delete rule.props;
  });
  return rules;
}
