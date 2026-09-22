import { describe, expect, it } from "vitest";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { compile } from "../compile/compiler.js";
import { verticalDiLayout } from "../layout/vertical-layout.js";
import { parse } from "../parse/parser.js";
import type { CcTaskSpec } from "./bpmn-model.js";
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

  it("formKey 前后空白 trim 后落盘（评审 S-1，与 assignee/ccTo 口径对齐）", async () => {
    const model = BpmnModel.create({ processId: "form_key_trim", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" })
      .addUserTask({ id: "t1", formKey: "  leave_form  ", shape: SHAPE })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "t1" })
      .addSequenceFlow({ id: "f2", sourceRef: "t1", targetRef: "end" });
    expect(model.elementOf("t1").get("formKey")).toBe("leave_form");
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain('flowable:formKey="leave_form"');
    expect(xml).not.toContain("  leave_form  ");
  });

  it("formKey 纯空白抛错，且不留半写节点（评审 S-1 前置校验）", () => {
    const model = BpmnModel.create({ processId: "form_key_blank", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" });
    expect(() => model.addUserTask({ id: "t1", formKey: "   ", shape: SHAPE })).toThrow(
      /formKey 不能为空白/,
    );
    // 前置校验：#addNode 未被调用，节点未登记
    expect(() => model.elementOf("t1")).toThrow(/不存在/);
  });

  it("addApprovalTask formKey 纯空白抛错，节点未登记（评审 S-1 前置校验）", () => {
    const model = BpmnModel.create({ processId: "form_key_apr", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" });
    expect(() =>
      model.addApprovalTask({
        id: "mi1",
        collection: "approvers",
        mode: "all",
        formKey: "  ",
      }),
    ).toThrow(/formKey 不能为空白/);
    expect(() => model.elementOf("mi1")).toThrow(/不存在/);
  });
});

describe("formKey 元素类型守卫（评审 C-2：适配器合同）", () => {
  /**
   * 只有 UserTask 的方言描述符声明了 formKey 扩展属性；ServiceTask / ScriptTask 上
   * 直写会落进 moddle $attrs、序列化时丢掉 flowable 前缀，产出 schema 非法 XML
   * （引擎侧静默忽略，严格校验器报未知属性）。addTask 的元素类型守卫与相邻
   * assignee 守卫对称，前置校验保证抛错时不留半写节点。
   */
  it("addTask('cc', { formKey }) 抛错，节点未登记", () => {
    const model = BpmnModel.create({ processId: "form_key_cc", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" });
    // JS 调用方绕过 TS 类型将 formKey 传给 cc 任务（CcTaskSpec 本身不开放该字段）：
    // 内核必须运行时拦截，避免产出无前缀 formKey 属性的非法 XML
    const spec = { id: "cc1", recipients: "张三", formKey: "cc_form" } as unknown as CcTaskSpec;
    expect(() => model.addTask("cc", spec)).toThrow(/不支持 formKey/);
    expect(() => model.elementOf("cc1")).toThrow(/不存在/);
  });

  it("addTask('mail', { formKey }) 抛错，节点未登记", () => {
    const model = BpmnModel.create({ processId: "form_key_mail", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" });
    expect(() => model.addTask("mail", { id: "mail1", formKey: "mail_form" })).toThrow(
      /不支持 formKey/,
    );
    expect(() => model.elementOf("mail1")).toThrow(/不存在/);
  });

  it("addTask('service', { formKey }) 抛错，节点未登记", () => {
    const model = BpmnModel.create({ processId: "form_key_svc", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" });
    expect(() => model.addTask("service", { id: "svc1", formKey: "svc_form" })).toThrow(
      /不支持 formKey/,
    );
    expect(() => model.elementOf("svc1")).toThrow(/不存在/);
  });

  it("addTask('script', { formKey }) 抛错，节点未登记", () => {
    const model = BpmnModel.create({ processId: "form_key_scr", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" });
    expect(() => model.addTask("script", { id: "scr1", formKey: "scr_form" })).toThrow(
      /不支持 formKey/,
    );
    expect(() => model.elementOf("scr1")).toThrow(/不存在/);
  });

  it("addTask('user', { formKey }) 正常写入 UserTask（对照用例）", async () => {
    const model = BpmnModel.create({ processId: "form_key_user", adapter: flowableAdapter })
      .addStartEvent({ id: "start" })
      .addEndEvent({ id: "end" })
      .addTask("user", { id: "u1", formKey: "user_form", shape: SHAPE })
      .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "u1" })
      .addSequenceFlow({ id: "f2", sourceRef: "u1", targetRef: "end" });
    const xml = await compile(model, { diLayout: verticalDiLayout() });
    expect(xml).toContain('flowable:formKey="user_form"');
  });
});
