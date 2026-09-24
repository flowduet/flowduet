import type { ModdleElement } from "bpmn-moddle";
import type { BpmnModel } from "./bpmn-model.js";

/**
 * 有效表单解析（ADR-0009 决策 4，CONTEXT.md 术语「有效表单」）：
 * 节点表单覆盖优先，否则使用流程默认表单；两者均未指定为合法无表单状态。
 * 已指定的 key 是否真的有定义，由持有表单目录的调用方（designer 展示 /
 * form-create 引用诊断）核对——内核只依据 XML 事实源回答「谁生效」。
 */
export interface EffectiveFormRef {
  /** 引用来源：节点显式覆盖 / 流程默认继承 / 未指定 */
  source: "node" | "default" | "none";
  /** 生效的表单 key；source 为 none 时为 undefined */
  key: string | undefined;
}

/**
 * 审批节点判定（CONTEXT.md 术语「审批节点」）：单签与三种多人形态统一落在
 * bpmn:UserTask（多人经多实例特征区分，表单语义同构）。网关、抄送、起止
 * 事件都不是审批节点——不参与默认继承，也不提供表单配置入口。
 * 默认继承、目录诊断、宿主遍历共用本谓词，口径单点维护。
 */
export function isApprovalTask(element: ModdleElement): boolean {
  return element.$type === "bpmn:UserTask";
}

/**
 * 解析节点当前的有效表单引用。
 * 只有审批节点（单签与三种多人形态）参与表单解析；其余元素一律返回 none，
 * 也不因流程默认表单而获得有效表单。引用失效（key 指向不存在的定义）
 * 不是回退理由——调用方按失效报告。
 */
export function resolveEffectiveForm(model: BpmnModel, nodeId: string): EffectiveFormRef {
  const element = model.elementOf(nodeId);
  if (!isApprovalTask(element)) {
    return { source: "none", key: undefined };
  }
  // 引用必须与 XML 字面值一致；裁剪后的副本会让预览误判为有效，而部署 XML 仍保留空格。
  const explicit = String(element.get("formKey") ?? "");
  if (explicit !== "") {
    return { source: "node", key: explicit };
  }
  const inherited = String(model.defaultFormKey ?? "");
  if (inherited !== "") {
    return { source: "default", key: inherited };
  }
  return { source: "none", key: undefined };
}
