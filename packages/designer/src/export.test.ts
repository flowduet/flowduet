import { describe, expect, it } from "vitest";
import { BpmnModel, compile, flowableAdapter, parse, verticalDiLayout } from "@flowduet/core";
import type { ModdleElement } from "@flowduet/core";
import { exportXml } from "./export.js";
import {
  addBranchToBlock,
  branchHeadFlowId,
  setBranchCondition,
  setDefaultBranch,
} from "./operations.js";

function singleApproval(): BpmnModel {
  return BpmnModel.create({ processId: "draft_export", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addUserTask({ id: "approval", name: "经理审批" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "to_approval", sourceRef: "start", targetRef: "approval" })
    .addSequenceFlow({ id: "to_end", sourceRef: "approval", targetRef: "end" });
}

function ccNotice(): BpmnModel {
  return BpmnModel.create({ processId: "draft_cc", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addTask("cc", { id: "cc", name: "抄送法务", recipients: "张三" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "to_cc", sourceRef: "start", targetRef: "cc" })
    .addSequenceFlow({ id: "to_end", sourceRef: "cc", targetRef: "end" });
}

function exclusiveApproval(): BpmnModel {
  return BpmnModel.create({ processId: "draft_branch", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addExclusiveGateway({ id: "fork", name: "金额判断" })
    .addUserTask({ id: "routine", name: "总监审批", assignee: "${director}" })
    .addUserTask({ id: "large", assignee: "${finance}" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "entry", sourceRef: "start", targetRef: "fork" })
    .addSequenceFlow({
      id: "routine_flow",
      name: "常规审批",
      sourceRef: "fork",
      targetRef: "routine",
      default: true,
    })
    .addSequenceFlow({
      id: "large_flow",
      name: "大额复核",
      sourceRef: "fork",
      targetRef: "large",
      condition: "${amount > 1000}",
    })
    .addSequenceFlow({ id: "routine_join", sourceRef: "routine", targetRef: "join" })
    .addSequenceFlow({ id: "large_join", sourceRef: "large", targetRef: "join" })
    .addSequenceFlow({ id: "exit", sourceRef: "join", targetRef: "end" });
}

describe("exportXml 全模型草稿校验", () => {
  it("单签审批人未配置时拒绝导出，指出审批节点", async () => {
    const model = singleApproval();

    await expect(exportXml(model)).rejects.toThrow(/经理审批.*审批人/);
  });

  it("空白审批人按未配置处理，节点无名称时回退到 ID", async () => {
    const model = singleApproval();
    model.elementOf("approval").set("name", "");
    model.elementOf("approval").set("assignee", "   ");

    await expect(exportXml(model)).rejects.toThrow(/approval.*审批人/);
  });

  it("抄送收件人为空白或丢失时拒绝导出", async () => {
    for (const recipients of ["   ", undefined]) {
      const model = ccNotice();
      model.elementOf("cc").set("ccTo", recipients);

      await expect(exportXml(model)).rejects.toThrow(/抄送法务.*收件人/);
    }
  });

  it("非默认条件支路未配置时拒绝导出，补齐后恢复", async () => {
    const model = exclusiveApproval();
    setBranchCondition(model, "large_flow", "");

    await expect(exportXml(model)).rejects.toThrow(/大额复核.*条件/);

    setBranchCondition(model, "large_flow", "${amount > 1000}");
    const xml = await exportXml(model);
    expect(xml).toContain('default="routine_flow"');
    expect(xml).toContain("conditionExpression");
  });

  it("非默认条件表达式只有空格时仍拒绝导出", async () => {
    const model = exclusiveApproval();
    const expression = model.elementOf("large_flow").get("conditionExpression") as ModdleElement;
    expression.set("body", "  \n  ");

    await expect(exportXml(model)).rejects.toThrow(/大额复核.*条件/);
  });

  it("默认支路切换后，旧默认支路必须配置条件", async () => {
    const model = exclusiveApproval();
    setBranchCondition(model, "large_flow", "");
    setDefaultBranch(model, "fork", 1);

    await expect(exportXml(model)).rejects.toThrow(/常规审批.*条件/);

    setBranchCondition(model, "routine_flow", "${amount <= 1000}");
    expect(await exportXml(model)).toContain('default="large_flow"');
  });

  it("新条件支路可保留草稿，补齐审批人和条件后可导出", async () => {
    const model = exclusiveApproval();
    const nodeId = addBranchToBlock(model, "fork");
    const flowId = branchHeadFlowId(model, "fork", 2);
    expect(flowId).toBeDefined();

    const result = await exportXml(model).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(nodeId);
    expect((result as Error).message).toContain(flowId);

    model.elementOf(nodeId).set("assignee", "${legal}");
    setBranchCondition(model, flowId!, "${amount > 2000}");
    const xml = await exportXml(model);
    expect(xml).toContain(`id="${nodeId}"`);
    expect(xml).toContain('default="routine_flow"');
  });

  it("导入模型中的默认支路若同时携带条件也不能导出", async () => {
    const model = exclusiveApproval();
    model
      .elementOf("routine_flow")
      .set(
        "conditionExpression",
        model.moddle.create("bpmn:FormalExpression", { body: "${amount <= 1000}" }),
      );

    await expect(exportXml(model)).rejects.toThrow(/默认支路.*条件/);
  });

  it("导入模型经 designer 导出时仍拦截缺少条件的支路", async () => {
    const original = exclusiveApproval();
    const imported = await parse(await exportXml(original), { adapter: flowableAdapter });
    setBranchCondition(imported, "large_flow", "");

    await expect(exportXml(imported)).rejects.toThrow(/大额复核.*条件/);
  });

  it("导入的普通循环审批节点按单签审批人校验", async () => {
    const source = singleApproval();
    source.elementOf("approval").set("assignee", "${manager}");
    source
      .elementOf("approval")
      .set("loopCharacteristics", source.moddle.create("bpmn:StandardLoopCharacteristics"));
    const imported = await parse(await compile(source, { diLayout: verticalDiLayout() }), {
      adapter: flowableAdapter,
    });

    const xml = await exportXml(imported);
    expect(xml).toContain("standardLoopCharacteristics");
    expect(xml).toContain('flowable:assignee="${manager}"');

    imported.elementOf("approval").set("assignee", undefined);
    await expect(exportXml(imported)).rejects.toThrow(/经理审批.*审批人/);
  });

  it("并行分支与普通顺序连线无需条件", async () => {
    const sequential = singleApproval();
    sequential.elementOf("approval").set("assignee", "${manager}");
    expect(await exportXml(sequential)).toContain('id="to_end"');

    const parallel = BpmnModel.create({ processId: "draft_parallel", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addParallelGateway({ id: "fork" })
      .addUserTask({ id: "finance", assignee: "${finance}" })
      .addUserTask({ id: "legal", assignee: "${legal}" })
      .addParallelGateway({ id: "join" })
      .addEndEvent({ id: "end" })
      .addSequenceFlow({ id: "entry", sourceRef: "start", targetRef: "fork" })
      .addSequenceFlow({ id: "finance_flow", sourceRef: "fork", targetRef: "finance" })
      .addSequenceFlow({ id: "legal_flow", sourceRef: "fork", targetRef: "legal" })
      .addSequenceFlow({ id: "finance_join", sourceRef: "finance", targetRef: "join" })
      .addSequenceFlow({ id: "legal_join", sourceRef: "legal", targetRef: "join" })
      .addSequenceFlow({ id: "exit", sourceRef: "join", targetRef: "end" });
    expect(await exportXml(parallel)).toContain("<bpmn:parallelGateway");
  });

  it("一次导出列出模型中的全部草稿问题且不修改模型", async () => {
    const model = exclusiveApproval();
    model.elementOf("routine").set("assignee", undefined);
    setBranchCondition(model, "large_flow", "");

    const result = await exportXml(model).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(Error);
    const message = (result as Error).message;
    expect(message).toContain("总监审批");
    expect(message).toContain("大额复核");
    expect(model.elementOf("routine").get("assignee")).toBeUndefined();
    expect(model.elementOf("large_flow").get("conditionExpression")).toBeUndefined();
    expect(model.elementOf("fork").get("default")).toBe(model.elementOf("routine_flow"));
  });
});
