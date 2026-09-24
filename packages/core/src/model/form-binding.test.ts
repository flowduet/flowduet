import { describe, expect, it } from "vitest";
import type { EngineAdapter } from "../adapter/engine-adapter.js";
import { flowableAdapter } from "../adapter/flowable-adapter.js";
import { BpmnModel } from "./bpmn-model.js";
import { compile } from "../compile/compiler.js";
import { verticalDiLayout } from "../layout/vertical-layout.js";
import { parse } from "../parse/parser.js";
import { buildDefaultFormFlow } from "../compile/__fixtures__/default-form.js";
import { resolveEffectiveForm } from "./form-binding.js";

/**
 * 默认表单绑定合同（#72，ADR-0009）：
 * flowduet:defaultFormKey 落在 process、往返保真、继承不固化；
 * 有效表单解析显式优先；flowduet 前缀冲突明确拒绝。
 */

/** 只为冲突测试用的假适配器：占用 flowduet 前缀 */
const conflictingAdapter: EngineAdapter = {
  id: "conflicting",
  namespacePrefix: "flowable",
  additionalPackages: { flowduet: { name: "Other", uri: "urn:other", prefix: "flowduet" } },
  taskTypeMapping: flowableAdapter.taskTypeMapping,
};

function buildModel(): BpmnModel {
  return BpmnModel.create({ processId: "binding_flow", adapter: flowableAdapter })
    .addStartEvent({ id: "start" })
    .addUserTask({ id: "solo", name: "单签", assignee: "${m}" })
    .addApprovalTask({ id: "counter", name: "会签", collection: "approvers", mode: "all" })
    .addTask("cc", { id: "cc_1", name: "抄送", recipients: "张三" })
    .addExclusiveGateway({ id: "fork" })
    .addEndEvent({ id: "end" })
    .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "solo" })
    .addSequenceFlow({ id: "f2", sourceRef: "solo", targetRef: "counter" })
    .addSequenceFlow({ id: "f3", sourceRef: "counter", targetRef: "cc_1" })
    .addSequenceFlow({ id: "f4", sourceRef: "cc_1", targetRef: "fork" })
    .addSequenceFlow({ id: "f5", sourceRef: "fork", targetRef: "end" });
}

describe("defaultFormKey 访问器", () => {
  it("写入 trim 后落盘；空白拒绝；undefined 清除", () => {
    const model = buildModel();
    expect(model.defaultFormKey).toBeUndefined();
    model.setDefaultFormKey("  leave_form_v1  ");
    expect(model.defaultFormKey).toBe("leave_form_v1");
    expect(() => model.setDefaultFormKey("   ")).toThrow("不能为空白");
    model.setDefaultFormKey(undefined);
    expect(model.defaultFormKey).toBeUndefined();
  });
});

describe("默认绑定往返（compile → parse 语义等价）", () => {
  it("process 默认 key 与显式节点 key 等价恢复；继承节点不固化 formKey", async () => {
    const first = await compile(buildDefaultFormFlow());
    expect(first).toContain('flowduet:defaultFormKey="leave_form_v1"');
    // 多实例节点继承默认：XML 上没有逐节点固化的 formKey
    expect(first).toContain('<bpmn:userTask id="counter_sign" name="部门会签"');

    const model = await parse(first, { adapter: flowableAdapter });
    expect(model.defaultFormKey).toBe("leave_form_v1");
    expect(String(model.elementOf("solo_approval").get("formKey"))).toBe("manager_form_v1");
    expect(model.elementOf("counter_sign").get("formKey")).toBeUndefined();

    expect(await compile(model)).toBe(first);
  });

  it("未使用默认绑定的模型输出不含 flowduet 命名空间声明", async () => {
    // 零坐标建模走竖排布局推导（与 exportXml 同一口径）；targetNamespace
    // 的默认值含 "flowduet.dev" 字样，断言只看命名空间声明与属性本身
    const xml = await compile(buildModel(), { diLayout: verticalDiLayout() });
    expect(xml).not.toContain("xmlns:flowduet");
    expect(xml).not.toContain("urn:flowduet");
    expect(xml).not.toContain("defaultFormKey");
  });
});

describe("resolveEffectiveForm 有效表单解析", () => {
  it("显式覆盖优先，否则继承默认，均无则无表单", () => {
    const model = buildModel();
    model.setDefaultFormKey("leave_form_v1");
    model.elementOf("solo").set("formKey", "manager_form_v1");

    expect(resolveEffectiveForm(model, "solo")).toEqual({ source: "node", key: "manager_form_v1" });
    expect(resolveEffectiveForm(model, "counter")).toEqual({
      source: "default",
      key: "leave_form_v1",
    });

    model.setDefaultFormKey(undefined);
    expect(resolveEffectiveForm(model, "counter")).toEqual({ source: "none", key: undefined });
  });

  it("或签与依次形态同样参与默认继承，显式覆盖优先", () => {
    // 三种多人形态同构落 bpmn:UserTask（会签已由上例覆盖），逐一验证
    for (const mode of ["any", "sequential"] as const) {
      const model = BpmnModel.create({ processId: `mi_${mode}`, adapter: flowableAdapter })
        .addStartEvent({ id: "start" })
        .addApprovalTask({ id: "multi", name: "多人", collection: "approvers", mode })
        .addEndEvent({ id: "end" })
        .addSequenceFlow({ id: "f1", sourceRef: "start", targetRef: "multi" })
        .addSequenceFlow({ id: "f2", sourceRef: "multi", targetRef: "end" });
      model.setDefaultFormKey("leave_form_v1");
      expect(resolveEffectiveForm(model, "multi")).toEqual({
        source: "default",
        key: "leave_form_v1",
      });
      model.elementOf("multi").set("formKey", "override_form");
      expect(resolveEffectiveForm(model, "multi")).toEqual({
        source: "node",
        key: "override_form",
      });
    }
  });

  it("网关与抄送不参与解析，即使设置了流程默认", () => {
    const model = buildModel();
    model.setDefaultFormKey("leave_form_v1");
    expect(resolveEffectiveForm(model, "fork")).toEqual({ source: "none", key: undefined });
    expect(resolveEffectiveForm(model, "cc_1")).toEqual({ source: "none", key: undefined });
  });
});

describe("flowduet 前缀冲突拒绝", () => {
  it("创建与解析路径统一拒绝占用 flowduet 前缀的适配器", async () => {
    expect(() => BpmnModel.create({ processId: "x", adapter: conflictingAdapter })).toThrow(
      "拒绝合并",
    );
    await expect(parse("<bpmn:definitions/>", { adapter: conflictingAdapter })).rejects.toThrow(
      "拒绝合并",
    );
  });
});
