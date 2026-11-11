import type { BpmnModel, ModdleElement } from "@flowduet/core";
import { exportXml } from "../src/export.js";

/** 结构/视图测试先补齐无关的草稿字段，再验证自己关注的导出结果。 */
export async function exportConfiguredXml(model: BpmnModel): Promise<string> {
  const elements = (model.process.get("flowElements") as ModdleElement[] | undefined) ?? [];
  for (const element of elements) {
    if (element.$type === "bpmn:UserTask") {
      const loop = element.get("loopCharacteristics");
      if (loop === undefined && String(element.get("assignee") ?? "").trim() === "") {
        element.set("assignee", "${testAssignee}");
      }
    }
    if (element.$type === "bpmn:ExclusiveGateway") {
      const outgoing = (element.get("outgoing") as ModdleElement[] | undefined) ?? [];
      if (outgoing.length <= 1) continue;
      for (const flow of outgoing) {
        if (element.get("default") === flow || flow.get("conditionExpression") !== undefined) {
          continue;
        }
        flow.set(
          "conditionExpression",
          model.moddle.create("bpmn:FormalExpression", { body: "${testCondition}" }),
        );
      }
    }
  }
  return exportXml(model);
}
