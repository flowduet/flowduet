import { BpmnModel } from "../../packages/core/src/model/bpmn-model.js";
import { addApprovalTask, prototypeAddFlow, prototypeFlowableAdapter } from "./mi-approval.js";
import { deriveBlockTree, prototypeAddGateway, renderTreeToString } from "./vertical-layout.js";

const DUMMY = { x: 0, y: 0, width: 10, height: 10 };

const model = BpmnModel.create({
  processId: "vertical_scenario",
  processName: "竖排推导场景",
  adapter: prototypeFlowableAdapter,
})
  .addStartEvent({ id: "start", name: "开始", shape: DUMMY })
  .addUserTask({ id: "initiate", name: "发起申请", assignee: "${initiator}", shape: DUMMY })
  .addExclusiveGateway({ id: "cond1_fork", name: "金额判断", shape: DUMMY });
prototypeAddGateway(model, { id: "par_fork", name: "并行开始", type: "parallel" });
prototypeAddGateway(model, { id: "par_join", name: "并行结束", type: "parallel" });
model
  .addUserTask({ id: "hr_approve", name: "HR 审批", assignee: "${hr}", shape: DUMMY })
  .addUserTask({ id: "director_approve", name: "总监审批", assignee: "${director}", shape: DUMMY })
  .addExclusiveGateway({ id: "cond2_fork", name: "是否通过", shape: DUMMY })
  .addExclusiveGateway({ id: "cond2_join", name: "汇聚", shape: DUMMY })
  .addUserTask({ id: "rectify", name: "整改", assignee: "${owner}", shape: DUMMY })
  .addUserTask({ id: "archive_review", name: "归档复核", assignee: "${auditor}", shape: DUMMY })
  .addExclusiveGateway({ id: "cond1_join", name: "汇聚", shape: DUMMY })
  .addEndEvent({ id: "end", name: "结束", shape: DUMMY });

addApprovalTask(model, {
  id: "counter_sign",
  name: "部门会签",
  collection: "${approvers}",
  mode: "all",
});
addApprovalTask(model, {
  id: "sequential_sign",
  name: "逐级审批",
  collection: "${chain}",
  mode: "sequential",
});

prototypeAddFlow(model, { id: "f_c1_par", sourceRef: "cond1_fork", targetRef: "par_fork" });
prototypeAddFlow(model, { id: "f_par_cs", sourceRef: "par_fork", targetRef: "counter_sign" });
prototypeAddFlow(model, { id: "f_par_hr", sourceRef: "par_fork", targetRef: "hr_approve" });
prototypeAddFlow(model, { id: "f_par_seq", sourceRef: "par_fork", targetRef: "sequential_sign" });
prototypeAddFlow(model, { id: "f_cs_join", sourceRef: "counter_sign", targetRef: "par_join" });
prototypeAddFlow(model, { id: "f_hr_pj", sourceRef: "hr_approve", targetRef: "par_join" });
prototypeAddFlow(model, { id: "f_seq_join", sourceRef: "sequential_sign", targetRef: "par_join" });
prototypeAddFlow(model, { id: "f_pj_j1", sourceRef: "par_join", targetRef: "cond1_join" });

model
  .addSequenceFlow({
    id: "f_s_init",
    sourceRef: "start",
    targetRef: "initiate",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_init_c1",
    sourceRef: "initiate",
    targetRef: "cond1_fork",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_c1_dir",
    sourceRef: "cond1_fork",
    targetRef: "director_approve",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_dir_c2",
    sourceRef: "director_approve",
    targetRef: "cond2_fork",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_c2_rect",
    sourceRef: "cond2_fork",
    targetRef: "rectify",
    condition: "${!passed}",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_rect_j2",
    sourceRef: "rectify",
    targetRef: "cond2_join",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_c2_arch",
    sourceRef: "cond2_fork",
    targetRef: "archive_review",
    condition: "${passed}",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_arch_j2",
    sourceRef: "archive_review",
    targetRef: "cond2_join",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_j2_j1",
    sourceRef: "cond2_join",
    targetRef: "cond1_join",
    waypoints: [DUMMY, DUMMY],
  })
  .addSequenceFlow({
    id: "f_j1_end",
    sourceRef: "cond1_join",
    targetRef: "end",
    waypoints: [DUMMY, DUMMY],
  });

const flowElements = model.process.get("flowElements") as {
  $type: string;
  get(k: string): unknown;
}[];
console.log("flowElements:", flowElements.map((el) => `${el.$type}:${el.get("id")}`).join(", "));
console.log("总数:", flowElements.length);

const tree = deriveBlockTree(model);
console.log(renderTreeToString(tree));
