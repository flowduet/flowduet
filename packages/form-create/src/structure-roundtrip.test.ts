import { describe, expect, it } from "vitest";
import { BpmnModel, flowableAdapter, type ModdleElement } from "@flowduet/core";
import {
  convertApprovalToMulti,
  convertMultiToSingle,
  removeApprovalNode,
  removeBlock,
} from "../../designer/src/operations.js";
import { openDesignDocument, saveDesignDocument, type FormDefinition } from "./document.js";

function branch(mode: "condition" | "default") {
  const m = BpmnModel.create({ processId: "branch_save", adapter: flowableAdapter });
  m.addStartEvent({ id: "s" })
    .addExclusiveGateway({ id: "fork" })
    .addUserTask({ id: "a", formKey: "form_1" })
    .addUserTask({ id: "tail", formKey: "form_1" })
    .addUserTask({ id: "b" })
    .addExclusiveGateway({ id: "join" })
    .addEndEvent({ id: "e" });
  m.addSequenceFlow({ id: "sf", sourceRef: "s", targetRef: "fork" })
    .addSequenceFlow({
      id: "fa",
      name: "采购",
      sourceRef: "fork",
      targetRef: "a",
      ...(mode === "condition" ? { condition: "${amount > 100}" } : { default: true }),
    })
    .addSequenceFlow({ id: "at", sourceRef: "a", targetRef: "tail" })
    .addSequenceFlow({ id: "tj", sourceRef: "tail", targetRef: "join" })
    .addSequenceFlow({ id: "fb", sourceRef: "fork", targetRef: "b" })
    .addSequenceFlow({ id: "bj", sourceRef: "b", targetRef: "join" })
    .addSequenceFlow({ id: "je", sourceRef: "join", targetRef: "e" });
  m.process.set("defaultFormKey", "form_1");
  return m;
}
const forms: FormDefinition[] = [
  { id: "form_1", name: "申请", provider: "form-create/element-plus", rules: "[]", options: "{}" },
];

describe("结构编辑后设计文档往返", () => {
  for (const mode of ["condition", "default"] as const) {
    for (const deletion of ["node", "block"] as const) {
      it(`${mode} ${deletion} 编辑后反复保存恢复保持支路与表单`, async () => {
        let m = branch(mode);
        if (deletion === "block") {
          m.addParallelGateway({ id: "inner" })
            .addParallelGateway({ id: "ij" })
            .addUserTask({ id: "i1" })
            .addUserTask({ id: "i2" });
          m.retargetSequenceFlow("fa", "inner");
          m.removeNode("a");
          for (const [id, sourceRef, targetRef] of [
            ["ii1", "inner", "i1"],
            ["ii2", "inner", "i2"],
            ["i1j", "i1", "ij"],
            ["i2j", "i2", "ij"],
            ["jt", "ij", "tail"],
          ] as const) {
            m.addSequenceFlow({ id, sourceRef, targetRef });
          }
          removeBlock(m, "inner");
        } else {
          convertApprovalToMulti(m, "a", { collection: "people", mode: "any" });
          convertMultiToSingle(m, "a");
          expect(m.elementOf("a").get("formKey")).toBe("form_1");
          removeApprovalNode(m, "a");
        }
        for (let i = 0; i < 2; i++) {
          const saved = await saveDesignDocument(m, forms);
          const opened = await openDesignDocument(saved.json);
          m = opened.model;
          expect(opened.forms).toEqual(forms);
          const head = m.elementOf("fa");
          expect(head.get("name")).toBe("采购");
          expect(head.get("targetRef")).toBe(m.elementOf("tail"));
          expect(
            (m.elementOf("fork").get("outgoing") as ModdleElement[]).map((e) => e.get("id")),
          ).toEqual(["fa", "fb"]);
          if (mode === "condition")
            expect((head.get("conditionExpression") as ModdleElement).get("body")).toBe(
              "${amount > 100}",
            );
          else expect(m.elementOf("fork").get("default")).toBe(head);
          expect(m.process.get("defaultFormKey")).toBe("form_1");
          expect(m.elementOf("tail").get("formKey")).toBe("form_1");
          const ids = (m.process.get("flowElements") as ModdleElement[]).map((e) => e.get("id"));
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids).not.toContain("a");
        }
      });
    }
  }
});
