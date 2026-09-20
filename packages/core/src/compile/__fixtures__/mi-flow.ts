import { flowableAdapter } from "../../adapter/flowable-adapter.js";
import { BpmnModel } from "../../model/bpmn-model.js";
import type { ApprovalMode } from "../../model/bpmn-model.js";

/**
 * 多实例三档（编译合同与往返保真共用）的最小流程输入：
 * 开始 → 多实例审批 → 结束。
 *
 * 三档的任务命名沿用原型（prototype/iter2-vertical-layout-mi）在
 * Flowable 6.8 实测部署过的产物，语义形态一一对应：
 *   all        → counter_sign（部门会签，approvers 集合）
 *   any        → any_sign（主管或签，approvers 集合）
 *   sequential → seq_sign（逐级审批，chain 集合，串行无完成条件）
 */
const TASK_BY_MODE: Readonly<
  Record<ApprovalMode, { id: string; name: string; collection: string }>
> = {
  all: { id: "counter_sign", name: "部门会签", collection: "approvers" },
  any: { id: "any_sign", name: "主管或签", collection: "approvers" },
  sequential: { id: "seq_sign", name: "逐级审批", collection: "chain" },
};

export function buildMiFlow(mode: ApprovalMode): BpmnModel {
  const task = TASK_BY_MODE[mode];
  return BpmnModel.create({
    processId: `mi_${mode}`,
    processName: `多实例三档验证 · ${mode}`,
    adapter: flowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addApprovalTask({
      id: task.id,
      name: task.name,
      collection: task.collection,
      mode,
      shape: { x: 140, y: 160, width: 100, height: 80 },
    })
    .addEndEvent({ id: "end", name: "结束", shape: { x: 160, y: 300, width: 36, height: 36 } })
    .addSequenceFlow({
      id: "f1",
      sourceRef: "start",
      targetRef: task.id,
      waypoints: [
        { x: 178, y: 96 },
        { x: 190, y: 160 },
      ],
    })
    .addSequenceFlow({
      id: "f2",
      sourceRef: task.id,
      targetRef: "end",
      waypoints: [
        { x: 190, y: 240 },
        { x: 178, y: 300 },
      ],
    });
}
