import { flowableAdapter } from "../../adapter/flowable-adapter.js";
import { BpmnModel } from "../../model/bpmn-model.js";

/**
 * 分支结构两份基准的流程输入（编译合同与往返保真共用）：
 * 1. 并行分裂-汇合：开始 → 并行网关分两路（HR/财务并行审批）→ 并行汇合 → 结束；
 * 2. 带默认分支的排他网关：拒绝分支为默认流转（无条件表达式），
 *    对应钉钉式抽屉「其余情况走默认」的落法（R2 决策：分支侧标记，内核写网关 default）。
 */
export function buildParallelFlow(): BpmnModel {
  return BpmnModel.create({
    processId: "parallel_flow",
    processName: "并行审批",
    adapter: flowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addParallelGateway({
      id: "fork",
      name: "并行分裂",
      shape: { x: 153, y: 150, width: 50, height: 50 },
    })
    .addUserTask({
      id: "hr_review",
      name: "人事审查",
      assignee: "${hr}",
      shape: { x: 60, y: 260, width: 100, height: 80 },
    })
    .addUserTask({
      id: "finance_review",
      name: "财务核销",
      assignee: "${finance}",
      shape: { x: 200, y: 260, width: 100, height: 80 },
    })
    .addParallelGateway({
      id: "join",
      name: "并行汇合",
      shape: { x: 153, y: 400, width: 50, height: 50 },
    })
    .addEndEvent({ id: "end", name: "结束", shape: { x: 160, y: 510, width: 36, height: 36 } })
    .addSequenceFlow({
      id: "f_start_fork",
      sourceRef: "start",
      targetRef: "fork",
      waypoints: [
        { x: 178, y: 96 },
        { x: 178, y: 150 },
      ],
    })
    .addSequenceFlow({
      id: "f_fork_hr",
      sourceRef: "fork",
      targetRef: "hr_review",
      waypoints: [
        { x: 153, y: 175 },
        { x: 110, y: 260 },
      ],
    })
    .addSequenceFlow({
      id: "f_fork_finance",
      sourceRef: "fork",
      targetRef: "finance_review",
      waypoints: [
        { x: 203, y: 175 },
        { x: 250, y: 260 },
      ],
    })
    .addSequenceFlow({
      id: "f_hr_join",
      sourceRef: "hr_review",
      targetRef: "join",
      waypoints: [
        { x: 110, y: 340 },
        { x: 153, y: 425 },
      ],
    })
    .addSequenceFlow({
      id: "f_finance_join",
      sourceRef: "finance_review",
      targetRef: "join",
      waypoints: [
        { x: 250, y: 340 },
        { x: 203, y: 425 },
      ],
    })
    .addSequenceFlow({
      id: "f_join_end",
      sourceRef: "join",
      targetRef: "end",
      waypoints: [
        { x: 178, y: 450 },
        { x: 178, y: 510 },
      ],
    });
}

export function buildDefaultBranchFlow(): BpmnModel {
  return BpmnModel.create({
    processId: "default_branch",
    processName: "默认分支审批",
    adapter: flowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addUserTask({
      id: "manager_approval",
      name: "经理审批",
      assignee: "${manager}",
      shape: { x: 140, y: 160, width: 100, height: 80 },
    })
    .addExclusiveGateway({
      id: "decision",
      name: "是否同意",
      shape: { x: 165, y: 290, width: 50, height: 50 },
    })
    .addEndEvent({
      id: "end_approved",
      name: "同意归档",
      shape: { x: 250, y: 400, width: 36, height: 36 },
    })
    .addEndEvent({
      id: "end_rejected",
      name: "拒绝结束",
      shape: { x: 100, y: 400, width: 36, height: 36 },
    })
    .addSequenceFlow({
      id: "flow_start_approve",
      sourceRef: "start",
      targetRef: "manager_approval",
      waypoints: [
        { x: 178, y: 96 },
        { x: 178, y: 160 },
      ],
    })
    .addSequenceFlow({
      id: "flow_approve_decision",
      sourceRef: "manager_approval",
      targetRef: "decision",
      waypoints: [
        { x: 190, y: 240 },
        { x: 190, y: 290 },
      ],
    })
    .addSequenceFlow({
      id: "flow_approved",
      name: "同意",
      sourceRef: "decision",
      targetRef: "end_approved",
      condition: "${approved}",
      waypoints: [
        { x: 215, y: 315 },
        { x: 268, y: 400 },
      ],
    })
    .addSequenceFlow({
      id: "flow_rejected",
      name: "拒绝",
      sourceRef: "decision",
      targetRef: "end_rejected",
      default: true,
      waypoints: [
        { x: 165, y: 315 },
        { x: 118, y: 400 },
      ],
    });
}
