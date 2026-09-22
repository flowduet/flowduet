import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { verticalDiLayout } from "../layout/vertical-layout.js";
import { parse } from "../parse/parser.js";
import { BpmnModel } from "./bpmn-model.js";

/**
 * 表单绑定占位（#25）：UserTask 的 formKey 以 flowable:formKey 扩展属性
 * 序列化（Flowable 习惯）；抽屉字段面只有这一行占位，表单协议本身属 v1。
 */

const SHAPE = { x: 140, y: 160, width: 100, height: 80 };

describe("formKey 占位（合同点二：扩展属性序列化）", () => {
  it("formKey 以方言前缀序列化，往返等价恢复", async () => {
    const model = BpmnModel.create({ processId: "form_key", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" })
      .addUserTask({ id: "t1", name: "审批", formKey: "leave_form_v1", shape: SHAPE })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain('flowable:formKey="leave_form_v1"');

    const restored = await parse(xml, { adapter: flowableAdapter });
    expect(restored.elementOf("t1").get("formKey")).toBe("leave_form_v1");
  });

  it("elementOf 直写 formKey 同样落序列化（抽屉写回路径）", async () => {
    const model = BpmnModel.create({ processId: "form_key2", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" })
      .addUserTask({ id: "t1", shape: SHAPE })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    model.elementOf("t1").set("formKey", "expense_form");
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain('flowable:formKey="expense_form"');
  });
});
