import type { FormDefinition } from "./document.js";

/**
 * 表单定义的语义视图（#74 测试辅助，不进公开 API）：
 * 把设计器导出的规则树投影为「字段标识、类型、选项、默认值、必填、顺序、
 * 布局、表单配置」的语义形态，忽略设计器每次装载重新生成的运行态元数据
 * （_fc_id / name 引用 / display / hidden 等），用于断言往返语义等价——
 * 字符串级比较会被这些元数据干扰，而语义等价才是 #74 的验收口径。
 */

interface RuleSemantics {
  type: unknown;
  field: unknown;
  title: unknown;
  value: unknown;
  required: unknown;
  props: unknown;
  options: unknown;
  validate: unknown;
  children?: unknown[];
}

/** 单条规则的语义视图；$required 缺省与 false 语义相同，归一为 false */
function ruleSemantics(rule: Record<string, unknown>): RuleSemantics {
  const view: RuleSemantics = {
    type: rule.type,
    field: rule.field,
    title: rule.title,
    value: rule.value,
    required: rule.$required ?? false,
    props: rule.props ?? {},
    options: rule.options ?? [],
    validate: rule.validate ?? [],
  };
  if (Array.isArray(rule.children)) {
    view.children = rule.children.map((child) => ruleSemantics(child as Record<string, unknown>));
  }
  return view;
}

/** 忽略设计器元数据后的规则树语义（数组顺序即字段顺序语义） */
export function rulesSemantics(rules: string): unknown[] {
  return (JSON.parse(rules) as Record<string, unknown>[]).map(ruleSemantics);
}

/** 完整表单定义的语义视图（含表单配置） */
export function formSemantics(form: FormDefinition): Record<string, unknown> {
  return {
    id: form.id,
    name: form.name,
    provider: form.provider,
    rules: rulesSemantics(form.rules),
    options: JSON.parse(form.options) as Record<string, unknown>,
  };
}
