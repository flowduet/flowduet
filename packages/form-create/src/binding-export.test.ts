import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter } from "@flowduet/core";
import type { FormDefinition } from "./document.js";
import { collectReferenceIssues } from "./binding.js";
import { exportDeployXml } from "./export.js";

/**
 * 组合部署导出（#72）：流程校验（designer 草稿拦截）+ 表单目录引用完整性，
 * 两类问题合并呈报；无表单无引用 = 原 exportXml 合同。
 */

function buildConfiguredFlow(): BpmnModel {
  return BpmnModel.create({ processId: "deploy_flow", adapter: flowableAdapter })
    .addStartEvent({ id: "start", name: "开始" })
    .addUserTask({ id: "solo", name: "经理审批", assignee: "${manager}" })
    .addEndEvent({ id: "end", name: "结束" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "solo" })
    .addSequenceFlow({ id: "f2", sourceRef: "solo", targetRef: "end" });
}

function buildDraftFlow(): BpmnModel {
  const model = buildConfiguredFlow();
  model.elementOf("solo").set("assignee", undefined);
  return model;
}

const FORM: FormDefinition = {
  id: "form_apply",
  name: "申请单",
  provider: "form-create/element-plus",
  rules: "[]",
  options: "{}",
};

describe("collectReferenceIssues", () => {
  it("默认与节点 key 均有效时无问题；节点失效与默认失效分别定位", () => {
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("form_apply");
    model.elementOf("solo").set("formKey", "form_apply");
    expect(collectReferenceIssues(model, [FORM])).toEqual([]);

    model.elementOf("solo").set("formKey", "ghost_form");
    const issues = collectReferenceIssues(model, [FORM]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("solo");
    expect(issues[0]).toContain("ghost_form");
  });

  it("A18：默认 key 失效即使节点全部显式覆盖也报出", () => {
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("ghost_default");
    model.elementOf("solo").set("formKey", "form_apply");
    const issues = collectReferenceIssues(model, [FORM]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("ghost_default");
  });
});

describe("exportDeployXml", () => {
  it("引用有效且配置完整：产出含默认引用的部署 XML", async () => {
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("form_apply");
    const xml = await exportDeployXml(model, [FORM]);
    expect(xml).toContain('flowduet:defaultFormKey="form_apply"');
  });

  it("引用失效阻断部署导出，即使流程配置完整（A18）", async () => {
    const model = buildConfiguredFlow();
    model.setDefaultFormKey("ghost_default");
    await expect(exportDeployXml(model, [FORM])).rejects.toThrow("ghost_default");
  });

  it("草稿与引用问题合并呈报", async () => {
    const model = buildDraftFlow();
    model.elementOf("solo").set("formKey", "ghost_form");
    await expect(exportDeployXml(model, [FORM])).rejects.toThrow(/ghost_form[\s\S]*审批人为空白/);
  });

  it("无表单无引用：与原 exportXml 同合同，放行完整流程、拦截草稿", async () => {
    await expect(exportDeployXml(buildConfiguredFlow(), [])).resolves.toContain("bpmn:process");
    await expect(exportDeployXml(buildDraftFlow(), [])).rejects.toThrow("审批人为空白");
  });
});
