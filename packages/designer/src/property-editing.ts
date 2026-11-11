import type { ApprovalDraftOptions, ApprovalMode, BpmnModel, ModdleElement } from "@flowduet/core";
import {
  CC_RECIPIENTS_PLACEHOLDER,
  convertApprovalToMulti,
  convertMultiToSingle,
  readApprovalMulti,
  setApprovalMode,
  setBranchCondition,
} from "./operations.js";
export type FlowPropertyDraft =
  | { kind: "process"; name: string }
  | {
      kind: "approval";
      name: string;
      approvalKind: "single" | ApprovalMode;
      assignee: string;
      formKey: string;
      elementVariable?: string;
      lastSingleAssignee?: string;
      lastCollection?: string;
    }
  | { kind: "cc"; name: string; recipients: string }
  | { kind: "branch"; name: string; condition: string };
export type DesignerOperation =
  | { type: "insert-after"; nodeId: string; kind: "approval" | "cc" }
  | { type: "remove-node"; nodeId: string }
  | { type: "add-branch"; forkId: string }
  | { type: "remove-branch"; flowId: string }
  | { type: "remove-block"; forkId: string }
  | { type: "set-default"; forkId: string; flowId: string | null };
export type DesignerSelectionRequest = { model: BpmnModel; renderRevision: number; id: string };
export type DesignerOperationRequest = {
  model: BpmnModel;
  renderRevision: number;
  operation: DesignerOperation;
};
export type FocusResult =
  { status: "focused"; selectedId: string } | { status: "missing" | "cancelled" };
export const KIND_OPTIONS = [
  { key: "single", label: "单签", hint: "一人审批" },
  { key: "all", label: "会签", hint: "全员同意" },
  { key: "any", label: "或签", hint: "任一同意" },
  { key: "sequential", label: "依次", hint: "顺序逐人" },
] as const;

export function readPropertyDraft(model: BpmnModel, id: string): FlowPropertyDraft | undefined {
  const el = id === model.process.get("id") ? model.process : model.elementOf(id);
  const name = String(el.get("name") ?? "");
  if (el.$type === "bpmn:Process") return { kind: "process", name };
  if (el.$type === "bpmn:UserTask") {
    const multi = readApprovalMulti(model, id);
    return {
      kind: "approval",
      name,
      approvalKind: multi?.mode ?? "single",
      assignee: multi?.collection ?? String(el.get("assignee") ?? ""),
      formKey: String(el.get("formKey") ?? ""),
      ...(multi ? { elementVariable: multi.elementVariable } : {}),
    };
  }
  if (el.$type === "bpmn:ServiceTask" && el.get("ccTo") !== undefined)
    return { kind: "cc", name, recipients: String(el.get("ccTo") ?? "") };
  if (
    el.$type === "bpmn:SequenceFlow" &&
    (el.get("sourceRef") as ModdleElement).$type === "bpmn:ExclusiveGateway"
  )
    return {
      kind: "branch",
      name,
      condition: String(
        (el.get("conditionExpression") as ModdleElement | undefined)?.get("body") ?? "",
      ),
    };
  return undefined;
}

/** 形态切换只改输入；分别记住审批人与集合变量，防止跨语义沿用。 */
export function switchApprovalKind(
  draft: Extract<FlowPropertyDraft, { kind: "approval" }>,
  next: "single" | ApprovalMode,
): Extract<FlowPropertyDraft, { kind: "approval" }> {
  if ((draft.approvalKind === "single") === (next === "single"))
    return { ...draft, approvalKind: next };
  const result = { ...draft, approvalKind: next };
  if (draft.approvalKind === "single") result.lastSingleAssignee = draft.assignee;
  else result.lastCollection = draft.assignee;
  result.assignee = (next === "single" ? result.lastSingleAssignee : result.lastCollection) ?? "";
  return result;
}

/** 抽屉与外置面板共用规则；调用者负责事务与提交时机，默认仍严格。 */
export function applyPropertyDraft(
  model: BpmnModel,
  id: string,
  draft: FlowPropertyDraft,
  options: ApprovalDraftOptions & { integratedForms?: boolean } = {},
): void {
  const current = readPropertyDraft(model, id);
  if (!current || current.kind !== draft.kind) throw new Error("对象形态与编辑输入不相容");
  const el = id === model.process.get("id") ? model.process : model.elementOf(id);
  if (draft.kind === "branch") setBranchCondition(model, id, draft.condition);
  else if (draft.kind === "approval") {
    const assignee = draft.assignee.trim();
    if (draft.approvalKind !== "single") {
      if (!assignee && options.allowIncomplete !== true)
        throw new Error("多人审批需要填写审批人集合变量名（运行时注入名单）");
      if (assignee && !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(assignee))
        throw new Error(
          "审批人集合变量名仅支持英文字母/数字/下划线（如 approvers 或 dept.approvers），不接受 ${...} 表达式或逗号名单",
        );
    }
    if (draft.approvalKind === "single") {
      if (readApprovalMulti(model, id) !== null) convertMultiToSingle(model, id);
      el.set("assignee", assignee || undefined);
    } else {
      const elementVariable =
        draft.elementVariable ??
        (current.kind === "approval" ? current.elementVariable : undefined);
      const spec = {
        collection: assignee,
        mode: draft.approvalKind,
        ...(elementVariable !== undefined ? { elementVariable } : {}),
      };
      if (readApprovalMulti(model, id) === null) convertApprovalToMulti(model, id, spec, options);
      else setApprovalMode(model, id, spec, options);
    }
    const key = options.integratedForms ? draft.formKey : draft.formKey.trim();
    el.set("formKey", key || undefined);
  } else if (draft.kind === "cc") {
    const recipients = draft.recipients.trim();
    if (
      options.allowIncomplete !== true &&
      (!recipients || recipients === CC_RECIPIENTS_PLACEHOLDER)
    )
      throw new Error("抄送收件人不能为空白或占位文本（字面量逗号分隔或表达式）");
    el.set("ccTo", recipients);
  }
  // 结构/格式守卫通过后再写名称；原位转换保持所有外部引用。
  el.set("name", draft.name.trim() || undefined);
}
