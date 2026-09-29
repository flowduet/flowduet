import type { FormDefinition } from "./document.js";

/**
 * 表单内容序列化收口：rules / options 以 JSON 字符串成对保存恢复。
 * #74 起字段范围扩展为八类常用组件（文本、多行文本、数字、单选、多选、
 * 下拉单选、日期单值、开关）与基础栅格布局（fcRow/col）。超出范围的
 * 规则明确拒绝，不静默删减后再保存（迭代三总规格「表单范围」约定）。
 */

/** 支持的字段组件类型（文本与多行文本同为 input，多行经 props.type=textarea 表达） */
const SUPPORTED_FIELD_TYPES = new Set([
  "input",
  "inputNumber",
  "radio",
  "checkbox",
  "select",
  "datePicker",
  "switch",
]);

/** 栅格布局容器类型（基础行列布局：fcRow 一行、col 一列） */
const LAYOUT_ROW_TYPE = "fcRow";
const LAYOUT_COL_TYPE = "col";

/** 日期组件的开放形态：单值白名单（缺省视为 date）；dates（多日期、数组值）与各 range 形态超出「日期单值」范围 */
const DATE_SINGLE_TYPES = new Set(["", "date", "datetime", "week", "month", "year"]);

/** 开放范围的人读清单，用于拒绝信息一次性说清边界 */
const SUPPORTED_LABEL = "文本 / 多行文本 / 数字 / 单选 / 多选 / 下拉单选 / 日期 / 开关 / 栅格布局";

/** 设计器产出的字段规则（宽松形状：只核对开放范围关心的键） */
export interface FieldRule {
  type: string;
  field?: string;
  title?: string;
  [key: string]: unknown;
}

/** 解析字段规则串：必须是 JSON 数组且每项形如字段规则 */
export function parseFormRules(rules: string): FieldRule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rules);
  } catch (e) {
    throw new Error(`表单 rules 不是合法 JSON：${e instanceof Error ? e.message : String(e)}`, {
      cause: e,
    });
  }
  if (!Array.isArray(parsed)) {
    throw new Error("表单 rules 必须是字段规则数组（JSON 数组）");
  }
  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("表单 rules 的每一项必须是字段规则对象");
    }
    const rule = item as Record<string, unknown>;
    if (typeof rule.type !== "string" || rule.type === "") {
      throw new Error("字段规则缺少非空的 type（FormCreate 组件类型）");
    }
  }
  return parsed as FieldRule[];
}

