import type { BpmnModel } from "@flowduet/core";
import { exportXml } from "@flowduet/designer";
import type { FormDefinition } from "./document.js";
import { collectReferenceIssues } from "./binding.js";

/**
 * 组合部署导出（#72）：designer 的流程校验（草稿拦截）+ 表单目录引用完整性。
 * 两类问题合并呈报；引用全部有效且流程配置完整才产出部署 XML。
 * 无表单、无引用是合法形态——直接走原 exportXml 合同。
 * 底层 exportXml(model) 职责不变，不假装能校验未传入的目录。
 */
export async function exportDeployXml(
  model: BpmnModel,
  forms: readonly FormDefinition[],
): Promise<string> {
  const referenceIssues = collectReferenceIssues(model, forms);
  let xml: string;
  try {
    xml = await exportXml(model);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error([...referenceIssues, message].join("\n"), { cause: e });
  }
  if (referenceIssues.length > 0) {
    throw new Error(referenceIssues.join("\n"));
  }
  return xml;
}
