import { compile, flowableAdapter, verticalDiLayout } from "@flowduet/core";
import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { CC_RECIPIENTS_PLACEHOLDER } from "./operations.js";

function labelOf(element: ModdleElement): string {
  const id = String(element.get("id") ?? "");
  const name = String(element.get("name") ?? "").trim();
  return name !== "" && name !== id ? `${name}（${id}）` : id;
}

/**
 * 抄送形态的服务任务判定（#71 起公开）：收件人属性在场，或命中适配器声明的
 * 抄送占位 delegate 引用。收件人属性可能被导入模型或宿主直写清除，仍按
 * delegate 识别该节点。草稿扫描与设计文档打开侧的子集校验共用本谓词，
 * 「什么是抄送节点」的口径单点维护。
 */
export function isCcServiceTask(element: ModdleElement): boolean {
  if (element.$type !== "bpmn:ServiceTask") return false;
  const ccDelegate = flowableAdapter.taskTypeMapping.cc.attributes?.delegateExpression;
  return (
    element.get("ccTo") !== undefined ||
    (ccDelegate !== undefined && element.get("delegateExpression") === ccDelegate)
  );
}

/**
 * 草稿扫描（#71 起公开）：收集「部署合法但运行时无法按用户配置执行」的待修复项。
 * 草稿允许留在模型树中——部署导出（exportXml）据此拦截，设计文档保存据此提示，
 * 两条链路共用同一扫描口径，不各自复制判断。
 */
export function collectDraftIssues(model: BpmnModel): string[] {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  const errors: string[] = [];
  for (const el of elements) {
    const label = labelOf(el);
    if (el.$type === "bpmn:ServiceTask") {
      if (!isCcServiceTask(el)) continue;
      const ccTo = el.get("ccTo");
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
  return errors;
}

/** 部署导出的草稿拦截：有待修复项时不产出 XML（保存设计文档不受此限）。 */
function assertNoDraftFields(model: BpmnModel): void {
  const errors = collectDraftIssues(model);
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
