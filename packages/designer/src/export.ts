import { compile, flowableAdapter, verticalDiLayout } from "@flowduet/core";
import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { CC_RECIPIENTS_PLACEHOLDER } from "./operations.js";

function labelOf(element: ModdleElement): string {
  const id = String(element.get("id") ?? "");
  const name = String(element.get("name") ?? "").trim();
  return name !== "" && name !== id ? `${name}（${id}）` : id;
}

/** 草稿允许留在模型树中，只有导出时统一收集所有缺失配置。 */
function assertNoDraftFields(model: BpmnModel): void {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  const errors: string[] = [];
  for (const el of elements) {
    const label = labelOf(el);
    if (el.$type === "bpmn:ServiceTask") {
      const ccTo = el.get("ccTo");
      const ccDelegate = flowableAdapter.taskTypeMapping.cc.attributes?.delegateExpression;
      // 收件人属性可能被导入模型或宿主直写清除，仍按抄送 delegate 识别该节点。
      if (
        ccTo === undefined &&
        (ccDelegate === undefined || el.get("delegateExpression") !== ccDelegate)
      ) {
        continue;
      }
      if (typeof ccTo !== "string" || ccTo.trim() === "") {
        errors.push(`抄送节点「${label}」的收件人为空白，请在抽屉补填后再导出`);
      } else if (ccTo.trim() === CC_RECIPIENTS_PLACEHOLDER) {
        errors.push(`抄送节点「${label}」的收件人仍是插入占位串，请在抽屉填真实名单后再导出`);
      }
      continue;
    }
    if (el.$type === "bpmn:UserTask") {
      const loop = el.get("loopCharacteristics") as ModdleElement | undefined;
      if (loop?.$type !== "bpmn:MultiInstanceLoopCharacteristics") {
        if (String(el.get("assignee") ?? "").trim() === "") {
          errors.push(`单签审批节点「${label}」的审批人为空白，请在抽屉补填后再导出`);
        }
        continue;
      }
      const collection = String(loop.get("collection") ?? "").trim();
      if (collection === "") {
        errors.push(`多人审批节点「${label}」的集合变量为空白，请在抽屉补填后再导出`);
      }
    }
    if (el.$type === "bpmn:ExclusiveGateway") {
      const outgoing = (el.get("outgoing") as ModdleElement[] | undefined) ?? [];
      if (outgoing.length <= 1) continue;
      const defaultFlow = el.get("default");
      for (const flow of outgoing) {
        const branchLabel = labelOf(flow);
        const expression = flow.get("conditionExpression") as ModdleElement | undefined;
        if (flow === defaultFlow) {
          if (expression !== undefined) {
            errors.push(`默认支路「${branchLabel}」不能携带条件，请清除表达式后再导出`);
          }
          continue;
        }
        if (String(expression?.get("body") ?? "").trim() === "") {
          errors.push(`条件分支「${branchLabel}」未设置条件，请配置表达式或设为默认支路`);
        }
      }
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

/**
 * XML 导出入口（顶层组件接缝的一部分）：
 * 钉钉式编辑无画布坐标，导出固定走竖排布局推导 DI。
 * 前置草稿扫描拒绝部署合法但运行时无法按用户配置执行的形态。
 */
export async function exportXml(model: BpmnModel): Promise<string> {
  assertNoDraftFields(model);
  return compile(model, { diLayout: verticalDiLayout() });
}
