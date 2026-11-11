import type { BpmnModel, ModdleElement } from "@flowduet/core";
import type { DesignerOperation } from "../../../../../packages/designer/src/property-editing";
import {
  insertApprovalAfter,
  insertCcAfter,
  CC_RECIPIENTS_PLACEHOLDER,
  removeApprovalNode,
  addBranchToBlock,
  removeBranch,
  removeBlock,
  setDefaultBranch,
} from "../../../../../packages/designer/src/operations";
/** 只接受封闭的既有语义命令，索引在当前fork上重新解析。 */
export function runOperation(model: BpmnModel, operation: DesignerOperation) {
  switch (operation.type) {
    case "insert-after":
      if (operation.kind === "approval") insertApprovalAfter(model, operation.nodeId);
      else insertCcAfter(model, operation.nodeId, { recipients: CC_RECIPIENTS_PLACEHOLDER });
      break;
    case "remove-node":
      removeApprovalNode(model, operation.nodeId);
      break;
    case "add-branch":
      addBranchToBlock(model, operation.forkId);
      break;
    case "remove-block":
      removeBlock(model, operation.forkId);
      break;
    case "remove-branch": {
      const flow = model.elementOf(operation.flowId),
        fork = flow.get("sourceRef") as ModdleElement;
      const index = ((fork.get("outgoing") as ModdleElement[]) ?? []).indexOf(flow);
      if (index < 0) throw new Error("支路头不属于当前网关");
      removeBranch(model, String(fork.get("id")), index);
      break;
    }
    case "set-default": {
      const outgoing = (model.elementOf(operation.forkId).get("outgoing") as ModdleElement[]) ?? [];
      const index =
        operation.flowId === null
          ? null
          : outgoing.findIndex((f) => f.get("id") === operation.flowId);
      if (index === -1) throw new Error("默认支路不属于当前网关");
      setDefaultBranch(model, operation.forkId, index);
      break;
    }
  }
}
