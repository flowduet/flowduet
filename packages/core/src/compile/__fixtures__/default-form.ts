import { flowableAdapter } from "../../adapter/flowable-adapter.js";
import { BpmnModel } from "../../model/bpmn-model.js";

/**
 * 默认表单绑定基准（#72）：流程默认 key + 单签节点显式覆盖 + 多实例节点继承。
 * 继承不逐节点固化——XML 只有 process 上的 flowduet:defaultFormKey 与显式
 * 节点的 flowable:formKey 两处引用，供编译合同与 Flowable 6.8 部署冒烟使用。
 */
export function buildDefaultFormFlow(): BpmnModel {
  return BpmnModel.create({
    processId: "default_form_flow",
    processName: "默认表单审批",
    adapter: flowableAdapter,
  })
    .setDefaultFormKey("leave_form_v1")
    .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
    .addUserTask({
      id: "solo_approval",
      name: "经理审批",
      assignee: "${manager}",
      formKey: "manager_form_v1",
      shape: { x: 140, y: 160, width: 100, height: 80 },
    })
    .addApprovalTask({
      id: "counter_sign",
      name: "部门会签",
      collection: "approvers",
      mode: "all",
      shape: { x: 140, y: 300, width: 100, height: 80 },
    })
    .addEndEvent({ id: "end", name: "结束", shape: { x: 172, y: 440, width: 36, height: 36 } })
    .addSequenceFlow({
      id: "flow_start_solo",
      sourceRef: "start",
      targetRef: "solo_approval",
      waypoints: [
        { x: 178, y: 96 },
        { x: 178, y: 160 },
      ],
    })
    .addSequenceFlow({
      id: "flow_solo_counter",
      sourceRef: "solo_approval",
      targetRef: "counter_sign",
      waypoints: [
        { x: 190, y: 240 },
        { x: 190, y: 300 },
      ],
    })
    .addSequenceFlow({
      id: "flow_counter_end",
      sourceRef: "counter_sign",
      targetRef: "end",
      waypoints: [
        { x: 190, y: 380 },
        { x: 190, y: 440 },
      ],
    });
}
