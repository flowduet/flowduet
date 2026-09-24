import type { FormDefinition } from "./document.js";

/**
 * 表单内容序列化收口（#72）：rules / options 以 JSON 字符串成对保存恢复。
 * 本票字段范围只有文本（input）——超出范围的规则明确拒绝，
 * 不静默删减后再保存（迭代三总规格「表单范围」约定）。
 */

/** 本票支持的 FormCreate 组件类型全集（menu 已收口为文本；此处为导入侧守卫） */
const SUPPORTED_FIELD_TYPES = new Set(["input"]);

/** 设计器产出的字段规则（宽松形状：只核对本票关心的键） */
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

/**
 * 字段子集守卫：类型超出本票范围（文本）明确拒绝。
 * 违规项点名 type 与字段标识，便于定位；不静默丢弃。
 */
export function assertSupportedFieldTypes(rules: readonly FieldRule[]): void {
  for (const rule of rules) {
    if (SUPPORTED_FIELD_TYPES.has(rule.type)) continue;
    const label =
      rule.field !== undefined ? `${rule.title ?? ""}（${rule.field}）` : String(rule.title ?? "");
    throw new Error(
      `表单字段「${label}」的类型是 ${rule.type}，本版本只支持文本（input）字段，拒绝导入`,
    );
  }
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
  assertSupportedFieldTypes(rules);
  const fields = new Set<string>();
  for (const rule of rules) {
    if (typeof rule.field !== "string" || rule.field.trim() === "") {
      throw new Error(`表单 ${form.id} 的字段标识不能为空白`);
    }
    if (fields.has(rule.field)) {
      throw new Error(`表单 ${form.id} 的字段标识重复：${rule.field}`);
    }
    fields.add(rule.field);
  }
  parseFormOptions(form.options);
}