/** 解析表单配置串：必须是 JSON 对象 */
export function parseFormOptions(options: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(options);
  } catch (e) {
    throw new Error(`表单 options 不是合法 JSON：${e instanceof Error ? e.message : String(e)}`, {
      cause: e,
    });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("表单 options 必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

/** 违规项的定位标签：优先用字段标识，布局容器退回标题或类型 */
function ruleLabel(rule: FieldRule): string {
  if (rule.field !== undefined) return `${rule.title ?? ""}（${rule.field}）`;
  return String(rule.title ?? rule.type);
}

/** 联动规则可能藏在任意层级，布局列也必须检查 */
function assertNoControl(rule: Record<string, unknown>): void {
  if (rule.control !== undefined && (!Array.isArray(rule.control) || rule.control.length > 0)) {
    throw new Error(`规则「${ruleLabel(rule as unknown as FieldRule)}」不支持组件联动（control）`);
  }
}

/**
 * 组件语义守卫：开放范围内的配置边界。
 * 下拉仅单选、日期仅单值、选项仅静态（远程数据源不在开放范围）。
 */
function assertFieldSemantics(rule: FieldRule): void {
  const label = ruleLabel(rule);
  const props = (rule.props ?? {}) as Record<string, unknown>;
  if (
    rule.type === "input" &&
    props.type !== undefined &&
    props.type !== "" &&
    props.type !== "text" &&
    props.type !== "textarea"
  ) {
    throw new Error(
      `输入字段「${label}」的形态是 ${String(props.type)}，本版本只支持文本或多行文本`,
    );
  }
  if (rule.type === "select" && props.multiple !== undefined && props.multiple !== false) {
    throw new Error(`下拉字段「${label}」配置了 multiple 多选形态，本版本只支持下拉单选`);
  }
  if (rule.type === "select" && props.remote !== undefined && props.remote !== false) {
    throw new Error(`下拉字段「${label}」配置了 remote 远程搜索，本版本只支持静态选项`);
  }
  if (rule.type === "datePicker") {
    const type = typeof props.type === "string" ? props.type : "";
    if (!DATE_SINGLE_TYPES.has(type)) {
      throw new Error(`日期字段「${label}」的形态是 ${type || "（空）"}，本版本只支持日期单值`);
    }
  }
  const effect = rule.effect;
  if (typeof effect === "object" && effect !== null && !Array.isArray(effect)) {
    const fetch = (effect as Record<string, unknown>).fetch;
    if (fetch !== undefined && fetch !== "") {
      throw new Error(`字段「${label}」配置了远程数据源（effect.fetch），本版本只支持静态选项`);
    }
  }
}

/**
 * 规则树守卫（保存与打开两侧共用）：
 * - 类型必须在开放集合内（字段或布局容器）；
 * - 字段标识非空且全树唯一（含栅格列内的字段）；
 * - 栅格不嵌套：fcRow 只能出现在顶层（布局内再放布局属于复杂嵌套，明确拒绝）；
 * - col 只能直接位于 fcRow 内，fcRow 的子级只能是 col（行列结构由设计器产出）。
 */
function assertRuleTreeSupported(
  rules: readonly unknown[],
  knownFields: Set<string>,
  formId: string,
  insideLayout: boolean,
): void {
  for (const item of rules) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("表单 rules 的每一项（含栅格列内）必须是字段规则对象");
    }
    const rule = item as Record<string, unknown>;
    if (typeof rule.type !== "string" || rule.type === "") {
      throw new Error("字段规则缺少非空的 type（FormCreate 组件类型）");
    }
    const typedRule = rule as unknown as FieldRule;
    assertNoControl(rule);
    if (rule.type === LAYOUT_ROW_TYPE) {
      if (insideLayout) {
        throw new Error("栅格布局（fcRow）不支持嵌套，复杂嵌套布局超出本版本范围");
      }
      // fcRow 的直接子级只能是 col；col 内部回到字段层递归（字段不能是布局）
      const cols = rule.children === undefined ? [] : rule.children;
      if (!Array.isArray(cols)) {
        throw new Error("栅格布局（fcRow）的 children 必须是数组");
      }
      for (const child of cols) {
        if (typeof child !== "object" || child === null || Array.isArray(child)) {
          throw new Error("栅格布局（fcRow）内只能是栅格列（col）规则对象");
        }
        const col = child as Record<string, unknown>;
        if (col.type !== LAYOUT_COL_TYPE) {
          throw new Error(
            `栅格布局（fcRow）内只能是栅格列（col），出现 ${col.type ?? "（无 type）"}`,
          );
        }
        assertNoControl(col);
        const colChildren = col.children === undefined ? [] : col.children;
        if (!Array.isArray(colChildren)) {
          throw new Error("栅格列（col）的 children 必须是数组");
        }
        assertRuleTreeSupported(colChildren, knownFields, formId, true);
      }
      continue;
    }
    if (rule.type === LAYOUT_COL_TYPE) {
      throw new Error("栅格列（col）只能位于栅格布局（fcRow）内，不能单独出现");
    }
    if (!SUPPORTED_FIELD_TYPES.has(rule.type)) {
      throw new Error(
        `表单字段「${ruleLabel(typedRule)}」的类型是 ${rule.type}，本版本支持的组件：${SUPPORTED_LABEL}，拒绝导入`,
      );
    }
    if (
      rule.children !== undefined &&
      (!Array.isArray(rule.children) || rule.children.length > 0)
    ) {
      throw new Error(`普通字段不能包含 children 子规则：${ruleLabel(typedRule)}`);
    }
    assertFieldSemantics(typedRule);
    if (typeof rule.field !== "string" || rule.field.trim() === "") {
      throw new Error(`表单字段「${ruleLabel(typedRule)}」缺少非空的字段标识`);
    }
    if (knownFields.has(rule.field)) {
      throw new Error(`表单 ${formId} 的字段标识重复：${rule.field}`);
    }
    knownFields.add(rule.field);
  }
}

/**
 * 字段子集守卫：类型、布局与组件语义超出开放范围明确拒绝，
 * 违规项点名 type 与字段标识，便于定位；不静默丢弃。
 */
export function assertSupportedFieldTypes(rules: readonly FieldRule[], formId = ""): void {
  assertRuleTreeSupported(rules, new Set<string>(), formId, false);
}

/** 单张表单定义的结构校验：供保存与打开两侧共用 */
export function assertFormDefinitionValid(form: FormDefinition, knownIds: Set<string>): void {
  if (form.id.trim() === "") {
    throw new Error(`表单定义的 id 不能为空白（名称：${form.name || "未命名"}）`);
  }
  if (knownIds.has(form.id)) {
    throw new Error(`表单 id 重复：${form.id}（文档内 id 必须唯一）`);
  }
  knownIds.add(form.id);
  if (form.name.trim() === "") {
    throw new Error(`表单 ${form.id} 的名称不能为空白`);
  }
  if (form.provider !== "form-create/element-plus") {
    throw new Error(
      `表单 ${form.id} 的提供者是 ${form.provider}，本版本只支持 form-create/element-plus`,
    );
  }
  const rules = parseFormRules(form.rules);
  assertSupportedFieldTypes(rules, form.id);
  parseFormOptions(form.options);
}
