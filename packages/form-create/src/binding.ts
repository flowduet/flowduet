import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { isApprovalTask } from "@flowduet/core";
import type { FormDefinition } from "./document.js";
import { elementLabel } from "./element-label.js";

/**
 * 目录引用诊断（#72，ADR-0009 决策 4）：
 * 已声明的默认 / 节点 key 必须能在表单目录中找到定义——找不到即引用失效。
 * 失效引用不回退、不清除：保存/打开允许（业务草稿，保留 key 供修复），
 * 组合部署导出阻断（exportDeployXml），相关预览失败。
 * A18：默认 key 失效时即使所有节点都有显式覆盖，同样报出并阻断导出。
 */
export function collectReferenceIssues(
  model: BpmnModel,
  forms: readonly FormDefinition[],
): string[] {
  const issues: string[] = [];
  const ids = new Set(forms.map((form) => form.id));

  const defaultKey = model.defaultFormKey;
  const defaultProblem = defaultKey === undefined ? undefined : referenceProblem(defaultKey, ids);
  if (defaultProblem !== undefined) {
    issues.push(
      `流程默认表单 key「${defaultKey}」${defaultProblem}（已保留原值，请修复引用或补建表单）`,
    );
  }

  const flowElements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  for (const element of flowElements) {
    if (!isApprovalTask(element)) continue;
    const key = String(element.get("formKey") ?? "");
    if (key === "") continue;
    const problem = referenceProblem(key, ids);
    if (problem === undefined) continue;
    const label = elementLabel(element);
    issues.push(`审批节点「${label}」的表单 key「${key}」${problem}（已保留原值，请修复引用）`);
  }
  return issues;
}

function referenceProblem(key: string, ids: ReadonlySet<string>): string | undefined {
  if (key !== key.trim()) return "含首尾空格";
  return ids.has(key) ? undefined : "不在表单目录中";
}
