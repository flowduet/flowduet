import { validatedRuleProps } from "../form-schema.js";
import type { FieldRule } from "../form-schema.js";

/** 仅用于retained编辑态，交付文档前移除。 */
export const TEXT_DEFAULT_STATE = "__flowduetTextDefault";

function visit(rules: FieldRule[], restore: boolean): void {
  for (const rule of rules) {
    const props = validatedRuleProps(rule);
    if (
      restore &&
      rule.type === "input" &&
      props[TEXT_DEFAULT_STATE] === true &&
      rule.value === undefined
    )
      rule.value = "";
    delete props[TEXT_DEFAULT_STATE];
    if (!restore && rule.type === "input") props[TEXT_DEFAULT_STATE] = Object.hasOwn(rule, "value");
    if (Object.keys(props).length) rule.props = props;
    else delete rule.props;
    if (Array.isArray(rule.children)) visit(rule.children as FieldRule[], restore);
  }
}
/** 只接收经既有守卫解析的临时数组；外部标记不签发值存在性。 */
export function prepareTextDefaults(rules: FieldRule[]): void {
  visit(rules, false);
}
export function restoreTextDefaults(rules: FieldRule[]): void {
  visit(rules, true);
}
