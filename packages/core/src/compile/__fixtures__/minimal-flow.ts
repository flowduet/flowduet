import { flowableAdapter } from "../../adapter/flowable-adapter";
import { BpmnModel } from "../../model/bpmn-model";

/**
 * 编译合同的最小流程输入（ROADMAP Step 1 测试链 1 与 2 共用）：
 * 开始 → 用户任务 → 排他网关 → 两分支 → 结束。
 */
export function buildMinimalFlow(): BpmnModel {
  return BpmnModel.create({
    processId: "leave_approval",
    processName: "请假审批",
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
      condition: "${!approved}",
      waypoints: [
        { x: 165, y: 315 },
        { x: 118, y: 400 },
      ],
    });
}
