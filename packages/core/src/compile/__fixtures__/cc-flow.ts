import { flowableAdapter } from "../../adapter/flowable-adapter.js";
import { BpmnModel } from "../../model/bpmn-model.js";

/**
 * 抄送任务基准的最小流程输入（编译合同与往返保真共用）：
 * 开始 → 经理审批 → 抄送知会 → 结束。
 * 抄送方言形态 = ServiceTask + flowable:ccTo（收件人）+ 占位 delegate
 * 引用（宿主绑定 bean 实现知会，R3 决策）。
 */
export function buildCcFlow(): BpmnModel {
  return BpmnModel.create({
    processId: "cc_flow",
    processName: "抄送知会",
    adapter: flowableAdapter,
  })
    .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addUserTask({
      id: "manager_approval",
      name: "经理审批",
      assignee: "${manager}",
      shape: { x: 140, y: 160, width: 100, height: 80 },
    })
    .addTask("cc", {
      id: "cc_notify",
      name: "抄送知会",
      recipients: "张三,李四",
      shape: { x: 140, y: 300, width: 100, height: 80 },
    })
    .addEndEvent({ id: "end", name: "结束", shape: { x: 172, y: 440, width: 36, height: 36 } })
    .addSequenceFlow({
      id: "f_start_approval",
      sourceRef: "start",
      targetRef: "manager_approval",
      waypoints: [
        { x: 178, y: 96 },
        { x: 178, y: 160 },
      ],
    })
    .addSequenceFlow({
      id: "f_approval_cc",
      sourceRef: "manager_approval",
      targetRef: "cc_notify",
      waypoints: [
        { x: 190, y: 240 },
        { x: 190, y: 300 },
      ],
    })
    .addSequenceFlow({
      id: "f_cc_end",
      sourceRef: "cc_notify",
      targetRef: "end",
      waypoints: [
        { x: 190, y: 380 },
        { x: 190, y: 440 },
      ],
    });
}
