import { flowableAdapter } from "../../adapter/flowable-adapter.js";
import { BpmnModel } from "../../model/bpmn-model.js";

/**
 * 验证场景（#22）：五类节点全谱、多层嵌套（条件块嵌并行块 + 条件块嵌条件块），
 * 零坐标建模——钉钉式纵向编辑的形态。编译合同走 verticalDiLayout 推导几何。
 */
export function buildVerticalScenario(): BpmnModel {
  return (
    BpmnModel.create({
      processId: "vertical_scenario",
      processName: "竖排推导场景",
      adapter: flowableAdapter,
    })
      .addStartEvent({ id: "start", name: "开始" })
      .addUserTask({ id: "initiate", name: "发起申请", assignee: "${initiator}" })
      .addExclusiveGateway({ id: "cond1_fork", name: "金额判断" })
      // 支 1：并行分支块（三支，含会签与依次审批两档多实例）
      .addParallelGateway({ id: "par_fork", name: "并行开始" })
      .addParallelGateway({ id: "par_join", name: "并行结束" })
      .addApprovalTask({
        id: "counter_sign",
        name: "部门会签",
        collection: "approvers",
        mode: "all",
      })
      .addUserTask({ id: "hr_approve", name: "HR 审批", assignee: "${hr}" })
      .addApprovalTask({
        id: "sequential_sign",
        name: "逐级审批",
        collection: "chain",
        mode: "sequential",
      })
      // 支 2：总监审批 → 抄送 → 嵌套条件分支块
      .addUserTask({ id: "director_approve", name: "总监审批", assignee: "${director}" })
      .addTask("cc", { id: "cc_notify", name: "抄送知会", recipients: "张三,李四" })
      .addExclusiveGateway({ id: "cond2_fork", name: "是否通过" })
      .addExclusiveGateway({ id: "cond2_join", name: "汇聚" })
      .addUserTask({ id: "rectify", name: "整改", assignee: "${owner}" })
      .addUserTask({ id: "archive_review", name: "归档复核", assignee: "${auditor}" })
      .addExclusiveGateway({ id: "cond1_join", name: "汇聚" })
      .addEndEvent({ id: "end", name: "结束" })
      .addSequenceFlow({ id: "f_s_init", sourceRef: "start", targetRef: "initiate" })
      .addSequenceFlow({ id: "f_init_c1", sourceRef: "initiate", targetRef: "cond1_fork" })
      .addSequenceFlow({
        id: "f_c1_par",
        sourceRef: "cond1_fork",
        targetRef: "par_fork",
        condition: "${amount > 1000}",
      })
      .addSequenceFlow({ id: "f_par_cs", sourceRef: "par_fork", targetRef: "counter_sign" })
      .addSequenceFlow({ id: "f_par_hr", sourceRef: "par_fork", targetRef: "hr_approve" })
      .addSequenceFlow({ id: "f_par_seq", sourceRef: "par_fork", targetRef: "sequential_sign" })
      .addSequenceFlow({ id: "f_cs_join", sourceRef: "counter_sign", targetRef: "par_join" })
      .addSequenceFlow({ id: "f_hr_pj", sourceRef: "hr_approve", targetRef: "par_join" })
      .addSequenceFlow({ id: "f_seq_join", sourceRef: "sequential_sign", targetRef: "par_join" })
      .addSequenceFlow({ id: "f_pj_j1", sourceRef: "par_join", targetRef: "cond1_join" })
      .addSequenceFlow({
        id: "f_c1_dir",
        sourceRef: "cond1_fork",
        targetRef: "director_approve",
        condition: "${amount <= 1000}",
      })
      .addSequenceFlow({ id: "f_dir_cc", sourceRef: "director_approve", targetRef: "cc_notify" })
      .addSequenceFlow({ id: "f_cc_c2", sourceRef: "cc_notify", targetRef: "cond2_fork" })
      .addSequenceFlow({
        id: "f_c2_rect",
        sourceRef: "cond2_fork",
        targetRef: "rectify",
        condition: "${!passed}",
      })
      .addSequenceFlow({ id: "f_rect_j2", sourceRef: "rectify", targetRef: "cond2_join" })
      .addSequenceFlow({
        id: "f_c2_arch",
        sourceRef: "cond2_fork",
        targetRef: "archive_review",
        condition: "${passed}",
      })
      .addSequenceFlow({ id: "f_arch_j2", sourceRef: "archive_review", targetRef: "cond2_join" })
      .addSequenceFlow({ id: "f_j2_j1", sourceRef: "cond2_join", targetRef: "cond1_join" })
      .addSequenceFlow({ id: "f_j1_end", sourceRef: "cond1_join", targetRef: "end" })
  );
}
