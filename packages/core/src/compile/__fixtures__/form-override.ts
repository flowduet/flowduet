import { flowableAdapter } from "../../adapter/flowable-adapter.js";
import { BpmnModel } from "../../model/bpmn-model.js";

/**
 * 多表单覆盖基准（#73，A19/AC10）：流程默认 + 四种审批形态的继承/覆盖混布，
 * 其中会签与依次审批复用同一张覆盖表单（form_review_v1）——多节点共享表单
 * 定义的编译形态。网关与抄送在场但不参与表单解析，供编译合同、往返保真
 * 与 Flowable 6.8 部署冒烟（任务 formKey 运行时断言）使用。
 */
export function buildFormOverrideFlow(): BpmnModel {
  return (
    BpmnModel.create({
      processId: "form_override_flow",
      processName: "多表单覆盖审批",
      adapter: flowableAdapter,
    })
      .setDefaultFormKey("form_apply_v1")
      .addStartEvent({ id: "start", name: "开始", shape: { x: 160, y: 60, width: 36, height: 36 } })
      // 单签：继承默认（不落 formKey）
      .addUserTask({
        id: "solo_apply",
        name: "提交复核",
        assignee: "${submitter}",
        shape: { x: 140, y: 150, width: 100, height: 80 },
      })
      .addExclusiveGateway({
        id: "amount_fork",
        name: "金额判断",
        shape: { x: 165, y: 280, width: 50, height: 50 },
      })
      // 会签：显式覆盖为复核单（默认支，无需条件）
      .addApprovalTask({
        id: "mi_review",
        name: "部门复核",
        collection: "approvers",
        mode: "all",
        formKey: "form_review_v1",
        shape: { x: 40, y: 390, width: 100, height: 80 },
      })
      // 或签：继承默认（条件支）
      .addApprovalTask({
        id: "any_audit",
        name: "总监抽审",
        collection: "directors",
        mode: "any",
        shape: { x: 230, y: 390, width: 100, height: 80 },
      })
      .addExclusiveGateway({
        id: "merge_join",
        name: "汇聚",
        shape: { x: 165, y: 520, width: 50, height: 50 },
      })
      // 依次审批：与部门复用同一张复核单（多节点复用同一表单定义）
      .addApprovalTask({
        id: "seq_sign",
        name: "依次确认",
        collection: "chains",
        mode: "sequential",
        formKey: "form_review_v1",
        shape: { x: 140, y: 630, width: 100, height: 80 },
      })
      // 抄送：不参与表单解析（A19）
      .addTask("cc", {
        id: "cc_record",
        name: "抄送备案",
        recipients: "张三,李四",
        shape: { x: 140, y: 770, width: 100, height: 80 },
      })
      .addEndEvent({ id: "end", name: "结束", shape: { x: 172, y: 910, width: 36, height: 36 } })
      .addSequenceFlow({
        id: "f_start_apply",
        sourceRef: "start",
        targetRef: "solo_apply",
        waypoints: [
          { x: 178, y: 96 },
          { x: 178, y: 150 },
        ],
      })
      .addSequenceFlow({
        id: "f_apply_fork",
        sourceRef: "solo_apply",
        targetRef: "amount_fork",
        waypoints: [
          { x: 190, y: 230 },
          { x: 190, y: 280 },
        ],
      })
      .addSequenceFlow({
        id: "f_fork_review",
        name: "常规复核",
        sourceRef: "amount_fork",
        targetRef: "mi_review",
        default: true,
        waypoints: [
          { x: 165, y: 305 },
          { x: 90, y: 390 },
        ],
      })
      .addSequenceFlow({
        id: "f_fork_audit",
        name: "大额抽审",
        sourceRef: "amount_fork",
        targetRef: "any_audit",
        condition: "${amount > 1000}",
        waypoints: [
          { x: 215, y: 305 },
          { x: 280, y: 390 },
        ],
      })
      .addSequenceFlow({
        id: "f_review_join",
        sourceRef: "mi_review",
        targetRef: "merge_join",
        waypoints: [
          { x: 90, y: 470 },
          { x: 165, y: 545 },
        ],
      })
      .addSequenceFlow({
        id: "f_audit_join",
        sourceRef: "any_audit",
        targetRef: "merge_join",
        waypoints: [
          { x: 280, y: 470 },
          { x: 215, y: 545 },
        ],
      })
      .addSequenceFlow({
        id: "f_join_seq",
        sourceRef: "merge_join",
        targetRef: "seq_sign",
        waypoints: [
          { x: 190, y: 570 },
          { x: 190, y: 630 },
        ],
      })
      .addSequenceFlow({
        id: "f_seq_cc",
        sourceRef: "seq_sign",
        targetRef: "cc_record",
        waypoints: [
          { x: 190, y: 710 },
          { x: 190, y: 770 },
        ],
      })
      .addSequenceFlow({
        id: "f_cc_end",
        sourceRef: "cc_record",
        targetRef: "end",
        waypoints: [
          { x: 190, y: 850 },
          { x: 190, y: 910 },
        ],
      })
  );
}
